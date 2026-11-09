import assert from 'node:assert/strict';
const base=process.env.VTT_TEST_URL??'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Integration identities are only allowed against loopback.');
const suffix=crypto.randomUUID(),gm='test-gm-'+suffix,player='test-player-'+suffix,stranger='test-stranger-'+suffix;
const sessions=new Map();
async function register(user){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user+'@example.test',password:'Integration-strong-password-2026',name:user})});assert.equal(r.status,201);sessions.set(user,r.headers.get('set-cookie').split(';')[0]);}
for(const id of [gm,player,stranger])await register(id);
async function call(user,path,method='GET',data){const r=await fetch(base+'/api/'+path,{method,headers:{Cookie:sessions.get(user),'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};}
const gmId=(await call(gm,'profile')).data;const profileResponse=await fetch(base+'/api/profile',{headers:{Cookie:sessions.get(gm)}});assert.equal(profileResponse.status,200);
const created=await call(gm,'worlds','POST',{title:'Isolated integration campaign'});assert.equal(created.status,201);const id=created.data.id;
try{
 assert.equal((await call(player,'worlds/'+id)).status,403);
 const invite=await call(gm,'worlds/'+id+'/invite','POST',{});assert.equal(invite.status,200);
 assert.equal((await call(player,'join','POST',{token:invite.data.token})).status,200);
 assert.equal((await call(player,'join','POST',{token:invite.data.token})).status,200);
 let snapshot=(await call(gm,'worlds/'+id)).data;assert.equal(snapshot.members.length,2);const playerId=snapshot.members.find(m=>m.name===player).userId,gmUserId=snapshot.members.find(m=>m.name===gm).userId;
 async function command(c){const r=await call(gm,'worlds/'+id+'/command','POST',{version:snapshot.version,command:c});assert.equal(r.status,200,JSON.stringify(r));snapshot.version=r.data.version;return r;}
 await command({type:'token.update',id:'aelin',patch:{ownerId:playerId,notes:'TOP_SECRET_CHARACTER_NOTE'}});
 await command({type:'token.update',id:'sentinel',patch:{hidden:true}});
 const playerState=await call(player,'worlds/'+id);assert.equal(playerState.status,200);assert.equal(playerState.data.state.scenes.length,1);assert.equal(playerState.data.state.scenes[0].tokens.length,3);assert.ok(!JSON.stringify(playerState.data).includes('TOP_SECRET_CHARACTER_NOTE'));assert.ok(!JSON.stringify(playerState.data).includes('Секрет ведущего'));
 const moved=await call(player,'worlds/'+id+'/command','POST',{version:snapshot.version,command:{type:'move',id:'aelin',x:300,y:400}});assert.equal(moved.status,200);snapshot.version=moved.data.version;
 assert.equal((await call(player,'worlds/'+id+'/command','POST',{version:snapshot.version,command:{type:'move',id:'thor',x:1,y:1}})).status,403);
 assert.equal((await call(player,'worlds/'+id+'/command','POST',{version:snapshot.version,command:{type:'token.update',id:'aelin',patch:{ownerId:gmUserId,hidden:true}}})).status,400);
 assert.equal((await call(player,'worlds/'+id+'/command','POST',{version:snapshot.version,command:{type:'system',system:{}}})).status,403);
 assert.equal((await call(player,'worlds/'+id+'/invite','POST',{})).status,403);
 const secretId=crypto.randomUUID(),publicId=crypto.randomUUID();
 assert.equal((await call(gm,'worlds/'+id+'/events','POST',{id:secretId,kind:'roll',formula:'2d20kh1',visibility:'gm'})).status,201);
 assert.equal((await call(player,'worlds/'+id+'/events','POST',{id:publicId,kind:'roll',formula:'10d6>=5',visibility:'all'})).status,201);
 const p2=(await call(player,'worlds/'+id)).data,g2=(await call(gm,'worlds/'+id)).data;assert.ok(!p2.events.some(e=>e.id===secretId));assert.ok(g2.events.some(e=>e.id===secretId));assert.deepEqual(p2.events.find(e=>e.id===publicId).data,g2.events.find(e=>e.id===publicId).data);
 assert.equal((await call(stranger,'worlds/'+id)).status,403);assert.equal((await call(stranger,'worlds/'+id+'/events','POST',{id:crypto.randomUUID(),kind:'chat',text:'intrusion'})).status,403);assert.equal((await call(player,'worlds/'+id,'DELETE')).status,403);
 const other=(await call(stranger,'worlds')).data;assert.ok(!other.worlds.some(w=>w.id===id));
 await command({type:'pause'});assert.equal((await call(player,'worlds/'+id+'/command','POST',{version:snapshot.version,command:{type:'move',id:'aelin',x:1,y:1}})).status,403);
 await command({type:'scene.update',patch:{fog:true,visionMode:'manual'}});assert.equal((await call(player,'worlds/'+id)).data.state.scenes[0].tokens.length,1);
 console.log('PASS: 25 multi-user API assertions (membership, ownership, secret filtering, shared rolls, pause, fog, isolation).');
}finally{assert.equal((await call(gm,'worlds/'+id,'DELETE')).status,200);}
