// meta:
//   id: "159-src-debug-build"
//   type: code
//   domain: src
//   subject: debug-build
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec"]
//   tags: ["script"]
//   usage: script

const fs = require("fs");
const path = require("path");

const DEBUG_CALL_CALLEES = ["logger.debug", "markSnipLogger.debug"];

function isFirstPartyJs(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  if (!normalized.endsWith(".js")) return false;
  if (normalized.endsWith(".min.js")) return false;
  if (normalized.includes("/popup/lib/")) return false;
  if (normalized.includes("/node_modules/")) return false;
  if (normalized.endsWith("/background/Readability.js")) return false;
  if (normalized.endsWith("/background/turndown.js")) return false;
  if (normalized.endsWith("/background/turndown-plugin-gfm.js")) return false;
  if (normalized.endsWith("/background/apache-mime-types.js")) return false;
  return true;
}

function skipString(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) {
      return i + 1;
    }
    if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
      i = skipTemplateExpression(source, i + 2);
      continue;
    }
    i += 1;
  }
  return source.length;
}

function skipTemplateExpression(source, start) {
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i);
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      i = skipLineComment(source, i);
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i = skipBlockComment(source, i);
      continue;
    }
    if (ch === "/" && canStartRegexLiteral(source, i)) {
      i = skipRegexLiteral(source, i);
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    i += 1;
  }
  return i;
}

function skipLineComment(source, start) {
  const nl = source.indexOf("\n", start);
  return nl === -1 ? source.length : nl + 1;
}

function skipBlockComment(source, start) {
  const end = source.indexOf("*/", start + 2);
  return end === -1 ? source.length : end + 2;
}

function matchingParen(source, openIndex) {
  let depth = 0;
  let i = openIndex;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i);
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      i = skipLineComment(source, i);
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i = skipBlockComment(source, i);
      continue;
    }
    if (ch === "/" && canStartRegexLiteral(source, i)) {
      i = skipRegexLiteral(source, i);
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function canStartRegexLiteral(source, slashIndex) {
  let i = slashIndex - 1;
  while (i >= 0 && /[ \t\r]/.test(source[i])) i -= 1;
  if (i < 0) return true;
  const ch = source[i];
  if ("(,=:[!&|?{};~%^*+-<>\n".includes(ch)) return true;
  const word = source.slice(0, i + 1).match(/[A-Za-z_$][A-Za-z0-9_$]*$/);
  return Boolean(
    word &&
      /^(return|throw|case|typeof|new|in|of|await|yield|delete|void|else)$/.test(word[0])
  );
}

function skipRegexLiteral(source, start) {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "[" && !inClass) inClass = true;
    else if (ch === "]" && inClass) inClass = false;
    else if (ch === "/" && !inClass) {
      i += 1;
      while (i < source.length && /[A-Za-z]/.test(source[i])) i += 1;
      return i;
    }
    if (ch === "\n") return start + 1;
    i += 1;
  }
  return start + 1;
}

function nextNonSpace(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  return i;
}

function isIdentifierBoundary(source, index) {
  if (index < 0 || index >= source.length) return true;
  return !/[A-Za-z0-9_$]/.test(source[index]);
}

function stripLoggerDebugCalls(source) {
  let output = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = skipString(source, i);
      output += source.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      const end = skipLineComment(source, i);
      output += source.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = skipBlockComment(source, i);
      output += source.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "/" && canStartRegexLiteral(source, i)) {
      const end = skipRegexLiteral(source, i);
      output += source.slice(i, end);
      i = end;
      continue;
    }

    const slice = source.slice(i);
    const callee = DEBUG_CALL_CALLEES.find((name) => slice.startsWith(name));
    if (
      callee &&
      isIdentifierBoundary(source, i - 1) &&
      isIdentifierBoundary(source, i + callee.length)
    ) {
      const afterCallee = nextNonSpace(source, i + callee.length);
      if (source[afterCallee] === "(") {
        const close = matchingParen(source, afterCallee);
        if (close !== -1) {
          let end = close + 1;
          const afterClose = nextNonSpace(source, end);
          if (source[afterClose] === ";") {
            end = afterClose + 1;
          }
          if (/\n/.test(source.slice(i, end))) {
            output += "\n";
          }
          i = end;
          continue;
        }
      }
    }

    output += ch;
    i += 1;
  }
  return output;
}

