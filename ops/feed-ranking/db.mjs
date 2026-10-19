// 只读/受控写探针：用 backend-ts 自带 neon 驱动直连 .env.local 指向的库。
// 用法：node db.mjs "SQL"   （单语句；返回 JSON）
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const here = path.dirname(new URL(import.meta.url).pathname);
const bt = path.resolve(here, '../../backend-ts');
const require = createRequire(path.join(bt, 'package.json'));
const dotenv = require('dotenv');
dotenv.config({ path: path.join(bt, '.env.local') });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const q = process.argv[2];
if (!q) { console.error('usage: node db.mjs "<sql>"'); process.exit(2); }
const rows = await sql(q);
console.log(JSON.stringify(rows, null, 1));
