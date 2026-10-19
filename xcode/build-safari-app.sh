#!/usr/bin/env bash
# Build the legacy-named Safari Web Extension wrapper app and zip the .app.
# The Xcode project and bundle IDs still use "MarkDownload"; the zip is marksnip-safari-*.
#
# xcodebuild requires -scheme (or -testProductsPath / -xctestrun) when
# -derivedDataPath is set. The shared scheme is committed at
# xcshareddata/xcschemes/MarkDownload - Markdown Web Clipper.xcscheme.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT/src"
XCODE_DIR="$ROOT/xcode/MarkDownload - Markdown Web Clipper"
PROJECT="$XCODE_DIR/MarkDownload - Markdown Web Clipper.xcodeproj"
SCHEME="MarkDownload - Markdown Web Clipper"
APP_NAME="MarkDownload - Markdown Web Clipper.app"
CONFIGURATION="${CONFIGURATION:-Release}"
DERIVED="${DERIVED_DATA_PATH:-$ROOT/tmp/safari-derived}"
DIST_DIR="${DIST_DIR:-$ROOT/dist}"

VERSION="$(python3 -c "import json; print(json.load(open('${SRC_DIR}/manifest.json'))['version'])")"
ZIP_NAME="marksnip-safari-${VERSION}${MARKSNIP_ARTIFACT_SUFFIX:-}.zip"

if [ ! -d "$SRC_DIR/.build/safari" ]; then
  echo "error: $SRC_DIR/.build/safari is missing; run npm run build:manifests in src/ first" >&2
  exit 1
fi

mkdir -p "$DERIVED" "$DIST_DIR"

SIGN_ARGS=()
if [ -n "${MACOS_DEVELOPMENT_TEAM:-}" ]; then
  SIGN_ARGS+=(
    DEVELOPMENT_TEAM="${MACOS_DEVELOPMENT_TEAM}"
    CODE_SIGN_STYLE="${MACOS_CODE_SIGN_STYLE:-Manual}"
    CODE_SIGN_IDENTITY="${MACOS_CODE_SIGN_IDENTITY:--}"
    CODE_SIGNING_ALLOWED=YES
    CODE_SIGNING_REQUIRED=YES
  )
else
  # Unsigned CI builds: skip signing so hosted macOS runners do not need a team.
  SIGN_ARGS+=(
    CODE_SIGN_IDENTITY="-"
    CODE_SIGN_STYLE=Manual
    DEVELOPMENT_TEAM=
    CODE_SIGNING_ALLOWED=NO
    CODE_SIGNING_REQUIRED=NO
  )
fi

xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination 'generic/platform=macOS' \
  -derivedDataPath "$DERIVED" \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$VERSION" \
  "${SIGN_ARGS[@]}"

APP_PATH="$DERIVED/Build/Products/${CONFIGURATION}/${APP_NAME}"
if [ ! -d "$APP_PATH" ]; then
  echo "error: expected app at $APP_PATH" >&2
  find "$DERIVED/Build/Products" -maxdepth 3 -iname '*.app' -print >&2 || true
  exit 1
fi

if [ ! -f "$APP_PATH/Contents/PlugIns/MarkDownload - Markdown Web Clipper Extension.appex/Contents/Resources/manifest.json" ] \
  && [ ! -f "$APP_PATH/Contents/PlugIns/MarkDownload - Markdown Web Clipper Extension.appex/Contents/Resources/safari/manifest.json" ]; then
  # Resources usually land at Contents/Resources/manifest.json inside the appex.
  APPEX_RESOURCES="$(find "$APP_PATH/Contents/PlugIns" -name manifest.json | head -n 1 || true)"
  if [ -z "$APPEX_RESOURCES" ]; then
    echo "error: Safari appex is missing manifest.json; web extension sources were not copied" >&2
    find "$APP_PATH" -name manifest.json -print >&2 || true
    exit 1
  fi
fi

rm -f "$DIST_DIR/$ZIP_NAME"
ditto -c -k --keepParent "$APP_PATH" "$DIST_DIR/$ZIP_NAME"
echo "Wrote $DIST_DIR/$ZIP_NAME"
