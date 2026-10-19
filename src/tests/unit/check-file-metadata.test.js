// meta:
//   id: "023-src-check-file-metadata-test"
//   type: code
//   domain: src
//   subject: check-file-metadata
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["021-src-check-file-metadata"]
//   tags: ["test", "metadata"]
//   usage: test

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  checkFileMetadata,
  extractMetadataBlock,
  validateMetadata
} = require('../../scripts/check-file-metadata');
const {
  insertHeader,
  isEligiblePath,
  isExcludedPath
} = require('../../../tools/metadata/rules.cjs');

const validMeta = `id: "020-src-check-version-sync"
type: code
domain: src
subject: check-version-sync
status: adopted
owner: ""
created: 2026-10-19
updated: 2026-10-19
related: []
tags: ["ci"]
usage: script
`;

function slashHeader() {
  return `// meta:\n${validMeta
    .split('\n')
    .filter(Boolean)
    .map((line) => `//   ${line}`)
    .join('\n')}\n`;
}

describe('check-file-metadata', () => {
  test('extracts slash-comment metadata from scripts', () => {
    const text = `${slashHeader()}\nconst x = 1;\n`;
    const meta = extractMetadataBlock(text, 'check-version-sync.js');
    expect(meta.usage).toBe('script');
    expect(meta.id).toBe('020-src-check-version-sync');
    expect(validateMetadata(meta, 'check-version-sync.js')).toEqual([]);
  });

  test('extracts markdown front matter with folded scalars', () => {
    const text = `---
name: example
description: >
  A folded
  description
id: "100-project-skill"
type: code
domain: project
subject: skill
status: adopted
owner: ""
created: 2026-10-19
updated: 2026-10-19
related: []
tags: []
usage: doc
---

# Title
`;
    const meta = extractMetadataBlock(text, 'SKILL.md');
    expect(meta.usage).toBe('doc');
    expect(meta.id).toBe('100-project-skill');
  });

  test('extracts markdown front matter', () => {
    const text = `---\n${validMeta}---\n\n# Title\n`;
    const meta = extractMetadataBlock(text, 'note.md');
    expect(meta.type).toBe('code');
    expect(meta.related).toEqual([]);
  });

  test('extracts metadata after shebang, use strict, and @ts-check', () => {
    const text = `#!/usr/bin/env node\n'use strict';\n// @ts-check\n${slashHeader()}\nmodule.exports = {};\n`;
    const meta = extractMetadataBlock(text, 'tool.js');
    expect(meta.usage).toBe('script');
  });

  test('extracts metadata after a Go package-adjacent header', () => {
    const text = `${slashHeader()}\npackage bridge\n`;
    const meta = extractMetadataBlock(text, 'status.go');
    expect(meta.domain).toBe('src');
  });

  test('rejects unknown usage values', () => {
    const meta = extractMetadataBlock(`---\n${validMeta.replace('usage: script', 'usage: mystery')}\n---\n`, 'note.md');
    expect(validateMetadata(meta, 'note.md').some((error) => /usage/.test(error))).toBe(true);
  });

  test('requires headers on eligible files and ignores excluded files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-meta-'));
    fs.writeFileSync(path.join(root, 'plain.js'), 'const x = 1;\n');
    fs.writeFileSync(path.join(root, 'headed.js'), `${slashHeader()}\nconst y = 2;\n`);
    fs.writeFileSync(path.join(root, 'vendor.min.js'), 'const z=1;\n');
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'node_modules', 'pkg.js'), 'module.exports=1;\n');

    const result = checkFileMetadata({ rootDir: root });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('plain.js');
    expect(result.checked).toHaveLength(1);
    expect(result.errors.some((error) => /plain\.js: missing file metadata header/.test(error))).toBe(true);
  });

  test('exclusion list matches the spec', () => {
    expect(isExcludedPath('README.md')).toBe(true);
    expect(isExcludedPath('CHANGELOG.md')).toBe(true);
    expect(isExcludedPath('.github/dependabot.yml')).toBe(true);
    expect(isExcludedPath('.github/ISSUE_TEMPLATE/bug_report.yml')).toBe(true);
    expect(isExcludedPath('src/popup/lib/codemirror.js')).toBe(true);
    expect(isExcludedPath('src/background/Readability.js')).toBe(true);
    expect(isExcludedPath('src/highlight.min.js')).toBe(true);
    expect(isExcludedPath('src/tests/fixtures/e2e-markdown/batch/snapshot-one.md')).toBe(true);
    expect(isExcludedPath('xcode/MarkSnip/MarkSnip.xcodeproj/project.pbxproj')).toBe(true);
    expect(isExcludedPath('src/manifest.json')).toBe(true);
    expect(isEligiblePath('src/shared/url-utils.js')).toBe(true);
    expect(isEligiblePath('src/tests/unit/url-utils.test.js')).toBe(true);
    expect(isEligiblePath('.github/workflows/ci.yml')).toBe(true);
    expect(isEligiblePath('tools/metadata/apply-headers.mjs')).toBe(true);
  });

  test('inserts headers after shebang and use strict without duplicating them', () => {
    const withShebang = insertHeader('#!/usr/bin/env node\nconst x = 1;\n', 'src/scripts/tool.js', {
      id: '100-src-tool',
      type: 'code',
      domain: 'src',
      subject: 'tool',
      status: 'adopted',
      owner: '',
      created: '2026-10-19',
      updated: '2026-10-19',
      related: [],
      tags: [],
      usage: 'script'
    });
    expect(withShebang.startsWith('#!/usr/bin/env node\n// meta:')).toBe(true);

    const withStrict = insertHeader("'use strict';\nconst x = 1;\n", 'src/notifications/notification-host.js', {
      id: '101-src-notification-host',
      type: 'code',
      domain: 'src',
      subject: 'notification-host',
      status: 'adopted',
      owner: '',
      created: '2026-10-19',
      updated: '2026-10-19',
      related: [],
      tags: [],
      usage: 'source'
    });
    expect(withStrict.startsWith("'use strict';\n// meta:")).toBe(true);
  });
});
