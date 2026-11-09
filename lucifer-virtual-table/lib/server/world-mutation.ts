import 'server-only';
import {getPool} from './postgres';
import {publishRoom} from './room-bus';
import {acquireDrag} from './drag-lease';
import {resolveAction,monsterToken,characterToken} from './catalog';
import {applyCommand,GameError,playerView} from '../game/commands';
import type {Command,Member,WorldState} from '../game/types';
export async function mutateWorld(worldId:string,userId:string,version:number,command:Command){
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  const {rows}=await client.query('SELECT w.state,w.version,m.role,m.name FROM worlds w JOIN members m ON m.world_id=w.id WHERE w.id=$1 AND m.user_id=$2 FOR UPDATE OF w',[worldId,userId]);
  const row=rows[0];if(!row)throw new GameError('Нет доступа к кампании',403);
  // Independent token moves merge against the latest state instead of
  // rejecting a different player's concurrent move as a stale whole-world edit.
  if(command.type!=='move'&&version!==row.version)throw new GameError('Стол уже изменился. Повторите действие.',409);
  const state=row.state as WorldState,member:Member={userId,name:row.name,role:row.role};
  if(command.type==='combat.act')command={...command,resolvedAction:resolveAction(state,command,member.role==='gm')};
  if(command.type==='catalog.monster'){if(member.role!=='gm')throw new GameError('Доступно только ведущему',403);command={type:'token.add',token:monsterToken(String(command.monsterId),state.scenes.find(s=>s.id===state.activeScene)!)};}
  if(command.type==='catalog.character'){if(member.role!=='gm')throw new GameError('Доступно только ведущему',403);command={type:'token.add',token:characterToken(command,state.scenes.find(s=>s.id===state.activeScene)!)};}
  const next=applyCommand(state,command,member),nextVersion=row.version+1;
  if(command.type==='move'){
   if(command.sceneId&&command.sceneId!==state.activeScene)throw new GameError('Сцена уже сменилась',409);
   if(typeof command.gestureId==='string'){
    await acquireDrag(client,worldId,state.activeScene,String(command.id),command.gestureId,member);
    await client.query('INSERT INTO token_drags(world_id,scene_id,token_id,user_id,gesture_id,seq,x,y,updated_at) VALUES($1,$2,$3,$4,$5,1000001,$6,$7,$8) ON CONFLICT(world_id,scene_id,token_id) DO UPDATE SET user_id=excluded.user_id,gesture_id=excluded.gesture_id,seq=excluded.seq,x=excluded.x,y=excluded.y,updated_at=excluded.updated_at',[worldId,state.activeScene,command.id,userId,command.gestureId,command.x,command.y,Date.now()]);
   }else{
    const lease=(await client.query('SELECT d.user_id,m.role FROM token_drags d JOIN members m ON m.world_id=d.world_id AND m.user_id=d.user_id WHERE d.world_id=$1 AND d.scene_id=$2 AND d.token_id=$3 AND d.updated_at>$4',[worldId,state.activeScene,command.id,Date.now()-3000])).rows[0];
    if(lease&&lease.user_id!==userId){if(member.role==='player')throw new GameError('Фишкой сейчас управляет ведущий',409);await acquireDrag(client,worldId,state.activeScene,String(command.id),crypto.randomUUID(),member);}
   }
  }
  await client.query('UPDATE worlds SET state=$1,version=$2 WHERE id=$3',[JSON.stringify(next),nextVersion,worldId]);
  await publishRoom({worldId,type:'invalidate',version:nextVersion},client);
  await client.query('COMMIT');
  return {version:nextVersion,state:member.role==='gm'?next:playerView(next,userId)};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
