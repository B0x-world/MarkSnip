// meta:
//   id: "120-native-docs"
//   type: code
//   domain: native
//   subject: docs
//   status: adopted
//   owner: ""
//   created: 2026-10-20
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package bridge

import (
	"fmt"
	"strings"
)

const DebugEnvVar = "MARKSNIP_BRIDGE_DEBUG"

func StatusFileLocationGuide() string {
	return strings.Join([]string{
		"Linux:   $XDG_CONFIG_HOME/MarkSnip/agent-bridge/status.json",
		"         (default ~/.config/MarkSnip/agent-bridge/status.json)",
		"macOS:   ~/Library/Application Support/MarkSnip/agent-bridge/status.json",
		`Windows: %APPDATA%\MarkSnip\agent-bridge\status.json`,
	}, "\n")
}

func DebugLogLocationGuide() string {
	return strings.Join([]string{
		"Set " + DebugEnvVar + "=1 before the browser launches the native host.",
		"Logs append to host-debug.log in the same directory as status.json:",
		"Linux:   $XDG_CONFIG_HOME/MarkSnip/agent-bridge/host-debug.log",
		"macOS:   ~/Library/Application Support/MarkSnip/agent-bridge/host-debug.log",
		`Windows: %APPDATA%\MarkSnip\agent-bridge\host-debug.log`,
	}, "\n")
}

func NativeMessagingLocationGuide() string {
	name := HostName + ".json"
	return strings.Join([]string{
		"install-host writes a Chrome-format manifest (allowed_origins from --chrome-extension-id)",
		"for Chrome, Chromium, Brave, and Edge, plus a Firefox-format manifest (allowed_extensions).",
		"Brave on Linux may also read Chrome's folder; MarkSnip still installs the Brave path.",
		"",
		"Linux (~/.config unless noted):",
		"  chrome    ~/.config/google-chrome/NativeMessagingHosts/" + name,
		"  chromium  ~/.config/chromium/NativeMessagingHosts/" + name,
		"  brave     ~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/" + name,
		"  edge      ~/.config/microsoft-edge/NativeMessagingHosts/" + name,
		"  firefox   ~/.mozilla/native-messaging-hosts/" + name,
		"",
		"macOS (~/Library/Application Support):",
		"  chrome    .../Google/Chrome/NativeMessagingHosts/" + name,
		"  chromium  .../Chromium/NativeMessagingHosts/" + name,
		"  brave     .../BraveSoftware/Brave-Browser/NativeMessagingHosts/" + name,
		"  edge      .../Microsoft Edge/NativeMessagingHosts/" + name,
		"  firefox   .../Mozilla/NativeMessagingHosts/" + name,
		"",
		"Windows: JSON files live under %APPDATA%\\MarkSnip\\NativeMessagingHosts\\<browser>\\" + name,
		"and these HKCU registry keys point at them:",
		"  chrome    HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\" + HostName,
		"  chromium  HKCU\\Software\\Chromium\\NativeMessagingHosts\\" + HostName,
		"  brave     HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\" + HostName,
		"  edge      HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\" + HostName,
		"  firefox   HKCU\\Software\\Mozilla\\NativeMessagingHosts\\" + HostName,
	}, "\n")
}

func AllowedBrowserValues() string {
	return "chrome, chromium, brave, edge, firefox"
}

func DefaultChromeExtensionIDHelp() string {
	return fmt.Sprintf("default %s (Chrome Web Store ID; reused for Chromium, Brave, and Edge)", DefaultChromeID)
}
