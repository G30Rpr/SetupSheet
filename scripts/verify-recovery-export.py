#!/usr/bin/env python3
"""Offline decryptability, copy-integrity and Storage-byte checks. NOT a restore test."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


def plaintext(path, identity):
    proc = subprocess.Popen(["age", "--decrypt", "--identity", str(identity), str(path)],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while chunk := proc.stdout.read(1024 * 1024):
            yield chunk
        if proc.wait() != 0:
            raise RuntimeError("Decryption failed. Check the identity and backup copy locally.")
    finally:
        proc.stdout.close()
        if proc.poll() is None:
            proc.kill()
        proc.wait()


def digest(chunks):
    checksum = hashlib.sha256()
    size = 0
    for chunk in chunks:
        checksum.update(chunk)
        size += len(chunk)
    return checksum.hexdigest(), size


def verify(directory, identity):
    directory = directory.resolve()
    if (directory / "INCOMPLETE").exists():
        raise ValueError("An INCOMPLETE marker remains. Refusing this backup set.")
    complete = json.loads((directory / "COMPLETE.json").read_text())
    if complete.get("status") != "EXPORT_COMPLETE_RESTORE_UNVERIFIED":
        raise ValueError("Unexpected export status.")
    files = complete["files"]
    required = {"roles.sql.age", "schema.sql.age", "data.sql.age", "history-schema.sql.age",
                "history-data.sql.age", "manifest.json.age", "encryption-check.age"}
    if not required <= set(files):
        raise ValueError("Required export components are missing.")
    for name, expected in files.items():
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*\.age", name):
            raise ValueError("Unsafe ciphertext filename.")
        path = directory / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Missing or linked ciphertext file.")
        with path.open("rb") as f:
            actual, size = digest(iter(lambda: f.read(1024 * 1024), b""))
        if actual != expected or size == 0:
            raise ValueError("Ciphertext copy-integrity check failed.")
    content = bytearray()
    chunks = plaintext(directory / "manifest.json.age", identity)
    try:
        for chunk in chunks:
            content.extend(chunk)
            if len(content) > 64 * 1024 * 1024:
                raise ValueError("Manifest exceeds the verifier's 64 MiB memory limit.")
    finally:
        chunks.close()
    manifest = json.loads(content)
    if manifest["project"] != complete["project"]:
        raise ValueError("Backup project identifiers disagree.")
    objects = {item["ciphertext"]: item for item in manifest["objects"]}
    if len(objects) != len(manifest["objects"]) or set(files) != required | set(objects):
        raise ValueError("Storage manifest and ciphertext file list disagree.")
    for name in sorted(set(files) - {"manifest.json.age"}):
        actual, size = digest(plaintext(directory / name, identity))
        if not size and name not in objects:
            raise ValueError("An SQL or encryption-check component decrypts to empty content.")
        if name in objects and (actual != objects[name]["sha256"] or size != objects[name]["bytes"]):
            raise ValueError("Restored Storage byte checksum or size does not match the manifest.")
    print(f"Offline verification passed: {len(files)} encrypted artifacts, {len(objects)} Storage objects.")
    print("COPY INTEGRITY AND DECRYPTABILITY ONLY. A successful isolated database/app restore is still required.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--identity", required=True, type=Path)
    args = parser.parse_args()
    try:
        verify(args.directory, args.identity)
    except (Exception, KeyboardInterrupt) as error:
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__
        print(f"Verification stopped: {message}", file=sys.stderr)
        sys.exit(1)
