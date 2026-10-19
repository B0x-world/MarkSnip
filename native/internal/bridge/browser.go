// meta:
//   id: "111-native-browser"
//   type: code
//   domain: native
//   subject: browser
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-03-21
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package bridge

import "strings"

func DetectBrowserFromArgs(args []string) Browser {
	for _, arg := range args {
		if strings.HasPrefix(arg, "chrome-extension://") {
			return BrowserChrome
		}
		if strings.Contains(arg, DefaultFirefoxID) || strings.Contains(arg, "@") {
			return BrowserFirefox
		}
	}
	return BrowserChrome
}
