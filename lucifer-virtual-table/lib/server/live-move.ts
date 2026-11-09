import 'server-only';
import {z} from 'zod';
import {getPool} from './postgres';
import {publishRoom} from './room-bus';
import {acquireDrag} from './drag-lease';
import {applyCommand,GameError,tokenVisible} from '../game/commands';
import type {Member,WorldState} from '../game/types';
const point=z.object({x:z.number().finite().min(0).max(1800),y:z.number().finite().min(0).max(1200)});
const schema=z.object({id:z.string().min(1).max(100),sceneId:z.string().min(1).max(100),gestureId:z.string().uuid(),seq:z.number().int().min(0).max(1000000),x:point.shape.x,y:point.shape.y,path:z.array(point).max(200).optional(),phase:z.enum(['move','end'])});
export async function liveMove(worldId:string,userId:string,input:unknown){
 const move=schema.parse(input),client=await getPool().connect();
 try{
  await client.query('BEGIN');
  const {rows}=await client.query('SELECT w.state,w.version,m.role,m.name FROM worlds w JOIN members m ON m.world_id=w.id WHERE w.id=$1 AND m.user_id=$2 FOR SHARE OF w',[worldId,userId]);
  const row=rows[0];if(!row)throw new GameError('Нет доступа к кампании',403);
  if(move.phase==='end'){
   const removed=await client.query('DELETE FROM token_drags WHERE world_id=$1 AND scene_id=$2 AND token_id=$3 AND user_id=$4 AND gesture_id=$5 RETURNING token_id',[worldId,move.sceneId,move.id,userId,move.gestureId]);
   if(removed.rowCount)await publishRoom({worldId,type:'drag-end',id:move.id,gestureId:move.gestureId,version:row.version},client);
   await client.query('COMMIT');return;
  }
  const state=row.state as WorldState;if(state.activeScene!==move.sceneId)throw new GameError('Сцена уже сменилась',409);
  const member:Member={userId,name:row.name,role:row.role};
  applyCommand(state,{type:'move',id:move.id,x:move.x,y:move.y,path:move.path},member);
  await acquireDrag(client,worldId,move.sceneId,move.id,move.gestureId,member);const now=Date.now();
  const lease=await client.query('INSERT INTO token_drags(world_id,scene_id,token_id,user_id,gesture_id,seq,x,y,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(world_id,scene_id,token_id) DO UPDATE SET user_id=excluded.user_id,gesture_id=excluded.gesture_id,seq=excluded.seq,x=excluded.x,y=excluded.y,updated_at=excluded.updated_at WHERE token_drags.gesture_id<>excluded.gesture_id OR token_drags.seq<excluded.seq RETURNING token_id',[worldId,move.sceneId,move.id,userId,move.gestureId,move.seq,move.x,move.y,now]);
  if(lease.rowCount){
   const token=state.scenes.find(s=>s.id===move.sceneId)!.tokens.find(t=>t.id===move.id)!;
   await publishRoom({worldId,type:'preview',token:{id:move.id,sceneId:move.sceneId,gestureId:move.gestureId,seq:move.seq,userId,x:move.x,y:move.y,visible:true,expiresAt:now+2500},hidden:token.hidden,ownerId:token.ownerId,revealed:(state.scenes.find(s=>s.id===move.sceneId)!.visionMode??'shared')!=='owned'&&tokenVisible({...token,x:move.x,y:move.y},state),visibleTo:[...new Set(state.scenes.find(s=>s.id===move.sceneId)!.tokens.map(t=>t.ownerId).filter((id):id is string=>!!id))].filter(id=>tokenVisible({...token,x:move.x,y:move.y},state,id))},client);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
