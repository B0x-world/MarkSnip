---
id: "{{NNN}}-release-{{version}}-checklist"
type: checklist
domain: release
subject: checklist
status: draft
owner: ""
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
related: []
tags:
  - release
usage: template
template_version: 1
---

# Release checklist: MarkSnip {{version}}

Store uploads are done by hand. CI only builds unsigned artifacts.

## Prepare

- [ ] Versions match in `src/package.json`, `src/manifest.json`, and Safari `MARKETING_VERSION`
- [ ] `CHANGELOG.md` has user highlights for this version
- [ ] `npm run generate:release-highlights` is current
- [ ] Tag will be `v{{version}}`

## Verify

- [ ] Version-sync check passes
- [ ] Lint, unit, and integration tests pass
- [ ] E2E ran if `src/` or the E2E workflows changed
- [ ] Safari / CodeQL Swift ran if Safari or Swift files changed

## Tag and build

- [ ] Push `v{{version}}` **or** run a preset by hand
- [ ] Preset used: Build and Release (PC) / Build and Release (PC + Mac) / Build and Release Extension
- [ ] `publish_release` set as intended (tags always publish)

## Artifacts

- [ ] Firefox `.xpi`
- [ ] Chrome `.zip`
- [ ] Safari `.app` zip (if this release includes Mac)
- [ ] Windows / Linux helpers (amd64 and arm64 as needed)
- [ ] macOS helpers (if this release includes Mac)
- [ ] All attached artifacts are unsigned

## Release notes

- [ ] GitHub generated notes (from PR titles and `.github/release.yml`) look right
- [ ] Changelog / user-highlight text is in the release body
- [ ] Install notes match the artifacts that were actually built

## Store uploads (manual)

- [ ] Chrome Web Store
- [ ] Firefox Add-ons
- [ ] Safari / Mac (if shipping)
