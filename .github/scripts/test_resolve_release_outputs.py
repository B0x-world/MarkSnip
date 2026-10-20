#!/usr/bin/env python3
# meta:
#   id: "125-ci-resolve-release-outputs-test"
#   type: code
#   domain: ci
#   subject: resolve-release-outputs-test
#   status: adopted
#   owner: ""
#   created: 2026-10-20
#   updated: 2026-10-20
#   related: ["001-project-file-metadata-spec"]
#   tags: ["script", "ci"]
#   usage: test

import importlib.util
import unittest
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "resolve_release_outputs",
    Path(__file__).with_name("resolve-release-outputs.py"),
)
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_MOD)
apply_architecture_filter = _MOD.apply_architecture_filter
normalize_architectures = _MOD.normalize_architectures


class ArchitectureFilterTests(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize_architectures("x64"), "x64")
        self.assertEqual(normalize_architectures("amd64"), "x64")
        self.assertEqual(normalize_architectures("arm64"), "arm64")
        self.assertEqual(normalize_architectures("all"), "all")

    def test_x64_keeps_covered_os_amd64_only(self):
        flags = {
            "windows_amd64": True,
            "windows_arm64": True,
            "linux_amd64": True,
            "linux_arm64": True,
            "macos_amd64": True,
            "macos_arm64": True,
        }
        apply_architecture_filter(flags, "x64")
        self.assertTrue(flags["windows_amd64"])
        self.assertFalse(flags["windows_arm64"])
        self.assertTrue(flags["linux_amd64"])
        self.assertFalse(flags["linux_arm64"])
        self.assertTrue(flags["macos_amd64"])
        self.assertFalse(flags["macos_arm64"])

    def test_arm64_maps_pc_linux_amd64_only_preset(self):
        flags = {
            "windows_amd64": False,
            "windows_arm64": False,
            "linux_amd64": True,
            "linux_arm64": False,
            "macos_amd64": False,
            "macos_arm64": False,
        }
        apply_architecture_filter(flags, "arm64")
        self.assertFalse(flags["linux_amd64"])
        self.assertTrue(flags["linux_arm64"])


if __name__ == "__main__":
    unittest.main()
