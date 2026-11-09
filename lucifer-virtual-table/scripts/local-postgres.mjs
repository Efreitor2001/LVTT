import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
mkdirSync('var',{recursive:true});
const secretsPath='var/postgres-credentials.json';
const credentials=existsSync(secretsPath)?JSON.parse(readFileSync(secretsPath,'utf8')):{cluster:randomBytes(32).toString('hex'),app:randomBytes(32).toString('hex')};
if(!existsSync(secretsPath))writeFileSync(secretsPath,JSON.stringify(credentials),{mode:0o600});
const databaseDir=resolve('var/postgres'),database=new EmbeddedPostgres({databaseDir,user:'lvt_cluster',password:credentials.cluster,port:55432,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1','-c','max_connections=40'],onLog:message=>appendFileSync('var/postgres.log',String(message)+'\n'),onError:message=>appendFileSync('var/postgres.log',String(message)+'\n')});
if(process.argv.includes('--stop')){await database.stop();console.log('Local PostgreSQL stopped. Data preserved.');process.exit(0);}
if(!existsSync(databaseDir+'/PG_VERSION'))await database.initialise();
let stopped=false;
async function stop(){if(stopped)return;stopped=true;await database.stop();process.exit(0);}
await database.start();
const client=new pg.Client({host:'127.0.0.1',port:55432,user:'lvt_cluster',password:credentials.cluster,database:'postgres'});await client.connect();
if(!(await client.query("SELECT 1 FROM pg_roles WHERE rolname='lvt_app'")).rows.length)await client.query("CREATE ROLE lvt_app WITH LOGIN PASSWORD '"+credentials.app+"' NOSUPERUSER NOCREATEDB NOCREATEROLE");
if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='lucifer_vtt'")).rows.length)await client.query('CREATE DATABASE lucifer_vtt OWNER lvt_app');
const version=(await client.query('SHOW server_version')).rows[0].server_version;await client.end();
if(!existsSync('.env.local'))writeFileSync('.env.local','DATABASE_URL=postgresql://lvt_app:'+credentials.app+'@127.0.0.1:55432/lucifer_vtt\nAUTH_SECURE_COOKIE=false\n',{mode:0o600});
console.log('PostgreSQL '+version+' ready: 127.0.0.1:55432 / lucifer_vtt. Credentials are local and ignored by Git.');
process.on('SIGINT',stop);process.on('SIGTERM',stop);
setInterval(()=>{},60000);
