"use strict";

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
