// meta:
//   id: "109-native-main"
//   type: code
//   domain: native
//   subject: main
//   status: adopted
//   owner: ""
//   created: 2026-03-21
//   updated: 2026-10-20
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/DhruvParikh1/markdownload-extension-updated/native/internal/bridge"
)

type clipRequest struct {
	Fresh bool `json:"fresh"`
}

type clipReply struct {
	Result *bridge.ClipResult `json:"result,omitempty"`
	Error  string             `json:"error,omitempty"`
	Code   string             `json:"code,omitempty"`
	URL    string             `json:"url,omitempty"`
}

type pendingResult struct {
	result *bridge.ClipResult
	err    string
	code   string
	url    string
}

type hostServer struct {
	browser bridge.Browser
	token   string
	writer  *bridge.NativeWriter
	pending sync.Map
	debugf  func(string, ...any)
}

func main() {
	if wantsNativeHostHelp(os.Args[1:]) {
		fmt.Fprint(os.Stdout, nativeHostHelp(filepath.Base(os.Args[0])))
		return
	}

	log.SetOutput(io.Discard)
	ignoreBrokenPipe()
	debugf := buildDebugLogger()

	browser := bridge.DetectBrowserFromArgs(os.Args[1:])
	token, err := bridge.RandomToken()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	session := bridge.SessionStatus{
		Browser:     string(browser),
		Port:        listener.Addr().(*net.TCPAddr).Port,
		Token:       token,
		PID:         os.Getpid(),
		HostVersion: bridge.HostVersion,
		ConnectedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := bridge.WriteSession(session); err != nil {
		_ = listener.Close()
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	server := &hostServer{
		browser: browser,
		token:   token,
		writer:  bridge.NewNativeWriter(os.Stdout),
		debugf:  debugf,
	}
	debugf("host start browser=%s pid=%d", browser, os.Getpid())

	httpServer := &http.Server{
		Handler: server.routes(),
	}

	var cleaned bool
	var cleanedMu sync.Mutex
	cleanup := func() {
		cleanedMu.Lock()
		defer cleanedMu.Unlock()
		if cleaned {
			return
		}
		cleaned = true
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(ctx)
		_ = listener.Close()
		_ = bridge.RemoveSession(server.browser, os.Getpid())
		debugf("host cleanup browser=%s pid=%d", server.browser, os.Getpid())
	}
	defer cleanup()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		cleanup()
		os.Exit(0)
	}()

	go func() {
		_ = httpServer.Serve(listener)
	}()

	_ = server.writer.Send(bridge.NativeMessage{
		Type:        "bridge.ready",
		Browser:     string(server.browser),
		HostVersion: bridge.HostVersion,
		ConnectedAt: session.ConnectedAt,
	})
	debugf("sent bridge.ready browser=%s", server.browser)

	for {
		message, err := bridge.ReadNativeMessage(os.Stdin)
		if err != nil {
			if !errors.Is(err, io.EOF) {
				fmt.Fprintln(os.Stderr, err)
			}
			debugf("stdin closed err=%v", err)
			break
		}
		debugf("native recv type=%s requestId=%s", message.Type, message.RequestID)

		switch message.Type {
		case "bridge.hello":
			if next := applyHelloBrowser(server, session, message.Browser); next.Browser != "" {
				session = next
			}
			_ = server.writer.Send(bridge.NativeMessage{
				Type:        "bridge.ready",
				Browser:     string(server.browser),
				HostVersion: bridge.HostVersion,
				ConnectedAt: session.ConnectedAt,
			})
			debugf("sent bridge.ready in response to hello browser=%s", server.browser)
		case "bridge.clip.result":
			if value, ok := server.pending.LoadAndDelete(message.RequestID); ok {
				reply := value.(chan pendingResult)
				reply <- pendingResult{result: message.Result}
				debugf("resolved clip result requestId=%s", message.RequestID)
			}
		case "bridge.error":
			if value, ok := server.pending.LoadAndDelete(message.RequestID); ok {
				reply := value.(chan pendingResult)
				reply <- pendingResult{err: message.Error, code: message.Code, url: message.URL}
				debugf("resolved clip error requestId=%s error=%s code=%s", message.RequestID, message.Error, message.Code)
			}
		}
	}
}

func applyHelloBrowser(server *hostServer, session bridge.SessionStatus, reported string) bridge.SessionStatus {
	parsed, err := bridge.ParseBrowser(reported)
	if err != nil || parsed == "" {
		return session
	}
	next := bridge.PreferSpecificBrowser(server.browser, parsed)
	if next == server.browser {
		return session
	}
	_ = bridge.RelabelSession(server.browser, next, os.Getpid())
	server.browser = next
	session.Browser = string(next)
	_ = bridge.WriteSession(session)
	return session
}

func (s *hostServer) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/clip", s.handleClip)
	mux.HandleFunc("/status", s.handleStatus)
	return mux
}

