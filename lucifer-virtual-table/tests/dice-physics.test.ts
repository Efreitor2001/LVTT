import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,IcosahedronGeometry,Quaternion,Vector3} from 'three';
import {describeDie} from '../lib/game/geometry';
import {DiceThrow} from '../lib/game/dice-physics';
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('cube contacts use six convex faces instead of coplanar triangles',()=>{
 const geometry=new BoxGeometry(.78,.78,.78),description=describeDie(geometry);assert.equal(description.vertices.length,8);assert.equal(description.faces.length,6);
 for(const face of description.faces)assert.equal(face.indices.length,4);
 geometry.dispose();
});
test('dice fall onto the table and settle without escaping or corrective rotation',()=>{
 for(const [count,geometry] of [[1,new IcosahedronGeometry(.64)],[4,new BoxGeometry(.78,.78,.78)],[24,new BoxGeometry(.78,.78,.78)]] as const){
  const description=describeDie(geometry),shape={vertices:description.vertices,faces:description.faces.map(f=>f.indices)};
  const simulation=new DiceThrow(Array.from({length:count},()=>shape),6,4,random(14));
  for(let i=0;i<48;i++)simulation.step();
  assert.ok(simulation.bodies.every(b=>b.position.y<1.8),'unobstructed fall: a wall must not act as a ceiling');
  while(!simulation.step()){}
  for(const body of simulation.bodies){assert.ok(body.position.y>.3&&body.position.y<1.4);assert.ok(Math.abs(body.position.x)<6&&Math.abs(body.position.z)<4);assert.ok(body.velocity.length()<.2);assert.ok(body.angularVelocity.length()<.25);}
  const last=simulation.frames.at(-1)!,previous=simulation.frames.at(-2)!;
  for(let i=0;i<count;i++){const a=new Quaternion().fromArray(last.quaternions,i*4),b=new Quaternion().fromArray(previous.quaternions,i*4);assert.ok(a.angleTo(b)<.04,'resting orientation must not be turned to a different face');const p=new Vector3().fromArray(last.positions,i*3),q=new Vector3().fromArray(previous.positions,i*3);assert.ok(p.distanceTo(q)<.01);}
  geometry.dispose();
 }
});
