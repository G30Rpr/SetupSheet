#!/usr/bin/env python3
"""Operator-only, read-only export. No restore or hosted changes.

Requires Python 3.10+, Supabase CLI 3.1.0, Docker, psql 17+, and age.
Prompts for secrets locally; never prints subprocess errors or database URLs.
Only encrypted backup contents are written. A completed export is NOT a verified restore.
"""
import argparse
import datetime as dt
import getpass
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

PRODUCTION = "vbrjblpurbpvpqlepxtc"
ORIGIN = f"https://{PRODUCTION}.supabase.co"


def source_environment(url):
    p = urllib.parse.urlsplit(url)
    user = urllib.parse.unquote(p.username or "")
    direct = p.hostname == f"db.{PRODUCTION}.supabase.co" and user == "postgres"
    pooler = (p.hostname or "").endswith(".pooler.supabase.com") and user == f"postgres.{PRODUCTION}"
    query = urllib.parse.parse_qs(p.query, keep_blank_values=True)
    if (p.scheme not in ("postgres", "postgresql") or not (direct or pooler)
            or p.port not in (None, 5432) or p.path != "/postgres" or p.fragment
            or set(query) - {"sslmode"}
            or query.get("sslmode", ["require"]) not in (["require"], ["verify-full"])):
        raise ValueError("Use production's direct or SESSION-pooler postgres URI on port 5432, with no connection overrides.")
    if not p.password:
        raise ValueError("The connection URI must contain the database password (URL-encoded).")
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    env.update(PGHOST=p.hostname, PGPORT="5432", PGUSER=user, PGDATABASE="postgres",
               PGPASSWORD=urllib.parse.unquote(p.password), PGSSLMODE=query.get("sslmode", ["require"])[0],
               PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000")
    return env


def query_json(sql, env):
    result = subprocess.run(["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if result.returncode:
        raise RuntimeError("Read-only database inventory failed; details suppressed to protect credentials.")
    return json.loads(result.stdout)


def encrypt_chunks(chunks, dest, recipient):
    """Delete partial ciphertext on producer OR encryption failure."""
    created = False
    try:
        with dest.open("xb") as output:
            created = True
            proc = subprocess.Popen(["age", "--recipient", recipient], stdin=subprocess.PIPE,
                                    stdout=output, stderr=subprocess.DEVNULL)
            try:
                for chunk in chunks:
                    proc.stdin.write(chunk)
                proc.stdin.close()
                if proc.wait() != 0:
                    raise RuntimeError("Encryption failed.")
            except BaseException:
                proc.kill()
                proc.wait()
                raise
            finally:
                if not proc.stdin.closed:
                    try:
                        proc.stdin.close()
                    except BrokenPipeError:
                        pass
    except BaseException:
        if created:
            dest.unlink(missing_ok=True)
        raise


def command_chunks(command, env=None):
    proc = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        size = 0
        while chunk := proc.stdout.read(1024 * 1024):
            size += len(chunk)
            yield chunk
        if proc.wait() != 0:
            raise RuntimeError("Supabase export failed; command details suppressed to protect credentials.")
        if not size:
            raise RuntimeError("Supabase export returned no SQL; refusing an empty backup component.")
    finally:
        proc.stdout.close()
        if proc.poll() is None:
            proc.kill()
        proc.wait()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Storage redirect refused; credentials were not forwarded.")


def download_chunks(obj, key, summary):
    encoded = "/".join(urllib.parse.quote(v, safe="") for v in [obj["bucket_id"], *obj["name"].split("/")])
    req = urllib.request.Request(f"{ORIGIN}/storage/v1/object/authenticated/{encoded}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    digest = hashlib.sha256()
    size = 0
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=120) as response:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
            yield chunk
    expected = (obj.get("metadata") or {}).get("size")
    if expected is not None and size != int(expected):
        raise RuntimeError("Storage object size changed or download was incomplete. Retry during a write pause.")
    summary.update(sha256=digest.hexdigest(), bytes=size)


def inventory(env):
    # All customer content stays in process memory or encrypted artifacts.
    return query_json("""SELECT jsonb_build_object(
      'objects',(SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY bucket_id,name),'[]') FROM storage.objects o),
      'buckets',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]') FROM storage.buckets b),
      'vault_secret_count',(SELECT count(*) FROM vault.secrets),
      'managed_policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname),'[]') FROM pg_policies p WHERE schemaname IN ('auth','storage')),
      'managed_triggers',(SELECT coalesce(jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.oid),'[]') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('auth','storage') AND NOT t.tgisinternal),
      'managed_functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'signature',p.oid::regprocedure::text) ORDER BY p.oid),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage')),
      'migrations',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations m),
      'public_tables',(SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r')
    )""", env)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="Private independent backup directory; a new timestamped child is created.")
    parser.add_argument("--recipient", required=True, help="age PUBLIC recipient; keep its private identity elsewhere.")
    args = parser.parse_args()
    os.umask(0o077)
    for tool in ("supabase", "psql", "age", "docker"):
        if not shutil.which(tool):
            raise RuntimeError(f"Install required tool: {tool}")
    version = subprocess.run(["supabase", "--version"], capture_output=True, text=True, check=True).stdout.strip()
    if version != "3.1.0":
        raise RuntimeError("This helper was checked against Supabase CLI 3.1.0; install that version before proceeding.")
    db_url = getpass.getpass("Production postgres connection URI (hidden): ")
    env = source_environment(db_url)
    storage_key = getpass.getpass("Production legacy service_role key for Storage downloads (hidden): ")
    if not storage_key:
        raise ValueError("Storage credential is required for a complete independent export.")
    before = inventory(env)
    if before["vault_secret_count"]:
        raise RuntimeError("Vault secrets exist: prepare root-key recovery separately before using this helper.")
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = args.output.expanduser().resolve() / f"setupsheet-{now}"
    dest.mkdir(parents=True, exist_ok=False, mode=0o700)
    # A marker remains on any failure; only a complete export receives COMPLETE.json.
    (dest / "INCOMPLETE").write_text("Do not use as a complete recovery backup.\n")
    encrypt_chunks([b"encryption preflight"], dest / "encryption-check.age", args.recipient)
    exports = {
        "roles.sql.age": ["--role-only"],
        "schema.sql.age": [],
        "data.sql.age": ["--data-only", "--use-copy", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes"],
        "history-schema.sql.age": ["--schema", "supabase_migrations"],
        "history-data.sql.age": ["--schema", "supabase_migrations", "--data-only", "--use-copy"],
    }
    for filename, flags in exports.items():
        print(f"Exporting {filename}...", flush=True)
        chunks = command_chunks(["supabase", "db", "dump", f"--remote={db_url}", "--log-level", "error", *flags], env=env)
        try:
            encrypt_chunks(chunks, dest / filename, args.recipient)
        finally:
            chunks.close()
    records = []
    for i, obj in enumerate(before["objects"]):
        filename = f"object-{i:06d}.age"  # Object names never become local paths.
        record = {"ciphertext": filename, "source": obj}
        encrypt_chunks(download_chunks(obj, storage_key, record), dest / filename, args.recipient)
        records.append(record)
        print(f"Encrypted Storage object {i + 1}/{len(before['objects'])}", flush=True)
    after = inventory(env)
    if before != after:
        raise RuntimeError("Source inventory changed during export. Keep this incomplete set and rerun during a coordinated write pause.")
    counts = {}
    for table in before["public_tables"]:
        ident = '"' + table.replace('"', '""') + '"'
        counts[f"public.{table}"] = query_json(f"SELECT count(*) FROM public.{ident}", env)
    for table in ("auth.users", "auth.identities", "storage.objects"):
        counts[table] = query_json(f"SELECT count(*) FROM {table}", env)
    manifest = {"project": PRODUCTION, "started_utc": now, "counts_after_export": counts,
                "inventory": before, "objects": records,
                "limitations": ["Separate SQL dumps are not a single coordinated snapshot; rehearse restore and use a coordinated write pause for the release backup.",
                                "Managed Auth/Storage schema customizations need separate review and restoration.",
                                "OAuth secrets, project settings, functions and encryption root keys are not included."]}
    encrypt_chunks([json.dumps(manifest).encode()], dest / "manifest.json.age", args.recipient)
    checksums = {}
    for path in sorted(dest.glob("*.age")):
        digest = hashlib.sha256()
        with path.open("rb") as encrypted:
            while chunk := encrypted.read(1024 * 1024):
                digest.update(chunk)
        checksums[path.name] = digest.hexdigest()
    (dest / "COMPLETE.json").write_text(json.dumps({"project": PRODUCTION, "files": checksums,
        "status": "EXPORT_COMPLETE_RESTORE_UNVERIFIED"}, indent=2) + "\n")
    (dest / "INCOMPLETE").unlink()
    print(f"Encrypted export complete: {dest}\nRESTORE IS UNVERIFIED. Keep the private key separately and copy this directory outside Supabase.")


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        # Raw exceptions may contain object paths, URLs, credentials, or API response bodies.
        safe = str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__
        print(f"Export stopped: {safe}", file=sys.stderr)
        sys.exit(1)
