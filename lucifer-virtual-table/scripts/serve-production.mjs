import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
process.env.PORT??='5173';
process.env.HOSTNAME='127.0.0.1';
await import('../.next/standalone/server.js');
