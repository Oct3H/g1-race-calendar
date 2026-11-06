import Foundation
import SQLite3

enum StoreError: Error {
    case database(String)
}

final class LocalStore {
    private let db: OpaquePointer
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    init(directory: URL) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var connection: OpaquePointer?
        let path = directory.appendingPathComponent("calendar.sqlite").path
        guard sqlite3_open_v2(path, &connection, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, nil) == SQLITE_OK,
              let connection else {
            sqlite3_close(connection)
            throw StoreError.database("Cannot open calendar.sqlite")
        }
        db = connection
        let sql = "CREATE TABLE IF NOT EXISTS local_data (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else {
            sqlite3_close(db)
            throw StoreError.database("Cannot initialize calendar.sqlite")
        }
    }

    deinit { sqlite3_close(db) }

    private func statement(_ sql: String, key: String) throws -> OpaquePointer {
        var handle: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &handle, nil) == SQLITE_OK, let handle else { throw failure() }
        guard sqlite3_bind_text(handle, 1, key, -1, transient) == SQLITE_OK else {
            sqlite3_finalize(handle)
            throw failure()
        }
        return handle
    }

    private func failure() -> StoreError {
        .database(String(cString: sqlite3_errmsg(db)))
    }

    func read(_ key: String) throws -> String? {
        let handle = try statement("SELECT value FROM local_data WHERE key = ?1", key: key)
        defer { sqlite3_finalize(handle) }
        switch sqlite3_step(handle) {
        case SQLITE_DONE: return nil
        case SQLITE_ROW: return sqlite3_column_text(handle, 0).map { String(cString: $0) }
        default: throw failure()
        }
    }

    func write(_ key: String, _ value: String) throws {
        let sql = "INSERT INTO local_data VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        let handle = try statement(sql, key: key)
        defer { sqlite3_finalize(handle) }
        guard sqlite3_bind_text(handle, 2, value, -1, transient) == SQLITE_OK,
              sqlite3_step(handle) == SQLITE_DONE else { throw failure() }
    }
}
