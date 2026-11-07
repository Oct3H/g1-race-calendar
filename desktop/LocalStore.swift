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

    // Old race records use raceDate. Early records without a date can only be
    // assigned to a year when it is encoded in a known key format.
    private let cacheYearSQL = """
        CASE
          WHEN key = 'result' AND json_valid(value)
            THEN CASE WHEN json_extract(value, '$.cleared') IS NOT 1 THEN '2026' END
          WHEN key GLOB 'cache.revision.[0-9][0-9][0-9][0-9]' THEN substr(key, -4)
          WHEN key GLOB 'schedule.*.[0-9][0-9][0-9][0-9]' THEN substr(key, -4)
          WHEN key GLOB 'detail.horse.[0-9][0-9][0-9][0-9]-*' THEN substr(key, 14, 4)
          WHEN key GLOB 'detail.race.*' AND json_valid(value) THEN
            CASE
              WHEN json_extract(value, '$.raceDate') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
                THEN substr(json_extract(value, '$.raceDate'), 1, 4)
              WHEN key GLOB 'detail.race.jra-[0-9][0-9][0-9][0-9]-*'
                OR key GLOB 'detail.race.nar-[0-9][0-9][0-9][0-9]-*' THEN substr(key, 17, 4)
              WHEN key GLOB 'detail.race.ifha-[0-9][0-9][0-9][0-9]-*'
                OR key GLOB 'detail.race.hkjc-[0-9][0-9][0-9][0-9]-*' THEN substr(key, 18, 4)
              WHEN key GLOB 'detail.race.nar-history-[0-9][0-9][0-9][0-9]-*' THEN substr(key, 25, 4)
              WHEN key GLOB 'detail.race.overseas-history-[0-9][0-9][0-9][0-9]-*' THEN substr(key, 30, 4)
            END
        END
        """

    func cacheRevision(_ year: Int) throws -> Int {
        Int(try read("cache.revision.\(year)") ?? "") ?? 0
    }

    func cacheYears() throws -> [[String: Int]] {
        let sql = """
            SELECT year,
              sum(key GLOB 'detail.race.*' OR key = 'result'),
              sum(key GLOB 'detail.horse.*'),
              max(CASE WHEN key GLOB 'cache.revision.*' THEN CAST(value AS INTEGER) ELSE 0 END)
            FROM (SELECT key, value, \(cacheYearSQL) AS year FROM local_data)
            WHERE year IS NOT NULL GROUP BY year
            """
        var handle: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &handle, nil) == SQLITE_OK, let handle else { throw failure() }
        defer { sqlite3_finalize(handle) }
        var years: [[String: Int]] = []
        while true {
            switch sqlite3_step(handle) {
            case SQLITE_DONE: return years
            case SQLITE_ROW:
                years.append(["year": Int(sqlite3_column_int(handle, 0)),
                              "races": Int(sqlite3_column_int(handle, 1)),
                              "horses": Int(sqlite3_column_int(handle, 2)),
                              "revision": Int(sqlite3_column_int(handle, 3))])
            default: throw failure()
            }
        }
    }

    func clearCacheYear(_ year: Int) throws -> Int {
        guard sqlite3_exec(db, "BEGIN IMMEDIATE", nil, nil, nil) == SQLITE_OK else { throw failure() }
        var committed = false
        defer { if !committed { sqlite3_exec(db, "ROLLBACK", nil, nil, nil) } }
        let sql = """
            DELETE FROM local_data
            WHERE key GLOB 'detail.*' AND (\(cacheYearSQL)) = ?1
            """
        let handle = try statement(sql, key: String(year))
        defer { sqlite3_finalize(handle) }
        guard sqlite3_step(handle) == SQLITE_DONE else { throw failure() }
        if year == 2026 { try write("result", #"{"cleared":true}"#) }
        let revision = try cacheRevision(year) + 1
        try write("cache.revision.\(year)", String(revision))
        guard sqlite3_exec(db, "COMMIT", nil, nil, nil) == SQLITE_OK else { throw failure() }
        committed = true
        return revision
    }
}
