import {World,Body,Material,ContactMaterial,Plane,Box,Vec3,ConvexPolyhedron,GSSolver} from 'cannon-es';
export type PhysicalDie={vertices:[number,number,number][];faces:number[][]};
export type DiceFrame={positions:Float32Array;quaternions:Float32Array};
export type Impact={time:number;speed:number};
/** The same fixed-step trajectory is prepared once, then interpolated for display. */
export class DiceThrow{
 readonly world:World;
 readonly bodies:Body[]=[];
 readonly frames:DiceFrame[]=[];
 readonly impacts:Impact[]=[];
 time=0;
 private steps=0;
 private lastImpact=-1;
 readonly dt=1/120;
 constructor(shapes:PhysicalDie[],public halfWidth=6,public halfDepth=3.5,random:()=>number=Math.random){
  const world=this.world=new World({gravity:new Vec3(0,-18,0),allowSleep:true});
  (world.solver as GSSolver).iterations=16;(world.solver as GSSolver).tolerance=.0001;
  const material=new Material('dice'),floorMaterial=new Material('table');
  world.addContactMaterial(new ContactMaterial(material,floorMaterial,{friction:.55,restitution:.24,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
  world.addContactMaterial(new ContactMaterial(material,material,{friction:.38,restitution:.2}));
  const floor=new Body({mass:0,material:floorMaterial,shape:new Plane()});floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
  // Finite box walls avoid rotating plane normals into a ceiling or a second floor.
  for(const [x,z,hx,hz] of [[-halfWidth-.2,0,.2,halfDepth+.4],[halfWidth+.2,0,.2,halfDepth+.4],[0,-halfDepth-.2,halfWidth,.2],[0,halfDepth+.2,halfWidth,.2]]){
   const wall=new Body({mass:0,material:floorMaterial,shape:new Box(new Vec3(hx,2,hz))});wall.position.set(x,2,z);world.addBody(wall);
  }
  const columns=Math.min(4,Math.max(1,Math.floor((halfWidth*2-1.5)/1.4))),rows=Math.max(1,Math.ceil(shapes.length/columns)),depthStep=Math.min(1.4,(halfDepth*2-1.4)/Math.max(1,rows-1));
  shapes.forEach((shape,i)=>{
   const vertices=shape.vertices.map(p=>new Vec3(...p)),body=new Body({mass:1,material,shape:new ConvexPolyhedron({vertices,faces:shape.faces}),linearDamping:.12,angularDamping:.22,sleepSpeedLimit:.14,sleepTimeLimit:.3});
   const col=i%columns,row=Math.floor(i/columns),x=-halfWidth+1+col*1.4,z=shapes.length===1?(random()-.5)*1.2:(row-(rows-1)/2)*depthStep;
   body.position.set(x,1.7+random()*.45+col*.08,z);
   body.velocity.set(3.8+random()*1.6,.3+random()*.8,-z*.3+(random()-.5)*.7);
   const axis=new Vec3(random()-.5,random()-.5,random()-.5);axis.normalize();axis.scale(3.5+random()*3,body.angularVelocity);
   body.quaternion.setFromEuler(random()*Math.PI*2,random()*Math.PI*2,random()*Math.PI*2);
   body.addEventListener('collide',(event:{body:Body;contact:{getImpactVelocityAlongNormal:()=>number}})=>{
    const speed=Math.abs(event.contact.getImpactVelocityAlongNormal());
    if(event.body===floor)body.angularDamping=.55;
    if(speed>1&&this.time-this.lastImpact>.045){this.impacts.push({time:this.time,speed});this.lastImpact=this.time;}
   });
   world.addBody(body);this.bodies.push(body);
  });
  this.capture();
 }
 private capture(){
  const positions=new Float32Array(this.bodies.length*3),quaternions=new Float32Array(this.bodies.length*4);
  this.bodies.forEach((body,i)=>{positions.set([body.position.x,body.position.y,body.position.z],i*3);quaternions.set([body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w],i*4);});
  this.frames.push({positions,quaternions});
 }
 step(){
  if(this.time>2.5)for(const body of this.bodies){body.angularDamping=.8;body.linearDamping=.65;}
  this.time+=this.dt;this.world.step(this.dt);this.steps++;
  if(this.steps%2===0)this.capture();
  const done=this.time>=1.1&&this.bodies.every(body=>body.sleepState===Body.SLEEPING)||this.time>=5;
  if(done&&this.steps%2!==0)this.capture();
  return done;
 }
}
