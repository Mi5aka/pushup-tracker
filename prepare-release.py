"""Refresh or check the offline asset fingerprints before publishing."""

import argparse
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
FILES = {
    "./": "index.html",
    "styles.css": "styles.css",
    "app.js": "app.js",
    "translations.js": "translations.js",
    "manifest.webmanifest": "manifest.webmanifest",
    "icons/icon-192.png": "icons/icon-192.png",
    "icons/icon-512.png": "icons/icon-512.png",
    "icons/apple-touch-icon.png": "icons/apple-touch-icon.png",
}
RELEASE_BLOCK = re.compile(r"(?<=// BEGIN RELEASE\n).*?(?=// END RELEASE)", re.DOTALL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if fingerprints are out of date.")
    args = parser.parse_args()

    path = ROOT / "service-worker.js"
    source = path.read_text(encoding="utf-8")
    template, count = RELEASE_BLOCK.subn("", source)
    if count != 1:
        parser.exit(1, "Expected exactly one release block.\n")

    assets = {
        url: hashlib.sha256((ROOT / file).read_bytes()).hexdigest()
        for url, file in FILES.items()
    }
    version_input = template + json.dumps(assets, sort_keys=True)
    release = {"version": hashlib.sha256(version_input.encode()).hexdigest(), "assets": assets}
    block = f"const release = {json.dumps(release, indent=2)};\n"
    updated = RELEASE_BLOCK.sub(lambda _: block, source)
    if args.check:
        if source != updated:
            parser.exit(1, "Offline fingerprints are stale. Run python3 prepare-release.py.\n")
    else:
        path.write_text(updated, encoding="utf-8")


if __name__ == "__main__":
    main()
