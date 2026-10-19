// meta:
//   id: "246-src-hashtag-handling-test"
//   type: code
//   domain: src
//   subject: hashtag-handling-test
//   status: adopted
//   owner: ""
//   created: 2026-03-03
//   updated: 2026-03-17
//   related: ["001-project-file-metadata-spec"]
//   tags: ["test"]
//   usage: test

/**
 * Hashtag handling behavior tests.
 * Uses shared production helpers.
 */

const { createBrowserEnvironment } = require('../helpers/browser-env');
const {
  applyHashtagHandlingToHtml,
  applyHashtagHandlingToMarkdown
} = require('../../shared/hashtag-utils');

function convertHtmlWithHashtagHandling(html, mode) {
  const env = createBrowserEnvironment();
  const service = new env.TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    fence: '```'
  });

  const processedHtml = applyHashtagHandlingToHtml(html, mode);
  const markdown = service.turndown(processedHtml);
  return applyHashtagHandlingToMarkdown(markdown, mode);
}

describe('Hashtag Handling', () => {
  test('keep mode leaves hashtags unchanged', () => {
    const markdown = convertHtmlWithHashtagHandling('<p>#research and #ai</p>', 'keep');
    expect(markdown).toContain('#research');
    expect(markdown).toContain('#ai');
  });

  test('remove mode strips leading # from hashtag-like tokens', () => {
    const markdown = convertHtmlWithHashtagHandling(
      '<h2>#Research Notes</h2><p>Track #ai and #ml updates.</p>',
      'remove'
    );

    expect(markdown).toContain('## Research Notes');
    expect(markdown).toContain('Track ai and ml updates.');
    expect(markdown).not.toContain('#Research');
    expect(markdown).not.toContain('#ai');
  });

  test('escape mode writes hashtag-like tokens as escaped markdown', () => {
    const markdown = convertHtmlWithHashtagHandling(
      '<h2>#Research Notes</h2><p>Track #ai updates.</p>',
      'escape'
    );

    expect(markdown).toContain('## \\#Research Notes');
    expect(markdown).toContain('\\#ai');
  });

  test('does not alter hashtags inside fenced or inline code', () => {
    const markdown = convertHtmlWithHashtagHandling(
      '<p>#outside</p><pre><code>#inside_fence</code></pre><p><code>#inside_inline</code></p>',
      'remove'
    );

    expect(markdown).toContain('outside');
    expect(markdown).toContain('#inside_fence');
    expect(markdown).toContain('`#inside_inline`');
  });

  test('does not alter URL fragments while still handling plain hashtags', () => {
    const markdown = convertHtmlWithHashtagHandling(
      '<p>Visit https://example.com/#section and tag #topic</p><p><a href="https://example.com/#anchor">https://example.com/#anchor</a></p>',
      'remove'
    );

    expect(markdown).toContain('https://example.com/#section');
    expect(markdown).toContain('https://example.com/#anchor');
    expect(markdown).toContain('tag topic');
    expect(markdown).not.toContain('#topic');
  });
});
