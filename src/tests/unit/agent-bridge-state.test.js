// meta:
//   id: "235-src-agent-bridge-state-test"
//   type: code
//   domain: src
//   subject: agent-bridge-state-test
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: ["test"]
//   usage: test

const agentBridgeState = require('../../shared/agent-bridge-state');

describe('agent-bridge-state helpers', () => {
  test('normalizes settings to disabled by default', () => {
    expect(agentBridgeState.normalizeSettings()).toEqual({ enabled: false });
    expect(agentBridgeState.normalizeSettings({ enabled: true })).toEqual({ enabled: true });
  });

  test('normalizes status with an explicit connecting state', () => {
    expect(agentBridgeState.normalizeStatus()).toEqual({
      enabled: false,
      permissionGranted: false,
      connecting: false,
      connected: false,
      hostInstalled: false,
      browser: '',
      hostVersion: '',
      lastError: '',
      updatedAt: ''
    });

    expect(agentBridgeState.normalizeStatus({
      enabled: true,
      permissionGranted: true,
      connecting: true,
      connected: false,
      hostInstalled: true,
      browser: ' Chrome ',
      hostVersion: ' 0.1.0 ',
      lastError: ' waiting ',
      updatedAt: ' 2026-03-22T00:00:00.000Z '
    })).toEqual({
      enabled: true,
      permissionGranted: true,
      connecting: true,
      connected: false,
      hostInstalled: true,
      browser: 'chrome',
      hostVersion: '0.1.0',
      lastError: 'waiting',
      updatedAt: '2026-03-22T00:00:00.000Z'
    });
  });

  test('normalizes latest clip and strips hashes from page urls', () => {
    const clip = agentBridgeState.normalizeLatestClip({
      title: 'Doc',
      markdown: '# Hello',
      pageUrl: 'https://example.com/path#intro',
      source: 'popup'
    });

    expect(clip.pageUrl).toBe('https://example.com/path#intro');
    expect(clip.normalizedPageUrl).toBe('https://example.com/path');
    expect(clip.source).toBe('popup');
  });

  test('matches latest clip to the active page using normalized urls', () => {
    const clip = {
      title: 'Doc',
      markdown: '# Hello',
      pageUrl: 'https://example.com/path#intro',
      source: 'popup'
    };

    expect(agentBridgeState.shouldUseLatestClipForPage(clip, 'https://example.com/path#summary')).toBe(true);
    expect(agentBridgeState.shouldUseLatestClipForPage(clip, 'https://example.com/other')).toBe(false);
  });

  test('persists settings and latest clip through storage helpers', async () => {
    const storage = {
      values: {},
      async get(key) {
        return { [key]: this.values[key] };
      },
      async set(payload) {
        this.values = { ...this.values, ...payload };
      },
      async remove(key) {
        delete this.values[key];
      }
    };

    await agentBridgeState.saveSettings({ enabled: true }, storage);
    await agentBridgeState.saveLatestClip({
      title: 'Saved',
      markdown: 'body',
      pageUrl: 'https://example.com/path#part',
      source: 'popup'
    }, storage);

    const settings = await agentBridgeState.loadSettings(storage);
    const latestClip = await agentBridgeState.loadLatestClip(storage);

    expect(settings).toEqual({ enabled: true });
    expect(latestClip.title).toBe('Saved');
    expect(latestClip.normalizedPageUrl).toBe('https://example.com/path');
  });

  test('detects firefox, brave, edge, chromium, and chrome labels', () => {
    const chromeExt = {
      getURL: () => 'chrome-extension://abc/'
    };

    expect(agentBridgeState.detectBrowserLabel({
      browser: { runtime: { getURL: () => 'moz-extension://abc/' } },
      navigator: {}
    })).toBe('firefox');

    expect(agentBridgeState.detectBrowserLabel({
      browser: { runtime: chromeExt },
      navigator: { brave: { isBrave: () => true }, userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' }
    })).toBe('brave');

    expect(agentBridgeState.detectBrowserLabel({
      browser: { runtime: chromeExt },
      navigator: { brave: { isBrave: () => Promise.resolve(true) }, userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' }
    })).toBe('brave');

    expect(agentBridgeState.detectBrowserLabel({
      browser: { runtime: chromeExt },
      navigator: {
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        userAgentData: { brands: [{ brand: 'Microsoft Edge', version: '120' }, { brand: 'Chromium', version: '120' }] }
      }
    })).toBe('edge');

    expect(agentBridgeState.detectBrowserLabel({
      browser: { runtime: chromeExt },
      navigator: {
        userAgent: 'Mozilla/5.0 Chromium/120.0.0.0 Safari/537.36',
        userAgentData: { brands: [{ brand: 'Chromium', version: '120' }, { brand: 'Not.A/Brand', version: '8' }] }
      }
    })).toBe('chromium');

    expect(agentBridgeState.detectBrowserLabel({
      browser: { runtime: chromeExt },
      navigator: {
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        userAgentData: { brands: [{ brand: 'Google Chrome', version: '120' }, { brand: 'Chromium', version: '120' }] }
      }
    })).toBe('chrome');
  });
});
