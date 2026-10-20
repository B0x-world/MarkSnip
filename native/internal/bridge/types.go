// meta:
//   id: "116-native-types"
//   type: code
//   domain: native
//   subject: types
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package bridge

const (
	HostName         = "com.marksnip.bridge"
	HostVersion      = "0.1.0"
	DefaultChromeID  = "kcbaglhfgbkjdnpeokaamjjkddempipm"
	DefaultFirefoxID = "marksnip@dhruvparikh"
)

type Browser string

const (
	BrowserChrome   Browser = "chrome"
	BrowserChromium Browser = "chromium"
	BrowserBrave    Browser = "brave"
	BrowserEdge     Browser = "edge"
	BrowserFirefox  Browser = "firefox"
)

// InstalledBrowsers is the default set that install-host / uninstall-host cover.
func InstalledBrowsers() []Browser {
	return []Browser{
		BrowserChrome,
		BrowserChromium,
		BrowserBrave,
		BrowserEdge,
		BrowserFirefox,
	}
}

func BrowserDisplayOrder() []Browser {
	return InstalledBrowsers()
}

func IsChromiumFamily(browser Browser) bool {
	switch browser {
	case BrowserChrome, BrowserChromium, BrowserBrave, BrowserEdge:
		return true
	default:
		return false
	}
}

type ClipResult struct {
	Markdown   string `json:"markdown"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	Source     string `json:"source"`
	CapturedAt string `json:"capturedAt"`
	Browser    string `json:"browser"`
}

type NativeMessage struct {
	Type             string      `json:"type"`
	RequestID        string      `json:"requestId,omitempty"`
	Fresh            bool        `json:"fresh,omitempty"`
	Browser          string      `json:"browser,omitempty"`
	ExtensionID      string      `json:"extensionId,omitempty"`
	ExtensionVersion string      `json:"extensionVersion,omitempty"`
	ConnectedAt      string      `json:"connectedAt,omitempty"`
	HostVersion      string      `json:"hostVersion,omitempty"`
	Result           *ClipResult `json:"result,omitempty"`
	Error            string      `json:"error,omitempty"`
	Code             string      `json:"code,omitempty"`
	URL              string      `json:"url,omitempty"`
}

type SessionStatus struct {
	Browser     string `json:"browser"`
	Port        int    `json:"port"`
	Token       string `json:"token"`
	PID         int    `json:"pid"`
	HostVersion string `json:"hostVersion"`
	ConnectedAt string `json:"connectedAt"`
}

type StatusFile struct {
	Sessions map[string]SessionStatus `json:"sessions"`
}

type InstalledManifest struct {
	Browser Browser
	Path    string
}

type InstallResult struct {
	ChromeManifestPath  string
	FirefoxManifestPath string
	Manifests           []InstalledManifest
}
