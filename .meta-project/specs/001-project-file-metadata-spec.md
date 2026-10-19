---
id: "001-project-file-metadata-spec"
type: spec
domain: project
subject: file-metadata
status: adopted
owner: ""
created: 2026-10-19
updated: 2026-10-19
related:
  - "000-project-meta-folder"
tags:
  - metadata
  - spec
usage: doc
template_version: 1
---

# File metadata spec

One machine-readable metadata block is used on every kind of file artifact, including code. The core fields match the `.meta-project/` template front matter, plus `usage`.

## Fields

| Field | Type | Allowed values |
| --- | --- | --- |
| `id` | string | Stable id, preferably `NNN-domain-subject-type` |
| `type` | enum | `plan` \| `decision` \| `status` \| `change-proposal` \| `checklist` \| `risk` \| `spec` \| `ci` \| `policy` \| `code` \| `form` |
| `domain` | string | lowercase kebab-case |
| `subject` | string | lowercase kebab-case |
| `status` | enum | `draft` \| `proposed` \| `adopted` \| `superseded` \| `deprecated` |
| `owner` | string | person or team; `""` is allowed |
| `created` | date | `YYYY-MM-DD` or `{{YYYY-MM-DD}}` |
| `updated` | date | `YYYY-MM-DD` or `{{YYYY-MM-DD}}` |
| `related` | list | ids or paths |
| `tags` | list | lowercase kebab-case strings |
| `usage` | enum | `source` \| `test` \| `config` \| `workflow` \| `doc` \| `template` \| `script` \| `asset` |

Extra keys (for example `template_version`) are allowed. Unknown `type`, `status`, or `usage` values are invalid.

## How the block is carried

Do not add a header when it would break the file or its tooling.

### Markdown

Use YAML front matter:

```markdown
---
id: "014-release-notes-plan"
type: plan
domain: release
subject: notes
status: draft
owner: ""
created: 2026-10-19
updated: 2026-10-19
related: []
tags: []
usage: doc
---
```

Do **not** use YAML front matter on GitHub-special Markdown that would show the block or break rendering:

| File | Carrier |
| --- | --- |
| `README.md` | HTML comment `<!-- meta: ... -->` if a header is needed; otherwise nothing |
| `SECURITY.md` | HTML comment (hidden when GitHub renders the file) |
| `CHANGELOG.md` | nothing (generated narrative; do not wrap) |
| `.github/pull_request_template.md` | nothing (GitHub shows the template as raw text in the PR form) |
| `.github/ISSUE_TEMPLATE/*.yml` issue forms | nothing |
| `.github/ISSUE_TEMPLATE/config.yml` | nothing |
| `.github/release.yml` | nothing |
| `.github/dependabot.yml` | nothing |
| `.github/FUNDING.yml` | nothing |

### JavaScript, TypeScript, Go, Swift, CSS

Use a leading `//` or `/* */` block whose first line is `meta:`. Place it after a shebang or `'use strict'` when those must come first.

Go: a comment block **before** `package` is fine. Leave a blank line before `package` so the block does not become the package doc comment.

```javascript
// meta:
//   id: "020-src-check-version-sync"
//   type: code
//   domain: src
//   subject: check-version-sync
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: []
//   tags: ["ci"]
//   usage: script
```

```go
// meta:
//   id: "030-native-bridge-status"
//   type: code
//   domain: native
//   subject: bridge-status
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: []
//   tags: []
//   usage: source

package bridge
```

### YAML workflows/configs and shell/Python

Use a leading `#` block:

```yaml
# meta:
#   id: "010-ci-build-preset-pc"
#   type: ci
#   domain: ci
#   subject: build-preset-pc
#   status: adopted
#   owner: ""
#   created: 2026-10-19
#   updated: 2026-10-19
#   related: []
#   tags: ["workflow"]
#   usage: workflow

name: Build and Release (PC)
```

```bash
#!/usr/bin/env bash
# meta:
#   id: "012-xcode-build-safari-app"
#   type: code
#   domain: safari
#   subject: build-safari-app
#   status: adopted
#   owner: ""
#   created: 2026-10-19
#   updated: 2026-10-19
#   related: []
#   tags: []
#   usage: script
```

GitHub-schema YAML (`release.yml`, `dependabot.yml`, issue forms, `FUNDING.yml`) stays header-less.

### HTML / XML

Use a comment after any XML declaration or doctype:

```html
<!DOCTYPE html>
<!-- meta:
id: "040-options-page"
type: code
domain: src
subject: options-page
status: adopted
owner: ""
created: 2026-10-19
updated: 2026-10-19
related: []
tags: []
usage: source
-->
```

### JSON and other comment-less formats

`manifest.json`, `package.json`, lockfiles, and similar files get **no** inline header. An optional sidecar `<file>.meta.yaml` may sit next to the file. The full-repo rollout will decide where sidecars are actually used.

```yaml
# example: src/manifest.json.meta.yaml
id: "015-src-extension-manifest"
type: code
domain: src
subject: extension-manifest
status: draft
owner: ""
created: 2026-10-19
updated: 2026-10-19
related: []
tags: []
usage: config
```

Binaries and images: no inline header; sidecar only if the rollout asks for one.

### Generated or vendored files

Excluded. Do not add headers under `src/.build/`, `node_modules/`, `dist/`, `tmp/`, `coverage/`, `test-artifacts/`, `web-ext-artifacts/`, or minified/vendored third-party sources.

## Parse rule

A tool finds the block as follows:

1. Skip a shebang line (`#!...`) when present.
2. If the file is comment-less (`json`, lockfiles, binaries, images), look for an optional sibling `<basename>.meta.yaml` and parse that YAML as the block. Otherwise stop: no header.
3. If the remaining text starts with `---`, read until the next line that is only `---` and parse that YAML. Accept the block only when it includes `usage`.
4. Else search the first comment region for `meta:` followed by indented `key: value` lines:
   - Markdown/HTML/XML: `<!-- meta: ... -->`
   - `#` languages: consecutive `#` lines starting with `# meta:`
   - `//` languages: consecutive `//` lines starting with `// meta:`
   - or a `/* meta: ... */` block
5. Parse the inner text as a small YAML mapping (scalars, quoted strings, `[]` / inline lists / `- item` lists).
6. Validate required fields and enum values. `{{placeholder}}` is valid on fill-in fields.

`src/scripts/check-file-metadata.js` implements this rule for files that already have a header. Files without a header are ignored.
