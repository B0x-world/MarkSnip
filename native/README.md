# MarkSnip Agent Bridge

Desktop companion binaries for the MarkSnip browser extension.

Files:

- Windows: `marksnip.exe` and `marksnip-native-host.exe`
- macOS/Linux: `marksnip` and `marksnip-native-host`

`marksnip-native-host` is launched by the browser. Use `marksnip` from a terminal.

Typical setup:

**Windows**

```powershell
.\marksnip.exe install-host
```

**macOS/Linux**

```bash
./marksnip install-host
```

Then enable **Agent Bridge** in MarkSnip Settings. Unpacked Chromium-family builds need `--chrome-extension-id <id>` (same ID for Chrome, Chromium, Brave, and Edge).

`install-host` registers Chrome, Chromium, Brave, Edge, and Firefox. `uninstall-host` removes all of them.

CLI flags (`marksnip help <command>` or `<command> --help`):

- `clip --json` (default false)
- `clip --fresh` (default false)
- `clip --browser chrome|chromium|brave|edge|firefox` (default unset; `chrome` matches a single Chromium-family session)
- `install-host --chrome-extension-id` (default the Chrome Web Store ID)

Typical usage:

```bash
./marksnip status
./marksnip clip
./marksnip clip --json --fresh --browser brave
```

## Native messaging locations

Linux:

- Chrome: `~/.config/google-chrome/NativeMessagingHosts/com.marksnip.bridge.json`
- Chromium: `~/.config/chromium/NativeMessagingHosts/com.marksnip.bridge.json`
- Brave: `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.marksnip.bridge.json`
- Edge: `~/.config/microsoft-edge/NativeMessagingHosts/com.marksnip.bridge.json`
- Firefox: `~/.mozilla/native-messaging-hosts/com.marksnip.bridge.json`

Brave on Linux may also read Chrome's native-messaging folder. MarkSnip still installs the Brave path.

macOS (`~/Library/Application Support`):

- Chrome: `Google/Chrome/NativeMessagingHosts/com.marksnip.bridge.json`
- Chromium: `Chromium/NativeMessagingHosts/com.marksnip.bridge.json`
- Brave: `BraveSoftware/Brave-Browser/NativeMessagingHosts/com.marksnip.bridge.json`
- Edge: `Microsoft Edge/NativeMessagingHosts/com.marksnip.bridge.json`
- Firefox: `Mozilla/NativeMessagingHosts/com.marksnip.bridge.json`

Windows: JSON files under `%APPDATA%\MarkSnip\NativeMessagingHosts\<browser>\com.marksnip.bridge.json`, with HKCU keys:

- Chrome: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.marksnip.bridge`
- Chromium: `HKCU\Software\Chromium\NativeMessagingHosts\com.marksnip.bridge`
- Brave: `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.marksnip.bridge`
- Edge: `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.marksnip.bridge`
- Firefox: `HKCU\Software\Mozilla\NativeMessagingHosts\com.marksnip.bridge`

`status.json` is `$XDG_CONFIG_HOME/MarkSnip/agent-bridge/status.json` (Linux), `~/Library/Application Support/MarkSnip/agent-bridge/status.json` (macOS), or `%APPDATA%\MarkSnip\agent-bridge\status.json` (Windows). Set `MARKSNIP_BRIDGE_DEBUG=1` to append `host-debug.log` in that directory.
