// meta:
//   id: "110-native-marksnip-main"
//   type: code
//   domain: native
//   subject: marksnip-main
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/DhruvParikh1/markdownload-extension-updated/native/internal/bridge"
)

type clipResponse struct {
	Result *bridge.ClipResult `json:"result,omitempty"`
	Error  string             `json:"error,omitempty"`
	Code   string             `json:"code,omitempty"`
	URL    string             `json:"url,omitempty"`
}

func main() {
	os.Exit(run(os.Args, os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	prog := filepath.Base(args[0])
	if len(args) < 2 || isHelpToken(args[1]) {
		fmt.Fprint(stdout, topLevelHelp(prog))
		if len(args) < 2 {
			return 1
		}
		return 0
	}

	if args[1] == "help" {
		command := ""
		if len(args) > 2 {
			command = args[2]
		}
		if command == "" {
			fmt.Fprint(stdout, topLevelHelp(prog))
		} else {
			fmt.Fprint(stdout, commandHelp(prog, command))
		}
		return 0
	}

	if looksLikeHelp(args[2:]) {
		fmt.Fprint(stdout, commandHelp(prog, args[1]))
		return 0
	}

	var err error
	switch args[1] {
	case "clip":
		err = runClip(args[2:], stdout, stderr)
	case "status":
		err = runStatus(stdout, stderr)
	case "install-host":
		err = runInstallHost(args[2:], stdout)
	case "uninstall-host":
		err = bridge.UninstallHost()
		if err == nil {
			fmt.Fprintln(stdout, "Removed MarkSnip native host registration.")
		}
	default:
		fmt.Fprint(stderr, topLevelHelp(prog))
		return 1
	}
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			fmt.Fprint(stdout, commandHelp(prog, args[1]))
			return 0
		}
		fmt.Fprintln(stderr, err)
		return 1
	}
	return 0
}

func runInstallHost(args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("install-host", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	chromeID := fs.String("chrome-extension-id", bridge.DefaultChromeID, "Chromium-family extension ID")
	if err := fs.Parse(args); err != nil {
		return err
	}

	exe, err := os.Executable()
	if err != nil {
		return err
	}

	result, err := bridge.InstallHost(exe, bridge.InstallOptions{
		ChromeExtensionID: *chromeID,
	})
	if err != nil {
		return err
	}

	fmt.Fprintln(stdout, "Installed MarkSnip native host manifests.")
	for _, manifest := range result.Manifests {
		fmt.Fprintf(stdout, "%s: %s\n", manifest.Browser, manifest.Path)
	}
	return nil
}

func runStatus(stdout, stderr io.Writer) error {
	live, stale, err := bridge.RefreshLiveStatus()
	if err != nil {
		return err
	}

	if len(stale) > 0 {
		fmt.Fprintf(stderr, "Removed %d stale MarkSnip bridge session(s): %s\n", len(stale), formatSessionList(stale))
	}

	if len(live.Sessions) == 0 {
		return errors.New("no live MarkSnip bridge session is connected; open chrome, chromium, brave, edge, or firefox with Agent Bridge enabled")
	}

	for _, session := range bridge.OrderedSessions(live) {
		fmt.Fprintf(stdout, "%s: connected on 127.0.0.1:%d (pid=%d, host=%s, since=%s)\n",
			session.Browser,
			session.Port,
			session.PID,
			session.HostVersion,
			session.ConnectedAt,
		)
	}
	return nil
}

func runClip(args []string, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("clip", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	jsonOutput := fs.Bool("json", false, "Print JSON instead of Markdown")
	fresh := fs.Bool("fresh", false, "Recapture instead of using a popup-edited cache")
	browserName := fs.String("browser", "", "chrome|chromium|brave|edge|firefox")
	if err := fs.Parse(args); err != nil {
		return err
	}

	requested, err := bridge.ParseBrowser(*browserName)
	if err != nil {
		return err
	}

	live, stale, err := bridge.RefreshLiveStatus()
	if err != nil {
		return err
	}
	if len(stale) > 0 {
		fmt.Fprintf(stderr, "Removed %d stale MarkSnip bridge session(s): %s\n", len(stale), formatSessionList(stale))
	}

	candidates, err := clipCandidates(live, requested)
	if err != nil {
		return err
	}

	var lastErr error
	for index, session := range candidates {
		result, err := requestClip(session, *fresh)
		if err == nil {
			if *jsonOutput {
				encoder := json.NewEncoder(stdout)
				encoder.SetIndent("", "  ")
				return encoder.Encode(result)
			}
			_, err = fmt.Fprint(stdout, result.Markdown)
			return err
		}
		lastErr = err
		if requested != "" || !isConnectionError(err) || index == len(candidates)-1 {
			return err
		}
		fmt.Fprintf(stderr, "Session %s is no longer reachable; trying the next live session.\n", session.Browser)
	}
	if lastErr != nil {
		return lastErr
	}
	return errors.New("no live MarkSnip bridge session is connected")
}

func clipCandidates(live bridge.StatusFile, requested bridge.Browser) ([]bridge.SessionStatus, error) {
	if requested != "" {
		session, err := bridge.SelectSession(live, requested)
		if err != nil {
			return nil, err
		}
		return []bridge.SessionStatus{session}, nil
	}

	if len(live.Sessions) == 0 {
		return nil, errors.New("no live MarkSnip bridge session is connected; open chrome, chromium, brave, edge, or firefox with Agent Bridge enabled")
	}
	if len(live.Sessions) > 1 {
		return nil, fmt.Errorf("multiple MarkSnip bridge sessions are connected; rerun with --browser chrome, chromium, brave, edge, or firefox")
	}
	return bridge.OrderedSessions(live), nil
}

func requestClip(session bridge.SessionStatus, fresh bool) (*bridge.ClipResult, error) {
	requestBody, err := json.Marshal(map[string]any{
		"fresh": fresh,
	})
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("http://127.0.0.1:%d/clip", session.Port)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(requestBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MarkSnip-Token", session.Token)

	client := &http.Client{Timeout: 35 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to contact MarkSnip native host: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed clipResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Error != "" {
		return nil, errors.New(parsed.Error)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("bridge request failed with HTTP %d", resp.StatusCode)
	}
	if parsed.Result == nil {
		return nil, errors.New("MarkSnip bridge returned no clip result")
	}
	return parsed.Result, nil
}

func isConnectionError(err error) bool {
	if err == nil {
		return false
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "connection refused") ||
		strings.Contains(message, "connect: ") ||
		strings.Contains(message, "no live")
}

func formatSessionList(sessions []bridge.SessionStatus) string {
	names := make([]string, 0, len(sessions))
	for _, session := range sessions {
		if session.Browser == "" {
			continue
		}
		names = append(names, fmt.Sprintf("%s pid=%d", session.Browser, session.PID))
	}
	if len(names) == 0 {
		return "unknown"
	}
	return strings.Join(names, ", ")
}
