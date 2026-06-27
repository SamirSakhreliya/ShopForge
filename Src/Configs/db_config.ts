import { Pool } from 'pg';

import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: String(process.env.DB_HOST),
  user: String(process.env.DB_USER),
  password: String(process.env.DB_PASSWORD),
  port: Number(process.env.DB_PORT),
  database: String(process.env.DB_DATABASE_NAME),
});
