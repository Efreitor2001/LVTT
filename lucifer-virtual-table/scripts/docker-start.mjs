import {readFileSync} from 'node:fs';
if(!process.env.DATABASE_URL&&process.env.DATABASE_PASSWORD_FILE){
 const password=readFileSync(process.env.DATABASE_PASSWORD_FILE,'utf8').trim();
 if(!password)throw new Error('Empty database password file');
 const host=process.env.DATABASE_HOST??'db',port=process.env.DATABASE_PORT??'5432',name=process.env.DATABASE_NAME??'lucifer_vtt',user=process.env.DATABASE_USER??'lvt_app';
 process.env.DATABASE_URL='postgresql://'+encodeURIComponent(user)+':'+encodeURIComponent(password)+'@'+host+':'+port+'/'+encodeURIComponent(name);
}
await import('./migrate.mjs');
await import('../server.js');
