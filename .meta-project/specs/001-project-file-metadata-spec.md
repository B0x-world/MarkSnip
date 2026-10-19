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

Use a leading `//` or `/* */` block whose first line is `meta:`. Place it after a shebang, `'use strict'` / `"use strict"`, or `// @ts-check` when those must come first. Place it after a license comment or Xcode `//  File.swift` banner when that banner must stay first. Leave a blank line after the metadata block before the next code.

`.mjs` and `.cjs` use the same `//` carrier as `.js`. CSS must use `/* meta: ... */` (`//` is not a CSS comment).

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

### YAML workflows/configs and shell/Python/PowerShell

Use a leading `#` block. `.ps1` uses the same carrier. Place it after a shebang when one is present:

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

Excluded. The authoritative list lives in [`tools/metadata/rules.cjs`](../../tools/metadata/rules.cjs). That module is what `check:file-metadata` and `tools/metadata/apply-headers.mjs` both import. Do not add headers under skipped directories (`src/.build/`, `node_modules/`, `dist/`, `tmp/`, `coverage/`, `test-artifacts/`, `test-results/`, `web-ext-artifacts/`), minified files (`*.min.js`, `*.min.css`), vendored first-party copies (`src/popup/lib/**`, `src/background/Readability.js`, `src/background/turndown.js`, `src/background/turndown-plugin-gfm.js`, `src/background/apache-mime-types.js`, `src/browser-polyfill.min.js`, `src/highlight.min.js`), Xcode-generated files (`.pbxproj`, `.plist`, `.entitlements`, `.storyboard`, `.xcscheme`, `.xcfilelist`, `*.xcassets/**`), or golden Markdown fixtures under `src/tests/fixtures/e2e-markdown/` (front matter would change compared output).

Every `README.md` and `CHANGELOG.md` is excluded (GitHub-special or generated narrative), not only the repository-root copies.

## Parse rule

A tool finds the block as follows:

1. Skip a shebang line (`#!...`) when present.
2. Skip `'use strict'` / `"use strict"` and `// @ts-check` when those are the next non-empty lines.
3. If the file is comment-less (`json`, lockfiles, binaries, images), look for an optional sibling `<basename>.meta.yaml` and parse that YAML as the block. Otherwise stop: no header.
4. If the remaining text starts with `---`, read until the next line that is only `---` and parse that YAML. Accept the block only when it includes `usage`. If that front matter has no `usage`, keep looking for an HTML `<!-- meta: -->` comment (Cursor skill files already have their own front matter).
5. Else search the first comment region for `meta:` followed by indented `key: value` lines. If the first comment region is a license or Xcode file banner (not `meta:`), skip it and read the next comment region:
   - Markdown/HTML/XML: `<!-- meta: ... -->`
   - `#` languages: consecutive `#` lines starting with `# meta:`
   - `//` languages: consecutive `//` lines starting with `// meta:`
   - or a `/* meta: ... */` block
6. Parse the inner text as a small YAML mapping (scalars, quoted strings, `[]` / inline lists / `- item` lists).
7. Validate required fields and enum values. `{{placeholder}}` is valid on fill-in fields.

`src/scripts/check-file-metadata.js` implements this rule. Eligible files (inline-header extensions that are not in `tools/metadata/rules.cjs`) must have a valid header; missing or malformed headers fail `npm run check:file-metadata`. `tools/metadata/apply-headers.mjs` inserts headers using git history for `created` / `updated`.

This rollout does **not** add JSON sidecars. Comment-less files stay header-less until a later decision.
