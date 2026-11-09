import {z} from 'zod';
import type {Wall} from './combat-types';
export const MATERIALS=['stone','wood','marble','earth','grass','water','sand','lava','dark'] as const;
export const MAP_OBJECTS=['tree','bush','rock','torch','table','chair','chest','bed','barrel','crate','altar','stairs','pillar','statue','bookshelf','rug','campfire','bones'] as const;
const coord=z.number().finite().min(-3600).max(5400),id=z.string().min(1).max(100);
export const mapElementSchema=z.object({id,layerId:id,kind:z.enum(['room','corridor','terrain','wall','door','window','object','text']),x:coord,y:coord,w:z.number().finite().min(1).max(3600),h:z.number().finite().min(1).max(2400),rotation:z.number().finite().min(-3600).max(3600),material:z.enum(MATERIALS),asset:z.enum(MAP_OBJECTS).optional(),label:z.string().max(200),color:z.string().regex(/^#[\da-f]{6}$/i),solid:z.boolean(),open:z.boolean(),shape:z.enum(['rect','ellipse','polygon']),points:z.array(z.object({x:coord,y:coord})).max(200).optional()});
export const mapDocumentSchema=z.object({version:z.literal(1),background:z.string().regex(/^#[\da-f]{6}$/i),useSceneImage:z.boolean(),gridSize:z.number().int().min(20).max(150),layers:z.array(z.object({id,name:z.string().min(1).max(50),visible:z.boolean(),locked:z.boolean()})).min(1).max(30),elements:z.array(mapElementSchema).max(1500)}).superRefine((doc,ctx)=>{
 if(new Set(doc.layers.map(l=>l.id)).size!==doc.layers.length||new Set(doc.elements.map(n=>n.id)).size!==doc.elements.length)ctx.addIssue({code:'custom',message:'Повторяющиеся идентификаторы карты'});
 if(doc.elements.some(n=>!doc.layers.some(l=>l.id===n.layerId)))ctx.addIssue({code:'custom',message:'Слой объекта не найден'});
});
export type MapDocument=z.infer<typeof mapDocumentSchema>;
export type MapElement=z.infer<typeof mapElementSchema>;
export type MapPoint={x:number;y:number};
export function blankMap(gridSize=60):MapDocument{return {version:1,background:'#242c28',useSceneImage:false,gridSize,layers:[{id:'ground',name:'Ландшафт',visible:true,locked:false},{id:'rooms',name:'Комнаты и стены',visible:true,locked:false},{id:'props',name:'Объекты',visible:true,locked:false},{id:'labels',name:'Подписи',visible:true,locked:false}],elements:[]};}
export function rotatePoint(p:MapPoint,center:MapPoint,degrees:number):MapPoint{const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=p.x-center.x,dy=p.y-center.y;return {x:center.x+dx*c-dy*s,y:center.y+dx*s+dy*c};}
export function elementVertices(n:MapElement):MapPoint[]{const center={x:n.x+n.w/2,y:n.y+n.h/2};let points:MapPoint[];
 if(n.shape==='polygon'&&n.points?.length)points=n.points.map(p=>({x:p.x+n.x,y:p.y+n.y}));
 else if(n.shape==='ellipse')points=Array.from({length:32},(_,i)=>({x:center.x+Math.cos(i*Math.PI/16)*n.w/2,y:center.y+Math.sin(i*Math.PI/16)*n.h/2}));
 else points=[{x:n.x,y:n.y},{x:n.x+n.w,y:n.y},{x:n.x+n.w,y:n.y+n.h},{x:n.x,y:n.y+n.h}];return points.map(p=>rotatePoint(p,center,n.rotation));
}
export function elementSegment(n:MapElement):[MapPoint,MapPoint]{const center={x:n.x+n.w/2,y:n.y+n.h/2};return [{x:n.x,y:center.y},{x:n.x+n.w,y:center.y}].map(p=>rotatePoint(p,center,n.rotation)) as [MapPoint,MapPoint];}
export function compileMapWalls(doc:MapDocument):Wall[]{
 const elements=doc.elements.filter(n=>doc.layers.some(l=>l.id===n.layerId&&l.visible));
 const base:Wall[]=[],openings=elements.filter(n=>n.kind==='door'||n.kind==='window');
 const add=(id:string,a:MapPoint,b:MapPoint)=>{const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v));base.push({id,x1:clamp(a.x,1800),y1:clamp(a.y,1200),x2:clamp(b.x,1800),y2:clamp(b.y,1200),open:false,source:'map'});};
 for(const n of elements){if(n.kind==='wall')add(n.id,...elementSegment(n));else if((n.kind==='room'||n.kind==='corridor')&&n.solid){const p=elementVertices(n);p.forEach((a,i)=>add(n.id+'-'+i,a,p[(i+1)%p.length]));}}
 const result:Wall[]=[];
 for(const wall of base){const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,length=Math.hypot(dx,dy);if(length<1)continue;let intervals:[number,number][]=[[0,length]];
  for(const n of openings){const [a,b]=elementSegment(n),project=(p:MapPoint)=>(p.x-wall.x1)*dx/length+(p.y-wall.y1)*dy/length,dist=(p:MapPoint)=>Math.abs((p.x-wall.x1)*dy-(p.y-wall.y1)*dx)/length;
   if(dist(a)>14||dist(b)>14)continue;const lo=Math.min(project(a),project(b)),hi=Math.max(project(a),project(b));if(hi<0||lo>length)continue;
   intervals=intervals.flatMap(([s,e])=>hi<=s||lo>=e?[[s,e] as [number,number]]:[[s,Math.max(s,lo)],[Math.min(e,hi),e]].filter(([x,y])=>y-x>1) as [number,number][]);
  }
  intervals.forEach(([s,e],i)=>result.push({...wall,id:wall.id+'~'+i,x1:wall.x1+dx/length*s,y1:wall.y1+dy/length*s,x2:wall.x1+dx/length*e,y2:wall.y1+dy/length*e}));
 }
 for(const n of openings){const [a,b]=elementSegment(n);result.push({id:n.id,x1:Math.max(0,Math.min(1800,a.x)),y1:Math.max(0,Math.min(1200,a.y)),x2:Math.max(0,Math.min(1800,b.x)),y2:Math.max(0,Math.min(1200,b.y)),open:n.open,kind:n.kind as 'door'|'window',blocksVision:n.kind!=='window',blocksMovement:true,source:'map'});}
 const unique=new Map<string,Wall>();for(const w of result){const a=[w.x1,w.y1].map(Math.round).join(','),b=[w.x2,w.y2].map(Math.round).join(','),key=[a,b].sort().join('|')+'|'+(w.kind??'wall');if(w.x1!==w.x2||w.y1!==w.y2)unique.set(key,w);}return [...unique.values()];
}
