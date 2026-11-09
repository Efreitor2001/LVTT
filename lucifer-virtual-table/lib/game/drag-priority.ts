import type {Member} from './types';
export type DragLease={userId:string;gestureId:string;role:'gm'|'player';updatedAt:number};
export function dragPriority(actor:Pick<Member,'userId'|'role'>,gestureId:string,lease:DragLease|undefined,now:number):'claim'|'continue'|'preempt'|'blocked'{
 if(!lease||lease.updatedAt<now-3000)return 'claim';
 if(lease.userId===actor.userId&&lease.gestureId===gestureId)return 'continue';
 if(actor.role==='gm'&&lease.role==='player')return 'preempt';
 return 'blocked';
}
