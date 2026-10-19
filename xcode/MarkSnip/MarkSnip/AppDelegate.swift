//
//  AppDelegate.swift
//  MarkSnip
//
//  Created by Gordon Pedersen on 17/2/21.
//

// meta:
//   id: "286-safari-app-delegate"
//   type: code
//   domain: safari
//   subject: app-delegate
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Insert code here to initialize your application
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Insert code here to tear down your application
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

}
