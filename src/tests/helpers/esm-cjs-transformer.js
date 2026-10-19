"use strict";

// meta:
//   id: "222-src-esm-cjs-transformer"
//   type: code
//   domain: src
//   subject: esm-cjs-transformer
//   status: adopted
//   owner: ""
//   created: 2026-10-18
//   updated: 2026-10-18
//   related: ["001-project-file-metadata-spec"]
//   tags: ["test"]
//   usage: test

const path = require("path");
const esbuild = require("esbuild");

const loaders = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".ts": "ts",
  ".mts": "ts",
};

module.exports = {
  process(sourceText, sourcePath) {
    const ext = path.extname(sourcePath);
    const result = esbuild.transformSync(sourceText, {
      loader: loaders[ext] || "js",
      format: "cjs",
      sourcefile: sourcePath,
      target: "node20",
    });
    return { code: result.code };
  },
};
