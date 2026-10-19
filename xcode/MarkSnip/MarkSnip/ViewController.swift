//
//  ViewController.swift
//  MarkSnip
//
//  Created by Gordon Pedersen on 17/2/21.
//

import Cocoa
import SafariServices.SFSafariApplication
import SafariServices.SFSafariExtensionManager

let appName = "MarkSnip"
/// Upstream MarkDownload bundle ID; kept so Safari extension state stays attached.
let extensionBundleIdentifier = "au.death.MarkDownload.Extension"

class ViewController: NSViewController {

    @IBOutlet var appNameLabel: NSTextField!

    override func viewDidLoad() {
        super.viewDidLoad()
        self.appNameLabel.stringValue = appName
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                return
            }

            DispatchQueue.main.async {
                if state.isEnabled {
                    self.appNameLabel.stringValue = "\(appName)'s extension is currently on."
                } else {
                    self.appNameLabel.stringValue = "\(appName)'s extension is currently off. You can turn it on in Safari settings."
                }
            }
        }
    }

    @IBAction func openSafariExtensionPreferences(_ sender: AnyObject?) {
        // Xcode 26.6's macOS SDK still declares showPreferencesForExtension
        // and does not declare showSettingsForExtension (compile error).
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            guard error == nil else {
                return
            }

            DispatchQueue.main.async {
                NSApplication.shared.terminate(nil)
            }
        }
    }

}
