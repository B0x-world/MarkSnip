# Safari wrapper (MarkSnip)

The macOS Safari Web Extension wrapper lives at `xcode/MarkSnip/`. Display names for the app, extension, Xcode targets, scheme, and bundles are **MarkSnip**. The packaged zip is still `marksnip-safari-<version>.zip`.

## Bundle IDs (unchanged)

These IDs stayed on the upstream MarkDownload values so existing Safari extension state, App Store records, and native-messaging host mappings keep working:

| Target | Display name | Product | Bundle ID |
| --- | --- | --- | --- |
| App | MarkSnip | `MarkSnip.app` | `au.death.MarkDownload` |
| Extension | MarkSnip Extension | `MarkSnip Extension.appex` | `au.death.MarkDownload.Extension` |

`ViewController.swift` looks up the extension with `au.death.MarkDownload.Extension`.

## Generated web-extension tree

Do not point Xcode at raw `src/` folders. Generate first, then build:

```bash
cd src && npm ci && npm run build:manifests
bash xcode/build-safari-app.sh
```

`src/scripts/generate-browser-manifests.js` writes `src/.build/safari` (Safari-compatible `manifest.json` plus the full extension sources, including `service-worker.js`, `offscreen/`, `_locales/`, `browser-polyfill.min.js`, and `highlight.min.js`). A Run Script build phase rsyncs that tree into the appex resources.

Safari supports MV3 service workers but not offscreen documents. The Safari manifest uses `background.service_worker` and omits the `offscreen` permission, matching the Firefox fallback: clipping loads `offscreen/offscreen.html` as an extension page.

CI and CodeQL build the wrapper **unsigned** (`CODE_SIGNING_ALLOWED=NO`). See the root README [Code signing](../README.md#code-signing) section.
