module.exports = {
  testEnvironment: 'jsdom',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'service-worker.js',
    'offscreen/offscreen.js',
    'popup/popup.js',
    'contentScript/contentScript.js',
    'options/options.js',
    'shared/**/*.js',
    '!**/*.min.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/background/moment.min.js',
    '!**/background/apache-mime-types.js',
    '!**/__mocks__/**',
    '!**/tests/**'
  ],

  coverageThreshold: {
    './shared/template-utils.js': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './shared/url-utils.js': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './shared/selection-utils.js': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './shared/markdown-options.js': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './shared/download-tracker.js': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './shared/options-state.js': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Transform ESM-only jsdom 27+ deps so Jest on Node 20/22 can require them.
  transform: {
    "[/\\\\](@exodus[/\\\\]bytes|parse5|html-encoding-sniffer|entities|@asamuzakjp[/\\\\][^/\\\\]+|@csstools[/\\\\][^/\\\\]+)[/\\\\].+\\.(js|mjs|cjs|ts)$":
      "<rootDir>/tests/helpers/esm-cjs-transformer.js",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!.*(?:parse5|html-encoding-sniffer|entities|@exodus/bytes|@asamuzakjp/|@csstools/))",
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/vendor/',
    '/.web-extension-id/'
  ],

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000
};
