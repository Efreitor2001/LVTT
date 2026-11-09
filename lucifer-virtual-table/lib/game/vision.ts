import type {Scene,Token} from './types';
import type {Wall} from './combat-types';
type Point={x:number;y:number};
export function visionSources(scene:Scene,userId?:string):Token[]{return scene.tokens.filter(t=>!t.hidden&&(t.faction??(t.portrait==='enemy'?'hostile':'party'))==='party'&&((scene.visionMode??'shared')==='shared'||t.ownerId===userId));}
export function rayWall(from:Point,direction:Point,wall:Wall):number|null{
 if(wall.open)return null;const sx=wall.x2-wall.x1,sy=wall.y2-wall.y1,den=direction.x*sy-direction.y*sx;if(Math.abs(den)<1e-9)return null;
 const dx=wall.x1-from.x,dy=wall.y1-from.y,t=(dx*sy-dy*sx)/den,u=(dx*direction.y-dy*direction.x)/den;return t>1e-6&&u>=0&&u<=1?t:null;
}
export function segmentClear(scene:Scene,from:Point,to:Point,mode:'vision'|'movement'):boolean{const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(length<.01)return true;return !(scene.walls??[]).some(w=>{if(mode==='vision'&&w.blocksVision===false||mode==='movement'&&w.blocksMovement===false)return false;const hit=rayWall(from,{x:dx/length,y:dy/length},w);return hit!==null&&hit<length-.01;});}
export function lineOfSight(scene:Scene,from:Point,to:Point):boolean{return segmentClear(scene,from,to,'vision');}
export function visionRadius(scene:Scene,token:Token){return (token.vision??9)/scene.distance*scene.gridSize;}
export function inTokenVision(scene:Scene,point:Point,userId?:string):boolean{return visionSources(scene,userId).some(t=>Math.hypot(t.x-point.x,t.y-point.y)<=visionRadius(scene,t)&&lineOfSight(scene,t,point));}
export function visionPolygon(scene:Scene,token:Token):Point[]{
 const radius=visionRadius(scene,token),angles=Array.from({length:96},(_,i)=>i*Math.PI*2/96);
 for(const wall of scene.walls??[])if(!wall.open&&wall.blocksVision!==false)for(const p of [{x:wall.x1,y:wall.y1},{x:wall.x2,y:wall.y2}]){const a=Math.atan2(p.y-token.y,p.x-token.x);angles.push(a-.00001,a,a+.00001);}
 return angles.sort((a,b)=>a-b).map(angle=>{const direction={x:Math.cos(angle),y:Math.sin(angle)};let distance=radius;for(const wall of scene.walls??[]){if(wall.blocksVision===false)continue;const t=rayWall(token,direction,wall);if(t!==null)distance=Math.min(distance,t);}return {x:token.x+direction.x*distance,y:token.y+direction.y*distance};});
}
