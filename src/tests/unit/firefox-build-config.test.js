// meta:
//   id: "243-src-firefox-build-config-test"
//   type: code
//   domain: src
//   subject: firefox-build-config-test
//   status: adopted
//   owner: ""
//   created: 2026-05-10
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec"]
//   tags: ["test"]
//   usage: test

const fs = require('fs');
const path = require('path');
const {
  createChromeManifest,
  createFirefoxManifest,
  createSafariManifest,
  buildBrowserManifests
} = require('../../scripts/generate-browser-manifests');

const srcRoot = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(srcRoot, relativePath), 'utf8'));
}

describe('Firefox build configuration', () => {
  test('generates a Firefox-compatible background configuration', () => {
    const sourceManifest = readJson('manifest.json');
    const firefoxManifest = createFirefoxManifest(sourceManifest);

    expect(firefoxManifest.background).toEqual({
      scripts: expect.arrayContaining([
        'shared/debug-logging.js',
        'browser-polyfill.min.js',
        'shared/default-options.js',
        'shared/notifications.js',
        'shared/template-utils.js',
        'shared/url-utils.js',
        'shared/zip-utils.js',
        'service-worker.js'
      ])
    });

    const scripts = firefoxManifest.background.scripts;
    expect(scripts.indexOf('shared/template-utils.js')).toBeLessThan(scripts.indexOf('service-worker.js'));
    expect(scripts.indexOf('shared/url-utils.js')).toBeLessThan(scripts.indexOf('service-worker.js'));
    expect(scripts.indexOf('shared/zip-utils.js')).toBeLessThan(scripts.indexOf('service-worker.js'));
    expect(firefoxManifest.background.service_worker).toBeUndefined();
    expect(firefoxManifest.permissions).not.toContain('offscreen');
    expect(firefoxManifest.permissions).toEqual(expect.arrayContaining([
      'activeTab',
      'downloads',
      'storage',
      'scripting'
    ]));
    expect(firefoxManifest.browser_specific_settings?.gecko?.id).toBe('marksnip@dhruvparikh');
  });

  test('keeps Chrome-only manifest changes out of Firefox output', () => {
    const sourceManifest = readJson('manifest.json');
    const chromeManifest = createChromeManifest(sourceManifest);
    const firefoxManifest = createFirefoxManifest(sourceManifest);

    expect(chromeManifest.background).toEqual({ service_worker: 'service-worker.js' });
    expect(chromeManifest.browser_specific_settings).toBeUndefined();
    expect(chromeManifest.permissions).toContain('offscreen');
    expect(firefoxManifest.background.scripts).toContain('service-worker.js');
    expect(firefoxManifest.permissions).not.toContain('offscreen');
  });

  test('preserves explicit extension CSP in generated browser manifests', () => {
    const sourceManifest = readJson('manifest.json');
    const chromeManifest = createChromeManifest(sourceManifest);
    const firefoxManifest = createFirefoxManifest(sourceManifest);
    const safariManifest = createSafariManifest(sourceManifest);

    expect(chromeManifest.content_security_policy).toEqual(sourceManifest.content_security_policy);
    expect(firefoxManifest.content_security_policy).toEqual(sourceManifest.content_security_policy);
    expect(safariManifest.content_security_policy).toEqual(sourceManifest.content_security_policy);
  });

  test('generates a Safari-compatible background configuration from current sources', () => {
    const sourceManifest = readJson('manifest.json');
    const safariManifest = createSafariManifest(sourceManifest);

    expect(safariManifest.background).toEqual({ service_worker: 'service-worker.js' });
    expect(safariManifest.background.scripts).toBeUndefined();
    expect(safariManifest.permissions).not.toContain('offscreen');
    expect(safariManifest.browser_specific_settings?.safari?.strict_min_version).toBe('16.0');
    expect(safariManifest.browser_specific_settings?.gecko).toBeUndefined();
  });

  test('Safari build tree includes sources the old Xcode wrapper omitted', () => {
    const os = require('os');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marksnip-safari-build-'));
    try {
      const result = buildBrowserManifests({
        srcDir: srcRoot,
        buildRoot: tmpRoot,
        logger() {},
        assertArtifacts: false,
        debug: false
      });
      const required = [
        'manifest.json',
        'service-worker.js',
        'browser-polyfill.min.js',
        'highlight.min.js',
        'offscreen/offscreen.html',
        'offscreen/offscreen.js',
        '_locales/en/messages.json'
      ];
      for (const relativePath of required) {
        expect(fs.existsSync(path.join(result.safariDir, relativePath))).toBe(true);
      }
      const safariManifest = JSON.parse(
        fs.readFileSync(path.join(result.safariDir, 'manifest.json'), 'utf8')
      );
      expect(safariManifest.background.service_worker).toBe('service-worker.js');
      expect(safariManifest.permissions).not.toContain('offscreen');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('loads MathML conversion before the offscreen runtime', () => {
    const offscreenHtml = fs.readFileSync(path.join(srcRoot, 'offscreen/offscreen.html'), 'utf8');
    const mathMLScriptIndex = offscreenHtml.indexOf('../shared/mathml-to-tex.js');
    const zipUtilsScriptIndex = offscreenHtml.indexOf('../shared/zip-utils.js');
    const offscreenRuntimeIndex = offscreenHtml.indexOf('offscreen.js');

    expect(mathMLScriptIndex).toBeGreaterThan(-1);
    expect(zipUtilsScriptIndex).toBeGreaterThan(-1);
    expect(offscreenRuntimeIndex).toBeGreaterThan(-1);
    expect(mathMLScriptIndex).toBeLessThan(offscreenRuntimeIndex);
    expect(zipUtilsScriptIndex).toBeLessThan(offscreenRuntimeIndex);
    expect(fs.existsSync(path.join(srcRoot, 'shared/mathml-to-tex.js'))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, 'shared/zip-utils.js'))).toBe(true);
  });
});
