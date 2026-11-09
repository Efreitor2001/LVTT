import {database as db,getPool} from './postgres';
import { getCurrentUser } from './auth';
import { createSeed } from '../game/seed';
import { stateSchema } from '../game/validation';
import { applyCommand, GameError, playerView } from '../game/commands';
import { rollDice, DiceError } from '../game/dice';
import type { Command, WorldState, Member } from '../game/types';
import { z } from 'zod';
import { sameOrigin } from './origin';
import {mutateWorld} from './world-mutation';
import {liveMove} from './live-move';
import {publishRoom} from './room-bus';
import {actorActions} from './catalog';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=()=>crypto.randomUUID();
async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function api(request:Request,parts:string[]) {
 try {
  const user=await getCurrentUser();if(!user)throw new GameError('Войдите, чтобы сохранить кампанию и играть вместе',401);
  
  if(request.method!=='GET'&&!sameOrigin(request))throw new GameError('Источник запроса не разрешён',403);
  const [resource,id,action]=parts;
  const accountName=await db.prepare('SELECT name FROM profiles WHERE user_id=?').bind(user.userId).first<{name:string}>();const actorName=(accountName?.name??user.displayName).slice(0,60);
  async function body(){const text=await request.text();if(text.length>4_000_000)throw new GameError('Запрос слишком большой',413);try{return JSON.parse(text);}catch{throw new GameError('Некорректный JSON');}}
  if(resource==='worlds'&&id&&action==='live'&&request.method==='POST'){await liveMove(id,user.userId,await body());return json({ok:true});}
  if(resource==='profile'){
   if(request.method==='GET'){
    const profile=await db.prepare('SELECT name,bio,color,reduced,created_at as createdAt FROM profiles WHERE user_id=?').bind(user.userId).first();
    const stats=await db.prepare("SELECT COUNT(*) as campaigns,SUM(CASE WHEN role='gm' THEN 1 ELSE 0 END) as hosted FROM members WHERE user_id=?").bind(user.userId).first();
    const rolls=await db.prepare("SELECT COUNT(*) as rolls FROM events WHERE user_id=? AND kind='roll'").bind(user.userId).first();
    return json({profile:profile??{name:user.displayName,bio:'',color:'#ad6142',reduced:false,createdAt:null},email:user.email,stats:{...stats,...rolls}});
   }
   if(request.method==='POST'){
    const p=z.object({name:z.string().trim().min(1).max(60),bio:z.string().trim().max(500),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),reduced:z.boolean()}).parse(await body());
    await db.batch([db.prepare('INSERT INTO profiles(user_id,name,bio,color,reduced,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,bio=excluded.bio,color=excluded.color,reduced=excluded.reduced').bind(user.userId,p.name,p.bio,p.color,Number(p.reduced),Date.now()),db.prepare('UPDATE members SET name=? WHERE user_id=?').bind(p.name,user.userId)]);
    return json({profile:p});
   }
  }
  if(resource==='worlds'&&!id){
   if(request.method==='GET'){const rows=await db.prepare('SELECT w.id,w.title,w.version,m.role FROM worlds w JOIN members m ON m.world_id=w.id WHERE m.user_id=? ORDER BY w.created_at DESC').bind(user.userId).all();return json({worlds:rows.results});}
   if(request.method==='POST') {const data=await body();const title=z.string().trim().min(1).max(100).parse(data.title);const count=await db.prepare('SELECT COUNT(*) as n FROM worlds WHERE owner=?').bind(user.userId).first<{n:number}>();if((count?.n??0)>=30)throw new GameError('Лимит: 30 кампаний на аккаунт',429);const worldId=uuid(),state=stateSchema.parse(data.state??createSeed());await db.batch([db.prepare('INSERT INTO worlds(id,owner,title,state,created_at) VALUES(?,?,?,?,?)').bind(worldId,user.userId,title,JSON.stringify(state),Date.now()),db.prepare('INSERT INTO members(world_id,user_id,name,role,last_seen) VALUES(?,?,?,?,?)').bind(worldId,user.userId,actorName,'gm',Date.now())]);return json({id:worldId},201);}
  }
  if(resource==='join'&&request.method==='POST'){
   const {token}=z.object({token:z.string().min(32).max(100)}).parse(await body());const client=await getPool().connect();let worldId='';
   try{await client.query('BEGIN');const result=await client.query('SELECT world_id,remaining,expires_at FROM invites WHERE hash=$1 FOR UPDATE',[await hash(token)]);const invite=result.rows[0];if(!invite||Number(invite.expires_at)<Date.now())throw new GameError('Приглашение истекло',404);worldId=invite.world_id;const existing=await client.query('SELECT user_id FROM members WHERE world_id=$1 AND user_id=$2',[worldId,user.userId]);if(!existing.rows.length){if(invite.remaining<1)throw new GameError('Приглашение исчерпано',409);await client.query('INSERT INTO members(world_id,user_id,name,role,last_seen) VALUES($1,$2,$3,$4,$5)',[worldId,user.userId,actorName,'player',Date.now()]);await client.query('UPDATE invites SET remaining=remaining-1 WHERE hash=$1',[await hash(token)]);}await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}await publishRoom({worldId,type:'invalidate',version:0});return json({id:worldId});
  }
  if(resource==='assets'&&id&&request.method==='GET'){
   const row=await db.prepare('SELECT a.data,a.type FROM assets a JOIN members m ON m.world_id=a.world_id WHERE a.id=? AND m.user_id=?').bind(id,user.userId).first<{data:Buffer;type:string}>();if(!row)throw new GameError('Файл не найден',404);return new Response(new Uint8Array(row.data),{headers:{'Content-Type':row.type,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  if(resource!=='worlds'||!id)throw new GameError('Маршрут не найден',404);
  const member=await db.prepare('SELECT user_id as userId,name,role FROM members WHERE world_id=? AND user_id=?').bind(id,user.userId).first<Member>();if(!member)throw new GameError('У вас нет доступа к кампании',403);
  const row=await db.prepare('SELECT title,state,version FROM worlds WHERE id=?').bind(id).first<{title:string;state:string;version:number}>();if(!row)throw new GameError('Кампания не найдена',404);
  const state=(typeof row.state==='string'?JSON.parse(row.state):row.state) as WorldState,gm=member.role==='gm';const mustGM=()=>{if(!gm)throw new GameError('Доступно только ведущему',403);};
  if(request.method==='GET'&&action==='actions'){const token=state.scenes.find(s=>s.id===state.activeScene)!.tokens.find(t=>t.id===new URL(request.url).searchParams.get('token'));if(!token||(!gm&&token.ownerId!==user.userId))throw new GameError('Нет доступа к действиям персонажа',403);return json({actions:actorActions(token,state.scenes.find(s=>s.id===state.activeScene)!)});}
  if(request.method==='GET'&&!action){
   const last=Number(new URL(request.url).searchParams.get('after')??0);const after=Number.isFinite(last)?Math.max(0,last):0;
   const [people,logs]=await Promise.all([db.prepare('SELECT user_id as userId,name,role,last_seen as lastSeen FROM members WHERE world_id=?').bind(id).all(),db.prepare("SELECT id,user_id as userId,name,kind,visibility,data,created_at as createdAt FROM events WHERE world_id=? AND created_at>? AND (visibility='all' OR user_id=? OR ?='gm') ORDER BY created_at DESC,id DESC LIMIT 100").bind(id,after,user.userId,member.role).all()]);
   await db.prepare('UPDATE members SET last_seen=? WHERE world_id=? AND user_id=? AND last_seen<?').bind(Date.now(),id,user.userId,Date.now()-20000).run();
   return json({id,title:row.title,version:row.version,state:gm?state:playerView(state,user.userId),role:member.role,members:people.results,events:logs.results.reverse().map(e=>({...e,data:typeof e.data==='string'?JSON.parse(e.data):e.data}))});
  }
  if(request.method==='POST'&&action==='command'){const data=await body();const version=z.number().int().min(1).parse(data.version);const command=z.object({type:z.string()}).passthrough().parse(data.command) as Command;return json(await mutateWorld(id,user.userId,version,command));}
  if(request.method==='POST'&&action==='events'){
   const data=z.object({id:z.string().uuid(),kind:z.enum(['chat','roll','ping']),visibility:z.enum(['all','gm']).default('all'),text:z.string().trim().min(1).max(4000).optional(),formula:z.string().max(300).optional(),x:z.number().min(0).max(1800).optional(),y:z.number().min(0).max(1200).optional()}).parse(await body());
   const existing=await db.prepare('SELECT id FROM events WHERE id=? AND world_id=? AND user_id=?').bind(data.id,id,user.userId).first();if(existing)return json({ok:true});
   const recent=await db.prepare('SELECT COUNT(*) as n FROM events WHERE world_id=? AND user_id=? AND created_at>?').bind(id,user.userId,Date.now()-60000).first<{n:number}>();if((recent?.n??0)>=60)throw new GameError('Слишком много событий. Подождите минуту.',429);
   const payload=data.kind==='roll'?{roll:rollDice(data.formula??state.system.formula,state.system.dice,state.system.cancellations)}:data.kind==='ping'?{x:data.x??0,y:data.y??0}:{text:data.text??''};if(data.kind==='chat'&&!data.text)throw new GameError('Сообщение пустое');
   const event={id:data.id,userId:user.userId,name:member.name,kind:data.kind,visibility:data.visibility,data:payload,createdAt:Date.now()};
   await db.prepare('INSERT INTO events(id,world_id,user_id,name,kind,visibility,data,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(event.id,id,user.userId,event.name,event.kind,event.visibility,JSON.stringify(payload),event.createdAt).run();await publishRoom({worldId:id,type:'invalidate',version:row.version});return json({event},201);
  }
  if(request.method==='POST'&&action==='invite'){mustGM();const token=uuid()+uuid().replaceAll('-','');await db.prepare('INSERT INTO invites(hash,world_id,expires_at,remaining) VALUES(?,?,?,?)').bind(await hash(token),id,Date.now()+86400000,8).run();return json({token,expiresAt:Date.now()+86400000});}
  if(request.method==='POST'&&action==='upload'){
   mustGM();
   const type=request.headers.get('content-type')??'';if(!['image/png','image/jpeg','image/webp'].includes(type))throw new GameError('Загрузите PNG, JPEG или WebP');
   if(Number(request.headers.get('content-length'))>10_000_000)throw new GameError('Карта должна быть меньше 10 МБ',413);
   const buffer=await request.arrayBuffer();if(buffer.byteLength>10_000_000)throw new GameError('Карта должна быть меньше 10 МБ',413);
   const bytes=new Uint8Array(buffer);const actual=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':'';if(type!==actual)throw new GameError('Содержимое файла не соответствует формату');
   const used=await db.prepare('SELECT SUM(size) as n FROM assets WHERE world_id=?').bind(id).first<{n:number}>();if((used?.n??0)+buffer.byteLength>200_000_000)throw new GameError('Лимит файлов кампании: 200 МБ');
   const assetId=uuid();await db.prepare('INSERT INTO assets(id,world_id,type,size,data) VALUES(?,?,?,?,?)').bind(assetId,id,type,buffer.byteLength,Buffer.from(buffer)).run();return json({url:`/api/assets/${assetId}`},201);
  }
  if(request.method==='DELETE'&&!action){mustGM();await db.prepare('DELETE FROM worlds WHERE id=?').bind(id).run();await publishRoom({worldId:id,type:'deleted'});return json({ok:true});}
  throw new GameError('Маршрут не найден',404);
 }catch(e){if(e instanceof GameError)return json({error:e.message},e.status);if(e instanceof z.ZodError)return json({error:e.issues.map(i=>i.message).join('; ')},400);if(e instanceof DiceError)return json({error:e.message},400);console.error('VTT API error',e instanceof Error?e.message:'unknown');return json({error:'Не удалось выполнить запрос. Попробуйте ещё раз.'},500);}
}
