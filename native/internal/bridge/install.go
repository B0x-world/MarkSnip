// meta:
//   id: "113-native-install"
//   type: code
//   domain: native
//   subject: install
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package bridge

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

type InstallOptions struct {
	ChromeExtensionID string
}

type installEnvironment struct {
	goos              string
	userConfigDir     func() (string, error)
	userHomeDir       func() (string, error)
	setRegistryValue  func(string, string) error
	deleteRegistryKey func(string) error
}

func BuildChromeManifest(hostPath, extensionID string) map[string]any {
	return map[string]any{
		"name":            HostName,
		"description":     "MarkSnip native host",
		"path":            hostPath,
		"type":            "stdio",
		"allowed_origins": []string{fmt.Sprintf("chrome-extension://%s/", extensionID)},
	}
}

func BuildFirefoxManifest(hostPath string) map[string]any {
	return map[string]any{
		"name":               HostName,
		"description":        "MarkSnip native host",
		"path":               hostPath,
		"type":               "stdio",
		"allowed_extensions": []string{DefaultFirefoxID},
	}
}

func defaultInstallEnvironment() installEnvironment {
	return installEnvironment{
		goos:              runtime.GOOS,
		userConfigDir:     os.UserConfigDir,
		userHomeDir:       os.UserHomeDir,
		setRegistryValue:  setRegistryValue,
		deleteRegistryKey: deleteRegistryKey,
	}
}

func normalizeInstallEnvironment(env installEnvironment) installEnvironment {
	if env.goos == "" {
		env.goos = runtime.GOOS
	}
	if env.userConfigDir == nil {
		env.userConfigDir = os.UserConfigDir
	}
	if env.userHomeDir == nil {
		env.userHomeDir = os.UserHomeDir
	}
	if env.setRegistryValue == nil {
		env.setRegistryValue = setRegistryValue
	}
	if env.deleteRegistryKey == nil {
		env.deleteRegistryKey = deleteRegistryKey
	}
	return env
}

func hostBinaryName(goos string) string {
	if goos == "windows" {
		return "marksnip-native-host.exe"
	}
	return "marksnip-native-host"
}

func HostExecutableForCLI(cliExecutable string) (string, error) {
	return hostExecutableForCLI(cliExecutable, runtime.GOOS)
}

func hostExecutableForCLI(cliExecutable, goos string) (string, error) {
	absCLIPath, err := filepath.Abs(cliExecutable)
	if err != nil {
		return "", err
	}

	hostPath := filepath.Join(filepath.Dir(absCLIPath), hostBinaryName(goos))
	if _, err := os.Stat(hostPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("missing sibling host binary: %s", hostPath)
		}
		return "", err
	}
	return hostPath, nil
}

