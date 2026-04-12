import db from "./db.js";

export async function runMigrations() {
    try {
        await db.query(`
            ALTER TABLE account
            ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL
        `);
        await db.query(`
            ALTER TABLE account
            ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT NULL
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS race_history (
                id          SERIAL PRIMARY KEY,
                accountid   INTEGER NOT NULL REFERENCES account(accountid) ON DELETE CASCADE,
                wpm         INTEGER NOT NULL,
                accuracy    NUMERIC(5,2) NOT NULL,
                mode        VARCHAR(20) NOT NULL DEFAULT 'multiplayer',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_race_history_account_time
            ON race_history(accountid, created_at DESC)
        `);
        console.log("[DB] Migrations applied.");
    } catch (error) {
        console.error("[DB] Migration error:", error.message);
    }
}
