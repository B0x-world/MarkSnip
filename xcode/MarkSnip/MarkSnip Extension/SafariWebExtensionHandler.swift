//
//  SafariWebExtensionHandler.swift
//  MarkSnip Extension
//
//  Created by Gordon Pedersen on 17/2/21.
//

// meta:
//   id: "285-safari-safari-web-extension-handler"
//   type: code
//   domain: safari
//   subject: safari-web-extension-handler
//   status: adopted
//   owner: ""
//   created: 2026-10-19
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: source

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let message = request?.userInfo?[SFExtensionMessageKey]
        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %{public}@", String(describing: message))

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["Response to": message as Any]]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
