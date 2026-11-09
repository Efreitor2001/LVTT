import type {Scene,Token,WorldState} from './types';
export function activeCombatToken(state:WorldState):string|null{return state.combat.currentTokenId!==undefined?state.combat.currentTokenId:state.combat.order[state.combat.turn]??null;}
export function mapDistance(scene:Scene,a:{x:number;y:number},b:{x:number;y:number},d20=false){
 const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);
 if(scene.grid==='hex'){
  const axial=(p:{x:number;y:number})=>{const q=(Math.sqrt(3)/3*p.x-p.y/3)/scene.gridSize,r=2/3*p.y/scene.gridSize;let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);const ex=Math.abs(x-q),ey=Math.abs(y+q+r),ez=Math.abs(z-r);if(ex>ey&&ex>ez)x=-y-z;else if(ey>ez)y=-x-z;else z=-x-y;return {x,y,z};};
  const p=axial(a),q=axial(b);return Math.max(Math.abs(p.x-q.x),Math.abs(p.y-q.y),Math.abs(p.z-q.z))*scene.distance;
 }
 return (d20&&scene.grid==='square'?Math.max(dx,dy):Math.hypot(dx,dy))/scene.gridSize*scene.distance;
}
export function movementLeft(state:WorldState,token:Token):number{return Math.max(0,(token.speed??9)+(state.combat.dash?.[token.id]??0)-(state.combat.movement?.[token.id]??0));}
export function movementCost(scene:Scene,token:Token,to:{x:number;y:number},path:{x:number;y:number}[]|undefined,d20:boolean){let total=0,previous={x:token.x,y:token.y};for(const point of [...(path??[]),to]){total+=mapDistance(scene,previous,point,d20);previous=point;}return total;}
