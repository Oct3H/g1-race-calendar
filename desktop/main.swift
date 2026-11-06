import AppKit
import WebKit

let sourceURL = URL(string: "https://japanracing.jp/_news2026/261101.html")!
let resourceRoot = Bundle.main.resourceURL!
let pages = ["/welcome.html", "/index.html", "/settings.html"]

final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

final class Desktop: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
    let store: LocalStore
    let offline: Bool
    let smoke: String?
    let server: LocalPages
    private var window: NSWindow?
    private var webView: WKWebView?
    var tested = Set<String>()
    var completed = false

    init(store: LocalStore, server: LocalPages, offline: Bool, smoke: String?) {
        self.server = server
        self.store = store
        self.offline = offline
        self.smoke = smoke
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        menu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit GⅠ Race Calendar Dev", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        let fileItem = NSMenuItem()
        menu.addItem(fileItem)
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileItem.submenu = fileMenu
        NSApp.mainMenu = menu
        showWindow()
        if smoke != nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + (smoke == "audit-history" ? 600 : smoke == "history-future" ? 240 : 120)) { self.fail("Timed out") }
        }
    }

    @discardableResult
    private func showWindow() -> WKWebView {
        if let window, let webView {
            let wasHidden = !window.isVisible
            window.makeKeyAndOrderFront(nil)
            if wasHidden { loadStartup(webView) }
            return webView
        }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "calendar")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        if smoke != nil {
            web.configuration.userContentController.addUserScript(WKUserScript(source: """
            window.testErrors = [];
            addEventListener('error', e => testErrors.push(e.message || e.target?.src || e.target?.href || 'load error'), true);
            addEventListener('unhandledrejection', e => testErrors.push(String(e.reason)));
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 780),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                              backing: .buffered, defer: false)
        window.title = "GⅠ Race Calendar · Dev v2.4"
        window.appearance = NSAppearance(named: .aqua)
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(srgbRed: 233 / 255, green: 222 / 255, blue: 244 / 255, alpha: 1)
        window.minSize = NSSize(width: 620, height: 480)
        window.isReleasedWhenClosed = false
        let content = NSView()
        window.contentView = content
        content.addSubview(web)
        web.translatesAutoresizingMaskIntoConstraints = false
        let layout = window.contentLayoutGuide as! NSLayoutGuide
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: layout.topAnchor),
            web.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: content.bottomAnchor)
        ])
        window.delegate = self
        window.center()
        self.window = window
        self.webView = web
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        loadStartup(web)
        return web
    }

    private func loadStartup(_ web: WKWebView) {
        let language = (try? store.read("language")) ?? ""
        let url = ["zh", "ja", "en"].contains(language)
            ? server.base + "/index.html?preview=calendar&settingsMenu=preview&changes=0&lang=" + language
            : server.base + "/welcome.html"
        if smoke != nil { fputs("Loading \(url)\n", stderr) }
        web.load(URLRequest(url: URL(string: url)!))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow()
        return true
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = action.request.url
        if smoke != nil { fputs("Navigation \(url?.absoluteString ?? "nil") frame=\(String(describing: action.targetFrame?.isMainFrame)) local=\(server.localPath(url) ?? "nil")\n", stderr) }
        if let path = server.localPath(url), pages.contains(path), action.targetFrame?.isMainFrame == true {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler reply: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, server.localPath(message.frameInfo.request.url).map(pages.contains) == true,
              let body = message.body as? [String: Any], let command = body["command"] as? String else {
            reply(nil, "Invalid request")
            return
        }
        if smoke != nil { fputs("Bridge \(command) \(command == "language" ? body["value"] as? String ?? "" : "")\n", stderr) }
        do {
            switch command {
            case "load":
                let verified = try String(contentsOf: resourceRoot.appendingPathComponent("verified.json"), encoding: .utf8)
                let seed = try String(contentsOf: resourceRoot.appendingPathComponent("jairs_tenno.response"), encoding: .utf8)
                var testDate = try store.read("testDate")
                if testDate == nil, let date = Calendar.current.date(byAdding: .day, value: 7, to: Date()) {
                    testDate = ISO8601DateFormatter().string(from: date)
                    try store.write("testDate", testDate!)
                }
                reply(["wallet": try store.read("wallet") ?? "", "result": try store.read("result") ?? "",
                       "verified": verified, "seed": seed, "testDate": testDate ?? "", "offline": offline], nil)
            case "language":
                guard let value = body["value"] as? String, ["zh", "ja", "en"].contains(value) else {
                    reply(nil, "Invalid language"); return
                }
                try store.write(command, value)
                reply(true, nil)
            case "wallet", "result":
                guard let value = body["value"] as? String, value.utf8.count <= 2_000_000,
                      (try? JSONSerialization.jsonObject(with: Data(value.utf8))) is [String: Any] else {
                    reply(nil, "Invalid data"); return
                }
                try store.write(command, value)
                reply(true, nil)
            case "openSource":
                let url = (body["value"] as? String).flatMap(URL.init(string:)) ?? sourceURL
                guard url.scheme == "https", url.user == nil, url.password == nil, url.port == nil,
                      let host = url.host, ["japanracing.jp", "www.keiba.go.jp", "www.jra.go.jp", "www.ifhaonline.org", "racing.hkjc.com"].contains(host) else {
                    reply(nil, "Unsupported source URL"); return
                }
                reply(NSWorkspace.shared.open(url), nil)
            case "fetchDetail":
                guard let address = body["value"] as? String, let url = URL(string: address), isDetailURL(url) else {
                    reply(nil, "Unsupported official detail URL"); return
                }
                fetchOfficial(url, acceptNotFound: false, detailRedirects: 2, reply: reply)
            case "fetchOverseas":
                let input = body["value"] as? [String: Any]
                let venue = input?["venue"] as? String
                guard let date = input?["date"] as? String ?? body["value"] as? String,
                      venue == nil || ["ST", "HV", "S1", "S2", "S3", "S4", "S5"].contains(venue!),
                      date.range(of: #"^20\d{2}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else {
                    reply(nil, "Invalid overseas meeting date"); return
                }
                let file = resourceRoot.appendingPathComponent("design/data/hkjc-results-query.json")
                var payload = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
                payload["variables"] = ["date": date, "venueCode": venue as Any? ?? NSNull()]
                let json = try JSONSerialization.data(withJSONObject: payload)
                fetchOfficial(URL(string: "https://info.cld.hkjc.com/graphql/base/")!, acceptNotFound: false, json: json) { value, error in
                    if self.smoke == "audit-history", let response = value as? String {
                        try? self.store.write("audit.overseas.\(date).\(venue ?? "all")", response)
                    }
                    reply(value, error)
                }
            case "readDetail", "saveDetail":
                let data = body["value"] as? [String: Any]
                let key = data?["key"] as? String ?? body["value"] as? String ?? ""
                guard key.range(of: #"^(race|horse)\.[A-Za-z0-9_%-]{1,512}$"#, options: .regularExpression) != nil else {
                    reply(nil, "Invalid detail key"); return
                }
                if command == "readDetail" {
                    reply(try store.read("detail." + key) ?? "", nil)
                } else {
                    guard let json = data?["json"] as? String, json.utf8.count <= 256_000,
                          (try? JSONSerialization.jsonObject(with: Data(json.utf8))) is [String: Any] else {
                        reply(nil, "Invalid detail data"); return
                    }
                    try store.write("detail." + key, json)
                    reply(true, nil)
                }
            case "readSchedule", "saveSchedule", "fetchSchedule":
                guard let value = body["value"] as? [String: Any], let year = value["year"] as? Int,
                      let provider = value["provider"] as? String,
                      let url = scheduleURL(year: year, provider: provider) else {
                    reply(nil, "Unsupported annual directory"); return
                }
                let key = "schedule.\(provider).\(year)"
                if command == "readSchedule" {
                    reply(try store.read(key) ?? "", nil)
                } else if command == "saveSchedule" {
                    guard let json = value["json"] as? String, json.utf8.count <= 256_000,
                          (try? JSONSerialization.jsonObject(with: Data(json.utf8))) is [String: Any] else {
                        reply(nil, "Invalid schedule"); return
                    }
                    try store.write(key, json)
                    reply(true, nil)
                } else {
                    let form = provider == "ifha"
                        ? "cntry=&raceyear=\(year)&track=&FromDate=&ToDate=&FromPurse=&ToPurse=&FromDistance=&ToDistance=&distanceunit=F&group=G1&age=&sex="
                        : nil
                    fetchOfficial(url, acceptNotFound: true, form: form, reply: reply)
                }
            case "fetchRankingIndex":
                fetchOfficial(URL(string: "https://www.ifhaonline.org/default.asp?section=Racing&area=1")!, acceptNotFound: false, reply: reply)
            case "fetchRankingTable":
                guard let batch = body["value"] as? Int, (1...1000).contains(batch) else {
                    reply(nil, "Unsupported ranking"); return
                }
                let url = URL(string: "https://www.ifhaonline.org/resources/WTGradedRanking/LWGRank.asp?batch=\(batch)")!
                fetchOfficial(url, acceptNotFound: false, reply: reply)
            case "refresh":
                fetchOfficial(sourceURL, acceptNotFound: false, reply: reply)
            default: reply(nil, "Unknown command")
            }
        } catch {
            reply(nil, String(describing: error))
        }
    }

    private func isDetailURL(_ url: URL) -> Bool {
        guard url.scheme == "https", url.user == nil, url.password == nil, url.port == nil, url.fragment == nil else { return false }
        if url.host == "japanracing.jp" {
            return url.query == nil && url.path.range(of: #"^(/_news20\d{2}/\d{6}(-\d{2})?|/en/racing/news_media/news/20\d{2})\.html$"#, options: .regularExpression) != nil
        }
        if url.host == "www.keiba.go.jp" {
            if url.query == nil {
                return url.path.range(of: #"^/dirtgraderace/20\d{2}/[A-Za-z0-9_-]+/(racecard|introduction)\.html$"#, options: .regularExpression) != nil
            }
            guard ["/KeibaWeb/TodayRaceInfo/DebaTable", "/KeibaWeb/TodayRaceInfo/RaceMarkTable"].contains(url.path),
                  let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems, items.count == 3 else { return false }
            return items.allSatisfy { item in
                switch item.name {
                case "k_raceDate": return item.value?.range(of: #"^20\d{2}/\d{2}/\d{2}$"#, options: .regularExpression) != nil
                case "k_raceNo": return item.value?.range(of: #"^[1-9]\d?$"#, options: .regularExpression) != nil
                case "k_babaCode": return item.value?.range(of: #"^\d{1,2}$"#, options: .regularExpression) != nil
                default: return false
                }
            } && Set(items.map(\.name)).count == 3
        }
        guard url.host == "racing.hkjc.com",
              let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return false }
        switch url.path {
        case "/zh-hk/local/information/horse", "/zh-hk/local/information/otherhorse":
            return query.count == 1 && query[0].name == "horseid" &&
                query[0].value?.range(of: #"^HK_\d{4}_[A-Z]\d{3}$"#, options: .regularExpression) != nil
        case "/zh-hk/local/information/archive/localresults":
            let date = query.first { $0.name == "racedate" }?.value
            let course = query.first { $0.name == "racecourse" }?.value
            let number = query.first { $0.name == "RaceNo" }?.value
            return ["ST", "HV"].contains(course ?? "") && date?.range(of: #"^20\d{2}/\d{2}/\d{2}$"#, options: .regularExpression) != nil &&
                (number == nil ? query.count == 2 : query.count == 3 && number?.range(of: #"^[1-9]\d?$"#, options: .regularExpression) != nil)
        default:
            return false
        }
    }

    private func scheduleURL(year: Int, provider: String) -> URL? {
        let currentYear = Calendar(identifier: .gregorian).component(.year, from: Date())
        guard year <= currentYear + 2 else { return nil }
        switch provider {
        case "jra" where year >= 2005:
            return URL(string: "https://japanracing.jp/en/racing/schedule/graded/list/\(year).html")
        case "nar" where year >= 2023:
            return URL(string: "https://www.keiba.go.jp/dirtgraderace/\(year)/racelist/index.html")
        case "ifha" where year >= 2010:
            return URL(string: "https://www.ifhaonline.org/default.asp?section=Racing&area=7")
        default:
            return nil
        }
    }

    private func fetchOfficial(_ url: URL, acceptNotFound: Bool, form: String? = nil, json: Data? = nil, detailRedirects: Int = 0, reply: @escaping (Any?, String?) -> Void) {
        guard !offline else { reply(nil, "offline"); return }
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 35
        let session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
        if let form {
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            request.httpBody = Data(form.utf8)
        }
        if let json {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = json
        }
        session.dataTask(with: request) { data, response, error in
            defer { session.finishTasksAndInvalidate() }
            let http = response as? HTTPURLResponse
            let status = http?.statusCode ?? 0
            let html = data.flatMap { data -> String? in
                guard data.count <= 2_000_000 else { return nil }
                if let utf8 = String(data: data, encoding: .utf8) { return utf8 }
                guard url.host == "www.ifhaonline.org" else { return nil }
                return String(data: data, encoding: .windowsCP1252) ?? String(data: data, encoding: .isoLatin1)
            }
            DispatchQueue.main.async {
                if self.smoke != nil {
                    fputs("Official source \(url.host ?? "")\(url.path) · HTTP \(status) \(error?.localizedDescription ?? "")\n", stderr)
                }
                if detailRedirects > 0, [301, 302, 303, 307, 308].contains(status),
                   let location = http?.value(forHTTPHeaderField: "Location"), let next = URL(string: location, relativeTo: url)?.absoluteURL,
                   next.host == url.host, self.isDetailURL(next) {
                    self.fetchOfficial(next, acceptNotFound: acceptNotFound, detailRedirects: detailRedirects - 1, reply: reply)
                } else if status == 200, http?.url == url, let html {
                    reply(acceptNotFound ? ["html": html, "url": url.absoluteString, "status": status] : html, nil)
                } else if acceptNotFound, http?.url == url, [404, 410].contains(status) {
                    reply(["status": status], nil)
                } else {
                    reply(nil, error?.localizedDescription ?? "HTTP \(status)")
                }
            }
        }.resume()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard frame.isMainFrame, server.localPath(frame.request.url).map(pages.contains) == true else { completionHandler(false); return }
        if smoke != nil { completionHandler(true); return }
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        if frame.isMainFrame, server.localPath(frame.request.url).map(pages.contains) == true {
            let alert = NSAlert()
            alert.messageText = message
            alert.runModal()
        }
        completionHandler()
    }

    func reopenForSmoke() {
        guard let window else { fail("Window missing"); return }
        window.performClose(nil)
        guard !window.isVisible else { fail("Window did not close"); return }
        _ = applicationShouldHandleReopen(NSApp, hasVisibleWindows: false)
        guard window.isVisible else { fail("Window did not reopen"); return }
        _ = applicationShouldHandleReopen(NSApp, hasVisibleWindows: true)
        guard self.window === window else { fail("Reopen created another window"); return }
    }

    func fail(_ error: String) {
        fputs("Desktop test failed: \(error)\n", stderr)
        exit(1)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        guard smoke != nil, server.localPath(webView.url) != nil else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            webView.evaluateJavaScript("JSON.stringify({url:location.href,ready:document.readyState,errors:window.testErrors,body:document.body?.dataset.desktop,selection:document.querySelector('[name=language]:checked')?.value,days:document.querySelectorAll('#calendar .day').length,status:document.querySelector('#calendar-update')?.dataset.state})") { value, error in
                fputs("Web state: \(value ?? String(describing: error))\n", stderr)
                if self.server.localPath(webView.url) != nil { self.runSmoke(webView) }
            }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if smoke != nil { fail("Navigation failed: \(error)") }
    }


}

let arguments = CommandLine.arguments
func option(_ flag: String) -> String? {
    guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else { return nil }
    return arguments[index + 1]
}
let dataDirectory = option("--data-dir").map { URL(fileURLWithPath: $0, isDirectory: true) } ??
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("G1 Race Calendar Dev", isDirectory: true)
let app = NSApplication.shared
app.setActivationPolicy(.regular)
do {
    try FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true)
    let lock = open(dataDirectory.appendingPathComponent("running.lock").path, O_CREAT | O_RDWR | O_CLOEXEC, 0o600)
    guard lock >= 0 else { throw CocoaError(.fileWriteNoPermission) }
    defer { close(lock) }
    if flock(lock, LOCK_EX | LOCK_NB) != 0 {
        NSRunningApplication.runningApplications(withBundleIdentifier: "local.g1racecalendar.dev")
            .first { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }?.activate()
        exit(0)
    }
    let desktop = Desktop(store: try LocalStore(directory: dataDirectory), server: try LocalPages(),
                          offline: arguments.contains("--offline"), smoke: option("--self-test"))
    app.delegate = desktop
    withExtendedLifetime(desktop) { app.run() }
} catch {
    fputs("Could not start Race Calendar: \(error)\n", stderr)
    if option("--self-test") == nil { NSAlert(error: error).runModal() }
    exit(1)
}
