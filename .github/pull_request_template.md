## Summary

<!-- What changed, and why. -->

## Kind of change

- [ ] Feature
- [ ] Fix
- [ ] CI / build
- [ ] Docs
- [ ] Dependencies
- [ ] Other

Apply a label when you can (`enhancement`, `bug`, `github_actions`, `documentation`, `dependencies`) so tag-release notes group the PR.

## Checks

- [ ] Default clipping behavior is unchanged unless this change is explicitly opt-in
- [ ] No site-specific hardcoding (domains, selectors, or one-page special cases)
- [ ] Tests added or updated when behavior changed
- [ ] Live snapshots considered (or N/A for CI/docs-only work)

## Safari / Swift

- [ ] N/A
- [ ] `xcode/**`, `*.swift`, Safari scripts, or the workflows that drive them changed, **and** `ENABLE_MACOS=true` / `enable_macos` is on so the macOS jobs are expected to run
