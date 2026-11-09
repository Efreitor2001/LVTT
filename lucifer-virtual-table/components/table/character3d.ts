import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {MODELS,modelForToken} from '../../lib/game/models';
import type {Token} from '../../lib/game/types';
import {fogMaterial,type FogContext} from './scene3d';
const cache=new Map<string,Promise<GLTF>>();
function load(id:string){if(!cache.has(id))cache.set(id,new GLTFLoader().loadAsync('/models/'+id+'.glb').catch(e=>{cache.delete(id);throw e;}));return cache.get(id)!;}
export async function attachCharacter(parent:T.Group,token:Token,fog:FogContext){const id=modelForToken(token);if(!id)return null;const gltf=await load(id);if(parent.userData.disposed)return null;const rig=clone(gltf.scene),root=new T.Group(),box=new T.Box3().setFromObject(rig),dimensions=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),height=MODELS.find(m=>m.id===id)!.height,scale=height/Math.max(.01,dimensions.y);root.scale.setScalar(scale);root.position.set(-center.x*scale,.16-box.min.y*scale,-center.z*scale);root.add(rig);
 root.traverse(n=>{n.userData.tokenId=token.id;if(n instanceof T.Mesh){n.castShadow=true;n.receiveShadow=true;n.geometry=n.geometry.clone();const original=Array.isArray(n.material)?n.material:[n.material];const materials=original.map(m=>{const copy=m.clone();if(copy instanceof T.MeshStandardMaterial){copy.roughness=Math.max(.65,copy.roughness);fogMaterial(copy,fog);}return copy;});n.material=Array.isArray(n.material)?materials:materials[0];}});parent.add(root);parent.userData.modelId=id;
 const portrait=parent.children.find(n=>n.userData.portrait);if(portrait){parent.remove(portrait);if(portrait instanceof T.Mesh){portrait.geometry.dispose();(portrait.material as T.MeshStandardMaterial).map?.dispose();(portrait.material as T.Material).dispose();}}
 const label=parent.children.find(n=>n instanceof T.Sprite);if(label)label.position.y=height+.5;
 const mixer=new T.AnimationMixer(rig),clips=gltf.animations;let current:T.AnimationAction|null=null,activity='',until=0;
 function play(kind:string,once=false){if(activity===kind&&current)return;const search:Record<string,RegExp>={idle:/^idle$|idle|standing/i,walk:/walking|walk|running|run/i,attack:/1h.*melee.*attack|attack|cast|shoot|spell/i,dead:/death|dead|die/i};const clip=clips.find(c=>search[kind].test(c.name))??clips[0];if(!clip)return;const next=mixer.clipAction(clip);if(next===current)return;next.reset();next.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.fadeIn(.18).play();current?.fadeOut(.18);current=next;activity=kind;}
 play('idle');return {id,update(delta:number,moving:boolean,dead:boolean){if(dead){play('dead',true);}else if(Date.now()<until)play('attack',true);else play(moving?'walk':'idle');mixer.update(Math.min(.05,delta));},attack(){until=Date.now()+950;activity='';},dispose(){mixer.stopAllAction();mixer.uncacheRoot(rig);}};
}
