import pg from "pg";
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

db.query("SELECT 1")
  .then(() => console.log("Connected to PostgreSQL database"))
  .catch((err) => console.error("Error connecting to the database:", err.message));

// Don't let pool errors crash the process
db.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

export default db;