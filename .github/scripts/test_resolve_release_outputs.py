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
import os
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
apply_macos_gate = _MOD.apply_macos_gate
helper_arches = _MOD.helper_arches
macos_enabled = _MOD.macos_enabled
normalize_architectures = _MOD.normalize_architectures
resolve_flags = _MOD.resolve_flags


INPUT_KEYS = (
    "INPUT_HELPERS",
    "INPUT_EXTENSIONS",
    "INPUT_MAC",
    "INPUT_PC",
    "INPUT_CHROME",
    "INPUT_EDGE",
    "INPUT_FIREFOX",
    "INPUT_ENABLE_MACOS",
    "VAR_ENABLE_MACOS",
    "SAFARI_RELEVANT",
)


class ArchitectureFilterTests(unittest.TestCase):
    def _set_inputs(self, values: dict[str, str]) -> None:
        previous = {key: os.environ.get(key) for key in INPUT_KEYS}

        def restore() -> None:
            for key in INPUT_KEYS:
                if previous[key] is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = previous[key]

        self.addCleanup(restore)
        for key in INPUT_KEYS:
            os.environ.pop(key, None)
        os.environ.update(values)

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

    def test_macos_gate_clears_safari_and_macos_helpers(self):
        flags = {
            "safari": True,
            "macos_amd64": True,
            "macos_arm64": True,
            "linux_amd64": True,
        }
        apply_macos_gate(flags, False)
        self.assertFalse(flags["safari"])
        self.assertFalse(flags["macos_amd64"])
        self.assertFalse(flags["macos_arm64"])
        self.assertTrue(flags["linux_amd64"])

    def test_macos_enabled_requires_true_variable_or_input(self):
        self.addCleanup(os.environ.pop, "VAR_ENABLE_MACOS", None)
        self.addCleanup(os.environ.pop, "INPUT_ENABLE_MACOS", None)
        os.environ.pop("VAR_ENABLE_MACOS", None)
        os.environ.pop("INPUT_ENABLE_MACOS", None)
        self.assertFalse(macos_enabled())
        os.environ["VAR_ENABLE_MACOS"] = "true"
        self.assertTrue(macos_enabled())
        os.environ["VAR_ENABLE_MACOS"] = "yes"
        self.assertFalse(macos_enabled())
        os.environ["INPUT_ENABLE_MACOS"] = "true"
        self.assertTrue(macos_enabled())

    def test_helper_arches_from_pc_or_mac_target(self):
        self.assertEqual(helper_arches(True, "x64"), (True, False))
        self.assertEqual(helper_arches(True, "arm64"), (False, True))
        self.assertEqual(helper_arches(True, "all"), (True, True))
        self.assertEqual(helper_arches(False, "all"), (False, False))

    def test_dispatch_pc_x64_helpers(self):
        self._set_inputs(
            {
                "INPUT_HELPERS": "true",
                "INPUT_EXTENSIONS": "true",
                "INPUT_MAC": "false",
                "INPUT_PC": "true",
                "INPUT_CHROME": "true",
                "INPUT_EDGE": "true",
                "INPUT_FIREFOX": "false",
            }
        )
        flags = resolve_flags("workflow_dispatch", tag_push=False, architectures="x64")
        self.assertTrue(flags["chrome"])
        self.assertTrue(flags["edge"])
        self.assertFalse(flags["firefox"])
        self.assertFalse(flags["safari"])
        self.assertTrue(flags["windows_amd64"])
        self.assertFalse(flags["windows_arm64"])
        self.assertTrue(flags["linux_amd64"])
        self.assertFalse(flags["linux_arm64"])
        self.assertFalse(flags["macos_amd64"])

    def test_mac_helpers_need_enable_macos(self):
        self._set_inputs(
            {
                "INPUT_HELPERS": "true",
                "INPUT_EXTENSIONS": "false",
                "INPUT_MAC": "true",
                "INPUT_PC": "false",
                "INPUT_CHROME": "false",
                "INPUT_EDGE": "false",
                "INPUT_FIREFOX": "false",
            }
        )
        flags = resolve_flags("workflow_dispatch", tag_push=False, architectures="all")
        self.assertFalse(flags["safari"])
        self.assertFalse(flags["macos_amd64"])
        os.environ["INPUT_ENABLE_MACOS"] = "true"
        flags = resolve_flags("workflow_dispatch", tag_push=False, architectures="all")
        self.assertTrue(flags["safari"])
        self.assertTrue(flags["macos_amd64"])
        self.assertTrue(flags["macos_arm64"])

    def test_extensions_group_gates_browser_zips(self):
        self._set_inputs(
            {
                "INPUT_HELPERS": "false",
                "INPUT_EXTENSIONS": "false",
                "INPUT_MAC": "false",
                "INPUT_PC": "false",
                "INPUT_CHROME": "true",
                "INPUT_EDGE": "true",
                "INPUT_FIREFOX": "true",
            }
        )
        flags = resolve_flags("workflow_dispatch", tag_push=False, architectures="all")
        self.assertFalse(flags["chrome"])
        self.assertFalse(flags["edge"])
        self.assertFalse(flags["firefox"])


if __name__ == "__main__":
    unittest.main()