func WindowsNativeMessagingKey(browser Browser) string {
	switch browser {
	case BrowserChrome:
		return `HKCU\Software\Google\Chrome\NativeMessagingHosts\` + HostName
	case BrowserChromium:
		return `HKCU\Software\Chromium\NativeMessagingHosts\` + HostName
	case BrowserBrave:
		return `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\` + HostName
	case BrowserEdge:
		return `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\` + HostName
	case BrowserFirefox:
		return `HKCU\Software\Mozilla\NativeMessagingHosts\` + HostName
	default:
		return ""
	}
}

func ManifestPath(browser Browser) (string, error) {
	return manifestPath(defaultInstallEnvironment(), browser)
}

func manifestPath(env installEnvironment, browser Browser) (string, error) {
	env = normalizeInstallEnvironment(env)

	switch browser {
	case BrowserChrome, BrowserChromium, BrowserBrave, BrowserEdge, BrowserFirefox:
	default:
		return "", fmt.Errorf("unsupported browser: %s", browser)
	}

	switch env.goos {
	case "windows":
		configDir, err := requireDir(env.userConfigDir, "user config directory")
		if err != nil {
			return "", err
		}
		return filepath.Join(configDir, "MarkSnip", "NativeMessagingHosts", string(browser), HostName+".json"), nil
	case "darwin":
		configDir, err := requireDir(env.userConfigDir, "user config directory")
		if err != nil {
			return "", err
		}
		rel, err := darwinManifestDir(browser)
		if err != nil {
			return "", err
		}
		return filepath.Join(append([]string{configDir}, rel...)...), nil
	case "linux":
		if browser == BrowserFirefox {
			homeDir, err := requireDir(env.userHomeDir, "user home directory")
			if err != nil {
				return "", err
			}
			return filepath.Join(homeDir, ".mozilla", "native-messaging-hosts", HostName+".json"), nil
		}
		configDir, err := requireDir(env.userConfigDir, "user config directory")
		if err != nil {
			return "", err
		}
		rel, err := linuxManifestDir(browser)
		if err != nil {
			return "", err
		}
		return filepath.Join(append([]string{configDir}, rel...)...), nil
	}

	return "", fmt.Errorf("MarkSnip native host install is not supported on %s", env.goos)
}

func darwinManifestDir(browser Browser) ([]string, error) {
	switch browser {
	case BrowserChrome:
		return []string{"Google", "Chrome", "NativeMessagingHosts", HostName + ".json"}, nil
	case BrowserChromium:
		return []string{"Chromium", "NativeMessagingHosts", HostName + ".json"}, nil
	case BrowserBrave:
		return []string{"BraveSoftware", "Brave-Browser", "NativeMessagingHosts", HostName + ".json"}, nil
	case BrowserEdge:
		return []string{"Microsoft Edge", "NativeMessagingHosts", HostName + ".json"}, nil
	case BrowserFirefox:
		return []string{"Mozilla", "NativeMessagingHosts", HostName + ".json"}, nil
	default:
		return nil, fmt.Errorf("unsupported browser: %s", browser)
	}
}

func linuxManifestDir(browser Browser) ([]string, error) {
	switch browser {
	case BrowserChrome:
		return []string{"google-chrome", "NativeMessagingHosts", HostName + ".json"}, nil
	case BrowserChromium:
		return []string{"chromium", "NativeMessagingHosts", HostName + ".json"}, nil
	case BrowserBrave:
		return []string{"BraveSoftware", "Brave-Browser", "NativeMessagingHosts", HostName + ".json"}, nil
	case BrowserEdge:
		return []string{"microsoft-edge", "NativeMessagingHosts", HostName + ".json"}, nil
	default:
		return nil, fmt.Errorf("unsupported browser: %s", browser)
	}
}

func requireDir(getter func() (string, error), label string) (string, error) {
	dir, err := getter()
	if err != nil {
		return "", err
	}
	if dir == "" {
		return "", fmt.Errorf("%s is empty", label)
	}
	return dir, nil
}

func writeManifest(browser Browser, payload map[string]any, env installEnvironment) (string, error) {
	path, err := manifestPath(env, browser)
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func InstallHost(cliExecutable string, options InstallOptions) (InstallResult, error) {
	return installHost(cliExecutable, options, defaultInstallEnvironment())
}

func installHost(cliExecutable string, options InstallOptions, env installEnvironment) (InstallResult, error) {
	env = normalizeInstallEnvironment(env)

	chromeID := options.ChromeExtensionID
	if chromeID == "" {
		chromeID = DefaultChromeID
	}

	hostPath, err := hostExecutableForCLI(cliExecutable, env.goos)
	if err != nil {
		return InstallResult{}, err
	}

	result := InstallResult{Manifests: make([]InstalledManifest, 0, len(InstalledBrowsers()))}
	for _, browser := range InstalledBrowsers() {
		var payload map[string]any
		if browser == BrowserFirefox {
			payload = BuildFirefoxManifest(hostPath)
		} else {
			payload = BuildChromeManifest(hostPath, chromeID)
		}

		manifestFile, err := writeManifest(browser, payload, env)
		if err != nil {
			return InstallResult{}, err
		}
		result.Manifests = append(result.Manifests, InstalledManifest{Browser: browser, Path: manifestFile})
		switch browser {
		case BrowserChrome:
			result.ChromeManifestPath = manifestFile
		case BrowserFirefox:
			result.FirefoxManifestPath = manifestFile
		}

		if env.goos == "windows" {
			key := WindowsNativeMessagingKey(browser)
			if key == "" {
				continue
			}
			if err := env.setRegistryValue(key, manifestFile); err != nil {
				return InstallResult{}, err
			}
		}
	}

	return result, nil
}

func UninstallHost() error {
	return uninstallHost(defaultInstallEnvironment())
}

func uninstallHost(env installEnvironment) error {
	env = normalizeInstallEnvironment(env)

	if env.goos == "windows" {
		for _, browser := range InstalledBrowsers() {
			key := WindowsNativeMessagingKey(browser)
			if key == "" {
				continue
			}
			_ = env.deleteRegistryKey(key)
		}
	}

	for _, browser := range InstalledBrowsers() {
		path, err := manifestPath(env, browser)
		if err != nil {
			return err
		}
		if err := removeManifestFile(path); err != nil {
			return err
		}
	}
	return nil
}

func removeManifestFile(path string) error {
	err := os.Remove(path)
	if err == nil || errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func setRegistryValue(keyPath, value string) error {
	cmd := exec.Command("reg", "add", keyPath, "/ve", "/t", "REG_SZ", "/d", value, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("reg add failed: %w (%s)", err, string(output))
	}
	return nil
}

func deleteRegistryKey(keyPath string) error {
	cmd := exec.Command("reg", "delete", keyPath, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("reg delete failed: %w (%s)", err, string(output))
	}
	return nil
}
