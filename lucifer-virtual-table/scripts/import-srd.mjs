import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const revision='dff09cc6f6764734d20fdba65a07a041613697ca';
const root=`https://raw.githubusercontent.com/5e-bits/5e-srd-api/${revision}/packages/5e-database/src/2014/en/`;
mkdirSync('data/srd2014',{recursive:true});mkdirSync('public/licenses',{recursive:true});
const manifest={edition:'D&D 5e SRD 2014',revision,source:'https://github.com/5e-bits/5e-srd-api',files:[]};
for(const name of ['Monsters','Spells','Races','Subraces','Classes','Subclasses','Traits','Features','Conditions','Equipment','Levels']){
 const response=await fetch(root+'5e-SRD-'+name+'.json');if(!response.ok)throw new Error(name+': '+response.status);
 const data=await response.json();if(!Array.isArray(data)||!data.length)throw new Error('Empty dataset: '+name);
 const text=JSON.stringify(data);writeFileSync('data/srd2014/'+name.toLowerCase()+'.json',text);
 manifest.files.push({name,count:data.length,sha256:createHash('sha256').update(text).digest('hex')});console.log(name+': '+data.length);
}
writeFileSync('data/srd2014/manifest.json',JSON.stringify(manifest,null,2));
for(const [name,url] of [['5e-bits-LICENSE.md',`https://raw.githubusercontent.com/5e-bits/5e-srd-api/${revision}/LICENSE.md`],['SRD-OGL.txt',`https://raw.githubusercontent.com/5e-bits/5e-srd-api/${revision}/packages/5e-database/src/2014/LICENSE.md`]]){
 const response=await fetch(url);if(response.ok)writeFileSync('public/licenses/'+name,await response.text());else console.log('License source unavailable:',name,response.status);
}
