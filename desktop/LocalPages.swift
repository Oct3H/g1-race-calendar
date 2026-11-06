import Foundation
import Darwin

final class LocalPages {
    private let listener: DispatchSourceRead
    private let clients = DispatchQueue(label: "calendar.bundle-http.clients", attributes: .concurrent)
    private let prefix = "/" + UUID().uuidString.lowercased()
    private let root = Bundle.main.resourceURL!.appendingPathComponent("design").resolvingSymlinksInPath()
    private let types = ["html": "text/html; charset=utf-8", "css": "text/css; charset=utf-8",
                         "js": "text/javascript; charset=utf-8", "mjs": "text/javascript; charset=utf-8",
                         "json": "application/json", "svg": "image/svg+xml", "webp": "image/webp",
                         "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                         "woff2": "font/woff2"]
    let port: UInt16

    var base: String { "http://127.0.0.1:\(port)\(prefix)" }

    init() throws {
        let socket = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard socket >= 0 else { throw URLError(.cannotConnectToHost) }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
        var length = socklen_t(address.sin_len)
        let bound = withUnsafeMutablePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { endpoint in
                bind(socket, endpoint, length) == 0 && getsockname(socket, endpoint, &length) == 0
            }
        }
        guard bound, listen(socket, 32) == 0,
              fcntl(socket, F_SETFL, O_NONBLOCK) != -1 else {
            let code = errno
            close(socket)
            throw NSError(domain: NSPOSIXErrorDomain, code: Int(code))
        }
        port = UInt16(bigEndian: address.sin_port)
        listener = DispatchSource.makeReadSource(fileDescriptor: socket, queue: DispatchQueue(label: "calendar.bundle-http"))
        listener.setEventHandler { [weak self] in
            let client = accept(socket, nil, nil)
            guard client >= 0 else { return }
            guard let self else { close(client); return }
            self.clients.async { self.serve(client) }
        }
        listener.setCancelHandler { close(socket) }
        listener.resume()
    }

    deinit { listener.cancel() }

    func localPath(_ url: URL?) -> String? {
        guard let url, url.scheme == "http", url.host == "127.0.0.1", url.port == Int(port),
              url.user == nil, url.password == nil, url.path.hasPrefix(prefix + "/") else { return nil }
        return String(url.path.dropFirst(prefix.count))
    }

    private func serve(_ client: Int32) {
        defer { close(client) }
        guard fcntl(client, F_SETFL, 0) != -1 else { return; }
        var timeout = timeval(tv_sec: 5, tv_usec: 0)
        let timeSize = socklen_t(MemoryLayout<timeval>.size)
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, timeSize)
        setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, &timeout, timeSize)
        var enabled: Int32 = 1
        setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &enabled, socklen_t(MemoryLayout<Int32>.size))
        var bytes = [UInt8](repeating: 0, count: 4096)
        var data = Data()
        while data.count < 16_384 {
            let received = recv(client, &bytes, bytes.count, 0)
            guard received > 0 else { return }
            data.append(contentsOf: bytes.prefix(received))
            if let end = data.range(of: Data("\r\n\r\n".utf8)) {
                respond(client, request: String(decoding: data[..<end.lowerBound], as: UTF8.self))
                return
            }
        }
    }

    private func respond(_ connection: Int32, request: String) {
        let lines = request.components(separatedBy: "\r\n")
        let fields = lines[0].split(separator: " ")
        if CommandLine.arguments.contains("--self-test") { fputs("Bundle request: \(lines[0])\n", stderr) }
        let validHost = lines.dropFirst().contains { $0.lowercased() == "host: 127.0.0.1:\(port)" }
        guard validHost, fields.count == 3, fields[0] == "GET", fields[1].hasPrefix(prefix + "/"),
              let url = URL(string: "http://127.0.0.1:\(port)" + fields[1]),
              let path = localPath(url), let type = types[url.pathExtension] else {
            send(connection, code: "404 Not Found")
            return
        }
        let file = root.appendingPathComponent(String(path.dropFirst())).resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            send(connection, code: "404 Not Found")
            return
        }
        send(connection, code: "200 OK", type: type, data: data)
    }

    private func send(_ connection: Int32, code: String, type: String = "text/plain", data: Data = Data()) {
        let headers = [
            "HTTP/1.1 \(code)", "Content-Type: \(type)", "Content-Length: \(data.count)",
            "Connection: close", "Cache-Control: no-store", "X-Content-Type-Options: nosniff",
            "Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
        ]
        let response = Data((headers.joined(separator: "\r\n") + "\r\n\r\n").utf8) + data
        response.withUnsafeBytes { buffer in
            guard let pointer = buffer.baseAddress else { return }
            var sent = 0
            while sent < buffer.count {
                let count = Darwin.send(connection, pointer + sent, buffer.count - sent, 0)
                guard count > 0 else { return }
                sent += count
            }
        }
    }
}
