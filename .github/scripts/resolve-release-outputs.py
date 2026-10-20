#!/usr/bin/env python3
# meta:
#   id: "101-ci-resolve-release-outputs"
#   type: code
#   domain: ci
#   subject: resolve-release-outputs
#   status: adopted
#   owner: ""
#   created: 2026-10-19
#   updated: 2026-10-20
#   related: ["001-project-file-metadata-spec"]
#   tags: ["script", "ci"]
#   usage: script

"""Resolve selectable build outputs for build-release.yml."""
from __future__ import annotations

import argparse
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


def macos_enabled() -> bool:
    """Mac/Safari/Swift jobs stay off unless ENABLE_MACOS or enable_macos is true."""
    return env("VAR_ENABLE_MACOS").strip().lower() == "true" or to_bool(
        env("INPUT_ENABLE_MACOS"), False
    )


def apply_macos_gate(flags: dict[str, bool], enabled: bool) -> dict[str, bool]:
    if enabled:
        return flags
    flags["safari"] = False
    flags["macos_amd64"] = False
    flags["macos_arm64"] = False
    return flags


def normalize_architectures(raw: str | None) -> str:
    value = (raw or "all").strip().lower()
    if value in {"x64", "amd64", "x86_64"}:
        return "x64"
    if value in {"arm64", "aarch64"}:
        return "arm64"
    if value in {"all", ""}:
        return "all"
    raise SystemExit(f"Unknown architectures value: {raw!r} (use x64, arm64, or all)")


def apply_architecture_filter(flags: dict[str, bool], architectures: str) -> dict[str, bool]:
    kind = normalize_architectures(architectures)
    if kind == "all":
        return flags
    for os_name in ("windows", "linux", "macos"):
        covered = flags[f"{os_name}_amd64"] or flags[f"{os_name}_arm64"]
        if kind == "x64":
            flags[f"{os_name}_amd64"] = covered
            flags[f"{os_name}_arm64"] = False
        else:
            flags[f"{os_name}_amd64"] = False
            flags[f"{os_name}_arm64"] = covered
    return flags


def helper_arches(enabled: bool, architectures: str) -> tuple[bool, bool]:
    if not enabled:
        return False, False
    kind = normalize_architectures(architectures)
    if kind == "all":
        return True, True
    if kind == "x64":
        return True, False
    return False, True


def resolve_flags(
    event_name: str,
    *,
    tag_push: bool,
    architectures: str,
) -> dict[str, bool]:
    helpers = resolve(event_name, env("INPUT_HELPERS"), None, False, tag_push)
    extensions = resolve(event_name, env("INPUT_EXTENSIONS"), None, True, tag_push)
    mac = resolve(event_name, env("INPUT_MAC"), None, True, tag_push)
    pc = resolve(event_name, env("INPUT_PC"), None, False, tag_push)
    chrome = resolve(event_name, env("INPUT_CHROME"), None, True, tag_push)
    edge = resolve(event_name, env("INPUT_EDGE"), None, True, tag_push)
    firefox = resolve(event_name, env("INPUT_FIREFOX"), None, True, tag_push)

    windows_amd64, windows_arm64 = helper_arches(helpers and pc, architectures)
    linux_amd64, linux_arm64 = helper_arches(helpers and pc, architectures)
    macos_amd64, macos_arm64 = helper_arches(helpers and mac, architectures)

    flags = {
        "firefox": extensions and firefox,
        "chrome": extensions and chrome,
        "edge": extensions and edge,
        "safari": mac,
        "windows_amd64": windows_amd64,
        "windows_arm64": windows_arm64,
        "linux_amd64": linux_amd64,
        "linux_arm64": linux_arm64,
        "macos_amd64": macos_amd64,
        "macos_arm64": macos_arm64,
    }
    flags = apply_macos_gate(flags, macos_enabled())
    if event_name == "pull_request":
        flags["safari"] = flags["safari"] and to_bool(env("SAFARI_RELEVANT"), True)
    return flags


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resolve selectable build outputs")
    parser.add_argument(
        "--architectures",
        default=os.environ.get("INPUT_ARCHITECTURES", "all"),
        help="Native host architectures to keep: x64, arm64, or all (default: all)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    event_name = env("EVENT_NAME")
    tag_push = event_name == "push" and is_release_tag(env("GITHUB_REF"))
    args = parse_args(argv)
    architectures = env("INPUT_ARCHITECTURES") or args.architectures
    flags = resolve_flags(event_name, tag_push=tag_push, architectures=architectures)

    if event_name == "pull_request":
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
        f"edge={str(flags['edge']).lower()}",
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
