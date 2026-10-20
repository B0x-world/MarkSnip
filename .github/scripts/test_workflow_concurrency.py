#!/usr/bin/env python3
# meta:
#   id: "126-ci-workflow-concurrency-test"
#   type: code
#   domain: ci
#   subject: workflow-concurrency-test
#   status: adopted
#   owner: ""
#   created: 2026-10-20
#   updated: 2026-10-20
#   related: ["001-project-file-metadata-spec"]
#   tags: ["script", "ci"]
#   usage: test

"""Guard reusable-workflow concurrency groups against caller/callee deadlock."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
CALLEE = WORKFLOWS / "build-release.yml"
PRESETS = (
    WORKFLOWS / "build-release-pc.yml",
    WORKFLOWS / "build-release-pc-mac.yml",
)


def concurrency_block(text: str) -> str:
    match = re.search(r"(?ms)^concurrency:\n((?:  .+\n)+)", text)
    if not match:
        raise AssertionError("missing workflow-level concurrency block")
    return match.group(0)


def group_expression(text: str) -> str:
    match = re.search(r"group:\s*(.+)", concurrency_block(text))
    if not match:
        raise AssertionError("missing concurrency group")
    return match.group(1).strip()


def uses_reusable_build_release(text: str) -> bool:
    return "uses: ./.github/workflows/build-release.yml" in text


def evaluate_group(
    *,
    event_name: str,
    caller_workflow: str,
    pr_number: str,
    ref: str,
    run_id: str,
    callee: bool,
) -> str:
    """Mirror the YAML group expressions used by the packaging workflows."""
    if callee:
        return f"build-release-extension-{pr_number or run_id}"
    if event_name == "pull_request":
        return f"{caller_workflow}-{pr_number or ref}"
    return f"{caller_workflow}-{ref}"


class WorkflowConcurrencyTests(unittest.TestCase):
    def test_callee_does_not_use_github_workflow(self):
        group = group_expression(CALLEE.read_text(encoding="utf-8"))
        self.assertNotIn("github.workflow", group)
        self.assertIn("build-release-extension-", group)
        self.assertIn("github.run_id", group)
        self.assertIn("github.event.pull_request.number", group)
        self.assertIn("cancel-in-progress: ${{ github.event_name == 'pull_request' }}", CALLEE.read_text(encoding="utf-8"))

    def test_every_preset_caller_has_its_own_group(self):
        found = 0
        for path in sorted(WORKFLOWS.glob("*.yml")):
            text = path.read_text(encoding="utf-8")
            if not uses_reusable_build_release(text):
                continue
            found += 1
            group = group_expression(text)
            self.assertIn("github.workflow", group)
            self.assertIn("cancel-in-progress: false", concurrency_block(text))
        self.assertEqual(found, 2)
        for preset in PRESETS:
            self.assertTrue(preset.exists())

    def test_preset_and_callee_groups_never_collide(self):
        cases = [
            ("workflow_call", "Build and Release (PC)", "", "refs/heads/main", "101", "201"),
            ("workflow_call", "Build and Release (PC + Mac)", "", "refs/heads/main", "102", "202"),
            ("workflow_dispatch", "Build and Release Extension", "", "refs/heads/main", "103", "203"),
            ("push", "Build and Release Extension", "", "refs/tags/v5.2.0", "104", "204"),
            ("pull_request", "Build and Release Extension", "22", "refs/pull/22/merge", "105", "205"),
        ]
        for event_name, caller, pr_number, ref, parent_run, child_run in cases:
            parent = evaluate_group(
                event_name=event_name if event_name != "workflow_call" else "workflow_dispatch",
                caller_workflow=caller,
                pr_number=pr_number,
                ref=ref,
                run_id=parent_run,
                callee=False,
            )
            child = evaluate_group(
                event_name=event_name,
                caller_workflow=caller,
                pr_number=pr_number,
                ref=ref,
                run_id=child_run,
                callee=True,
            )
            self.assertNotEqual(parent, child, f"{caller} {event_name}")
            self.assertFalse(child.startswith(caller), child)

    def test_pr_runs_share_a_group_and_dispatch_runs_do_not(self):
        first = evaluate_group(
            event_name="pull_request",
            caller_workflow="Build and Release Extension",
            pr_number="22",
            ref="refs/pull/22/merge",
            run_id="1",
            callee=True,
        )
        second = evaluate_group(
            event_name="pull_request",
            caller_workflow="Build and Release Extension",
            pr_number="22",
            ref="refs/pull/22/merge",
            run_id="2",
            callee=True,
        )
        self.assertEqual(first, second)
        self.assertEqual(first, "build-release-extension-22")

        dispatch_a = evaluate_group(
            event_name="workflow_dispatch",
            caller_workflow="Build and Release Extension",
            pr_number="",
            ref="refs/heads/main",
            run_id="11",
            callee=True,
        )
        dispatch_b = evaluate_group(
            event_name="workflow_dispatch",
            caller_workflow="Build and Release Extension",
            pr_number="",
            ref="refs/heads/main",
            run_id="12",
            callee=True,
        )
        self.assertNotEqual(dispatch_a, dispatch_b)


if __name__ == "__main__":
    unittest.main()
