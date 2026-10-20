// meta:
//   id: "115-native-status"
//   type: code
//   domain: native
//   subject: status
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package bridge

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var (
	lookupProcess = processState
	probeSession  = httpProbeSession
)

func baseDir() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "MarkSnip", "agent-bridge"), nil
}

func StatusPath() (string, error) {
	dir, err := baseDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "status.json"), nil
}

func EnsureStateBaseDir() (string, error) {
	dir, err := baseDir()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func ReadStatusFile() (StatusFile, error) {
	path, err := StatusPath()
	if err != nil {
		return StatusFile{}, err
	}

	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return StatusFile{Sessions: map[string]SessionStatus{}}, nil
	}
	if err != nil {
		return StatusFile{}, err
	}

	var status StatusFile
	if err := json.Unmarshal(data, &status); err != nil {
		return StatusFile{}, err
	}
	if status.Sessions == nil {
		status.Sessions = map[string]SessionStatus{}
	}
	return status, nil
}

func WriteStatusFile(status StatusFile) error {
	if _, err := EnsureStateBaseDir(); err != nil {
		return err
	}

	if status.Sessions == nil {
		status.Sessions = map[string]SessionStatus{}
	}

	path, err := StatusPath()
	if err != nil {
		return err
	}

	payload, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}

	tempPath := path + ".tmp"
	if err := os.WriteFile(tempPath, append(payload, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Chmod(tempPath, 0o600); err != nil && runtime.GOOS != "windows" {
		_ = os.Remove(tempPath)
		return err
	}
	_ = os.Remove(path)
	if err := os.Rename(tempPath, path); err != nil {
		return err
	}
	if err := os.Chmod(path, 0o600); err != nil && runtime.GOOS != "windows" {
		return err
	}
	return nil
}

func WriteSession(session SessionStatus) error {
	status, err := ReadStatusFile()
	if err != nil {
		return err
	}
	if status.Sessions == nil {
		status.Sessions = map[string]SessionStatus{}
	}

	status.Sessions[session.Browser] = session
	return WriteStatusFile(status)
}

func RemoveSession(browser Browser, pid int) error {
	status, err := ReadStatusFile()
	if err != nil {
		return err
	}

	current, ok := status.Sessions[string(browser)]
	if !ok {
		return nil
	}
	if pid != 0 && current.PID != pid {
		return nil
	}

	delete(status.Sessions, string(browser))
	return WriteStatusFile(status)
}

func RelabelSession(from, to Browser, pid int) error {
	if from == "" || to == "" || from == to {
		return nil
	}

	status, err := ReadStatusFile()
	if err != nil {
		return err
	}

	current, ok := status.Sessions[string(from)]
	if !ok {
		return nil
	}
	if pid != 0 && current.PID != pid {
		return nil
	}

	delete(status.Sessions, string(from))
	current.Browser = string(to)
	status.Sessions[string(to)] = current
	return WriteStatusFile(status)
}

func RandomToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func supportedBrowserHint() string {
	return "chrome, chromium, brave, edge, or firefox"
}

func chromiumFamilySessions(status StatusFile) []SessionStatus {
	matches := make([]SessionStatus, 0, 4)
	for _, browser := range BrowserDisplayOrder() {
		if !IsChromiumFamily(browser) {
			continue
		}
		session, ok := status.Sessions[string(browser)]
		if !ok {
			continue
		}
		matches = append(matches, session)
	}
	return matches
}

func SelectSession(status StatusFile, requested Browser) (SessionStatus, error) {
	if len(status.Sessions) == 0 {
		return SessionStatus{}, fmt.Errorf("no MarkSnip bridge session is connected; open %s with Agent Bridge enabled", supportedBrowserHint())
	}

	if requested != "" {
		if session, ok := status.Sessions[string(requested)]; ok {
			return session, nil
		}
		// Older hosts and `--browser chrome` should still reach Brave/Edge/Chromium.
		if requested == BrowserChrome {
			matches := chromiumFamilySessions(status)
			if len(matches) == 1 {
				return matches[0], nil
			}
			if len(matches) > 1 {
				return SessionStatus{}, fmt.Errorf("multiple Chromium-family bridge sessions are connected; rerun with --browser chromium, brave, or edge")
			}
		}
		return SessionStatus{}, fmt.Errorf("no active MarkSnip bridge session for %s", requested)
	}

	if len(status.Sessions) > 1 {
		return SessionStatus{}, fmt.Errorf("multiple MarkSnip bridge sessions are connected; rerun with --browser %s", supportedBrowserHint())
	}

	for _, session := range status.Sessions {
		return session, nil
	}

	return SessionStatus{}, errors.New("no MarkSnip bridge session is connected")
}

func SessionIsLive(session SessionStatus) bool {
	if session.Port <= 0 || session.Token == "" {
		return false
	}

	exists, certain := lookupProcess(session.PID)
	if certain && !exists {
		return false
	}
	return probeSession(session)
}

func PartitionLiveSessions(status StatusFile) (live StatusFile, stale []SessionStatus) {
	live = StatusFile{Sessions: map[string]SessionStatus{}}
	for key, session := range status.Sessions {
		if SessionIsLive(session) {
			live.Sessions[key] = session
			continue
		}
		stale = append(stale, session)
	}
	return live, stale
}

func RefreshLiveStatus() (live StatusFile, stale []SessionStatus, err error) {
	status, err := ReadStatusFile()
	if err != nil {
		return StatusFile{}, nil, err
	}

	live, stale = PartitionLiveSessions(status)
	if len(stale) == 0 {
		return live, stale, nil
	}
	if err := WriteStatusFile(live); err != nil {
		return live, stale, err
	}
	return live, stale, nil
}

func SelectLiveSession(requested Browser) (SessionStatus, []SessionStatus, error) {
	live, stale, err := RefreshLiveStatus()
	if err != nil {
		return SessionStatus{}, stale, err
	}

	session, err := SelectSession(live, requested)
	if err != nil && len(stale) > 0 {
		return SessionStatus{}, stale, fmt.Errorf("%w (removed %d stale session(s))", err, len(stale))
	}
	return session, stale, err
}

func OrderedSessions(status StatusFile) []SessionStatus {
	seen := map[string]bool{}
	ordered := make([]SessionStatus, 0, len(status.Sessions))
	for _, browser := range BrowserDisplayOrder() {
		session, ok := status.Sessions[string(browser)]
		if !ok {
			continue
		}
		ordered = append(ordered, session)
		seen[string(browser)] = true
	}
	for key, session := range status.Sessions {
		if seen[key] {
			continue
		}
		ordered = append(ordered, session)
	}
	return ordered
}

func processState(pid int) (exists bool, certain bool) {
	if pid <= 0 {
		return false, true
	}

	switch runtime.GOOS {
	case "windows":
		out, err := exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", pid), "/FO", "CSV", "/NH").Output()
		if err != nil {
			return false, false
		}
		return strings.Contains(string(out), strconv.Itoa(pid)), true
	default:
		process, err := os.FindProcess(pid)
		if err != nil {
			return false, true
		}
		if err := process.Signal(syscall.Signal(0)); err != nil {
			if errors.Is(err, os.ErrProcessDone) || errors.Is(err, syscall.ESRCH) {
				return false, true
			}
			return false, false
		}
		return true, true
	}
}

func httpProbeSession(session SessionStatus) bool {
	client := &http.Client{Timeout: 800 * time.Millisecond}
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://127.0.0.1:%d/status", session.Port), nil)
	if err != nil {
		return false
	}
	req.Header.Set("X-MarkSnip-Token", session.Token)

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
