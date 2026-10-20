// meta:
//   id: "121-native-marksnip-help"
//   type: code
//   domain: native
//   subject: marksnip-help
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

	"github.com/DhruvParikh1/markdownload-extension-updated/native/internal/bridge"
)

func topLevelHelp(prog string) string {
	return fmt.Sprintf(`Usage: %s <clip|status|install-host|uninstall-host> [flags]
       %[1]s help <command>
       %[1]s <command> --help

Commands:
  clip            Capture the active tab as Markdown
  status          Show live Agent Bridge sessions
  install-host    Register native-messaging manifests
  uninstall-host  Remove native-messaging manifests
  help            Show this help, or flags for a command

Global flags:
  -h, --help      Show help
`, prog)
}

func commandHelp(prog, command string) string {
	switch command {
	case "clip":
		return fmt.Sprintf(`Usage: %s clip [flags]

Flags:
  --json              Print JSON instead of Markdown
                      Allowed: true|false (boolean flag)
                      Default: false
  --fresh             Recapture the page instead of using a popup-edited cache
                      Allowed: true|false (boolean flag)
                      Default: false
  --browser <name>    Session to use when more than one browser is connected
                      Allowed: chrome|chromium|brave|edge|firefox
                      Default: unset (required if multiple sessions are live)
                      chrome matches a single Chromium-family session when no
                      exact chrome session exists
  -h, --help          Show this help
`, prog)
	case "status":
		return fmt.Sprintf(`Usage: %s status [flags]

Flags:
  -h, --help          Show this help
`, prog)
	case "install-host":
		return fmt.Sprintf(`Usage: %s install-host [flags]

Flags:
  --chrome-extension-id <id>
                      Chromium-family extension ID written into Chrome, Chromium,
                      Brave, and Edge manifests
                      Allowed: a Chrome extension id string
                      Default: %s
  -h, --help          Show this help
`, prog, bridge.DefaultChromeID)
	case "uninstall-host":
		return fmt.Sprintf(`Usage: %s uninstall-host [flags]

Flags:
  -h, --help          Show this help
`, prog)
	default:
		return topLevelHelp(prog)
	}
}

func isHelpToken(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "-h", "-help", "--help":
		return true
	default:
		return false
	}
}

func looksLikeHelp(args []string) bool {
	for _, arg := range args {
		if isHelpToken(arg) {
			return true
		}
	}
	return false
}
