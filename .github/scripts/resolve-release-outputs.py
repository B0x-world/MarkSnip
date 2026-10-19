#!/usr/bin/env python3
"""Resolve selectable build outputs for build-release.yml."""
from __future__ import annotations

import json
import os
from pathlib import Path

TRUE = {"true", "1", "yes", "on"}
FALSE = {"false", "0", "no", "off"}

HELPERS = (
    ("windows_amd64", "windows-amd64", "windows", "amd64", "zip"),
    ("windows_arm64", "windows-arm64", "windows", "arm64", "zip"),
    ("linux_amd64", "linux-amd64", "linux", "amd64", "tar.gz"),
    ("linux_arm64", "linux-arm64", "linux", "arm64", "tar.gz"),
    ("macos_amd64", "macos-amd64", "darwin", "amd64", "tar.gz"),
    ("macos_arm64", "macos-arm64", "darwin", "arm64", "tar.gz"),
)


def to_bool(raw: str | None, fallback: bool) -> bool:
    value = (raw or "").strip().lower()
    if value in TRUE:
        return True
    if value in FALSE:
        return False
    return fallback


def is_release_tag(ref: str) -> bool:
    return (ref or "").startswith("refs/tags/")


def resolve(
    event_name: str,
    input_val: str | None,
    var_val: str | None,
    pr_value: bool,
    tag_push: bool,
) -> bool:
    if event_name == "pull_request":
        return pr_value
    # v*.*.* tag pushes always build every artifact.
    if tag_push:
        return True
    if event_name in {"workflow_dispatch", "workflow_call"}:
        return to_bool(input_val, True)
    return to_bool(var_val, True)


def env(name: str) -> str:
    return os.environ.get(name, "")


def main() -> None:
    event_name = env("EVENT_NAME")
    tag_push = event_name == "push" and is_release_tag(env("GITHUB_REF"))
    flags = {
        "firefox": resolve(event_name, env("INPUT_FIREFOX"), env("VAR_FIREFOX"), True, tag_push),
        "chrome": resolve(event_name, env("INPUT_CHROME"), env("VAR_CHROME"), True, tag_push),
        "safari": resolve(event_name, env("INPUT_SAFARI"), env("VAR_SAFARI"), True, tag_push),
        "windows_amd64": resolve(
            event_name, env("INPUT_WINDOWS_AMD64"), env("VAR_WINDOWS_AMD64"), False, tag_push
        ),
        "windows_arm64": resolve(
            event_name, env("INPUT_WINDOWS_ARM64"), env("VAR_WINDOWS_ARM64"), False, tag_push
        ),
        "linux_amd64": resolve(
            event_name, env("INPUT_LINUX_AMD64"), env("VAR_LINUX_AMD64"), False, tag_push
        ),
        "linux_arm64": resolve(
            event_name, env("INPUT_LINUX_ARM64"), env("VAR_LINUX_ARM64"), False, tag_push
        ),
        "macos_amd64": resolve(
            event_name, env("INPUT_MACOS_AMD64"), env("VAR_MACOS_AMD64"), False, tag_push
        ),
        "macos_arm64": resolve(
            event_name, env("INPUT_MACOS_ARM64"), env("VAR_MACOS_ARM64"), False, tag_push
        ),
    }

    if event_name == "pull_request":
        flags["safari"] = flags["safari"] and to_bool(env("SAFARI_RELEVANT"), True)
        publish = False
        debug = False
    elif event_name == "workflow_call":
        publish = to_bool(env("INPUT_PUBLISH"), False)
        debug = to_bool(env("INPUT_DEBUG"), False)
    elif event_name == "workflow_dispatch":
        publish = to_bool(env("INPUT_PUBLISH"), True)
        debug = to_bool(env("INPUT_DEBUG"), False)
    else:
        # Tag pushes always publish a production (non-debug) release.
        publish = True
        debug = False

    # Published releases always ship stripped production builds.
    if publish:
        debug = False

    if not any(flags.values()):
        raise SystemExit("No build outputs are enabled.")

    version = json.loads(Path("src/manifest.json").read_text(encoding="utf-8"))["version"]
    os_name = {"windows": "windows", "linux": "linux", "darwin": "macos"}
    matrix = []
    for flag_name, helper_id, goos, goarch, fmt in HELPERS:
        if not flags[flag_name]:
            continue
        ext = "zip" if fmt == "zip" else "tar.gz"
        matrix.append(
            {
                "id": helper_id,
                "goos": goos,
                "goarch": goarch,
                "archive": f"marksnip-agent-bridge-{os_name[goos]}-{goarch}.{ext}",
                "format": fmt,
            }
        )

    github_output = Path(os.environ["GITHUB_OUTPUT"])
    matrix_json = json.dumps(matrix, separators=(",", ":"))
    lines = [
        f"version={version}",
        f"firefox={str(flags['firefox']).lower()}",
        f"chrome={str(flags['chrome']).lower()}",
        f"safari={str(flags['safari']).lower()}",
        f"windows_amd64={str(flags['windows_amd64']).lower()}",
        f"windows_arm64={str(flags['windows_arm64']).lower()}",
        f"linux_amd64={str(flags['linux_amd64']).lower()}",
        f"linux_arm64={str(flags['linux_arm64']).lower()}",
        f"macos_amd64={str(flags['macos_amd64']).lower()}",
        f"macos_arm64={str(flags['macos_arm64']).lower()}",
        f"publish_release={str(publish).lower()}",
        f"debug={str(debug).lower()}",
        f"artifact_suffix={'-debug' if debug else ''}",
        f"helper_count={len(matrix)}",
        "helper_matrix<<EOF",
        matrix_json,
        "EOF",
    ]
    with github_output.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
