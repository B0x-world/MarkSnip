// meta:
//   id: "021-src-check-file-metadata"
//   type: code
//   domain: src
//   subject: check-file-metadata
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec"]
//   tags: ["ci", "metadata"]
//   usage: script

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SRC_DIR, '..');

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

const ALLOWED_STATUS = new Set(['draft', 'proposed', 'adopted', 'superseded', 'deprecated']);
const ALLOWED_USAGE = new Set([
  'source',
  'test',
  'config',
  'workflow',
  'doc',
  'template',
  'script',
  'asset'
]);
const ALLOWED_TYPE = new Set([
  'plan',
  'decision',
  'status',
  'change-proposal',
  'checklist',
  'risk',
  'spec',
  'ci',
  'policy',
  'code',
  'form'
]);

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  '.build',
  'dist',
  'tmp',
  'coverage',
  'test-artifacts',
  'test-results',
  'web-ext-artifacts'
]);

const PLACEHOLDER = /^\{\{[^}]+\}\}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isPlaceholder(value) {
  return typeof value === 'string' && PLACEHOLDER.test(value.trim());
}

function stripCommentPrefix(line, prefixRe) {
  return line.replace(prefixRe, '');
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === '[]') {
    return [];
  }
  if (value === '""' || value === "''") {
    return '';
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (/^\[.*\]$/.test(value)) {
    const inner = value.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner.split(',').map((item) => parseScalar(item));
  }
  const commentIndex = value.indexOf(' #');
  if (commentIndex !== -1) {
    return parseScalar(value.slice(0, commentIndex));
  }
  return value;
}

function parseYamlBlock(block) {
  const data = {};
  let currentKey = null;
  const lines = block.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      if (!Array.isArray(data[currentKey])) {
        data[currentKey] = [];
      }
      data[currentKey].push(parseScalar(listMatch[1]));
      continue;
    }
    const keyMatch = line.match(/^\s*([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyMatch) {
      throw new Error(`Invalid metadata line: ${line}`);
    }
    currentKey = keyMatch[1];
    const rest = keyMatch[2];
    data[currentKey] = rest === '' ? [] : parseScalar(rest);
  }
  return data;
}

function tryParseYamlBlock(block) {
  try {
    return parseYamlBlock(block);
  } catch {
    return null;
  }
}

function extractFrontMatter(text) {
  if (!text.startsWith('---')) {
    return null;
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) {
    return null;
  }
  return tryParseYamlBlock(text.slice(4, end));
}

function extractHtmlMeta(text) {
  const match = text.match(/<!--\s*meta:\s*([\s\S]*?)-->/);
  if (!match) {
    return null;
  }
  return tryParseYamlBlock(match[1]);
}

function extractPrefixedMeta(text, prefixRe) {
  const lines = text.split(/\r?\n/);
  let index = 0;
  if (lines[0] && lines[0].startsWith('#!')) {
    index = 1;
    if (lines[1] === '') {
      index = 2;
    }
  }
  while (index < lines.length && lines[index].trim() === '') {
    index += 1;
  }
  if (index >= lines.length || !prefixRe.test(lines[index]) || !/meta:\s*$/.test(lines[index])) {
    return null;
  }
  index += 1;
  const collected = [];
  while (index < lines.length && prefixRe.test(lines[index])) {
    collected.push(stripCommentPrefix(lines[index], prefixRe));
    index += 1;
  }
  if (collected.length === 0) {
    return null;
  }
  return tryParseYamlBlock(collected.join('\n'));
}

function extractMetadataBlock(text, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md') {
    return extractFrontMatter(text) || extractHtmlMeta(text);
  }
  if (ext === '.html' || ext === '.xml') {
    return extractHtmlMeta(text);
  }
  if (ext === '.yml' || ext === '.yaml' || ext === '.sh' || ext === '.py') {
    return extractPrefixedMeta(text, /^#\s?/);
  }
  if (ext === '.js' || ext === '.ts' || ext === '.go' || ext === '.swift' || ext === '.css') {
    const slash = extractPrefixedMeta(text, /^\/\/\s?/);
    if (slash) {
      return slash;
    }
    const block = text.match(/\/\*\s*meta:\s*([\s\S]*?)\*\//);
    return block ? tryParseYamlBlock(block[1]) : null;
  }
  return extractFrontMatter(text) || extractHtmlMeta(text) || extractPrefixedMeta(text, /^#\s?/);
}

function validateMetadata(meta, filePath) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!(field in meta)) {
      errors.push(`${filePath}: missing field ${field}`);
    }
  }
  if (errors.length > 0) {
    return errors;
  }

  const checkEnum = (field, allowed) => {
    const value = meta[field];
    if (isPlaceholder(value)) {
      return;
    }
    if (!allowed.has(value)) {
      errors.push(`${filePath}: ${field} "${value}" is not allowed`);
    }
  };

  checkEnum('status', ALLOWED_STATUS);
  checkEnum('usage', ALLOWED_USAGE);
  checkEnum('type', ALLOWED_TYPE);

  for (const field of ['created', 'updated']) {
    const value = meta[field];
    if (typeof value !== 'string' || !(ISO_DATE.test(value) || isPlaceholder(value))) {
      errors.push(`${filePath}: ${field} must be YYYY-MM-DD or {{YYYY-MM-DD}}`);
    }
  }

  for (const field of ['related', 'tags']) {
    if (!Array.isArray(meta[field])) {
      errors.push(`${filePath}: ${field} must be an array`);
    }
  }

  if (typeof meta.id !== 'string' || !meta.id.trim()) {
    errors.push(`${filePath}: id must be a non-empty string`);
  }

  return errors;
}

function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(name);
}

function walkFiles(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }
      files.push(fullPath);
    }
  }
  return files;
}

function checkFileMetadata(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const files = options.files || walkFiles(rootDir);
  const checked = [];
  const errors = [];

  for (const filePath of files) {
    if (filePath.endsWith('.meta.yaml')) {
      const meta = parseYamlBlock(fs.readFileSync(filePath, 'utf8'));
      const target = filePath.slice(0, -'.meta.yaml'.length);
      checked.push(filePath);
      errors.push(...validateMetadata(meta, target));
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.zip', '.xpi'].includes(ext)) {
      continue;
    }
    let text;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\u0000')) {
      continue;
    }
    let meta = null;
    try {
      meta = extractMetadataBlock(text, filePath);
    } catch (error) {
      errors.push(`${filePath}: ${error.message}`);
      continue;
    }
    if (!meta || !meta.usage) {
      continue;
    }
    checked.push(filePath);
    errors.push(...validateMetadata(meta, filePath));
  }

  return { ok: errors.length === 0, checked, errors };
}

function main() {
  const result = checkFileMetadata();
  if (result.checked.length === 0) {
    console.log('No file metadata headers found.');
    return;
  }
  console.log(`Checked ${result.checked.length} file(s) with metadata headers.`);
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
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
  ALLOWED_STATUS,
  ALLOWED_TYPE,
  ALLOWED_USAGE,
  REQUIRED_FIELDS,
  checkFileMetadata,
  extractMetadataBlock,
  parseYamlBlock,
  validateMetadata
};
