"""Cache the pinned GenVM runner bundle under the name gltest expects.

genlayer-test 0.29.2 looks for ``genvm-universal.tar.xz`` while GenVM
v0.3.0-rc7 publishes the runner-only equivalent as
``genvm-runners-all.tar.xz``. Keep this compatibility shim until gltest ships
support for the new asset name.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
import urllib.request
from pathlib import Path

GENVM_VERSION = "v0.3.0-rc7"
RUNNER_BUNDLE_SHA256 = "e218a1854214681560351051f76fe2b878545cf3409455ef372d57014a88ca67"
RUNNER_BUNDLE_URL = (
    "https://github.com/genlayerlabs/genvm/releases/download/"
    f"{GENVM_VERSION}/genvm-runners-all.tar.xz"
)
CACHE_DIR = Path.home() / ".cache" / "gltest-direct"
CACHE_PATH = CACHE_DIR / f"genvm-universal-{GENVM_VERSION}.tar.xz"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if CACHE_PATH.exists() and sha256(CACHE_PATH) == RUNNER_BUNDLE_SHA256:
        print(f"Pinned GenVM runner bundle is cached at {CACHE_PATH}")
        return 0

    descriptor, temporary_name = tempfile.mkstemp(
        prefix="genvm-runners-", suffix=".tar.xz", dir=CACHE_DIR
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        print(f"Downloading pinned GenVM runner bundle {GENVM_VERSION}...")
        request = urllib.request.Request(
            RUNNER_BUNDLE_URL,
            headers={"User-Agent": "GenLayer-release-preflight"},
        )
        with urllib.request.urlopen(request, timeout=300) as response:
            with temporary_path.open("wb") as destination:
                while chunk := response.read(1024 * 1024):
                    destination.write(chunk)

        actual_digest = sha256(temporary_path)
        if actual_digest != RUNNER_BUNDLE_SHA256:
            raise RuntimeError(
                "GenVM runner checksum mismatch: "
                f"expected {RUNNER_BUNDLE_SHA256}, got {actual_digest}"
            )
        os.replace(temporary_path, CACHE_PATH)
        print(f"Cached verified GenVM runner bundle at {CACHE_PATH}")
        return 0
    finally:
        temporary_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
