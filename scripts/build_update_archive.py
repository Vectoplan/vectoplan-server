from __future__ import annotations

import argparse
import hashlib
import os
import subprocess
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


FORBIDDEN_NAMES = {".env", "id_rsa", "id_ed25519"}
FORBIDDEN_SUFFIXES = {".key", ".p12", ".pfx", ".pem"}
EXCLUDED_DIRECTORIES = {
    ".git",
    ".github",
    ".idea",
    ".pnpm-store",
    ".pytest_cache",
    ".ruff_cache",
    "__pycache__",
    "node_modules",
}


@dataclass(frozen=True)
class SourceBlob:
    repository: Path
    object_id: str
    archive_path: PurePosixPath


def _tree_entries(repository: Path, revision: str) -> list[tuple[str, str, str, Path]]:
    result = subprocess.run(
        ["git", "ls-tree", "-r", "-z", revision],
        cwd=repository,
        check=True,
        stdout=subprocess.PIPE,
    )
    entries: list[tuple[str, str, str, Path]] = []
    for entry in result.stdout.split(b"\0"):
        if not entry:
            continue
        metadata, raw_path = entry.split(b"\t", 1)
        mode, kind, object_id = metadata.decode("ascii").split(" ", 2)
        entries.append((mode, kind, object_id, Path(raw_path.decode("utf-8"))))
    return entries


def _collect(
    repository: Path,
    prefix: Path = Path(),
    revision: str = "HEAD",
) -> list[SourceBlob]:
    files: list[SourceBlob] = []
    for mode, kind, object_id, relative in _tree_entries(repository, revision):
        archive_relative = prefix / relative
        if any(part.casefold() in EXCLUDED_DIRECTORIES for part in archive_relative.parts):
            continue
        if kind == "commit" and mode == "160000":
            submodule = repository / relative
            if not submodule.is_dir():
                raise RuntimeError(f"Submodule is not checked out: {relative.as_posix()}")
            checked_out = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=submodule,
                check=True,
                stdout=subprocess.PIPE,
                text=True,
            ).stdout.strip()
            if checked_out != object_id:
                raise RuntimeError(f"Submodule revision mismatch: {relative.as_posix()}")
            files.extend(_collect(submodule, archive_relative, object_id))
            continue
        if kind != "blob" or mode == "120000":
            raise RuntimeError(f"Unsupported tracked entry: {archive_relative.as_posix()}")
        if relative.name.casefold() in FORBIDDEN_NAMES or relative.suffix.casefold() in FORBIDDEN_SUFFIXES:
            # Update archives intentionally omit local/runtime credentials even
            # when a repository accidentally tracks them. Operators restore
            # the managed root .env from the existing installation.
            continue
        files.append(
            SourceBlob(
                repository=repository,
                object_id=object_id,
                archive_path=PurePosixPath(archive_relative.as_posix()),
            )
        )
    return files


def _write_sources(
    archive: zipfile.ZipFile,
    root: PurePosixPath,
    sources: list[SourceBlob],
) -> None:
    repositories: dict[Path, list[SourceBlob]] = {}
    for source in sources:
        repositories.setdefault(source.repository, []).append(source)
    for repository, repository_sources in sorted(
        repositories.items(),
        key=lambda item: str(item[0]).casefold(),
    ):
        process = subprocess.Popen(
            ["git", "cat-file", "--batch"],
            cwd=repository,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
        )
        if process.stdin is None or process.stdout is None:
            process.kill()
            raise RuntimeError("Could not open Git object reader")
        try:
            for source in sorted(
                repository_sources,
                key=lambda item: item.archive_path.as_posix(),
            ):
                process.stdin.write(source.object_id.encode("ascii") + b"\n")
                process.stdin.flush()
                header = process.stdout.readline().decode("ascii").strip().split(" ")
                if len(header) != 3 or header[0] != source.object_id or header[1] != "blob":
                    raise RuntimeError(f"Git object is unavailable: {source.archive_path}")
                payload = process.stdout.read(int(header[2]))
                if len(payload) != int(header[2]) or process.stdout.read(1) != b"\n":
                    raise RuntimeError(f"Git object is truncated: {source.archive_path}")
                info = zipfile.ZipInfo((root / source.archive_path).as_posix())
                info.date_time = (2026, 1, 1, 0, 0, 0)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, payload)
        finally:
            process.stdin.close()
            return_code = process.wait(timeout=30)
            if return_code != 0:
                raise RuntimeError(f"Git object reader failed for {repository}")


def build(repository: Path, output: Path, version: str) -> str:
    repository = repository.resolve(strict=True)
    output = output.resolve(strict=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    root = PurePosixPath(f"vectoplan-server-{version}")
    files = _collect(repository)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        _write_sources(archive, root, files)
    with zipfile.ZipFile(output) as archive:
        names = set(archive.namelist())
    required = {
        (root / "docker-compose.yml").as_posix(),
        (root / ".env.example").as_posix(),
    }
    if not required <= names or not any(name.startswith((root / "services").as_posix() + "/") for name in names):
        output.unlink(missing_ok=True)
        raise RuntimeError("Server update archive contract is incomplete")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(
        f"{digest}  {output.name}{os.linesep}",
        encoding="utf-8",
    )
    return digest


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a tracked VECTOPLAN Server update archive")
    parser.add_argument("--repository", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--version", required=True)
    arguments = parser.parse_args()
    print(build(arguments.repository, arguments.output, arguments.version))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
