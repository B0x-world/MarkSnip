#!/usr/bin/env bash
# Generate src/.build/safari if needed, then build the unsigned MarkSnip Safari
# wrapper .app and zip it as marksnip-safari-*.zip.
#
# Display names are MarkSnip. Bundle IDs stay au.death.MarkDownload /
# au.death.MarkDownload.Extension (see xcode/README.md).
#
# xcodebuild requires -scheme (or -testProductsPath / -xctestrun) when
# -derivedDataPath is set. The shared scheme is committed at
# xcode/MarkSnip/MarkSnip.xcodeproj/xcshareddata/xcschemes/MarkSnip.xcscheme.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT/src"
XCODE_DIR="$ROOT/xcode/MarkSnip"
PROJECT="$XCODE_DIR/MarkSnip.xcodeproj"
SCHEME="MarkSnip"
APP_NAME="MarkSnip.app"
EXTENSION_NAME="MarkSnip Extension.appex"
CONFIGURATION="${CONFIGURATION:-Release}"
DERIVED="${DERIVED_DATA_PATH:-$ROOT/tmp/safari-derived}"
DIST_DIR="${DIST_DIR:-$ROOT/dist}"

VERSION="$(python3 -c "import json; print(json.load(open('${SRC_DIR}/manifest.json'))['version'])")"
ZIP_NAME="marksnip-safari-${VERSION}${MARKSNIP_ARTIFACT_SUFFIX:-}.zip"

if [ ! -d "$SRC_DIR/.build/safari" ]; then
  echo "Generating Safari web extension tree at $SRC_DIR/.build/safari"
  (cd "$SRC_DIR" && npm run build:manifests)
fi

if [ ! -d "$SRC_DIR/.build/safari" ]; then
  echo "error: $SRC_DIR/.build/safari is missing after generate" >&2
  exit 1
fi

mkdir -p "$DERIVED" "$DIST_DIR"

# Always unsigned. Store/OS signing is a later opt-in step (see README Code signing).
SIGN_ARGS=(
  CODE_SIGN_IDENTITY="-"
  CODE_SIGN_STYLE=Manual
  DEVELOPMENT_TEAM=
  CODE_SIGNING_ALLOWED=NO
  CODE_SIGNING_REQUIRED=NO
)

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

APPEX_MANIFEST="$APP_PATH/Contents/PlugIns/${EXTENSION_NAME}/Contents/Resources/manifest.json"
if [ ! -f "$APPEX_MANIFEST" ]; then
  APPEX_RESOURCES="$(find "$APP_PATH/Contents/PlugIns" -name manifest.json | head -n 1 || true)"
  if [ -z "$APPEX_RESOURCES" ]; then
    echo "error: Safari appex is missing manifest.json; web extension sources were not copied" >&2
    find "$APP_PATH" -name manifest.json -print >&2 || true
    exit 1
  fi
  APPEX_MANIFEST="$APPEX_RESOURCES"
fi

for required in service-worker.js browser-polyfill.min.js highlight.min.js offscreen _locales; do
  required_path="$(dirname "$APPEX_MANIFEST")/${required}"
  if [ ! -e "$required_path" ]; then
    echo "error: Safari appex is missing ${required} (expected at $required_path)" >&2
    exit 1
  fi
done

rm -f "$DIST_DIR/$ZIP_NAME"
ditto -c -k --keepParent "$APP_PATH" "$DIST_DIR/$ZIP_NAME"
echo "Wrote $DIST_DIR/$ZIP_NAME"
