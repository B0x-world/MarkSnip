#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildBrowserManifests } = require("./generate-browser-manifests");
const { assertBuildDebugArtifacts } = require("./debug-build");

function parseArgs(argv) {
  const options = { dir: null, debug: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") {
      options.dir = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--dir=")) {
      options.dir = arg.slice("--dir=".length);
    } else if (arg === "--debug") {
      options.debug = true;
    } else if (arg.startsWith("--debug=")) {
      const raw = arg.slice("--debug=".length).toLowerCase();
      options.debug = raw === "true" || raw === "1" || raw === "yes" || raw === "on";
    }
  }
  return options;
}

function assertDir(dir, debug) {
  const result = assertBuildDebugArtifacts(dir, { debug });
  console.log(
    `${debug ? "debug" : "release"} ${dir}: maps=${result.maps} debugCalls=${result.debugCalls}`
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dir) {
    if (!fs.existsSync(options.dir)) {
      throw new Error(`Build directory not found: ${options.dir}`);
    }
    const debug = options.debug === true;
    assertDir(options.dir, debug);
    return;
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "marksnip-debug-artifacts-"));
  try {
    const releaseRoot = path.join(tmpRoot, "release");
    const debugRoot = path.join(tmpRoot, "debug");
    buildBrowserManifests({
      buildRoot: releaseRoot,
      debug: false,
      logger: () => {}
    });
    buildBrowserManifests({
      buildRoot: debugRoot,
      debug: true,
      logger: () => {}
    });
    for (const browser of ["chrome", "firefox", "safari"]) {
      assertDir(path.join(releaseRoot, browser), false);
      assertDir(path.join(debugRoot, browser), true);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
