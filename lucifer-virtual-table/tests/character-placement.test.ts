import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fitCharacterToToken,keepCharacterOnToken,TOKEN_MODEL_FOOT_Y} from '../components/table/character-placement';

const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-5,`expected ${actual} near ${expected}`);

test('fits an off-center character to the pawn, preserving its intended height',()=>{
 const rig=new T.Group();
 const mesh=new T.Mesh(new T.BoxGeometry(2,4,2));
 mesh.position.set(3,5,-2);
 rig.add(mesh);
 const placement=fitCharacterToToken(rig,1.65);
 const root=new T.Group();
 root.scale.setScalar(placement.scale);
 root.position.copy(placement.position);
 root.add(rig);
 const box=new T.Box3().setFromObject(root,true),center=box.getCenter(new T.Vector3());
 near(box.max.y-box.min.y,1.65);
 near(box.min.y,TOKEN_MODEL_FOOT_Y);
 near(center.x,0);
 near(center.z,0);
});

test('uses the posed dimensions instead of an imported model original scale',()=>{
 const rig=new T.Group();
 const mesh=new T.Mesh(new T.BoxGeometry(1,1,1));
 mesh.position.y=.5;
 rig.add(mesh);
 rig.scale.setScalar(8); // An imported clip can set this on its first frame.
 const {scale,position}=fitCharacterToToken(rig,1.65);
 near(scale,1.65/8);
 const root=new T.Group();
 root.position.copy(position);
 root.scale.setScalar(scale);
 root.add(rig);
 const bounds=new T.Box3().setFromObject(root,true);
 near(bounds.min.y,TOKEN_MODEL_FOOT_Y);
 near(bounds.max.y-bounds.min.y,1.65);
});

test('restores a model shifted off its pawn by root-motion animation',()=>{
 const world=new T.Group(),parent=new T.Group(),root=new T.Group(),rig=new T.Group();
 const body=new T.Mesh(new T.BoxGeometry(1,2,1));
 body.position.y=1;
 rig.add(body);root.add(rig);parent.add(root);world.add(parent);
 const placement=fitCharacterToToken(rig,1.65);
 root.position.copy(placement.position);
 root.scale.setScalar(placement.scale);
 rig.position.set(2,2,-1);
 keepCharacterOnToken(parent,root,rig,1.65);
 const box=new T.Box3().setFromObject(rig,true),center=box.getCenter(new T.Vector3());
 near(box.min.y,TOKEN_MODEL_FOOT_Y);
 near(center.x,0);
 near(center.z,0);
});

test('shrinks an oversized animated character back to the intended height',()=>{
 const world=new T.Group(),parent=new T.Group(),root=new T.Group(),rig=new T.Group();
 const body=new T.Mesh(new T.BoxGeometry(1,2,1));body.position.y=1;rig.add(body);
 root.add(rig);parent.add(root);world.add(parent);
 const placement=fitCharacterToToken(rig,1.65);
 root.position.copy(placement.position);
 root.scale.setScalar(placement.scale);
 rig.scale.setScalar(10);
 keepCharacterOnToken(parent,root,rig,1.65);
 const bounds=new T.Box3().setFromObject(rig,true);
 near(bounds.max.y-bounds.min.y,1.65);
 near(bounds.min.y,TOKEN_MODEL_FOOT_Y);
});