func (s *hostServer) authenticate(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("X-MarkSnip-Token") != s.token {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		s.debugf("http unauthorized path=%s", r.URL.Path)
		return false
	}
	return true
}

func (s *hostServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	if !s.authenticate(w, r) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"browser":     s.browser,
		"hostVersion": bridge.HostVersion,
		"connected":   true,
	})
}

func (s *hostServer) handleClip(w http.ResponseWriter, r *http.Request) {
	if !s.authenticate(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, clipReply{Error: "method not allowed"})
		return
	}

	var req clipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, clipReply{Error: "invalid request payload"})
		return
	}

	requestID, err := bridge.RandomToken()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, clipReply{Error: err.Error()})
		return
	}
	s.debugf("http clip request fresh=%v requestId=%s", req.Fresh, requestID)

	replyCh := make(chan pendingResult, 1)
	s.pending.Store(requestID, replyCh)
	defer s.pending.Delete(requestID)

	if err := s.writer.Send(bridge.NativeMessage{
		Type:      "bridge.clip",
		RequestID: requestID,
		Fresh:     req.Fresh,
	}); err != nil {
		s.debugf("native send failed requestId=%s err=%v", requestID, err)
		writeJSON(w, http.StatusBadGateway, clipReply{Error: err.Error()})
		return
	}
	s.debugf("native sent bridge.clip requestId=%s", requestID)

	select {
	case reply := <-replyCh:
		if reply.err != "" {
			s.debugf("http clip reply error requestId=%s err=%s", requestID, reply.err)
			status := http.StatusBadGateway
			if reply.code == "restricted_page" {
				status = http.StatusUnprocessableEntity
			}
			writeJSON(w, status, clipReply{Error: reply.err, Code: reply.code, URL: reply.url})
			return
		}
		s.debugf("http clip reply success requestId=%s", requestID)
		writeJSON(w, http.StatusOK, clipReply{Result: reply.result})
	case <-time.After(35 * time.Second):
		s.debugf("http clip timeout requestId=%s", requestID)
		writeJSON(w, http.StatusGatewayTimeout, clipReply{Error: "timed out waiting for MarkSnip bridge response"})
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func ignoreBrokenPipe() {
	if runtime.GOOS == "windows" {
		return
	}
	signal.Ignore(syscall.SIGPIPE)
}

func buildDebugLogger() func(string, ...any) {
	if os.Getenv("MARKSNIP_BRIDGE_DEBUG") != "1" {
		return func(string, ...any) {}
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return func(string, ...any) {}
	}

	logDir := filepath.Join(configDir, "MarkSnip", "agent-bridge")
	if err := os.MkdirAll(logDir, 0o700); err != nil {
		return func(string, ...any) {}
	}

	logPath := filepath.Join(logDir, "host-debug.log")
	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return func(string, ...any) {}
	}

	return func(format string, args ...any) {
		line := fmt.Sprintf(format, args...)
		_, _ = fmt.Fprintf(file, "%s %s\n", time.Now().UTC().Format(time.RFC3339), line)
	}
}
