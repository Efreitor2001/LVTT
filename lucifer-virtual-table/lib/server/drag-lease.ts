import 'server-only';
import type {PoolClient} from 'pg';
import type {Member} from '../game/types';
import {GameError} from '../game/commands';
import {dragPriority} from '../game/drag-priority';
import {publishRoom} from './room-bus';
export async function acquireDrag(client:PoolClient,worldId:string,sceneId:string,tokenId:string,gestureId:string,actor:Member){
 const now=Date.now();
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[worldId+':'+sceneId+':'+tokenId]);
 const cancelled=await client.query('SELECT 1 FROM cancelled_drags WHERE world_id=$1 AND gesture_id=$2 AND user_id=$3 AND expires_at>$4',[worldId,gestureId,actor.userId,now]);
 if(cancelled.rows.length)throw new GameError('Перемещение отменено: управление передано ведущему',409);
 const row=(await client.query('SELECT d.user_id,d.gesture_id,d.updated_at,m.role FROM token_drags d JOIN members m ON m.world_id=d.world_id AND m.user_id=d.user_id WHERE d.world_id=$1 AND d.scene_id=$2 AND d.token_id=$3',[worldId,sceneId,tokenId])).rows[0];
 const lease=row?{userId:row.user_id,gestureId:row.gesture_id,role:row.role,updatedAt:row.updated_at}:undefined;
 const priority=dragPriority(actor,gestureId,lease,now);
 if(priority==='blocked')throw new GameError(row?.role==='gm'?'Фишкой сейчас управляет ведущий':'Эту фишку сейчас перемещает другой участник',409);
 if(priority==='preempt'){
  await client.query('INSERT INTO cancelled_drags(world_id,gesture_id,user_id,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(world_id,gesture_id) DO UPDATE SET expires_at=excluded.expires_at',[worldId,lease!.gestureId,lease!.userId,now+300000]);
  await publishRoom({worldId,type:'drag-revoked',id:tokenId,gestureId:lease!.gestureId,userId:lease!.userId},client);
 }
 return priority;
}
