// meta:
//   id: "231-src-security-surface-test"
//   type: code
//   domain: src
//   subject: security-surface-test
//   status: adopted
//   owner: ""
//   created: 2026-06-05
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: ["test"]
//   usage: test

const fs = require('fs');
const path = require('path');

const manifestJson = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../manifest.json'),
  'utf8'
));

describe('Security surface hardening', () => {
  test('manifest declares an explicit extension page CSP', () => {
    const csp = manifestJson.content_security_policy?.extension_pages || '';

    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain('connect-src');
  });

  test('shared URL utils treat file URLs as restricted tab URLs', () => {
    const { isRestrictedTabUrl } = require('../../shared/url-utils');
    expect(isRestrictedTabUrl('file:///tmp/doc.html')).toBe(true);
    expect(isRestrictedTabUrl('brave://settings')).toBe(true);
  });
});
