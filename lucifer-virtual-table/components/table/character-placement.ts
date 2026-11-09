import * as T from 'three';

// The token pawn is centered at y=.12 and is .13 units tall.
export const TOKEN_MODEL_FOOT_Y = .185;

/** Normalize a character after its initial animation pose has been evaluated. */
export function fitCharacterToToken(model:T.Object3D,targetHeight:number){
 model.updateMatrixWorld(true);
 // The precise bounds account for skinned meshes instead of stale bind-pose boxes.
 const box=new T.Box3().setFromObject(model,true);
 if(box.isEmpty())return {scale:1,position:new T.Vector3(0,TOKEN_MODEL_FOOT_Y,0)};
 const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const referenceHeight=size.y>1e-5?size.y:Math.max(size.x,size.z,1);
 const scale=targetHeight/referenceHeight;
 return {scale,position:new T.Vector3(-center.x*scale,TOKEN_MODEL_FOOT_Y-box.min.y*scale,-center.z*scale)};
}

/**
 * Some imported animations animate the model root, not just its bones. Keep the
 * visible character over its pawn even when an animation shifts its origin.
 * Call sparingly (not every render frame) because precise skinned bounds cost CPU.
 */
export function keepCharacterOnToken(parent:T.Group,root:T.Group,model:T.Object3D,targetHeight:number){
 parent.updateWorldMatrix(true,true);
 const box=new T.Box3().setFromObject(model,true);
 if(box.isEmpty())return;

 // A few rigs change scale when their first animation starts. Do not allow
 // those transforms to turn a human-sized pawn into a giant character.
 const currentHeight=box.max.y-box.min.y;
 if(currentHeight>targetHeight*1.5){
  root.scale.multiplyScalar(targetHeight/currentHeight);
  parent.updateWorldMatrix(true,true);
  box.setFromObject(model,true);
 }

 const center=box.getCenter(new T.Vector3());
 const centerLocal=parent.worldToLocal(center.clone());
 const footLocal=parent.worldToLocal(new T.Vector3(center.x,box.min.y,center.z));
 const offset=new T.Vector3(-centerLocal.x,TOKEN_MODEL_FOOT_Y-footLocal.y,-centerLocal.z);
 // A dead zone prevents breathing and walking animations from jittering.
 if(Math.hypot(offset.x,offset.z)>.18||Math.abs(offset.y)>.12)root.position.add(offset);
}
