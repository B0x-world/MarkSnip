// meta:
//   id: "117-native-browser-test"
//   type: code
//   domain: native
//   subject: browser-test
//   status: adopted
//   owner: ""
//   created: 2026-10-20
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: test

package bridge

import "testing"

func TestParseBrowser(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		input   string
		want    Browser
		wantErr bool
	}{
		{name: "empty", input: "", want: ""},
		{name: "chrome", input: "Chrome", want: BrowserChrome},
		{name: "chromium", input: "chromium-browser", want: BrowserChromium},
		{name: "brave", input: "brave", want: BrowserBrave},
		{name: "edge", input: "msedge", want: BrowserEdge},
		{name: "firefox", input: "firefox", want: BrowserFirefox},
		{name: "unknown", input: "safari", wantErr: true},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := ParseBrowser(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseBrowser: %v", err)
			}
			if got != tc.want {
				t.Fatalf("ParseBrowser(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestClassifyProcessName(t *testing.T) {
	t.Parallel()

	cases := map[string]Browser{
		"/usr/lib/brave-browser/brave": BrowserBrave,
		"Brave Browser Helper":         BrowserBrave,
		"/opt/google/chrome/chrome":    BrowserChrome,
		"Google Chrome":                BrowserChrome,
		"chromium":                     BrowserChromium,
		"/usr/lib/chromium/chromium":   BrowserChromium,
		"msedge.exe":                   BrowserEdge,
		"Microsoft Edge Helper":        BrowserEdge,
		"firefox":                      BrowserFirefox,
		"something-else":               "",
	}

	for name, want := range cases {
		name, want := name, want
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if got := ClassifyProcessName(name); got != want {
				t.Fatalf("ClassifyProcessName(%q) = %q, want %q", name, got, want)
			}
		})
	}
}

func TestDetectBrowserFromArgsUsesParentProcessForChromiumFamily(t *testing.T) {
	t.Parallel()

	origin := "chrome-extension://" + DefaultChromeID + "/"
	if got := detectBrowserFromArgs([]string{origin}, "/usr/lib/brave-browser/brave"); got != BrowserBrave {
		t.Fatalf("got %q, want brave", got)
	}
	if got := detectBrowserFromArgs([]string{origin}, "msedge"); got != BrowserEdge {
		t.Fatalf("got %q, want edge", got)
	}
	if got := detectBrowserFromArgs([]string{origin}, "chromium"); got != BrowserChromium {
		t.Fatalf("got %q, want chromium", got)
	}
	if got := detectBrowserFromArgs([]string{origin}, ""); got != BrowserChrome {
		t.Fatalf("got %q, want chrome", got)
	}
	if got := detectBrowserFromArgs([]string{DefaultFirefoxID}, "firefox"); got != BrowserFirefox {
		t.Fatalf("got %q, want firefox", got)
	}
}

func TestPreferSpecificBrowser(t *testing.T) {
	t.Parallel()

	if got := PreferSpecificBrowser(BrowserChrome, BrowserBrave); got != BrowserBrave {
		t.Fatalf("got %q, want brave", got)
	}
	if got := PreferSpecificBrowser(BrowserBrave, BrowserChrome); got != BrowserBrave {
		t.Fatalf("got %q, want brave", got)
	}
	if got := PreferSpecificBrowser(BrowserFirefox, BrowserChrome); got != BrowserFirefox {
		t.Fatalf("got %q, want firefox", got)
	}
}