function writeReleaseLogger(targetPath) {
  const contents = `(function (root) {
  function createLogger(options) {
    const consoleRef = (options && options.console) || root.console || {};

    function write(method, fallback, args) {
      if (typeof consoleRef[method] === "function") {
        consoleRef[method](...args);
        return;
      }
      if (fallback && typeof consoleRef[fallback] === "function") {
        consoleRef[fallback](...args);
      }
    }

    return {
      info(...args) {
        write("info", "log", args);
      },
      warn(...args) {
        write("warn", "log", args);
      },
      error(...args) {
        write("error", "log", args);
      }
    };
  }

  const logger = createLogger();
  root.markSnipLogger = logger;
  root.markSnipCreateLogger = createLogger;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createLogger };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
`;
  fs.writeFileSync(targetPath, contents, "utf8");
}

function collectFiles(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, files);
      continue;
    }
    if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function stripDebugFromTree(targetDir) {
  const files = collectFiles(targetDir, isFirstPartyJs);
  for (const filePath of files) {
    const original = fs.readFileSync(filePath, "utf8");
    const stripped = stripLoggerDebugCalls(original);
    if (stripped !== original) {
      fs.writeFileSync(filePath, stripped, "utf8");
    }
  }
  const loggerPath = path.join(targetDir, "shared", "debug-logging.js");
  if (fs.existsSync(loggerPath)) {
    writeReleaseLogger(loggerPath);
  }
  const buildConfigPath = path.join(targetDir, "shared", "build-config.js");
  if (fs.existsSync(buildConfigPath)) {
    fs.rmSync(buildConfigPath);
  }
}

function listMapFiles(dir) {
  return collectFiles(dir, (filePath) => filePath.endsWith(".map"));
}

function firstPartySourceMappingUrls(dir) {
  const hits = [];
  for (const filePath of collectFiles(dir, isFirstPartyJs)) {
    const text = fs.readFileSync(filePath, "utf8");
    if (text.includes("sourceMappingURL")) {
      hits.push(filePath);
    }
  }
  return hits;
}

function firstPartyDebugCalls(dir) {
  const hits = [];
  for (const filePath of collectFiles(dir, isFirstPartyJs)) {
    const text = fs.readFileSync(filePath, "utf8");
    if (/\blogger\.debug\b/.test(text) || /\bmarkSnipLogger\.debug\b/.test(text)) {
      hits.push(filePath);
    }
  }
  return hits;
}

function assertBuildDebugArtifacts(targetDir, { debug }) {
  const maps = listMapFiles(targetDir);
  const mappingUrls = firstPartySourceMappingUrls(targetDir);
  const debugCalls = firstPartyDebugCalls(targetDir);
  const buildConfig = path.join(targetDir, "shared", "build-config.js");
  const hasBuildConfig = fs.existsSync(buildConfig);

  if (debug) {
    if (maps.length === 0) {
      throw new Error(`Debug build ${targetDir} has no source maps`);
    }
    if (debugCalls.length === 0) {
      throw new Error(`Debug build ${targetDir} has no logger.debug calls`);
    }
    if (!hasBuildConfig) {
      throw new Error(`Debug build ${targetDir} is missing shared/build-config.js`);
    }
    const config = fs.readFileSync(buildConfig, "utf8");
    if (!config.includes("debug: true")) {
      throw new Error(`Debug build config does not set debug: true`);
    }
    return {
      maps: maps.length,
      debugCalls: debugCalls.length
    };
  }

  if (maps.length > 0) {
    throw new Error(`Non-debug build ${targetDir} contains source maps: ${maps.slice(0, 5).join(", ")}`);
  }
  if (mappingUrls.length > 0) {
    throw new Error(`Non-debug build ${targetDir} contains first-party sourceMappingURL: ${mappingUrls.slice(0, 5).join(", ")}`);
  }
  if (debugCalls.length > 0) {
    throw new Error(`Non-debug build ${targetDir} still has logger.debug: ${debugCalls.slice(0, 5).join(", ")}`);
  }
  if (hasBuildConfig) {
    throw new Error(`Non-debug build ${targetDir} should not include shared/build-config.js`);
  }
  return { maps: 0, debugCalls: 0 };
}

module.exports = {
  isFirstPartyJs,
  stripLoggerDebugCalls,
  stripDebugFromTree,
  writeReleaseLogger,
  assertBuildDebugArtifacts,
  collectFiles
};
