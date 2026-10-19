// meta:
//   id: "025-tools-metadata-rules"
//   type: code
//   domain: tools
//   subject: metadata-rules
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec", "021-src-check-file-metadata"]
//   tags: ["metadata"]
//   usage: script

/**
 * Single exclusion and eligibility list for file-metadata headers.
 * Referenced by `.meta-project/specs/001-project-file-metadata-spec.md`.
 */

const path = require('path');

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  '.build',
  'dist',
  'tmp',
  'coverage',
  'test-artifacts',
  'test-results',
  'web-ext-artifacts',
  '.gocache',
  'xcuserdata',
  'xcworkspace'
]);

const SKIP_EXACT_PATHS = new Set([
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  '.gitignore',
  'src/.gitignore',
  '.nvmrc',
  '.node-version',
  'providers.json',
  '.github/pull_request_template.md',
  '.github/release.yml',
  '.github/dependabot.yml',
  '.github/FUNDING.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml'
]);

const SKIP_BASENAMES = new Set(['README.md', 'CHANGELOG.md']);

const GITHUB_SCHEMA_DIR = '.github/ISSUE_TEMPLATE/';

const SKIP_PATH_PREFIXES = [
  'src/popup/lib/',
  'src/tests/fixtures/e2e-markdown/'
];

const VENDORED_SUFFIXES = [
  '/background/Readability.js',
  '/background/turndown.js',
  '/background/turndown-plugin-gfm.js',
  '/background/apache-mime-types.js',
  '/browser-polyfill.min.js',
  '/highlight.min.js'
];

const XCODE_GENERATED_EXTS = new Set([
  '.pbxproj',
  '.plist',
  '.entitlements',
  '.storyboard',
  '.xcscheme',
  '.xcfilelist'
]);

const COMMENTLESS_EXTS = new Set([
  '.json',
  '.lock',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.zip',
  '.xpi',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp4',
  '.webm',
  '.mov',
  '.pdf',
  '.mod',
  '.sum'
]);

const INLINE_HEADER_EXTS = new Set([
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.go',
  '.swift',
  '.css',
  '.html',
  '.xml',
  '.yml',
  '.yaml',
  '.sh',
  '.py',
  '.ps1',
  '.md'
]);

const SLASH_EXTS = new Set(['.js', '.ts', '.mjs', '.cjs', '.go', '.swift']);
const HASH_EXTS = new Set(['.yml', '.yaml', '.sh', '.py', '.ps1']);
const HTML_EXTS = new Set(['.html', '.xml']);
const BLOCK_EXTS = new Set(['.css']);

const REQUIRED_FIELDS = [
  'id',
  'type',
  'domain',
  'subject',
  'status',
  'owner',
  'created',
  'updated',
  'related',
  'tags',
  'usage'
];

function toPosix(relPath) {
  return String(relPath).split(path.sep).join('/');
}

function kebab(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(name);
}

function isMinified(relPosix) {
  return /\.min\.(js|css)$/i.test(relPosix);
}

function isXcodeGenerated(relPosix) {
  const ext = path.posix.extname(relPosix).toLowerCase();
  if (XCODE_GENERATED_EXTS.has(ext)) {
    return true;
  }
  return relPosix.includes('.xcassets/') || relPosix.endsWith('.xcassets');
}

function isVendored(relPosix) {
  if (isMinified(relPosix)) {
    return true;
  }
  if (SKIP_PATH_PREFIXES.some((prefix) => relPosix.startsWith(prefix))) {
    return true;
  }
  return VENDORED_SUFFIXES.some((suffix) => relPosix.endsWith(suffix));
}

function isGitHubSchemaYaml(relPosix) {
  if (SKIP_EXACT_PATHS.has(relPosix)) {
    return true;
  }
  return relPosix.startsWith(GITHUB_SCHEMA_DIR) && (relPosix.endsWith('.yml') || relPosix.endsWith('.yaml'));
}

function isExcludedPath(relPath) {
  const relPosix = toPosix(relPath);
  if (!relPosix || relPosix === '.') {
    return true;
  }
  const parts = relPosix.split('/');
  if (parts.some((part) => SKIP_DIR_NAMES.has(part))) {
    return true;
  }
  if (SKIP_EXACT_PATHS.has(relPosix) || SKIP_BASENAMES.has(path.posix.basename(relPosix))) {
    return true;
  }
  if (isGitHubSchemaYaml(relPosix) || isVendored(relPosix) || isXcodeGenerated(relPosix)) {
    return true;
  }
  const ext = path.posix.extname(relPosix).toLowerCase();
  if (COMMENTLESS_EXTS.has(ext)) {
    return true;
  }
  return false;
}

