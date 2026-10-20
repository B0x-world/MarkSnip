// meta:
//   id: "122-native-host-help"
//   type: code
//   domain: native
//   subject: native-host-help
//   status: adopted
//   owner: ""
//   created: 2026-10-20
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package main

import (
	"fmt"
	"strings"
)

func nativeHostHelp(prog string) string {
	return fmt.Sprintf(`Usage: %s

Launched by the browser for MarkSnip native messaging. Use the sibling marksnip
CLI (clip, status, install-host) from a terminal.

Flags:
  -h, --help          Show this help
`, prog)
}

func wantsNativeHostHelp(args []string) bool {
	for _, arg := range args {
		switch strings.ToLower(strings.TrimSpace(arg)) {
		case "-h", "-help", "--help", "help":
			return true
		}
	}
	return false
}
