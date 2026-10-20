// meta:
//   id: "124-native-host-help-test"
//   type: code
//   domain: native
//   subject: native-host-help-test
//   status: adopted
//   owner: ""
//   created: 2026-10-20
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: test

package main

import (
	"strings"
	"testing"
)

func TestNativeHostHelpMentionsBrowserLaunch(t *testing.T) {
	text := nativeHostHelp("marksnip-native-host")
	if !strings.Contains(text, "Launched by the browser") {
		t.Fatalf("unexpected help:\n%s", text)
	}
}