function isEligiblePath(relPath) {
  const relPosix = toPosix(relPath);
  const ext = path.posix.extname(relPosix).toLowerCase();
  if (!INLINE_HEADER_EXTS.has(ext)) {
    return false;
  }
  return !isExcludedPath(relPosix);
}

function commentStyle(relPath) {
  const ext = path.posix.extname(toPosix(relPath)).toLowerCase();
  if (SLASH_EXTS.has(ext)) {
    return 'slash';
  }
  if (BLOCK_EXTS.has(ext)) {
    return 'block';
  }
  if (HASH_EXTS.has(ext)) {
    return 'hash';
  }
  if (HTML_EXTS.has(ext)) {
    return 'html';
  }
  if (ext === '.md') {
    return 'frontmatter';
  }
  return null;
}

function domainFromPath(relPath) {
  const relPosix = toPosix(relPath);
  const parts = relPosix.split('/');
  const root = parts[0];
  if (root === '.github') {
    return 'ci';
  }
  if (root === '.meta-project' || root === '.agents') {
    return 'project';
  }
  if (root === 'src') {
    return 'src';
  }
  if (root === 'native') {
    return 'native';
  }
  if (root === 'xcode') {
    return 'safari';
  }
  if (root === 'docs') {
    return 'docs';
  }
  if (root === 'tools') {
    return 'tools';
  }
  if (parts.length === 1) {
    return 'docs';
  }
  return kebab(root || 'root');
}

function subjectFromPath(relPath) {
  const relPosix = toPosix(relPath);
  const ext = path.posix.extname(relPosix);
  const withoutExt = relPosix.slice(0, relPosix.length - ext.length);
  const parts = withoutExt.split('/').map(kebab).filter(Boolean);
  return parts[parts.length - 1] || 'file';
}

function uniqueSubject(relPath, usedKeys) {
  const domain = domainFromPath(relPath);
  const relPosix = toPosix(relPath);
  const ext = path.posix.extname(relPosix);
  const parts = relPosix
    .slice(0, relPosix.length - ext.length)
    .split('/')
    .map(kebab)
    .filter(Boolean);
  let subject = parts[parts.length - 1] || 'file';
  let index = parts.length - 2;
  while (usedKeys.has(`${domain}/${subject}`) && index >= 0) {
    subject = `${parts[index]}-${subject}`;
    index -= 1;
  }
  usedKeys.add(`${domain}/${subject}`);
  return { domain, subject };
}

function usageFromPath(relPath) {
  const relPosix = toPosix(relPath);
  const ext = path.posix.extname(relPosix).toLowerCase();
  if (relPosix.startsWith('.meta-project/templates/')) {
    return 'template';
  }
  if (
    relPosix.includes('/tests/') ||
    /\.(test|spec)\./.test(path.posix.basename(relPosix)) ||
    relPosix.includes('/fixtures/')
  ) {
    return 'test';
  }
  if (relPosix.startsWith('.github/workflows/')) {
    return 'workflow';
  }
  if (
    relPosix.includes('/scripts/') ||
    relPosix.startsWith('tools/') ||
    ext === '.sh' ||
    ext === '.py' ||
    ext === '.ps1'
  ) {
    return 'script';
  }
  if (
    ext === '.md' ||
    relPosix.startsWith('docs/') ||
    relPosix.startsWith('.meta-project/') ||
    relPosix.startsWith('.agents/')
  ) {
    return 'doc';
  }
  if (
    /^(eslint|jest|playwright|babel)\.config\./.test(path.posix.basename(relPosix)) ||
    ext === '.yml' ||
    ext === '.yaml'
  ) {
    return 'config';
  }
  return 'source';
}

function typeFromPath(relPath, usage) {
  const relPosix = toPosix(relPath);
  if (relPosix.startsWith('.github/workflows/') || usage === 'workflow') {
    return 'ci';
  }
  if (relPosix === 'SECURITY.md' || relPosix === 'PRIVACY.md') {
    return 'policy';
  }
  if (relPosix.includes('/specs/') || /[-.]spec\.md$/.test(relPosix)) {
    return 'spec';
  }
  return 'code';
}

function tagsFromPath(relPath, usage) {
  const tags = [];
  if (usage === 'test') {
    tags.push('test');
  }
  if (usage === 'workflow') {
    tags.push('workflow');
  }
  if (usage === 'script') {
    tags.push('script');
  }
  if (toPosix(relPath).startsWith('.github/')) {
    tags.push('ci');
  }
  return tags;
}

