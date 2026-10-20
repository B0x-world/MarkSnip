// meta:
//   id: "192-src-url-utils"
//   type: code
//   domain: src
//   subject: url-utils
//   status: adopted
//   owner: ""
//   created: 2026-03-17
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipUrlUtils = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  function getTemplateUtils() {
    if (root.markSnipTemplateUtils) {
      return root.markSnipTemplateUtils;
    }

    if (typeof require === 'function') {
      try {
        return require('./template-utils');
      } catch {
        return {
          generateValidFileName: (value) => value
        };
      }
    }

    return {
      generateValidFileName: (value) => value
    };
  }

  function safeParseUrl(urlString) {
    try {
      return new URL(urlString);
    } catch {
      return null;
    }
  }

  function resolveArticleUrl(domBaseUri, pageUrl) {
    const normalizedPageUrl = typeof pageUrl === 'string' ? pageUrl.trim() : '';
    const preferredUrl = normalizedPageUrl ? safeParseUrl(normalizedPageUrl) : null;
    if (preferredUrl) {
      return preferredUrl;
    }
    return safeParseUrl(domBaseUri);
  }

  function validateUri(href, baseURI) {
    try {
      new URL(href);
    } catch {
      return new URL(href, baseURI).href;
    }
    return href;
  }

  const IMAGE_PLACEMENT_MODES = Object.freeze({
    SAME_FOLDER: 'sameFolder',
    SIDECAR: 'sidecar',
    CUSTOM_PREFIX: 'customPrefix'
  });

  const VALID_IMAGE_PLACEMENT_MODES = new Set(Object.values(IMAGE_PLACEMENT_MODES));

  function normalizePathSeparators(value) {
    return String(value || '').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  }

  function stripLeadingSlashes(value) {
    return String(value || '').replace(/^\/+/, '');
  }

  function joinPathSegments(...segments) {
    return stripLeadingSlashes(segments
      .map((segment) => normalizePathSeparators(segment).replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/'));
  }

  function getMarkdownTitleFolder(title) {
    const normalizedTitle = stripLeadingSlashes(normalizePathSeparators(title).replace(/\/+$/g, ''));
    const lastSlashIndex = normalizedTitle.lastIndexOf('/');
    return lastSlashIndex >= 0 ? normalizedTitle.substring(0, lastSlashIndex + 1) : '';
  }

  function getMarkdownTitleBaseName(title) {
    const normalizedTitle = stripLeadingSlashes(normalizePathSeparators(title).replace(/\/+$/g, ''));
    const lastSlashIndex = normalizedTitle.lastIndexOf('/');
    return lastSlashIndex >= 0 ? normalizedTitle.substring(lastSlashIndex + 1) : normalizedTitle;
  }

  function getResolvedOptionTitle(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'resolvedTitle')) {
      return String(options.resolvedTitle || '');
    }
    return String(options.title || '');
  }

  function normalizeImagePlacementMode(options = {}) {
    const mode = String(options.imagePlacement || '').trim();
    if (VALID_IMAGE_PLACEMENT_MODES.has(mode)) {
      return mode;
    }

    const imagePrefix = String(options.imagePrefix ?? '');
    if (!imagePrefix) {
      return IMAGE_PLACEMENT_MODES.SAME_FOLDER;
    }

    const normalizedPrefix = normalizePathSeparators(imagePrefix);
    if (normalizedPrefix === '{pageTitle}/' || normalizedPrefix === '{title}/') {
      return IMAGE_PLACEMENT_MODES.SIDECAR;
    }

    return IMAGE_PLACEMENT_MODES.CUSTOM_PREFIX;
  }

  function getImageBaseFilename(src, options = {}) {
    const templateUtils = getTemplateUtils();
    const generateValidFileName = templateUtils.generateValidFileName;
    const effectiveOptions = options || {};

    const slashPos = src.lastIndexOf('/');
    const queryPos = src.indexOf('?');
    let filename = src.substring(slashPos + 1, queryPos > 0 ? queryPos : src.length);

    if (filename.includes(';base64,')) {
      filename = 'image.' + filename.substring(0, filename.indexOf(';'));
    }

    const extension = filename.substring(filename.lastIndexOf('.'));
    if (extension === filename) {
      filename = filename + '.idunno';
    }

    filename = generateValidFileName(
      filename,
      effectiveOptions.disallowedChars,
      effectiveOptions.disallowedCharReplacement
    );

    return filename;
  }

  function resolveImagePath(src, options = {}) {
    const templateUtils = getTemplateUtils();
    const generateValidFileName = templateUtils.generateValidFileName;
    const effectiveOptions = options || {};
    const filename = getImageBaseFilename(src, effectiveOptions);
    const placement = normalizeImagePlacementMode(effectiveOptions);
    const title = getResolvedOptionTitle(effectiveOptions);
    let relativePath = filename;

    if (placement === IMAGE_PLACEMENT_MODES.SIDECAR) {
      const sidecarFolder = generateValidFileName(
        getMarkdownTitleBaseName(title),
        effectiveOptions.disallowedChars,
        effectiveOptions.disallowedCharReplacement
      );
      relativePath = joinPathSegments(sidecarFolder, filename);
    } else if (placement === IMAGE_PLACEMENT_MODES.CUSTOM_PREFIX) {
      relativePath = stripLeadingSlashes(normalizePathSeparators(String(effectiveOptions.imagePrefix || ''))) + filename;
    }

    return {
      filename,
      imagePlacement: placement,
      markdownPath: stripLeadingSlashes(normalizePathSeparators(relativePath)),
      markdownTitleFolder: getMarkdownTitleFolder(title)
    };
  }

  function buildImageDownloadFilename(markdownImagePath, title = '', mdClipsFolder = '') {
    return joinPathSegments(
      mdClipsFolder,
      getMarkdownTitleFolder(title),
      markdownImagePath
    );
  }

  function resolveImageDownloadPath(src, options = {}, mdClipsFolder = '') {
    const resolved = resolveImagePath(src, options);
    const title = getResolvedOptionTitle(options || {});
    return {
      ...resolved,
      downloadFilename: buildImageDownloadFilename(
        resolved.markdownPath,
        title,
        mdClipsFolder
      )
    };
  }

  function getImageFilename(src, options, prependFilePath = true) {
    const resolved = resolveImagePath(src, options || {});
    if (!prependFilePath) {
      return resolved.markdownPath;
    }
    return buildImageDownloadFilename(resolved.markdownPath, getResolvedOptionTitle(options || {}), '');
  }

  const RESTRICTED_PAGE_CODE = 'restricted_page';
  const RESTRICTED_PAGE_MESSAGE = "This page can't be clipped.";

  function hostnameOf(urlString) {
    const parsed = safeParseUrl(urlString);
    return parsed ? parsed.hostname.toLowerCase() : '';
  }

  function pathnameOf(urlString) {
    const parsed = safeParseUrl(urlString);
    return parsed ? parsed.pathname : '';
  }

  function isRestrictedTabUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return false;
    }

    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('chrome://') ||
      lower.startsWith('brave://') ||
      lower.startsWith('edge://') ||
      lower.startsWith('about:') ||
      lower.startsWith('view-source:') ||
      lower.startsWith('file:') ||
      lower.startsWith('devtools:') ||
      lower.startsWith('chrome-untrusted://') ||
      lower.startsWith('chrome-extension://') ||
      lower.startsWith('moz-extension://') ||
      lower.startsWith('safari-web-extension://') ||
      /\.pdf(?:$|[?#])/i.test(trimmed)
    ) {
      return true;
    }

    const host = hostnameOf(trimmed);
    const pathname = pathnameOf(trimmed);
    if (host === 'chromewebstore.google.com') {
      return true;
    }
    if (host === 'chrome.google.com' && pathname.toLowerCase().startsWith('/webstore')) {
      return true;
    }
    if (host === 'addons.mozilla.org' || host.endsWith('.addons.mozilla.org')) {
      return true;
    }
    return false;
  }

  function isScriptingAccessError(error) {
    const message = String(error?.message || error || '');
    return /cannot access a (chrome|brave|edge):\/\//i.test(message) ||
      /cannot access an? about:/i.test(message) ||
      /cannot access contents of the page/i.test(message) ||
      /cannot access a chrome-extension/i.test(message) ||
      /the extensions gallery cannot be scripted/i.test(message) ||
      /missing host permission/i.test(message) ||
      /restricted_page/i.test(error?.code || '');
  }

  function getRestrictedPageMessage(url) {
    const fallback = RESTRICTED_PAGE_MESSAGE;
    const i18n = root?.markSnipI18n;
    const translated = i18n?.t?.('pageCannotBeClipped', null, fallback) || fallback;
    if (url && typeof url === 'string' && url.trim()) {
      return `${translated} (${url.trim()})`;
    }
    return translated;
  }

  function createRestrictedPageError(url) {
    const error = new Error(getRestrictedPageMessage(url));
    error.code = RESTRICTED_PAGE_CODE;
    error.url = typeof url === 'string' ? url : '';
    return error;
  }

  function toRestrictedPageError(error, url) {
    if (error?.code === RESTRICTED_PAGE_CODE) {
      return error;
    }
    if (isRestrictedTabUrl(url) || isScriptingAccessError(error)) {
      return createRestrictedPageError(url);
    }
    return error;
  }

  return {
    IMAGE_PLACEMENT_MODES,
    RESTRICTED_PAGE_CODE,
    RESTRICTED_PAGE_MESSAGE,
    safeParseUrl,
    resolveArticleUrl,
    validateUri,
    normalizeImagePlacementMode,
    getMarkdownTitleFolder,
    getMarkdownTitleBaseName,
    getImageBaseFilename,
    resolveImagePath,
    buildImageDownloadFilename,
    resolveImageDownloadPath,
    getImageFilename,
    isRestrictedTabUrl,
    isScriptingAccessError,
    getRestrictedPageMessage,
    createRestrictedPageError,
    toRestrictedPageError
  };
});
