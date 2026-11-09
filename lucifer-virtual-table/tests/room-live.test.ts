import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dragPriority} from '../lib/game/drag-priority';
import {publicRoomEvent} from '../lib/game/live';
import type {RoomSignal} from '../lib/game/live';
test('GM preempts a player; the player cannot preempt the GM',()=>{
 const now=10000,player={userId:'p',role:'player' as const},gm={userId:'g',role:'gm' as const};
 assert.equal(dragPriority(gm,'gm-drag',{userId:'p',gestureId:'player-drag',role:'player',updatedAt:now},now),'preempt');
 assert.equal(dragPriority(player,'player-drag',{userId:'g',gestureId:'gm-drag',role:'gm',updatedAt:now},now),'blocked');
 assert.equal(dragPriority(player,'mine',{userId:'p',gestureId:'mine',role:'player',updatedAt:now},now),'continue');
 assert.equal(dragPriority(player,'new',{userId:'g',gestureId:'old',role:'gm',updatedAt:now-4000},now),'claim');
});
test('room previews never disclose hidden or fogged token coordinates',()=>{
 const event:RoomSignal={worldId:'world',type:'preview',hidden:false,revealed:false,ownerId:'owner',token:{id:'t',sceneId:'s',gestureId:'g',seq:1,userId:'gm',x:100,y:200,visible:true,expiresAt:99999}};
 const stranger=publicRoomEvent(event,{userId:'other',role:'player'});assert.ok(stranger?.type==='preview');if(stranger?.type==='preview'){assert.equal(stranger.token.visible,false);assert.equal(stranger.token.x,undefined);assert.equal(stranger.token.y,undefined);}
 const owner=publicRoomEvent(event,{userId:'owner',role:'player'});assert.ok(owner?.type==='preview'&&owner.token.x===100);
 assert.equal(publicRoomEvent({...event,hidden:true},{userId:'owner',role:'player'}),null);
 const gm=publicRoomEvent({...event,hidden:true},{userId:'gm',role:'gm'});assert.ok(gm?.type==='preview'&&gm.token.x===100);
});
test('drag revocation is delivered only to the displaced user',()=>{
 const event:RoomSignal={worldId:'w',type:'drag-revoked',id:'t',gestureId:'g',userId:'p'};
 assert.equal(publicRoomEvent(event,{userId:'other',role:'player'}),null);
 assert.deepEqual(publicRoomEvent(event,{userId:'p',role:'player'}),{type:'drag-revoked',id:'t',gestureId:'g',userId:'p'});
});
