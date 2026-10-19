// QA 独立探针专用：显式解析 dev .env.local（不吃 process.env，避免生产串污染）
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const dotenv = require('dotenv');
const { neon } = require('@neondatabase/serverless');

const envPath = process.env.SF_ENV_FILE || '/Users/kevin/bistro/seafood/backend-ts/.env.local';
const parsed = dotenv.parse(fs.readFileSync(envPath));
const url = process.env.SF_DB_URL || parsed.DATABASE_URL_UNPOOLED || parsed.DATABASE_URL;
if (!url) throw new Error('no DATABASE_URL in ' + envPath);
export const sql = neon(url);
export const dbIdentity = async () => {
  const r = await sql`SELECT current_setting('neon.project_id', true) AS project_id, current_database() AS db, current_setting('neon.branch_id', true) AS branch`;
  return r[0];
};
