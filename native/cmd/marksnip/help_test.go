// meta:
//   id: "123-native-marksnip-help-test"
//   type: code
//   domain: native
//   subject: marksnip-help-test
//   status: adopted
//   owner: ""
//   created: 2026-10-20
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: test

package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/DhruvParikh1/markdownload-extension-updated/native/internal/bridge"
)

func TestHelpListsCommandFlags(t *testing.T) {
	var out bytes.Buffer
	if code := run([]string{"marksnip", "help", "clip"}, &out, &bytes.Buffer{}); code != 0 {
		t.Fatalf("help clip exit %d", code)
	}
	text := out.String()
	for _, needle := range []string{"--json", "--fresh", "--browser", "chrome|chromium|brave|edge|firefox", "Default: false"} {
		if !strings.Contains(text, needle) {
			t.Fatalf("clip help missing %q in:\n%s", needle, text)
		}
	}

	out.Reset()
	if code := run([]string{"marksnip", "install-host", "--help"}, &out, &bytes.Buffer{}); code != 0 {
		t.Fatalf("install-host --help exit %d", code)
	}
	if !strings.Contains(out.String(), "--chrome-extension-id") || !strings.Contains(out.String(), bridge.DefaultChromeID) {
		t.Fatalf("install-host help missing extension id flag:\n%s", out.String())
	}
}
