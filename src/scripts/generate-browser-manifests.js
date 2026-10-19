const fs = require("fs");
const path = require("path");
const {
  isFirstPartyJs,
  stripDebugFromTree,
  assertBuildDebugArtifacts
} = require("./debug-build");

const SRC_DIR = path.resolve(__dirname, "..");
const BUILD_ROOT = path.join(SRC_DIR, ".build");

const EXCLUDED_NAMES = new Set([
  "node_modules",
  "tests",
  "web-ext-artifacts",
  ".build",
  "coverage",
  ".gitignore",
  "package.json",
  "package-lock.json",
  "jest.config.js",
  "playwright.config.js",
  "scripts",
  "test-artifacts",
  "test-results",
  "build-config.js"
]);

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDED_NAMES.has(entry.name)) {
      continue;
    }
    if (entry.name.endsWith(".map")) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function writeManifest(targetDir, manifest) {
  const manifestPath = path.join(targetDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

const SCRIPT_BACKGROUND_FILES = [
  "shared/debug-logging.js",
  "browser-polyfill.min.js",
  "shared/i18n.js",
  "background/moment.min.js",
  "shared/notifications.js",
  "shared/default-options.js",
  "shared/template-utils.js",
  "shared/url-utils.js",
  "shared/zip-utils.js",
  "shared/highlight-state.js",
  "shared/interpreter-utils.js",
  "shared/agent-bridge-state.js",
  "shared/context-menus.js",
  "service-worker.js"
];

function backgroundScripts(debug) {
  if (debug) {
    return ["shared/build-config.js", ...SCRIPT_BACKGROUND_FILES];
  }
  return [...SCRIPT_BACKGROUND_FILES];
}

function createChromeManifest(sourceManifest) {
  const chromeManifest = JSON.parse(JSON.stringify(sourceManifest));
  chromeManifest.background = { service_worker: "service-worker.js" };
  delete chromeManifest.browser_specific_settings;
  return chromeManifest;
}

function applyScriptBackground(manifest, debug = false) {
  manifest.background = { scripts: backgroundScripts(debug) };
  manifest.permissions = manifest.permissions.filter((p) => p !== "offscreen");
  return manifest;
}

function createFirefoxManifest(sourceManifest, options = {}) {
  return applyScriptBackground(JSON.parse(JSON.stringify(sourceManifest)), options.debug === true);
}

function createSafariManifest(sourceManifest) {
  // Safari 16+ supports MV3 service workers (importScripts in service-worker.js).
  // It does not support chrome.offscreen documents; strip that Chrome-only
  // permission the same way Firefox does so clipping falls back to loading
  // offscreen/offscreen.html as an extension page.
  const safariManifest = JSON.parse(JSON.stringify(sourceManifest));
  safariManifest.background = { service_worker: "service-worker.js" };
  safariManifest.permissions = safariManifest.permissions.filter((p) => p !== "offscreen");
  safariManifest.browser_specific_settings = {
    safari: {
      strict_min_version: "16.0"
    }
  };
  return safariManifest;
}

function isDebugBuild(options = {}) {
  if (typeof options.debug === "boolean") {
    return options.debug;
  }
  if (process.argv.includes("--debug")) {
    return true;
  }
  const env = String(process.env.MARKSNIP_DEBUG || "").toLowerCase();
  return env === "true" || env === "1" || env === "yes" || env === "on";
}

function writeBuildConfig(targetDir) {
  const contents = `(function (root) {
  root.MARKSNIP_BUILD = {
    debug: true,
    sourceMaps: true
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
`;
  fs.mkdirSync(path.join(targetDir, "shared"), { recursive: true });
  fs.writeFileSync(path.join(targetDir, "shared", "build-config.js"), contents, "utf8");
}

function injectBuildConfigReferences(targetDir) {
  const swPath = path.join(targetDir, "service-worker.js");
  if (fs.existsSync(swPath)) {
    const original = fs.readFileSync(swPath, "utf8");
    if (!original.includes("shared/build-config.js")) {
      const next = original.replace(
        "'shared/debug-logging.js',",
        "'shared/build-config.js',\n    'shared/debug-logging.js',"
      );
      fs.writeFileSync(swPath, next, "utf8");
    }
  }

  const htmlFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.name.endsWith(".html")) htmlFiles.push(fullPath);
    }
  }
  walk(targetDir);

  for (const htmlPath of htmlFiles) {
    const original = fs.readFileSync(htmlPath, "utf8");
    if (original.includes("shared/build-config.js")) continue;
    const next = original.replace(
      /<script([^>]*)src="(\.\.\/shared\/)debug-logging\.js"><\/script>/g,
      '<script$1src="$2build-config.js"></script>\n  <script$1src="$2debug-logging.js"></script>'
    );
    if (next !== original) {
      fs.writeFileSync(htmlPath, next, "utf8");
    }
  }
}

function collectJsFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, files);
      continue;
    }
    if (isFirstPartyJs(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function emitSourceMaps(targetDir, logger) {
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch (error) {
    logger(`Skipping source maps (esbuild unavailable): ${error.message}`);
    return;
  }

  const files = collectJsFiles(targetDir);
  for (const filePath of files) {
    esbuild.buildSync({
      absWorkingDir: targetDir,
      entryPoints: [filePath],
      outfile: filePath,
      allowOverwrite: true,
      bundle: false,
      sourcemap: true,
      legalComments: "none",
      logLevel: "silent"
    });
  }
  logger(`Wrote source maps for ${files.length} first-party script(s)`);
}

function applyDebugMode(targetDir, debug, logger) {
  if (debug) {
    writeBuildConfig(targetDir);
    injectBuildConfigReferences(targetDir);
    emitSourceMaps(targetDir, logger);
    return;
  }
  stripDebugFromTree(targetDir);
}

function buildBrowserManifests(options = {}) {
  const srcDir = options.srcDir || SRC_DIR;
  const buildRoot = options.buildRoot || BUILD_ROOT;
  const logger = options.logger || console.log;
  const debug = isDebugBuild(options);
  const chromeDir = path.join(buildRoot, "chrome");
  const firefoxDir = path.join(buildRoot, "firefox");
  const safariDir = path.join(buildRoot, "safari");
  const sourceManifestPath = path.join(srcDir, "manifest.json");
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));

  fs.rmSync(buildRoot, { recursive: true, force: true });

  copyDirectory(srcDir, chromeDir);
  copyDirectory(srcDir, firefoxDir);
  copyDirectory(srcDir, safariDir);

  applyDebugMode(chromeDir, debug, logger);
  applyDebugMode(firefoxDir, debug, logger);
  applyDebugMode(safariDir, debug, logger);

  const chromeManifest = createChromeManifest(sourceManifest);
  const firefoxManifest = createFirefoxManifest(sourceManifest, { debug });
  const safariManifest = createSafariManifest(sourceManifest);

  writeManifest(chromeDir, chromeManifest);
  writeManifest(firefoxDir, firefoxManifest);
  writeManifest(safariDir, safariManifest);

  if (options.assertArtifacts !== false) {
    assertBuildDebugArtifacts(chromeDir, { debug });
    assertBuildDebugArtifacts(firefoxDir, { debug });
    assertBuildDebugArtifacts(safariDir, { debug });
  }

  logger("Generated browser manifests:");
  logger(`- Chrome:  ${path.relative(srcDir, path.join(chromeDir, "manifest.json"))}`);
  logger(`- Firefox: ${path.relative(srcDir, path.join(firefoxDir, "manifest.json"))}`);
  logger(`- Safari:  ${path.relative(srcDir, path.join(safariDir, "manifest.json"))}`);
  logger(`- Debug:   ${debug}`);

  return {
    chromeDir,
    firefoxDir,
    safariDir,
    chromeManifest,
    firefoxManifest,
    safariManifest,
    debug
  };
}

function main() {
  buildBrowserManifests();
}

if (require.main === module) {
  main();
}

module.exports = {
  createChromeManifest,
  createFirefoxManifest,
  createSafariManifest,
  buildBrowserManifests,
  isDebugBuild,
  backgroundScripts
};
