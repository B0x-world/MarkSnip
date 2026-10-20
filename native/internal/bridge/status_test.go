// meta:
//   id: "118-native-status-test"
//   type: code
//   domain: native
//   subject: status-test
//   status: adopted
//   owner: ""
//   created: 2026-10-20
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: test

package bridge

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

func isolateConfigDir(t *testing.T) {
	t.Helper()
	tmp := t.TempDir()
	switch runtime.GOOS {
	case "windows":
		t.Setenv("APPDATA", tmp)
	case "darwin":
		t.Setenv("HOME", tmp)
	default:
		t.Setenv("XDG_CONFIG_HOME", tmp)
		t.Setenv("HOME", tmp)
	}
}

func TestWriteStatusFileMode(t *testing.T) {
	isolateConfigDir(t)

	if err := WriteStatusFile(StatusFile{Sessions: map[string]SessionStatus{
		"brave": {Browser: "brave", Port: 1, Token: "secret", PID: 99},
	}}); err != nil {
		t.Fatalf("WriteStatusFile: %v", err)
	}

	path, err := StatusPath()
	if err != nil {
		t.Fatalf("StatusPath: %v", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("status.json mode = %o, want 0600", info.Mode().Perm())
	}

	loaded, err := ReadStatusFile()
	if err != nil {
		t.Fatalf("ReadStatusFile: %v", err)
	}
	if loaded.Sessions["brave"].Token != "secret" {
		t.Fatalf("unexpected session: %#v", loaded.Sessions["brave"])
	}
}

func TestPartitionLiveSessionsPrunesDeadPIDAndFailedProbe(t *testing.T) {
	t.Cleanup(func() {
		lookupProcess = processState
		probeSession = httpProbeSession
	})

	lookupProcess = func(pid int) (bool, bool) {
		return pid == 7, true
	}
	probeSession = func(session SessionStatus) bool {
		return session.Port == 9
	}

	status := StatusFile{Sessions: map[string]SessionStatus{
		"chrome": {Browser: "chrome", Port: 8, Token: "a", PID: 1},
		"brave":  {Browser: "brave", Port: 9, Token: "b", PID: 7},
	}}

	live, stale := PartitionLiveSessions(status)
	if _, ok := live.Sessions["brave"]; !ok {
		t.Fatalf("expected live brave session, got %#v", live.Sessions)
	}
	if len(stale) != 1 || stale[0].Browser != "chrome" {
		t.Fatalf("expected stale chrome, got %#v", stale)
	}
}

func TestHttpProbeSession(t *testing.T) {
	t.Cleanup(func() {
		lookupProcess = processState
		probeSession = httpProbeSession
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-MarkSnip-Token") != "token" {
			http.Error(w, "nope", http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	parsed, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	port, err := strconv.Atoi(parsed.Port())
	if err != nil {
		t.Fatalf("Atoi: %v", err)
	}

	if !httpProbeSession(SessionStatus{Port: port, Token: "token"}) {
		t.Fatal("expected live probe")
	}
	if httpProbeSession(SessionStatus{Port: port, Token: "wrong"}) {
		t.Fatal("expected failed probe")
	}
}

func TestSelectLiveSessionRemovesStaleEntries(t *testing.T) {
	isolateConfigDir(t)
	t.Cleanup(func() {
		lookupProcess = processState
		probeSession = httpProbeSession
	})

	lookupProcess = func(pid int) (bool, bool) {
		return pid == 22, true
	}
	probeSession = func(session SessionStatus) bool {
		return session.PID == 22
	}

	if err := WriteStatusFile(StatusFile{Sessions: map[string]SessionStatus{
		"chrome": {Browser: "chrome", Port: 1, Token: "dead", PID: 11},
		"brave":  {Browser: "brave", Port: 2, Token: "live", PID: 22},
	}}); err != nil {
		t.Fatalf("WriteStatusFile: %v", err)
	}

	session, stale, err := SelectLiveSession("")
	if err != nil {
		t.Fatalf("SelectLiveSession: %v", err)
	}
	if session.Browser != "brave" {
		t.Fatalf("got %#v, want brave", session)
	}
	if len(stale) != 1 || stale[0].Browser != "chrome" {
		t.Fatalf("stale = %#v", stale)
	}

	loaded, err := ReadStatusFile()
	if err != nil {
		t.Fatalf("ReadStatusFile: %v", err)
	}
	if _, ok := loaded.Sessions["chrome"]; ok {
		t.Fatal("stale chrome session was not pruned from status.json")
	}
}

func TestRelabelSession(t *testing.T) {
	isolateConfigDir(t)

	if err := WriteSession(SessionStatus{Browser: "chrome", Port: 4, Token: "t", PID: 5}); err != nil {
		t.Fatalf("WriteSession: %v", err)
	}
	if err := RelabelSession(BrowserChrome, BrowserBrave, 5); err != nil {
		t.Fatalf("RelabelSession: %v", err)
	}
	status, err := ReadStatusFile()
	if err != nil {
		t.Fatalf("ReadStatusFile: %v", err)
	}
	if _, ok := status.Sessions["chrome"]; ok {
		t.Fatal("chrome key still present")
	}
	if status.Sessions["brave"].Port != 4 {
		t.Fatalf("brave session = %#v", status.Sessions["brave"])
	}
}

func TestStatusPathUsesConfigDir(t *testing.T) {
	isolateConfigDir(t)
	path, err := StatusPath()
	if err != nil {
		t.Fatalf("StatusPath: %v", err)
	}
	if !strings.Contains(filepath.ToSlash(path), "MarkSnip/agent-bridge/status.json") &&
		!strings.Contains(filepath.ToSlash(path), `MarkSnip/agent-bridge/status.json`) {
		t.Fatalf("unexpected path %q", path)
	}
}
