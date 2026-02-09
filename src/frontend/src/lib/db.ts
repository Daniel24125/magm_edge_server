import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), '../edge_server/database/models/sessions.db');

let db: Database.Database;

try {
    db = new Database(dbPath, { verbose: console.log });
    db.pragma('journal_mode = WAL');
} catch (error) {
    console.error("Failed to connect to SQLite database:", error);
    throw error;
}

export default db;
