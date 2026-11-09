import type {Member} from './types';
export type DragUpdate={id:string;sceneId:string;gestureId:string;seq:number;x:number;y:number;path?:{x:number;y:number}[];phase:'move'|'end'};
export type LiveToken={id:string;sceneId:string;gestureId:string;seq:number;userId:string;x?:number;y?:number;visible:boolean;expiresAt:number;endingVersion?:number};
export type RoomEvent={type:'invalidate';version:number}|{type:'preview';token:LiveToken}|{type:'drag-end';id:string;gestureId:string;version:number}|{type:'drag-revoked';id:string;gestureId:string;userId:string}|{type:'deleted'}|{type:'ready'}|{type:'unauthorized'};
export type RoomSignal={worldId:string;type:'invalidate';version:number}|{worldId:string;type:'preview';token:LiveToken;hidden:boolean;revealed:boolean;ownerId:string|null;visibleTo?:string[]}|{worldId:string;type:'drag-end';id:string;gestureId:string;version:number}|{worldId:string;type:'drag-revoked';id:string;gestureId:string;userId:string}|{worldId:string;type:'deleted'};
export function publicRoomEvent(signal:RoomSignal,member:Pick<Member,'userId'|'role'>):RoomEvent|null{
 if(signal.type==='drag-revoked'&&signal.userId!==member.userId)return null;
 if(signal.type==='preview'){
  if(member.role!=='gm'&&signal.hidden)return null;
  const visible=member.role==='gm'||signal.revealed||signal.visibleTo?.includes(member.userId)||signal.ownerId===member.userId;
  const {x,y,...safe}=signal.token;
  return {type:'preview',token:visible?signal.token:{...safe,visible:false}};
 }
 const {worldId,...event}=signal;return event;
}
