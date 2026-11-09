import {test,expect,type Page} from '@playwright/test';
import pg from 'pg';
import {existsSync} from 'node:fs';
type Point={x:number;y:number};
async function screenPoint(page:Page,x:number,y:number):Promise<Point>{return page.locator('.map-svg').evaluate((svg,p)=>{const point=new DOMPoint(p.x,p.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);return {x:point.x,y:point.y};},{x,y});}
async function tokenPoint(page:Page,id:string):Promise<Point>{return page.locator(`[data-token="${id}"]`).evaluate(element=>{const point=new DOMPoint(0,0).matrixTransform((element as SVGGraphicsElement).getScreenCTM()!);return {x:point.x,y:point.y};});}
test('saved rooms stream live drags; GM takes control and late player packets cannot undo it',async({browser})=>{
 test.setTimeout(60000);
 const gm=await browser.newContext(),player=await browser.newContext(),outsider=await browser.newContext(),suffix=crypto.randomUUID();
 const emails=['live-gm-','live-player-','live-outsider-'].map(prefix=>prefix+suffix+'@example.test');
 let id='';
 try{
  for(const [i,context] of [gm,player,outsider].entries()){const response=await context.request.post('/api/auth/register',{data:{email:emails[i],name:i===0?'Ведущий RT':i===1?'Игрок RT':'Другой игрок',password:'Realtime-test-password-2026'}});expect(response.status()).toBe(201);}
  const created=await gm.request.post('/api/worlds',{data:{title:'Общая комната реального времени с длинным названием для проверки компактного интерфейса'}});expect(created.status()).toBe(201);id=(await created.json()).id;
  const invitation=await gm.request.post(`/api/worlds/${id}/invite`,{data:{}});expect((await player.request.post('/api/join',{data:{token:(await invitation.json()).token}})).status()).toBe(200);
  let snapshot=await (await gm.request.get(`/api/worlds/${id}`)).json();
  const playerId=snapshot.members.find((m:{role:string})=>m.role==='player').userId;
  expect((await gm.request.post(`/api/worlds/${id}/command`,{data:{version:snapshot.version,command:{type:'token.update',id:'aelin',patch:{ownerId:playerId}}}})).status()).toBe(200);
  const g=await gm.newPage(),p=await player.newPage();
  await Promise.all([g.goto('/?world='+id),p.goto('/?world='+id)]);
  await expect(g.locator('.app-shell')).toHaveAttribute('data-room-online','true',{timeout:15000});
  await expect(p.locator('.app-shell')).toHaveAttribute('data-room-online','true',{timeout:15000});
  expect((await g.locator('.campaign-art').boundingBox())!.height).toBeLessThan(100);
  await expect(g.locator('.campaign-art h1')).toHaveAttribute('title',/длинным названием/);
  expect((await outsider.request.get(`/api/worlds/${id}/stream`)).status()).toBe(403);
  const start=await tokenPoint(p,'aelin'),target=await screenPoint(p,930,690),otherTarget=await screenPoint(g,930,690);
  await p.mouse.move(start.x,start.y);await p.mouse.down();await p.mouse.move(target.x,target.y,{steps:8});
  await expect.poll(async()=>{const point=await tokenPoint(g,'aelin');return Math.hypot(point.x-otherTarget.x,point.y-otherTarget.y);},{timeout:3000}).toBeLessThan(3);
  // The other browser has the preview before the original mouse button is released.
  snapshot=await (await gm.request.get(`/api/worlds/${id}`)).json();expect(snapshot.state.scenes[0].tokens[0].x).toBe(570);
  await p.mouse.up();
  await expect.poll(async()=>{const data=await (await gm.request.get(`/api/worlds/${id}`)).json();return data.state.scenes[0].tokens[0].x;}).toBe(930);
  await expect(g.locator('[data-token="aelin"]')).toHaveAttribute('data-live-moving','false');
  const posted:{gestureId:string;phase:string}[]=[];p.on('request',request=>{if(request.url().endsWith('/live')&&request.method()==='POST')posted.push(request.postDataJSON());});
  const from=await tokenPoint(p,'aelin'),playerDestination=await screenPoint(p,690,510);
  await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(playerDestination.x,playerDestination.y,{steps:5});
  const playerAtGm=await screenPoint(g,690,510);
  await expect.poll(async()=>{const point=await tokenPoint(g,'aelin');return Math.hypot(point.x-playerAtGm.x,point.y-playerAtGm.y);}).toBeLessThan(3);
  const contested=await tokenPoint(g,'aelin');await g.mouse.move(contested.x,contested.y);await g.mouse.down();
  await expect(p.getByRole('status')).toContainText('Ведущий взял управление');
  const gmDestination=await screenPoint(g,810,450);await g.mouse.move(gmDestination.x,gmDestination.y,{steps:5});
  const playerAttempt=await screenPoint(p,510,450);await p.mouse.move(playerAttempt.x,playerAttempt.y,{steps:5});
  await g.mouse.up();await p.mouse.up();
  await expect.poll(async()=>{const data=await (await gm.request.get(`/api/worlds/${id}`)).json();const token=data.state.scenes[0].tokens[0];return [token.x,token.y];}).toEqual([810,450]);
  const cancelled=posted.find(r=>r.phase==='move')!.gestureId;
  const late=await player.request.post(`/api/worlds/${id}/command`,{data:{version:1,command:{type:'move',id:'aelin',sceneId:'ruins',gestureId:cancelled,x:510,y:450}}});expect(late.status()).toBe(409);
  const latePreview=await player.request.post(`/api/worlds/${id}/live`,{data:{id:'aelin',sceneId:'ruins',gestureId:cancelled,seq:999,x:510,y:450,phase:'move'}});expect(latePreview.status()).toBe(409);
  const wrong=await player.request.post(`/api/worlds/${id}/live`,{data:{id:'thor',sceneId:'ruins',gestureId:crypto.randomUUID(),seq:0,x:600,y:450,phase:'move'}});expect(wrong.status()).toBe(403);
  const expected=await screenPoint(p,810,450);await expect.poll(async()=>{const point=await tokenPoint(p,'aelin');return Math.hypot(point.x-expected.x,point.y-expected.y);}).toBeLessThan(3);
  // Different token commits merge even if both started from the same world version.
  snapshot=await (await gm.request.get(`/api/worlds/${id}`)).json();
  const moves=await Promise.all([gm.request.post(`/api/worlds/${id}/command`,{data:{version:snapshot.version,command:{type:'move',id:'thor',x:990,y:810}}}),player.request.post(`/api/worlds/${id}/command`,{data:{version:snapshot.version,command:{type:'move',id:'aelin',gestureId:crypto.randomUUID(),x:750,y:630}}})]);
  expect(moves.map(r=>r.status())).toEqual([200,200]);
  snapshot=await (await gm.request.get(`/api/worlds/${id}`)).json();expect(snapshot.state.scenes[0].tokens.find((t:{id:string})=>t.id==='thor').x).toBe(990);expect(snapshot.state.scenes[0].tokens[0].x).toBe(750);
  await g.screenshot({path:'outputs/shared-room-desktop.png',fullPage:true});
 }finally{
  if(id)await gm.request.delete(`/api/worlds/${id}`);
  await Promise.all([gm.close(),player.close(),outsider.close()]);
  if(existsSync('.env.local')){process.loadEnvFile('.env.local');const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();await db.query('DELETE FROM accounts WHERE email=ANY($1::text[])',[emails]);await db.end();}
 }
});
test('demo explicitly warns that browsers have separate tables',async({page})=>{
 await page.goto('/');await expect(page.locator('.demo-room')).toContainText('у каждого браузера свой стол');await expect(page.getByRole('button',{name:'Создать общую кампанию'})).toBeVisible();
 expect((await page.locator('.campaign-art').boundingBox())!.height).toBeLessThan(100);
});
