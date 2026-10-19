const fs = require('fs');
const path = require('path');
const { stripLoggerDebugCalls } = require('../../scripts/debug-build');
const { createFirefoxManifest } = require('../../scripts/generate-browser-manifests');

describe('debug build stripping', () => {
  test('removes logger.debug call sites including nested arguments', () => {
    const source = `
      keep();
      logger.debug('one', nest(a, b));
      stillHere();
      markSnipLogger.debug(
        foo(bar()),
        "text"
      );
      logger.debugEnabled();
      logger.info('stay');
    `;
    const stripped = stripLoggerDebugCalls(source);
    expect(stripped).toContain('keep();');
    expect(stripped).toContain('stillHere();');
    expect(stripped).toContain("logger.info('stay');");
    expect(stripped).toContain('logger.debugEnabled();');
    expect(stripped).not.toMatch(/logger\.debug\s*\(/);
    expect(stripped).not.toMatch(/markSnipLogger\.debug\s*\(/);
  });

  test('does not strip logger.debug inside strings or comments', () => {
    const source = `
      const msg = "logger.debug('nope')";
      // logger.debug('comment')
      logger.info('ok');
    `;
    const stripped = stripLoggerDebugCalls(source);
    expect(stripped).toContain("logger.debug('nope')");
    expect(stripped).toContain("// logger.debug('comment')");
    expect(stripped).toContain("logger.info('ok')");
  });

  test('still strips logger.debug after a regex that contains a backtick', () => {
    const source = [
      "const n = markdown.replace(/`/g, '').length;",
      "logger.debug(`Starting download for tab ${tabId}`);",
      "logger.info('stay');"
    ].join("\n");
    const stripped = stripLoggerDebugCalls(source);
    expect(stripped).toContain("markdown.replace(/`/g, '')");
    expect(stripped).not.toMatch(/logger\.debug\s*\(/);
    expect(stripped).toContain("logger.info('stay')");
  });

  test('Firefox background scripts include build-config only for debug builds', () => {
    const sourceManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../manifest.json'), 'utf8'));
    expect(createFirefoxManifest(sourceManifest).background.scripts).not.toContain('shared/build-config.js');
    expect(createFirefoxManifest(sourceManifest, { debug: true }).background.scripts[0]).toBe('shared/build-config.js');
  });
});
