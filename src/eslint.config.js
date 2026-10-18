const js = require("@eslint/js");
const globals = require("globals");
const eslintConfigPrettier = require("eslint-config-prettier");

const extensionGlobals = {
  browser: "readonly",
  chrome: "readonly",
  defaultOptions: "readonly",
  CodeMirror: "readonly",
  cm: "readonly",
  marked: "readonly",
  hljs: "readonly",
  TurndownService: "readonly",
  turndownPluginGfm: "readonly",
  Readability: "readonly",
  JSZip: "readonly",
  moment: "readonly",
  mimedb: "readonly",
  markSnipObsidian: "readonly",
  createMenus: "readonly",
  getOptions: "readonly",
  marksnipPrepareForCapture: "readonly",
  getSelectionAndDom: "readonly",
  downloadMarkdown: "readonly",
  clipSite: "readonly",
  recordNotificationMetrics: "readonly",
  handleInstalled: "readonly",
  handleCommands: "readonly",
  handleContextMenuClick: "readonly",
  ensureOffscreenDocumentExists: "readonly",
  batchState: "writable",
  importScripts: "readonly",
  self: "readonly",
  window: "readonly",
  document: "readonly",
  DOMParser: "readonly",
  fr: "readonly",
};

const nodeAndTestFiles = [
  "scripts/**/*.js",
  "jest.config.js",
  "playwright.config.js",
  "tests/**/*.js",
];

module.exports = [
  {
    ignores: [
      ".build/**",
      "node_modules/**",
      "test-results/**",
      "test-artifacts/**",
      "background/**",
      "browser-polyfill.min.js",
      "highlight.min.js",
      "popup/lib/**",
    ],
  },
  js.configs.recommended,
  {
    // Match ESLint 8: unused inline disable comments were not reported.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.es2021,
        ...extensionGlobals,
      },
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "no-undef": "off",
      "no-redeclare": "off",
      "no-global-assign": "off",
      "no-prototype-builtins": "off",
      "no-control-regex": "off",
      "no-self-assign": "off",
      "no-useless-escape": "off",
      "no-async-promise-executor": "off",
      "no-empty-pattern": "off",
    },
  },
  {
    files: nodeAndTestFiles,
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  {
    files: ["**/*.js"],
    ignores: nodeAndTestFiles,
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
  },
  eslintConfigPrettier,
];
