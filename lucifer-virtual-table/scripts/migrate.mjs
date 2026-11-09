import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
if(existsSync('.env.local'))process.loadEnvFile?.('.env.local');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is missing. Run npm run db:local first or configure .env.local.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try{
 await client.query('SELECT pg_advisory_lock(812765331)');
 await client.query('CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
 for(const name of readdirSync('db/migrations').filter(f=>f.endsWith('.sql')).sort()){
  const sql=readFileSync('db/migrations/'+name,'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
  const applied=await client.query('SELECT checksum FROM app_migrations WHERE name=$1',[name]);
  if(applied.rows[0]){if(applied.rows[0].checksum!==checksum)throw new Error('Applied migration changed: '+name);continue;}
  try{await client.query('BEGIN');await client.query(sql);await client.query('INSERT INTO app_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);await client.query('COMMIT');console.log('Applied '+name);}catch(e){await client.query('ROLLBACK');throw e;}
 }
}finally{await client.query('SELECT pg_advisory_unlock(812765331)');await client.end();}
