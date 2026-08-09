#!/usr/bin/env python3
"""Build a complete, deterministic desktop source bundle.

GitHub's automatically generated source archives do not contain Git submodule
working trees.  The desktop launcher therefore consumes this explicit release
asset, created only after checkout with recursive submodules.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath


REQUIRED_FILES = (
    Path("docker-compose.yml"),
    Path(".env.example"),
    Path(".gitmodules"),
)
REQUIRED_SERVICES = (
    Path("services/vectoplan-app"),
    Path("services/vectoplan-chunk"),
    Path("services/vectoplan-converter"),
    Path("services/vectoplan-core"),
    Path("services/vectoplan-editor"),
    Path("services/vectoplan-geoserver-orchestrator"),
    Path("services/vectoplan-language"),
    Path("services/vectoplan-library"),
    Path("services/vectoplan-openLayer"),
)
EXCLUDED_NAMES = {
    ".git",
    ".gunicorn",
    ".idea",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "node_modules",
}
VERSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument(
        "--repository-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument("--output-directory", type=Path, default=Path("dist"))
    return parser.parse_args()


def validate_checkout(root: Path) -> None:
    missing = [str(path) for path in REQUIRED_FILES if not (root / path).is_file()]
    for service in REQUIRED_SERVICES:
        directory = root / service
        if (
            not directory.is_dir()
            or not any(item.name not in {".git"} for item in directory.iterdir())
        ):
            missing.append(str(service))
    if missing:
        raise RuntimeError(
            "checkout is incomplete; initialize recursive submodules: "
            + ", ".join(missing)
        )


def should_include(path: Path, *, root: Path, output: Path) -> bool:
    relative = path.relative_to(root)
    if any(part in EXCLUDED_NAMES for part in relative.parts):
        return False
    try:
        path.relative_to(output)
    except ValueError:
        pass
    else:
        return False
    return not path.is_symlink()


def iter_files(root: Path, output: Path) -> list[Path]:
    files: list[Path] = []
    for directory, names, filenames in os.walk(root):
        current = Path(directory)
        names[:] = sorted(
            name
            for name in names
            if should_include(current / name, root=root, output=output)
        )
        for name in sorted(filenames):
            candidate = current / name
            if not should_include(candidate, root=root, output=output):
                continue
            try:
                if not stat.S_ISREG(candidate.lstat().st_mode):
                    continue
            except OSError:
                continue
            files.append(candidate)
    return files


def zip_info(name: str, *, executable: bool) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    mode = 0o755 if executable else 0o644
    info.external_attr = (stat.S_IFREG | mode) << 16
    info.create_system = 3
    return info


def build_bundle(root: Path, output: Path, version: str) -> tuple[Path, Path]:
    root = root.resolve(strict=True)
    output = output.resolve(strict=False)
    validate_checkout(root)
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f"vectoplan-server-{version}-desktop.zip"
    prefix = PurePosixPath(f"vectoplan-server-{version}")

    with tempfile.NamedTemporaryFile(
        prefix=archive.name,
        suffix=".tmp",
        dir=output,
        delete=False,
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(
            temporary_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as package:
            for source in iter_files(root, output):
                relative = PurePosixPath(source.relative_to(root).as_posix())
                mode = source.stat().st_mode
                package.writestr(
                    zip_info(
                        str(prefix / relative),
                        executable=bool(mode & stat.S_IXUSR),
                    ),
                    source.read_bytes(),
                )
        os.replace(temporary_path, archive)
    finally:
        temporary_path.unlink(missing_ok=True)

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum = archive.with_suffix(archive.suffix + ".sha256")
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    return archive, checksum


def main() -> int:
    args = parse_args()
    version = str(args.version).strip()
    if not VERSION_PATTERN.fullmatch(version):
        raise SystemExit("version is invalid")
    archive, checksum = build_bundle(
        args.repository_root,
        args.output_directory,
        version,
    )
    print(archive)
    print(checksum)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
