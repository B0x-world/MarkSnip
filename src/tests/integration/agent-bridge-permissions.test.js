// meta:
//   id: "225-src-agent-bridge-permissions-test"
//   type: code
//   domain: src
//   subject: agent-bridge-permissions-test
//   status: adopted
//   owner: ""
//   created: 2026-03-25
//   updated: 2026-03-25
//   related: ["001-project-file-metadata-spec"]
//   tags: ["test"]
//   usage: test

const fs = require('fs');
const path = require('path');

const manifestJson = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../manifest.json'),
  'utf8'
));

describe('Agent Bridge manifest permissions', () => {
  test('nativeMessaging is requested optionally instead of at install time', () => {
    expect(manifestJson.permissions || []).not.toContain('nativeMessaging');
    expect(manifestJson.optional_permissions || []).toContain('nativeMessaging');
  });
});
