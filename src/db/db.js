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

// Choose configuration based on environment
const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = isProduction 
  ? {
      // Production: Use DATABASE_URL (for Heroku, Render, etc.)
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      // Development: Use individual connection parameters
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB
    };

const db = new Pool(poolConfig);

db.query("SELECT 1")
  .then(() => console.log(`Connected to PostgreSQL database (${isProduction ? 'REMOTE' : 'LOCAL'})`))
  .catch((err) => console.error("Error connecting to the database:", err.message));

// Don't let pool errors crash the process
db.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

export default db;