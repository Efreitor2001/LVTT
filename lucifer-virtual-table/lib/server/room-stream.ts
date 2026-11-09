import 'server-only';
import {cookies} from 'next/headers';
import {getCurrentUser,digest} from './auth';
import {getPool} from './postgres';
import {subscribeRoom} from './room-bus';
import {publicRoomEvent} from '../game/live';
import type {RoomEvent} from '../game/live';
import type {Member} from '../game/types';
export async function roomStream(request:Request,worldId:string){
 const user=await getCurrentUser();if(!user)return Response.json({error:'Войдите в аккаунт'},{status:401});
 const db=getPool(),membership=(await db.query('SELECT role FROM members WHERE world_id=$1 AND user_id=$2',[worldId,user.userId])).rows[0];
 if(!membership)return Response.json({error:'Нет доступа к кампании'},{status:403});
 const member:Member={userId:user.userId,name:user.displayName,role:membership.role},session=(await cookies()).get('lvt_session')?.value;
 let controller:ReadableStreamDefaultController<Uint8Array>|undefined,closed=false,timer:ReturnType<typeof setInterval>|undefined,unsubscribe=()=>{};
 const encoder=new TextEncoder();
 function send(event:RoomEvent){if(!closed&&controller)controller.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));}
 function close(){if(closed)return;closed=true;clearInterval(timer);unsubscribe();request.signal.removeEventListener('abort',close);try{controller?.close();}catch{}}
 unsubscribe=await subscribeRoom(worldId,signal=>{const event=publicRoomEvent(signal,member);if(event)send(event);if(signal.type==='deleted')close();});
 if(request.signal.aborted){close();return new Response(null,{status:499});}
 const stream=new ReadableStream<Uint8Array>({
  start(c){
   controller=c;c.enqueue(encoder.encode('retry: 1500\n\n'));send({type:'ready'});
   request.signal.addEventListener('abort',close,{once:true});
   timer=setInterval(()=>{void (async()=>{
    const valid=await db.query('SELECT m.role FROM members m JOIN sessions s ON s.user_id=m.user_id WHERE m.world_id=$1 AND m.user_id=$2 AND s.token_hash=$3 AND s.expires_at>$4',[worldId,user.userId,session?digest(session):'',Date.now()]);
    if(!valid.rows.length){send({type:'unauthorized'});close();return;}
    member.role=valid.rows[0].role;await db.query('UPDATE members SET last_seen=$1 WHERE world_id=$2 AND user_id=$3',[Date.now(),worldId,user.userId]);
    if(!closed)controller?.enqueue(encoder.encode(': heartbeat\n\n'));
   })().catch(()=>close());},15000);
  },
  cancel(){close();}
 });
 return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
}
