"use strict";

const { spawnSync } = require("child_process");

const WEB_EXT_SPEC = "web-ext@10.8.0";

const result = spawnSync(
  "npx",
  ["--yes", WEB_EXT_SPEC, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
