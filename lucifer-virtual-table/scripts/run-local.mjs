import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import net from 'node:net';
const children=[];
const waitPort=async(port,timeout=30000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));}))return true;await new Promise(r=>setTimeout(r,300));}return false;};
const isUp=async(port)=>new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));});
const run=(script,args=[])=>{const child=spawn(process.execPath,[script,...args],{stdio:'inherit',windowsHide:true});children.push(child);return child;};
let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;for(const child of [...children].reverse())child.kill('SIGTERM');};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
if(!await isUp(55432)){run('scripts/local-postgres.mjs');if(!await waitPort(55432))throw new Error('Local PostgreSQL did not start. See var/postgres.log.');}
if(!existsSync('.env.local'))throw new Error('Configure DATABASE_URL in .env.local before starting.');
const migration=run('scripts/migrate.mjs');const migrationExit=await new Promise(resolve=>migration.on('exit',resolve));if(migrationExit!==0){stop();process.exit(1);}
if(await isUp(5173)){console.log('Port 5173 already has a server. Open http://127.0.0.1:5173 or stop it first.');process.exit(0);}
const production=process.argv.includes('--production'),server=production?run('scripts/serve-production.mjs'):run('node_modules/next/dist/bin/next',['dev','--hostname','127.0.0.1','--port','5173']);server.on('exit',code=>{stop();process.exit(code??0);});
