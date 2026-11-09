import 'server-only';
import type {PoolClient} from 'pg';
import type {RoomSignal} from '../game/live';
import {getPool} from './postgres';
export const ROOM_CHANNEL='lucifer_room_events';
type Listener=(signal:RoomSignal)=>void;
type Hub={listeners:Map<string,Set<Listener>>;ready?:Promise<void>;client?:PoolClient;retry?:ReturnType<typeof setTimeout>};
const shared=globalThis as typeof globalThis & {lvtRoomHub?:Hub};
const hub:Hub=shared.lvtRoomHub??={listeners:new Map()};
async function listen(){
 if(hub.ready)return hub.ready;
 hub.ready=(async()=>{
  const client=await getPool().connect();hub.client=client;
  client.on('notification',message=>{if(message.channel!==ROOM_CHANNEL||!message.payload)return;try{const event=JSON.parse(message.payload) as RoomSignal;for(const callback of hub.listeners.get(event.worldId)??[])callback(event);}catch{console.error('Invalid room notification');}});
  client.on('error',()=>{if(hub.client!==client)return;hub.client=undefined;hub.ready=undefined;client.release(true);if(!hub.retry)hub.retry=setTimeout(()=>{hub.retry=undefined;void listen().then(()=>{for(const [worldId,listeners] of hub.listeners)for(const callback of listeners)callback({worldId,type:'invalidate',version:0});}).catch(()=>{});},1000);});
  await client.query(`LISTEN ${ROOM_CHANNEL}`);
 })().catch(error=>{hub.ready=undefined;throw error;});
 return hub.ready;
}
export async function subscribeRoom(worldId:string,callback:Listener){
 await listen();let listeners=hub.listeners.get(worldId);if(!listeners){listeners=new Set();hub.listeners.set(worldId,listeners);}listeners.add(callback);
 return()=>{listeners!.delete(callback);if(!listeners!.size)hub.listeners.delete(worldId);};
}
export async function publishRoom(signal:RoomSignal,client?:Pick<PoolClient,'query'>){await (client??getPool()).query('SELECT pg_notify($1,$2)',[ROOM_CHANNEL,JSON.stringify(signal)]);}
