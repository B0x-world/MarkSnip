// meta:
//   id: "020-src-check-version-sync"
//   type: code
//   domain: src
//   subject: check-version-sync
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["021-src-check-file-metadata", "001-project-file-metadata-spec"]
//   tags: ["ci", "version"]
//   usage: script

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SRC_DIR, '..');

const DEFAULT_PATHS = {
  packageJson: path.join(SRC_DIR, 'package.json'),
  manifests: [path.join(SRC_DIR, 'manifest.json')],
  xcodeProject: path.join(ROOT_DIR, 'xcode/MarkSnip/MarkSnip.xcodeproj/project.pbxproj')
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectManifestVersions(manifestPaths) {
  return manifestPaths.map((manifestPath) => {
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Extension manifest is missing: ${manifestPath}`);
    }
    const manifest = readJson(manifestPath);
    if (!manifest.version) {
      throw new Error(`Extension manifest is missing version: ${manifestPath}`);
    }
    return { path: manifestPath, version: String(manifest.version) };
  });
}

function collectMarketingVersions(pbxprojPath) {
  if (!fs.existsSync(pbxprojPath)) {
    return [];
  }
  const text = fs.readFileSync(pbxprojPath, 'utf8');
  const matches = [...text.matchAll(/MARKETING_VERSION\s*=\s*([^;]+);/g)];
  return matches.map((match, index) => ({
    path: `${pbxprojPath}#${index + 1}`,
    version: match[1].trim()
  }));
}

function normalizeTagVersion(tag) {
  if (!tag) {
    return null;
  }
  const value = String(tag).trim();
  const refMatch = value.match(/refs\/tags\/v?(.+)$/);
  if (refMatch) {
    return refMatch[1];
  }
  return value.replace(/^v/, '');
}

function collectVersionRecords(options = {}) {
  const paths = { ...DEFAULT_PATHS, ...options.paths };
  const pkg = readJson(paths.packageJson);
  if (!pkg.version) {
    throw new Error(`package.json is missing version: ${paths.packageJson}`);
  }

  const records = [
    { path: paths.packageJson, version: String(pkg.version) },
    ...collectManifestVersions(paths.manifests),
    ...collectMarketingVersions(paths.xcodeProject)
  ];

  return records;
}

function findVersionMismatches(records) {
  const versions = [...new Set(records.map((record) => record.version))];
  if (versions.length <= 1) {
    return [];
  }
  return records;
}

function checkTagMatches(version, tag) {
  const tagVersion = normalizeTagVersion(tag);
  if (!tagVersion) {
    return { checked: false, ok: true, tagVersion: null };
  }
  return { checked: true, ok: tagVersion === version, tagVersion };
}

function checkVersionSync(options = {}) {
  const records = collectVersionRecords(options);
  const mismatches = findVersionMismatches(records);
  const expected = records[0]?.version || null;
  const tag = options.tag !== undefined ? options.tag : process.env.GITHUB_REF;
  const isTagBuild =
    options.isTagBuild !== undefined
      ? options.isTagBuild
      : String(process.env.GITHUB_REF || '').startsWith('refs/tags/');
  const tagCheck = isTagBuild
    ? checkTagMatches(expected, tag)
    : { checked: false, ok: true, tagVersion: normalizeTagVersion(tag) };

  return {
    ok: mismatches.length === 0 && tagCheck.ok,
    version: expected,
    records,
    mismatches,
    tagCheck
  };
}

function formatReport(result) {
  const lines = result.records.map((record) => `${record.version}\t${record.path}`);
  if (result.mismatches.length > 0) {
    lines.unshift('Version mismatch across package.json, manifests, and Safari MARKETING_VERSION:');
  } else {
    lines.unshift(`Versions match: ${result.version}`);
  }
  if (result.tagCheck.checked && !result.tagCheck.ok) {
    lines.push(
      `Tag version ${result.tagCheck.tagVersion} does not match project version ${result.version}`
    );
  }
  return lines.join('\n');
}

function main() {
  const result = checkVersionSync();
  console.log(formatReport(result));
  if (!result.ok) {
    process.exit(1);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  checkTagMatches,
  checkVersionSync,
  collectMarketingVersions,
  collectVersionRecords,
  findVersionMismatches,
  formatReport,
  normalizeTagVersion
};
