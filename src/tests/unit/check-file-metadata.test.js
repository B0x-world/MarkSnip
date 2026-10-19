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

describe('check-file-metadata', () => {
  test('extracts slash-comment metadata from scripts', () => {
    const text = `// meta:\n${validMeta
      .split('\n')
      .map((line) => (line ? `//   ${line}` : '//'))
      .join('\n')}\n\nconst x = 1;\n`;
    const meta = extractMetadataBlock(text, 'check-version-sync.js');
    expect(meta.usage).toBe('script');
    expect(meta.id).toBe('020-src-check-version-sync');
    expect(validateMetadata(meta, 'check-version-sync.js')).toEqual([]);
  });

  test('extracts markdown front matter', () => {
    const text = `---\n${validMeta}---\n\n# Title\n`;
    const meta = extractMetadataBlock(text, 'note.md');
    expect(meta.type).toBe('code');
    expect(meta.related).toEqual([]);
  });

  test('rejects unknown usage values', () => {
    const meta = extractMetadataBlock(`---\n${validMeta.replace('usage: script', 'usage: mystery')}\n---\n`, 'note.md');
    expect(validateMetadata(meta, 'note.md').some((error) => /usage/.test(error))).toBe(true);
  });

  test('walks a tree and ignores files without headers', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-meta-'));
    fs.writeFileSync(path.join(root, 'plain.js'), 'const x = 1;\n');
    fs.writeFileSync(
      path.join(root, 'headed.js'),
      `// meta:\n${validMeta
        .split('\n')
        .filter(Boolean)
        .map((line) => `//   ${line}`)
        .join('\n')}\n`
    );
    const result = checkFileMetadata({ rootDir: root });
    expect(result.ok).toBe(true);
    expect(result.checked).toHaveLength(1);
  });
});
