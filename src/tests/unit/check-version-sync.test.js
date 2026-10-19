// meta:
//   id: "022-src-check-version-sync-test"
//   type: code
//   domain: src
//   subject: check-version-sync
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["020-src-check-version-sync"]
//   tags: ["test", "version"]
//   usage: test

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  checkTagMatches,
  checkVersionSync,
  collectMarketingVersions,
  findVersionMismatches,
  normalizeTagVersion
} = require('../../scripts/check-version-sync');

function writeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'version-sync-'));
  for (const [relative, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relative);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents, 'utf8');
  }
  return root;
}

describe('check-version-sync', () => {
  test('repo versions currently match', () => {
    const result = checkVersionSync();
    expect(result.ok).toBe(true);
    expect(result.version).toBe('5.2.0');
    expect(result.records.some((record) => record.path.endsWith('package.json'))).toBe(true);
    expect(result.records.some((record) => record.path.endsWith('manifest.json'))).toBe(true);
    expect(result.records.filter((record) => record.path.includes('project.pbxproj')).length).toBeGreaterThan(0);
  });

  test('reports drift between package.json and the extension manifest', () => {
    const root = writeTree({
      'package.json': '{"version":"5.2.0"}',
      'manifest.json': '{"version":"5.1.0"}',
      'project.pbxproj': 'MARKETING_VERSION = 5.2.0;\n'
    });

    const result = checkVersionSync({
      paths: {
        packageJson: path.join(root, 'package.json'),
        manifests: [path.join(root, 'manifest.json')],
        xcodeProject: path.join(root, 'project.pbxproj')
      },
      isTagBuild: false
    });

    expect(result.ok).toBe(false);
    expect(findVersionMismatches(result.records).length).toBeGreaterThan(0);
  });

  test('treats missing MARKETING_VERSION as optional', () => {
    const versions = collectMarketingVersions(path.join(os.tmpdir(), 'missing-safari.pbxproj'));
    expect(versions).toEqual([]);
  });

  test('requires the git tag to match on a tag build', () => {
    expect(normalizeTagVersion('refs/tags/v5.2.0')).toBe('5.2.0');
    expect(checkTagMatches('5.2.0', 'refs/tags/v5.2.0')).toEqual({
      checked: true,
      ok: true,
      tagVersion: '5.2.0'
    });
    expect(checkTagMatches('5.2.0', 'refs/tags/v5.1.0').ok).toBe(false);
  });
});
