// meta:
//   id: "024-tools-apply-headers"
//   type: code
//   domain: tools
//   subject: apply-headers
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec", "021-src-check-file-metadata", "025-tools-metadata-rules"]
//   tags: ["metadata", "script"]
//   usage: script

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  classifyFile,
  commentStyle,
  insertHeader,
  isEligiblePath,
  isExcludedPath,
  shouldSkipDir,
  toPosix
} = require('./rules.cjs');
const { extractMetadataBlock } = require('../../src/scripts/check-file-metadata.js');

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '../..');
const FIRST_NEW_ID = 100;

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
  return files.sort((a, b) => toPosix(path.relative(rootDir, a)).localeCompare(toPosix(path.relative(rootDir, b))));
}

function isoDay(value) {
  if (!value) {
    return null;
  }
  return String(value).slice(0, 10);
}

function collectGitDates(rootDir) {
  const dates = new Map();
  let output = '';
  try {
    output = execFileSync(
      'git',
      ['-C', rootDir, 'log', '--pretty=format:DATE %aI', '--name-status', '--find-renames'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
  } catch {
    return dates;
  }

  let currentDate = null;
  for (const rawLine of output.split('\n')) {
    if (rawLine.startsWith('DATE ')) {
      currentDate = isoDay(rawLine.slice(5));
      continue;
    }
    if (!currentDate || !rawLine) {
      continue;
    }
    const rename = rawLine.match(/^R\d*\t(.+)\t(.+)$/);
    if (rename) {
      const fromPath = toPosix(rename[1]);
      const toPath = toPosix(rename[2]);
      touchDate(dates, toPath, currentDate);
      touchDate(dates, fromPath, currentDate);
      continue;
    }
    const change = rawLine.match(/^[A-Z]\t(.+)$/);
    if (change) {
      touchDate(dates, toPosix(change[1]), currentDate);
    }
  }
  return dates;
}

function touchDate(dates, relPosix, day) {
  const current = dates.get(relPosix) || { created: day, updated: day };
  current.created = day;
  if (!current.updated) {
    current.updated = day;
  }
  dates.set(relPosix, current);
}

function nextIdNumber(usedNumbers) {
  let value = FIRST_NEW_ID;
  while (usedNumbers.has(value)) {
    value += 1;
  }
  usedNumbers.add(value);
  return String(value).padStart(3, '0');
}

function existingIdNumber(id) {
  const match = String(id).match(/^(\d{3})-/);
  return match ? Number(match[1]) : null;
}

function applyHeaders(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const write = options.write !== false;
  const today = options.today || new Date().toISOString().slice(0, 10);
  const gitDates = options.gitDates || collectGitDates(rootDir);
  const files = walkFiles(rootDir);
  const usedSubjects = new Set();
  const usedNumbers = new Set();
  const planned = [];
  const skipped = [];
  const already = [];

  for (const filePath of files) {
    const relPosix = toPosix(path.relative(rootDir, filePath));
    if (!isEligiblePath(relPosix)) {
      if (isExcludedPath(relPosix) || !commentStyle(relPosix)) {
        skipped.push({ path: relPosix, reason: exclusionReason(relPosix) });
      }
      continue;
    }

    const text = fs.readFileSync(filePath, 'utf8');
    const existing = extractMetadataBlock(text, filePath);
    if (existing && existing.usage) {
      const number = existingIdNumber(existing.id);
      if (number !== null) {
        usedNumbers.add(number);
      }
      usedSubjects.add(`${existing.domain}/${existing.subject}`);
      already.push(relPosix);
      continue;
    }

    planned.push({ filePath, relPosix, text });
  }

  const byType = {};
  const written = [];

  for (const item of planned) {
    const classified = classifyFile(item.relPosix, usedSubjects);
    const history = gitDates.get(item.relPosix) || {};
    const nnn = nextIdNumber(usedNumbers);
    const meta = {
      id: `${nnn}-${classified.domain}-${classified.subject}`,
      type: classified.type,
      domain: classified.domain,
      subject: classified.subject,
      status: classified.status,
      owner: classified.owner,
      created: history.created || today,
      updated: history.updated || today,
      related: ['001-project-file-metadata-spec'],
      tags: classified.tags,
      usage: classified.usage
    };
    const next = insertHeader(item.text, item.relPosix, meta);
    if (write && next !== item.text) {
      fs.writeFileSync(item.filePath, next, 'utf8');
    }
    written.push({ path: item.relPosix, id: meta.id, usage: meta.usage, style: commentStyle(item.relPosix) });
    byType[meta.usage] = (byType[meta.usage] || 0) + 1;
  }

  return {
    written,
    already,
    skipped,
    byType,
    write
  };
}

function exclusionReason(relPosix) {
  if (relPosix === 'README.md' || path.posix.basename(relPosix) === 'README.md') {
    return 'GitHub-special or excluded README.md';
  }
  if (path.posix.basename(relPosix) === 'CHANGELOG.md') {
    return 'generated narrative CHANGELOG';
  }
  if (relPosix.startsWith('.github/ISSUE_TEMPLATE/') || relPosix === '.github/release.yml' || relPosix === '.github/dependabot.yml' || relPosix === '.github/FUNDING.yml' || relPosix === '.github/pull_request_template.md') {
    return 'GitHub-schema or PR template';
  }
  if (relPosix.startsWith('src/popup/lib/') || relPosix.endsWith('.min.js') || relPosix.endsWith('.min.css') || /Readability\.js|turndown/.test(relPosix) || relPosix.endsWith('apache-mime-types.js') || relPosix.endsWith('browser-polyfill.min.js') || relPosix.endsWith('highlight.min.js')) {
    return 'vendored or minified';
  }
  if (relPosix.startsWith('src/tests/fixtures/e2e-markdown/')) {
    return 'golden markdown fixture (front matter would break comparisons)';
  }
  if (relPosix.includes('.xcassets/') || /\.(pbxproj|plist|entitlements|storyboard|xcscheme|xcfilelist)$/.test(relPosix)) {
    return 'Xcode-generated';
  }
  if (/\.(json|lock|png|jpg|jpeg|gif|webp|ico|woff2|mp4|mod)$/.test(relPosix)) {
    return 'comment-less format, binary, or lockfile';
  }
  if (['.gitignore', '.nvmrc', '.node-version', 'LICENSE', 'src/.gitignore'].includes(relPosix) || path.posix.basename(relPosix) === 'LICENSE') {
    return 'license or comment-less dotfile';
  }
  return 'spec exclusion';
}

function printSummary(result) {
  console.log(`Already headed: ${result.already.length}`);
  console.log(`Headers ${result.write ? 'written' : 'planned'}: ${result.written.length}`);
  for (const [usage, count] of Object.entries(result.byType).sort()) {
    console.log(`  ${usage}: ${count}`);
  }
  const grouped = new Map();
  for (const item of result.skipped) {
    const list = grouped.get(item.reason) || [];
    list.push(item.path);
    grouped.set(item.reason, list);
  }
  console.log('Skipped:');
  for (const [reason, paths] of [...grouped.entries()].sort()) {
    console.log(`  ${reason}: ${paths.length}`);
  }
}

function main() {
  const write = !process.argv.includes('--dry-run');
  const result = applyHeaders({ write });
  printSummary(result);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export { applyHeaders, collectGitDates, exclusionReason };
