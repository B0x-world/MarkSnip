// meta:
//   id: "111-native-browser"
//   type: code
//   domain: native
//   subject: browser
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package bridge

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

var lookupParentProcessName = parentProcessName

func ParseBrowser(name string) (Browser, error) {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "":
		return "", nil
	case "chrome", "google-chrome", "google chrome":
		return BrowserChrome, nil
	case "chromium", "chromium-browser":
		return BrowserChromium, nil
	case "brave", "brave-browser":
		return BrowserBrave, nil
	case "edge", "msedge", "microsoft-edge", "microsoft edge":
		return BrowserEdge, nil
	case "firefox":
		return BrowserFirefox, nil
	default:
		return "", fmt.Errorf("unsupported browser %q (use chrome, chromium, brave, edge, or firefox)", name)
	}
}

func DetectBrowserFromArgs(args []string) Browser {
	return detectBrowserFromArgs(args, lookupParentProcessName())
}

func detectBrowserFromArgs(args []string, processName string) Browser {
	fromArgs := browserFromNativeArgs(args)
	fromProcess := ClassifyProcessName(processName)

	if fromProcess == BrowserFirefox {
		return BrowserFirefox
	}
	if fromArgs == BrowserFirefox {
		return BrowserFirefox
	}
	if fromProcess != "" {
		return fromProcess
	}
	if fromArgs != "" {
		return fromArgs
	}
	return BrowserChrome
}

func PreferSpecificBrowser(current, reported Browser) Browser {
	if reported == "" {
		return current
	}
	if current == "" {
		return reported
	}
	if current == reported {
		return current
	}
	if current == BrowserFirefox || reported == BrowserFirefox {
		return current
	}
	if current == BrowserChrome && IsChromiumFamily(reported) {
		return reported
	}
	return current
}

func ClassifyProcessName(name string) Browser {
	normalized := strings.ToLower(strings.ReplaceAll(name, "\\", "/"))
	base := normalized
	if idx := strings.LastIndex(normalized, "/"); idx >= 0 {
		base = normalized[idx+1:]
	}
	base = strings.TrimSuffix(base, ".exe")
	joined := base + " " + normalized

	switch {
	case strings.Contains(joined, "firefox"):
		return BrowserFirefox
	case strings.Contains(joined, "brave"):
		return BrowserBrave
	case strings.Contains(joined, "msedge") || strings.Contains(joined, "microsoft-edge") || strings.Contains(joined, "microsoft edge"):
		return BrowserEdge
	case strings.Contains(joined, "chromium"):
		return BrowserChromium
	case strings.Contains(joined, "google-chrome") || strings.Contains(joined, "google chrome") || strings.Contains(joined, "chrome"):
		return BrowserChrome
	default:
		return ""
	}
}

func browserFromNativeArgs(args []string) Browser {
	for _, arg := range args {
		if strings.HasPrefix(arg, "chrome-extension://") {
			return BrowserChrome
		}
		if strings.Contains(arg, DefaultFirefoxID) || strings.Contains(arg, "@") {
			return BrowserFirefox
		}
	}
	return ""
}

func parentProcessName() string {
	ppid := os.Getppid()
	if ppid <= 1 {
		return ""
	}

	switch runtime.GOOS {
	case "linux":
		if target, err := os.Readlink(fmt.Sprintf("/proc/%d/exe", ppid)); err == nil {
			if target != "" {
				return target
			}
		}
		if data, err := os.ReadFile(fmt.Sprintf("/proc/%d/comm", ppid)); err == nil {
			return strings.TrimSpace(string(data))
		}
		if data, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", ppid)); err == nil {
			return strings.TrimSpace(strings.ReplaceAll(string(data), "\x00", " "))
		}
	case "darwin":
		out, err := exec.Command("ps", "-p", strconv.Itoa(ppid), "-o", "comm=").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
	case "windows":
		out, err := exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", ppid), "/FO", "CSV", "/NH").Output()
		if err == nil {
			line := strings.TrimSpace(string(out))
			if strings.HasPrefix(line, `"`) {
				if end := strings.Index(line[1:], `"`); end >= 0 {
					return line[1 : 1+end]
				}
			}
			if fields := strings.Split(line, ","); len(fields) > 0 {
				return strings.Trim(fields[0], `"`)
			}
		}
	}

	return ""
}
