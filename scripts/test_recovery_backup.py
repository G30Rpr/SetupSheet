"""Offline failure-path tests. Fixtures do not exercise real encryption or production."""
import importlib.util
import os
from pathlib import Path
import sys
sys.dont_write_bytecode = True
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("prepare-recovery-backup.py"))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
verify_spec = importlib.util.spec_from_file_location("verify", Path(__file__).with_name("verify-recovery-export.py"))
verifier = importlib.util.module_from_spec(verify_spec)
verify_spec.loader.exec_module(verifier)


class BackupSafetyTests(unittest.TestCase):
    def test_direct_and_session_sources(self):
        for uri in [f"postgresql://postgres:p%40ss@db.{backup.PRODUCTION}.supabase.co:5432/postgres",
                    f"postgresql://postgres.{backup.PRODUCTION}:p%40ss@aws-0-us-east-2.pooler.supabase.com:5432/postgres"]:
            env = backup.source_environment(uri)
            self.assertEqual(env["PGPASSWORD"], "p@ss")
            self.assertEqual(env["PGSSLMODE"], "require")
            self.assertIn("default_transaction_read_only=on", env["PGOPTIONS"])

    def test_connection_overrides_are_removed(self):
        with patch.dict(os.environ, {"PGHOSTADDR": "8.8.8.8", "PGSERVICE": "other", "PGOPTIONS": "unsafe"}):
            env = backup.source_environment(f"postgres://postgres:p@db.{backup.PRODUCTION}.supabase.co/postgres")
        self.assertNotIn("PGHOSTADDR", env)
        self.assertNotIn("PGSERVICE", env)

    def test_wrong_destinations_and_unsafe_options_are_refused(self):
        uris = ["postgres://postgres:p@db.hhckfwvspmexobzfxnak.supabase.co/postgres",
                "postgres://postgres:p@evil.example/postgres",
                f"postgres://postgres.{backup.PRODUCTION}:p@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
                f"postgres://postgres:p@db.{backup.PRODUCTION}.supabase.co/postgres?hostaddr=8.8.8.8",
                f"postgres://postgres:p@db.{backup.PRODUCTION}.supabase.co/postgres?sslmode=disable",
                f"postgres://postgres@db.{backup.PRODUCTION}.supabase.co/postgres"]
        for uri in uris:
            with self.subTest(uri=uri), self.assertRaises(ValueError):
                backup.source_environment(uri)

    def test_partial_ciphertext_removed_on_producer_failure(self):
        def failed():
            yield b"partial dummy data"
            raise RuntimeError("fixture failure")
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "partial.age"
            # cat is an intentionally NON-encrypting subprocess fixture.
            real_popen = backup.subprocess.Popen
            with patch.object(backup.subprocess, "Popen", side_effect=lambda command, **kw: real_popen(["cat"], **kw)):
                with self.assertRaises(RuntimeError):
                    backup.encrypt_chunks(failed(), dest, "dummy")
            self.assertFalse(dest.exists())

    def test_encryption_failure_removes_partial_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "partial.age"
            real_popen = backup.subprocess.Popen
            with patch.object(backup.subprocess, "Popen", side_effect=lambda command, **kw: real_popen(["sh", "-c", "cat; exit 1"], **kw)):
                with self.assertRaises(RuntimeError):
                    backup.encrypt_chunks([b"dummy"], dest, "dummy")
            self.assertFalse(dest.exists())

    def test_export_failure_or_empty_output_refused(self):
        for code in ["pass", "import sys; sys.stdout.write('partial'); sys.exit(1)"]:
            with self.subTest(code=code), self.assertRaises(RuntimeError):
                list(backup.command_chunks([sys.executable, "-c", code]))

    def test_subprocess_errors_do_not_disclose_secret(self):
        with self.assertRaises(RuntimeError) as raised:
            list(backup.command_chunks([sys.executable, "-c", "import sys; sys.stderr.write('FAKE_SECRET'); sys.exit(1)"]))
        self.assertNotIn("FAKE_SECRET", str(raised.exception))

    def test_storage_redirects_refused(self):
        with self.assertRaises(RuntimeError):
            backup.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://other.example")

    def test_existing_ciphertext_is_never_deleted_or_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "existing.age"
            dest.write_bytes(b"existing backup")
            with self.assertRaises(FileExistsError):
                backup.encrypt_chunks([b"replacement"], dest, "dummy")
            self.assertEqual(dest.read_bytes(), b"existing backup")

    def run_fixture_export(self, tmp, fail_download=False):
        source = {"vault_secret_count": 0, "objects": [{"bucket_id": "setup-files", "name": "../../private", "metadata": {"size": 7}}],
                  "public_tables": ["profiles"], "buckets": [], "migrations": []}
        def chunks(obj, key, record):
            yield b"fixture"
            if fail_download:
                raise RuntimeError("download fixture failed")
            record.update(sha256=backup.hashlib.sha256(b"fixture").hexdigest(), bytes=7)
        def sql_chunks(command, env=None):
            self.assertNotIn("PGHOSTADDR", env)
            self.assertNotIn("PGSERVICE", env)
            self.assertEqual(env["PGHOST"], f"db.{backup.PRODUCTION}.supabase.co")
            yield b"-- SQL fixture"
        real_popen = backup.subprocess.Popen
        with patch.object(sys, "argv", ["backup", "--output", tmp, "--recipient", "dummy"]), \
                patch.object(backup.shutil, "which", return_value="fixture"), \
                patch.object(backup.subprocess, "run", return_value=types.SimpleNamespace(stdout="3.1.0")), \
                patch.object(backup.getpass, "getpass", side_effect=[f"postgres://postgres:fake@db.{backup.PRODUCTION}.supabase.co/postgres", "fake-storage-key"]), \
                patch.object(backup, "inventory", return_value=source), \
                patch.object(backup, "query_json", return_value=5), \
                patch.object(backup, "command_chunks", side_effect=sql_chunks), \
                patch.object(backup, "download_chunks", side_effect=chunks), \
                patch.object(backup.subprocess, "Popen", side_effect=lambda command, **kw: real_popen(["cat"], **kw)):
            backup.main()

    def test_complete_export_has_manifest_and_safe_local_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous_umask = os.umask(0o077)
            try:
                self.run_fixture_export(tmp)
            finally:
                os.umask(previous_umask)
            dest = next(Path(tmp).iterdir())
            self.assertTrue((dest / "COMPLETE.json").is_file())
            self.assertFalse((dest / "INCOMPLETE").exists())
            self.assertTrue((dest / "object-000000.age").is_file())
            # Fixture encryptor is cat: inspect only synthetic content here.
            manifest = backup.json.loads((dest / "manifest.json.age").read_text())
            self.assertEqual(manifest["objects"][0]["bytes"], 7)
            self.assertEqual(manifest["counts_after_export"]["auth.users"], 5)

    def test_download_failure_keeps_incomplete_marker_and_no_complete_claim(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous_umask = os.umask(0o077)
            try:
                with self.assertRaises(RuntimeError):
                    self.run_fixture_export(tmp, fail_download=True)
            finally:
                os.umask(previous_umask)
            dest = next(Path(tmp).iterdir())
            self.assertTrue((dest / "INCOMPLETE").is_file())
            self.assertFalse((dest / "COMPLETE.json").exists())
            self.assertFalse((dest / "object-000000.age").exists())

    def test_offline_verifier_accepts_fixture_and_rejects_corruption(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous_umask = os.umask(0o077)
            try:
                self.run_fixture_export(tmp)
            finally:
                os.umask(previous_umask)
            dest = next(Path(tmp).iterdir())
            real_popen = verifier.subprocess.Popen
            with patch.object(verifier.subprocess, "Popen", side_effect=lambda command, **kw: real_popen(["cat", command[-1]], **kw)):
                verifier.verify(dest, Path("dummy"))
                (dest / "object-000000.age").write_bytes(b"corrupt")
                with self.assertRaises(ValueError):
                    verifier.verify(dest, Path("dummy"))

    def test_offline_verifier_rejects_incomplete_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "INCOMPLETE").touch()
            with self.assertRaises(ValueError):
                verifier.verify(Path(tmp), Path("dummy"))

    def test_offline_verifier_rejects_decryption_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous_umask = os.umask(0o077)
            try:
                self.run_fixture_export(tmp)
            finally:
                os.umask(previous_umask)
            real_popen = verifier.subprocess.Popen
            with patch.object(verifier.subprocess, "Popen", side_effect=lambda command, **kw: real_popen(["sh", "-c", "exit 1"], **kw)):
                with self.assertRaises(RuntimeError):
                    verifier.verify(next(Path(tmp).iterdir()), Path("dummy"))


if __name__ == "__main__":
    unittest.main()
