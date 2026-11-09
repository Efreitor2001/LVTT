import { BufferGeometry,Float32BufferAttribute,Vector3 } from 'three';
/** A pentagonal trapezohedron: ten planar kite faces, the familiar d10. */
export function d10Geometry():BufferGeometry {
 const height=.72,radius=.58,offset=height*(1-Math.cos(Math.PI/5))/(1+Math.cos(Math.PI/5));
 const ring=Array.from({length:10},(_,i)=>new Vector3(Math.cos(i*Math.PI/5)*radius,i%2===0?offset:-offset,Math.sin(i*Math.PI/5)*radius));
 const poles=[new Vector3(0,height,0),new Vector3(0,-height,0)],positions:number[]=[];
 for(let side=0;side<2;side++)for(let i=0;i<5;i++){
  const j=2*i+side,points=[poles[side],ring[j%10],ring[(j+1)%10],ring[(j+2)%10]];
  for(const indices of [[0,1,2],[0,2,3]]){
   const [a,b,c]=indices.map(k=>points[k]),normal=b.clone().sub(a).cross(c.clone().sub(a));
   if(normal.dot(a.clone().add(b).add(c))<0)positions.push(...a.toArray(),...c.toArray(),...b.toArray());else positions.push(...a.toArray(),...b.toArray(),...c.toArray());
  }
 }
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

/** Merge coplanar render triangles into convex polygon faces for stable contacts. */
export function describeDie(geometry:BufferGeometry){
 const positions=geometry.getAttribute('position');
 const vertices:Vector3[]=[],lookup=new Map<string,number>(),triangles:number[][]=[];
 const ids:number[]=[];
 for(let i=0;i<positions.count;i++){
  const v=new Vector3(positions.getX(i),positions.getY(i),positions.getZ(i));
  const key=v.toArray().map(n=>n.toFixed(5)).join(',');
  let id=lookup.get(key);if(id===undefined){id=vertices.length;vertices.push(v);lookup.set(key,id);}ids.push(id);
 }
 if(geometry.index)for(let i=0;i<geometry.index.count;i+=3)triangles.push([ids[geometry.index.getX(i)],ids[geometry.index.getX(i+1)],ids[geometry.index.getX(i+2)]]);
 else for(let i=0;i<ids.length;i+=3)triangles.push(ids.slice(i,i+3));
 const polygons=new Map<string,{normal:Vector3;indices:Set<number>}>();
 for(const [a,b,c] of triangles){
  const normal=vertices[b].clone().sub(vertices[a]).cross(vertices[c].clone().sub(vertices[a])).normalize();
  const key=[...normal.toArray(),normal.dot(vertices[a])].map(n=>Math.round(n*10000)).join(',');
  let face=polygons.get(key);if(!face){face={normal,indices:new Set()};polygons.set(key,face);}face.indices.add(a);face.indices.add(b);face.indices.add(c);
 }
 const faces=[...polygons.values()].map(({normal,indices})=>{
  const points=[...indices],center=points.reduce((p,i)=>p.add(vertices[i]),new Vector3()).divideScalar(points.length);
  const u=vertices[points[0]].clone().sub(center).normalize(),v=normal.clone().cross(u);
  const angle=(i:number)=>{const p=vertices[i].clone().sub(center);return Math.atan2(p.dot(v),p.dot(u));};
  points.sort((a,b)=>angle(a)-angle(b));
  return {normal,center,indices:points};
 });
 return {vertices:vertices.map(v=>v.toArray() as [number,number,number]),faces};
}
