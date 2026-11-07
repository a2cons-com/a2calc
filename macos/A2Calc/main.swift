// A2 Calc for macOS: one window with a web view showing the same web build
// as the iOS and Android apps (the bundled "build" folder), plus a menu bar.
// Files are served over an app-only URL scheme rather than file:// so the
// page's JavaScript modules load and its storage persists.

import AppKit
import UniformTypeIdentifiers
import WebKit

let scheme = "a2calc"
let startURL = URL(string: "\(scheme)://app/")!

/// Serves the bundled web build; unknown paths get index.html so the
/// app's own router handles them (as on the static web host).
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    let root = Bundle.main.resourceURL!.appendingPathComponent("build", isDirectory: true)

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path.isEmpty ? "/" : url.path
        if path.hasSuffix("/") { path += "index.html" }
        var file = root.appendingPathComponent(String(path.dropFirst()))
        if !FileManager.default.fileExists(atPath: file.path) {
            file = root.appendingPathComponent("index.html")
        }
        do {
            let data = try Data(contentsOf: file)
            let type = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
                "Content-Type": type,
                "Content-Length": String(data.count),
                "Cache-Control": "no-cache",
            ])!
            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
        } catch {
            task.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// ⌘C and ⌘V go straight to the Edit menu's Copy and Paste. Left to
/// WebKit they reach the page as key presses, and its clipboard read asks
/// for permission with a "Paste" button first.
final class CalcWebView: WKWebView {
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let mods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if mods == .command, let key = event.charactersIgnoringModifiers?.lowercased(), key == "v" || key == "c",
           let menu = NSApp.mainMenu, menu.performKeyEquivalent(with: event) {
            return true
        }
        return super.performKeyEquivalent(with: event)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    let handler = BundleSchemeHandler()

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(handler, forURLScheme: scheme)
        config.websiteDataStore = .default()

        webView = CalcWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        // A calculator-sized window: it can grow a little, never full screen.
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "A2 Calc"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.contentMinSize = NSSize(width: 380, height: 700)
        window.contentMaxSize = NSSize(width: 760, height: 1100)
        window.collectionBehavior = [.fullScreenNone]
        window.backgroundColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                ? NSColor(red: 0x0b / 255, green: 0x10 / 255, blue: 0x0d / 255, alpha: 1)
                : NSColor(red: 0xf2 / 255, green: 0xf5 / 255, blue: 0xf3 / 255, alpha: 1)
        }
        window.contentView = webView
        window.setFrameAutosaveName("Main")
        window.center()
        window.makeKeyAndOrderFront(nil)

        NSApp.mainMenu = buildMenu()
        webView.load(URLRequest(url: startURL))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    // Links that leave the app (a source citation, the maker's site) open
    // in the default browser.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.scheme != scheme {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    // MARK: Edit menu: copy the answer, paste a value into the formula.

    @objc func copyAnswer(_ sender: Any?) {
        webView.evaluateJavaScript("window.__a2calc ? window.__a2calc.copyText() : null") { result, _ in
            if let text = result as? String, !text.isEmpty {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
            } else {
                NSApp.sendAction(#selector(NSText.copy(_:)), to: nil, from: sender)
            }
        }
    }

    @objc func pasteValue(_ sender: Any?) {
        guard let text = NSPasteboard.general.string(forType: .string),
              let json = try? JSONSerialization.data(withJSONObject: [text]),
              let arg = String(data: json, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__a2calc ? window.__a2calc.paste(\(arg)[0]) : false")
    }

    private func buildMenu() -> NSMenu {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let app = NSMenu()
        app.addItem(withTitle: "About A2 Calc", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Hide A2 Calc", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let others = app.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        others.keyEquivalentModifierMask = [.command, .option]
        app.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Quit A2 Calc", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = app
        main.addItem(appItem)

        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Copy", action: #selector(copyAnswer(_:)), keyEquivalent: "c").target = self
        edit.addItem(withTitle: "Paste", action: #selector(pasteValue(_:)), keyEquivalent: "v").target = self
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        main.addItem(editItem)

        let windowItem = NSMenuItem()
        let win = NSMenu(title: "Window")
        win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = win
        main.addItem(windowItem)
        NSApp.windowsMenu = win

        return main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
