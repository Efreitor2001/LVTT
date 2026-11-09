'use client';
import {useEffect,useRef,useState} from 'react';
import {X,SkipForward,Volume2,VolumeX} from 'lucide-react';
import type {RollResult,CustomDie} from '../../lib/game/types';
import type {BufferGeometry,NormalBufferAttributes,Group} from 'three';

type Props={roll:RollResult;custom:CustomDie[];color:string;reduced:boolean;onClose:()=>void};
export default function DiceStage({roll,custom,color,reduced,onClose}:Props){
 const host=useRef<HTMLDivElement>(null),soundRef=useRef(false);
 const [settled,setSettled]=useState(reduced),[preparing,setPreparing]=useState(!reduced),[error,setError]=useState(false),[sound,setSound]=useState(false);
 useEffect(()=>{soundRef.current=sound;},[sound]);
 useEffect(()=>{
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes UI with a browser/WebGL or room subscription lifecycle.
  setSettled(reduced);setPreparing(!reduced);setError(false);
  if(reduced)return;
  let cancelled=false,frame=0,audio:AudioContext|undefined;
  const disposables:{dispose:()=>void}[]=[],cleanups:(()=>void)[]=[];
  async function init(){
   const [THREE,{d10Geometry,describeDie},{DiceThrow},{RoundedBoxGeometry}]=await Promise.all([
    import('three'),import('../../lib/game/geometry'),import('../../lib/game/dice-physics'),import('three/examples/jsm/geometries/RoundedBoxGeometry.js')
   ]);
   if(cancelled||!host.current)return;
   const target=host.current;
   const specs=roll.groups.flatMap(g=>g.items.filter(i=>!i.rerolled).flatMap(item=>/d100$/i.test(g.notation)?[
    {item:{...item,label:String(Math.floor((item.value%100)/10)*10).padStart(2,'0')},notation:'1d10',percent:'tens'},
    {item:{...item,label:String(item.value%10)},notation:'1d10',percent:'units'}
   ]:[{item,notation:g.notation,percent:''}])).slice(0,24);
   const definitions=specs.map(({item,notation,percent})=>{
    const match=notation.match(/d(\d+|F|\[([^\]]+)\])/i),sides=Number(match?.[1]),customDie=custom.find(d=>d.id===match?.[2]);
    const labels=percent==='tens'?Array.from({length:10},(_,i)=>String(i*10).padStart(2,'0')):percent==='units'?Array.from({length:10},(_,i)=>String(i)):customDie?customDie.faces.map(f=>f.label):/dF/i.test(notation)?['−','0','+','−','0','+']:Array.from({length:Number.isFinite(sides)&&sides<101?sides:6},(_,i)=>String(i+1));
    let geometry:BufferGeometry<NormalBufferAttributes>;
    if(sides===4)geometry=new THREE.TetrahedronGeometry(.64);
    else if(sides===8)geometry=new THREE.OctahedronGeometry(.64);
    else if(sides===10)geometry=d10Geometry();
    else if(sides===12)geometry=new THREE.DodecahedronGeometry(.64);
    else if(sides===20)geometry=new THREE.IcosahedronGeometry(.64);
    else geometry=new THREE.BoxGeometry(.78,.78,.78);
    disposables.push(geometry);
    return {item,labels,sides,geometry,description:describeDie(geometry)};
   });
   const aspect=target.clientWidth/Math.max(1,target.clientHeight),halfWidth=specs.length>8?6:Math.min(6,Math.max(2.8,aspect*4)),halfDepth=specs.length>8?4:3.2;
   const simulation=new DiceThrow(definitions.map(d=>({vertices:d.description.vertices,faces:d.description.faces.map(f=>f.indices)})),halfWidth,halfDepth);
   // Preparing the trajectory lets us label the eventual upper face before the
   // first visible frame. The resting die never needs a corrective rotation.
   let finished=false;
   while(!finished){
    const deadline=performance.now()+6;
    do{finished=simulation.step();}while(!finished&&performance.now()<deadline);
    if(cancelled)return;
    if(!finished)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   }
   if(cancelled)return;
   const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0,0);
   disposables.push(renderer);target.appendChild(renderer.domElement);cleanups.push(()=>renderer.domElement.remove());
   renderer.domElement.dataset.diceCount=String(specs.length);renderer.domElement.dataset.phase='rolling';
   const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,60);camera.position.set(0,15,7.5);camera.lookAt(0,0,0);
   const resize=()=>{
    const width=target.clientWidth,height=Math.max(1,target.clientHeight),ratio=width/height,viewHeight=Math.max(halfDepth*2+2,(halfWidth*2+1.6)/ratio);
    camera.left=-viewHeight*ratio/2;camera.right=viewHeight*ratio/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();renderer.setSize(width,height);
   };
   const observer=new ResizeObserver(resize);observer.observe(target);cleanups.push(()=>observer.disconnect());resize();
   scene.add(new THREE.HemisphereLight(0xf4e4d2,0x344d51,2.4));
   const key=new THREE.DirectionalLight(0xffe3bd,4);key.position.set(-4,10,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-9,right:9,top:7,bottom:-7,near:.1,far:30});key.shadow.normalBias=.025;key.shadow.radius=3;scene.add(key);cleanups.push(()=>key.shadow.dispose());
   const rim=new THREE.PointLight(0x9ab8dc,25,30);rim.position.set(5,5,-5);scene.add(rim);
   const outline=new THREE.Shape(),w=halfWidth+.35,h=halfDepth+.35,r=.45;
   outline.moveTo(-w+r,-h);outline.lineTo(w-r,-h);outline.quadraticCurveTo(w,-h,w,-h+r);outline.lineTo(w,h-r);outline.quadraticCurveTo(w,h,w-r,h);outline.lineTo(-w+r,h);outline.quadraticCurveTo(-w,h,-w,h-r);outline.lineTo(-w,-h+r);outline.quadraticCurveTo(-w,-h,-w+r,-h);
   const tableGeometry=new THREE.ShapeGeometry(outline),tableMaterial=new THREE.MeshStandardMaterial({color:0x1c3031,roughness:.96,metalness:0,transparent:true,opacity:.92});
   disposables.push(tableGeometry,tableMaterial);const table=new THREE.Mesh(tableGeometry,tableMaterial);table.rotation.x=-Math.PI/2;table.position.y=-.015;table.receiveShadow=true;scene.add(table);
   const meshes:Group[]=[],last=simulation.frames[simulation.frames.length-1],q=new THREE.Quaternion();
   definitions.forEach((definition,index)=>{
    const {geometry,description,item,sides}=definition,group=new THREE.Group();meshes.push(group);
    q.fromArray(last.quaternions,index*4);
    let upper=0,max=-Infinity;
    description.faces.forEach((face,i)=>{const height=face.normal.clone().applyQuaternion(q).y;if(height>max){max=height;upper=i;}});
    const labels=Array.from({length:description.faces.length},(_,i)=>definition.labels[i%definition.labels.length]);
    const resultIndex=labels.indexOf(item.label);
    if(resultIndex>=0)[labels[upper],labels[resultIndex]]=[labels[resultIndex],labels[upper]];else labels[upper]=item.label;
    const surface=new THREE.MeshPhysicalMaterial({color,roughness:.32,metalness:.12,clearcoat:.55,clearcoatRoughness:.35,flatShading:description.faces.length!==6});
    if(item.dropped)surface.color.lerp(new THREE.Color('#5c6463'),.55);
    disposables.push(surface);
    const renderGeometry=description.faces.length===6?new RoundedBoxGeometry(.78,.78,.78,3,.045):geometry;
    if(renderGeometry!==geometry)disposables.push(renderGeometry);
    const mesh=new THREE.Mesh(renderGeometry,surface);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    description.faces.forEach((face,i)=>{
     const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
     const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff0cf';ctx.textAlign='center';ctx.textBaseline='middle';
     const label=labels[i];ctx.font=`600 ${label.length>3?29:label.length>2?37:58}px Georgia,serif`;ctx.fillText(label,64,66,112);
     if(label==='6'||label==='9'){ctx.font='18px sans-serif';ctx.fillText('·',64,105);}
     const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
     const labelMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,toneMapped:false});
     const size=sides===20?.32:sides===10?.34:.43,labelGeometry=new THREE.PlaneGeometry(size,size);
     disposables.push(texture,labelMaterial,labelGeometry);
     const labelMesh=new THREE.Mesh(labelGeometry,labelMaterial);labelMesh.position.copy(face.center.clone().addScaledVector(face.normal,.006));labelMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),face.normal);group.add(labelMesh);
    });
    scene.add(group);
   });
   let lastSound=0,impactIndex=0;
   function impact(speed:number){
    if(!soundRef.current||performance.now()-lastSound<40)return;lastSound=performance.now();
    try{
     audio??=new AudioContext();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';
     osc.frequency.setValueAtTime(130+Math.random()*80,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(45,audio.currentTime+.06);
     gain.gain.setValueAtTime(Math.min(.065,speed*.007),audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.085);
     osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.09);
    }catch{/* Sound is optional when an embedded browser blocks audio. */}
   }
   const a=new THREE.Quaternion(),b=new THREE.Quaternion(),started=performance.now();
   setPreparing(false);
   function animate(now:number){
    if(cancelled)return;
    const elapsed=Math.min(simulation.time,(now-started)/1000),cursor=elapsed/simulation.time*(simulation.frames.length-1),left=Math.floor(cursor),right=Math.min(left+1,simulation.frames.length-1),t=cursor-left;
    const first=simulation.frames[left],second=simulation.frames[right];
    meshes.forEach((mesh,i)=>{
     const p=i*3,j=i*4;
     mesh.position.set(THREE.MathUtils.lerp(first.positions[p],second.positions[p],t),THREE.MathUtils.lerp(first.positions[p+1],second.positions[p+1],t),THREE.MathUtils.lerp(first.positions[p+2],second.positions[p+2],t));
     a.fromArray(first.quaternions,j);b.fromArray(second.quaternions,j);mesh.quaternion.slerpQuaternions(a,b,t);
    });
    while(impactIndex<simulation.impacts.length&&simulation.impacts[impactIndex].time<=elapsed)impact(simulation.impacts[impactIndex++].speed);
    renderer.render(scene,camera);
    if(elapsed>=simulation.time){renderer.domElement.dataset.phase='settled';setSettled(true);return;}
    frame=requestAnimationFrame(animate);
   }
   frame=requestAnimationFrame(animate);
  }
  init().catch(()=>{if(!cancelled){setError(true);setPreparing(false);setSettled(true);}});
  return()=>{cancelled=true;cancelAnimationFrame(frame);cleanups.reverse().forEach(cleanup=>cleanup());disposables.reverse().forEach(resource=>resource.dispose());void audio?.close();};
 },[roll,custom,color,reduced]);
 useEffect(()=>{if(!settled)return;const timer=setTimeout(onClose,3500);return()=>clearTimeout(timer);},[settled,onClose]);
 return <div className="dice-overlay" role="dialog" aria-modal="true" aria-label="Бросок костей">
  <div className="dice-stage" ref={host}/>
  <div className="dice-top"><span className="eyebrow">LUCIFER DICE ENGINE</span><div>
   <button aria-label={sound?'Выключить звук':'Включить звук'} onClick={()=>setSound(!sound)}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>
   <button aria-label="Пропустить анимацию" onClick={onClose}><SkipForward size={18}/></button>
   <button aria-label="Закрыть бросок" onClick={onClose}><X size={18}/></button>
  </div></div>
  {preparing&&<div className="dice-preparing" role="status">Подбрасываем кости…</div>}
  <div className={`dice-outcome ${settled?'visible':''}`}><span>{roll.formula}</span><strong>{roll.total}</strong>
   <p>{Object.entries(roll.symbols).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Пусть кости расскажут историю'}</p>
   {roll.groups.reduce((n,g)=>n+g.items.filter(i=>!i.rerolled).length*(/d100$/i.test(g.notation)?2:1),0)>24&&<small>На столе показаны первые 24 кости. Полный бросок — в журнале.</small>}
   {error&&<small>3D недоступно на этом устройстве. Результат сохранён.</small>}
   <button onClick={onClose}>Продолжить игру</button>
  </div>
 </div>;
}
