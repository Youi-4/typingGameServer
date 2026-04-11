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
        console.log("[DB] Migrations applied.");
    } catch (error) {
        console.error("[DB] Migration error:", error.message);
    }
}