function classifyFile(relPath, usedKeys = new Set()) {
  const usage = usageFromPath(relPath);
  const { domain, subject } = uniqueSubject(relPath, usedKeys);
  return {
    type: typeFromPath(relPath, usage),
    domain,
    subject,
    usage,
    tags: tagsFromPath(relPath, usage),
    owner: '',
    related: [],
    status: 'adopted'
  };
}

function isUseStrict(line) {
  return /^['"]use strict['"];?\s*$/.test(String(line).trim());
}

function isTsCheck(line) {
  return /^\/\/\s*@ts-check\s*$/.test(String(line).trim());
}

function isMetaCommentLine(line, prefixRe) {
  return prefixRe.test(line) && /meta:\s*$/.test(line);
}

function skipSlashOrHashCommentRegion(lines, start, prefixRe) {
  let index = start;
  if (index >= lines.length || !prefixRe.test(lines[index]) || isMetaCommentLine(lines[index], prefixRe)) {
    return start;
  }
  while (index < lines.length && prefixRe.test(lines[index])) {
    index += 1;
  }
  return index;
}

function skipBlockCommentRegion(lines, start) {
  const first = lines[start] || '';
  if (!/^\s*\/\*/.test(first) || /^\s*\/\*\s*meta:/.test(first)) {
    return start;
  }
  let index = start;
  while (index < lines.length && !/\*\//.test(lines[index])) {
    index += 1;
  }
  if (index < lines.length) {
    index += 1;
  }
  return index;
}

function skipPreambleLines(lines, prefixRe) {
  let index = 0;
  if (lines[0] && lines[0].startsWith('#!')) {
    index = 1;
  }
  const skipBlanks = () => {
    while (index < lines.length && lines[index].trim() === '') {
      index += 1;
    }
  };
  skipBlanks();
  while (index < lines.length && isUseStrict(lines[index])) {
    index += 1;
    skipBlanks();
  }
  while (index < lines.length && isTsCheck(lines[index])) {
    index += 1;
    skipBlanks();
  }
  if (index < lines.length && prefixRe && !isMetaCommentLine(lines[index], prefixRe)) {
    const afterLine = skipSlashOrHashCommentRegion(lines, index, prefixRe);
    const afterBlock = skipBlockCommentRegion(lines, index);
    const next = Math.max(afterLine, afterBlock);
    if (next > index) {
      index = next;
      skipBlanks();
    }
  }
  return index;
}

function isXcodeBanner(lines, start) {
  if (start >= lines.length) {
    return false;
  }
  const region = [];
  let index = start;
  while (index < lines.length && /^\/\//.test(lines[index])) {
    region.push(lines[index]);
    index += 1;
  }
  const text = region.join('\n');
  return (
    region.length >= 3 &&
    (/Created by/.test(text) || /Copyright/.test(text) || /Licensed/.test(text) || /\/\s+\S+\.swift/.test(text))
  );
}

function isLicenseBlock(lines, start) {
  const first = lines[start] || '';
  if (!/^\s*\/\*/.test(first)) {
    return false;
  }
  let index = start;
  const collected = [first];
  while (index < lines.length && !/\*\//.test(lines[index])) {
    index += 1;
    if (index < lines.length) {
      collected.push(lines[index]);
    }
  }
  const text = collected.join('\n');
  return /Copyright|License|SPDX-License-Identifier|Mozilla Public License/i.test(text);
}

function insertOffset(text, relPath) {
  const style = commentStyle(relPath);
  const lines = text.split(/\r?\n/);
  let index = 0;

  if (lines[0] && lines[0].startsWith('#!')) {
    index = 1;
  }

  const skipBlanks = () => {
    while (index < lines.length && lines[index].trim() === '') {
      index += 1;
    }
  };

  if (style === 'html') {
    const doctype = text.match(/^<!DOCTYPE[^>]*>[ \t]*\r?\n?/i);
    if (doctype) {
      return doctype[0].length;
    }
    const xmlDecl = text.match(/^<\?xml\b[^?]*\?>[ \t]*\r?\n?/);
    if (xmlDecl) {
      return xmlDecl[0].length;
    }
    return 0;
  }

  if (style === 'frontmatter') {
    return 0;
  }

  skipBlanks();
  while (index < lines.length && isUseStrict(lines[index])) {
    index += 1;
    skipBlanks();
  }
  while (index < lines.length && isTsCheck(lines[index])) {
    index += 1;
    skipBlanks();
  }

  if (isXcodeBanner(lines, index) || isLicenseBlock(lines, index)) {
    if (isLicenseBlock(lines, index)) {
      index = skipBlockCommentRegion(lines, index);
    } else {
      index = skipSlashOrHashCommentRegion(lines, index, /^\/\//);
    }
    skipBlanks();
  }

  if (index === 0) {
    return 0;
  }
  const before = lines.slice(0, index).join('\n');
  if (before.length === text.length) {
    return text.length;
  }
  return before.length + 1;
}

function formatScalar(value) {
  if (value === '') {
    return '""';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    return `[${value.map((item) => (typeof item === 'string' ? JSON.stringify(item) : String(item))).join(', ')}]`;
  }
  if (typeof value === 'string' && !/^[A-Za-z0-9._-]+$/.test(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatHeader(meta, style) {
  const ordered = {};
  for (const field of REQUIRED_FIELDS) {
    ordered[field] = meta[field];
  }
  for (const [key, value] of Object.entries(meta)) {
    if (!(key in ordered)) {
      ordered[key] = value;
    }
  }

  if (style === 'frontmatter') {
    const lines = ['---'];
    for (const [key, value] of Object.entries(ordered)) {
      lines.push(`${key}: ${key === 'id' || key === 'owner' ? JSON.stringify(value) : formatScalar(value)}`);
    }
    lines.push('---');
    return `${lines.join('\n')}\n`;
  }

  if (style === 'html') {
    const lines = ['<!-- meta:'];
    for (const [key, value] of Object.entries(ordered)) {
      lines.push(`${key}: ${key === 'id' || key === 'owner' ? JSON.stringify(value) : formatScalar(value)}`);
    }
    lines.push('-->');
    return `${lines.join('\n')}\n`;
  }

  if (style === 'block') {
    const lines = ['/* meta:'];
    for (const [key, value] of Object.entries(ordered)) {
      lines.push(`   ${key}: ${key === 'id' || key === 'owner' ? JSON.stringify(value) : formatScalar(value)}`);
    }
    lines.push('*/');
    return `${lines.join('\n')}\n`;
  }

  const prefix = style === 'hash' ? '#' : '//';
  const lines = [`${prefix} meta:`];
  for (const [key, value] of Object.entries(ordered)) {
    const rendered = key === 'id' || key === 'owner' ? JSON.stringify(value) : formatScalar(value);
    lines.push(`${prefix}   ${key}: ${rendered}`);
  }
  return `${lines.join('\n')}\n`;
}

function mergeFrontMatter(text, meta) {
  if (!text.startsWith('---')) {
    return null;
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) {
    return null;
  }
  const after = text.slice(end + '\n---'.length).replace(/^\r?\n/, '');
  const existingBlock = text.slice(4, end);
  const seen = new Set();
  for (const rawLine of existingBlock.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*([A-Za-z0-9_]+):/);
    if (match) {
      seen.add(match[1]);
    }
  }
  const extra = [];
  for (const field of REQUIRED_FIELDS) {
    if (!seen.has(field)) {
      const value = meta[field];
      extra.push(`${field}: ${field === 'id' || field === 'owner' ? JSON.stringify(value) : formatScalar(value)}`);
    }
  }
  if (extra.length === 0) {
    return text;
  }
  const trimmedBlock = existingBlock.replace(/\s+$/, '');
  return `---\n${trimmedBlock}\n${extra.join('\n')}\n---\n${after}`;
}

function insertHeader(text, relPath, meta) {
  const style = commentStyle(relPath);
  if (!style) {
    throw new Error(`No comment style for ${relPath}`);
  }
  if (style === 'frontmatter' && text.startsWith('---')) {
    const merged = mergeFrontMatter(text, meta);
    if (merged) {
      return merged;
    }
  }
  const header = formatHeader(meta, style);
  const offset = insertOffset(text, relPath);
  const before = text.slice(0, offset);
  const after = text.slice(offset);
  const needsLeadingNl = before.length > 0 && !before.endsWith('\n');
  const glueBefore = needsLeadingNl ? '\n' : '';
  const glueAfter = after.startsWith('\n') || after === '' ? '' : '\n';
  return `${before}${glueBefore}${header}${glueAfter}${after}`;
}

module.exports = {
  BLOCK_EXTS,
  COMMENTLESS_EXTS,
  HASH_EXTS,
  HTML_EXTS,
  INLINE_HEADER_EXTS,
  REQUIRED_FIELDS,
  SKIP_DIR_NAMES,
  SKIP_EXACT_PATHS,
  SLASH_EXTS,
  classifyFile,
  commentStyle,
  domainFromPath,
  formatHeader,
  insertHeader,
  insertOffset,
  isEligiblePath,
  isExcludedPath,
  isTsCheck,
  isUseStrict,
  isVendored,
  shouldSkipDir,
  skipPreambleLines,
  subjectFromPath,
  tagsFromPath,
  toPosix,
  typeFromPath,
  uniqueSubject,
  usageFromPath
};
