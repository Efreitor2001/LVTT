'use client';
import {useCallback,useEffect,useRef,useState,useLayoutEffect} from 'react';
import type {DragUpdate,LiveToken,RoomEvent} from '../lib/game/live';
export function useRoomSync(worldId:string,userId:string,version:number,refresh:()=>Promise<unknown>,notify:(message:string)=>void,onDeleted:()=>void){
 const [online,setOnline]=useState(false),[tokens,setTokens]=useState<Record<string,LiveToken>>({}),[revoked,setRevoked]=useState<{id:string;gestureId:string}|null>(null);const cancelled=useRef(new Set<string>());
 const callbacks=useRef({refresh,notify,onDeleted});useLayoutEffect(()=>{callbacks.current={refresh,notify,onDeleted};},[refresh,notify,onDeleted]);
 const current=useRef({worldId,version});useLayoutEffect(()=>{current.current={worldId,version};},[worldId,version]);
 const outgoing=useRef<{active:boolean;pending:DragUpdate[];timer?:ReturnType<typeof setTimeout>;worldId:string;lastSent:number}>({active:false,pending:[],worldId,lastSent:0});
 const refreshTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const queueRefresh=useCallback(()=>{
  if(refreshTimer.current)return;
  refreshTimer.current=setTimeout(()=>{refreshTimer.current=null;void callbacks.current.refresh().catch(()=>{});},35);
 },[]);
 useEffect(()=>{
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes UI with a browser/WebGL or room subscription lifecycle.
  setTokens({});setOnline(false);setRevoked(null);cancelled.current.clear();outgoing.current={active:false,pending:[],worldId,lastSent:0};
  if(worldId==='demo')return;
  let disposed=false;
  const source=new EventSource(`/api/worlds/${worldId}/stream`);
  source.onmessage=message=>{
   if(disposed)return;
   const event=JSON.parse(message.data) as RoomEvent;
   if(event.type==='ready'){setOnline(true);queueRefresh();}
   if(event.type==='invalidate')queueRefresh();
   if(event.type==='deleted'){callbacks.current.onDeleted();source.close();}
   if(event.type==='unauthorized'){setOnline(false);source.close();callbacks.current.notify('Доступ к комнате завершён. Войдите в аккаунт снова.');}
   if(event.type==='preview'&&event.token.userId!==userId)setTokens(previous=>{
    const old=previous[event.token.id];
    if(old?.gestureId===event.token.gestureId&&old.seq>=event.token.seq)return previous;
    return {...previous,[event.token.id]:{...event.token,expiresAt:Date.now()+2500}};
   });
   if(event.type==='drag-revoked'){cancelled.current.add(event.gestureId);outgoing.current.pending=outgoing.current.pending.filter(p=>p.gestureId!==event.gestureId);setRevoked({id:event.id,gestureId:event.gestureId});callbacks.current.notify('Ведущий взял управление фишкой. Ваше перетаскивание отменено.');}
   if(event.type==='drag-end'){
    setTokens(previous=>{const token=previous[event.id];if(!token||token.gestureId!==event.gestureId)return previous;if(current.current.version>=event.version){const next={...previous};delete next[event.id];return next;}return {...previous,[event.id]:{...token,endingVersion:event.version,expiresAt:Date.now()+2500}};});
    queueRefresh();
   }
  };
  source.onerror=()=>setOnline(false);
  const cleanup=setInterval(()=>setTokens(previous=>{const now=Date.now(),next=Object.fromEntries(Object.entries(previous).filter(([,t])=>t.expiresAt>now));return Object.keys(next).length===Object.keys(previous).length?previous:next;}),300);
  const visible=()=>{if(!document.hidden)queueRefresh();};document.addEventListener('visibilitychange',visible);
  return()=>{disposed=true;source.close();clearInterval(cleanup);document.removeEventListener('visibilitychange',visible);if(refreshTimer.current)clearTimeout(refreshTimer.current);refreshTimer.current=null;if(outgoing.current.timer)clearTimeout(outgoing.current.timer);};
 },[worldId,userId,queueRefresh]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes UI with a browser/WebGL or room subscription lifecycle.
 useEffect(()=>{setTokens(previous=>{const next=Object.fromEntries(Object.entries(previous).filter(([,t])=>t.endingVersion===undefined||t.endingVersion>version));return Object.keys(next).length===Object.keys(previous).length?previous:next;});},[version]);
 const send=useCallback((update:DragUpdate)=>{
  if(current.current.worldId==='demo'||cancelled.current.has(update.gestureId))return;
  const queue=outgoing.current;
  const previous=queue.pending.at(-1);
  if(update.phase==='move'&&previous?.phase==='move'&&previous.gestureId===update.gestureId)queue.pending[queue.pending.length-1]=update;else queue.pending.push(update);
  async function drain(){
   if(queue.active||!queue.pending.length||queue.worldId!==current.current.worldId)return;
   queue.active=true;
   const next=queue.pending.shift()!;
   try{
    const response=await fetch(`/api/worlds/${queue.worldId}/live`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next),keepalive:next.phase==='end'});
    if(!response.ok&&!cancelled.current.has(next.gestureId)){const error=await response.json() as {error?:string};if(queue.worldId===current.current.worldId)callbacks.current.notify(error.error??'Не удалось передать перемещение');}
   }catch{/* A later snapshot restores the authoritative position after reconnect. */}
   finally{queue.active=false;queue.lastSent=performance.now();if(queue.pending.length)queue.timer=setTimeout(()=>{queue.timer=undefined;void drain();},queue.pending[0].phase==='end'?0:50);}
  }
  if(!queue.active&&!queue.timer)queue.timer=setTimeout(()=>{queue.timer=undefined;void drain();},update.phase==='end'?0:Math.max(0,50-(performance.now()-queue.lastSent)));
 },[]);
 return {online,tokens,send,revoked};
}
