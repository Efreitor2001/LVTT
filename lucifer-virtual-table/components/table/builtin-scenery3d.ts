import * as T from 'three';
import type {Scene} from '../../lib/game/types';
import type {MapElement} from '../../lib/game/map-document';
import {makeObject,xyz,fogMaterial,type FogContext} from './scene3d';
import {texturedMaterial} from './materials3d';
export async function builtinScenery(scene:Scene,fog:FogContext){const group=new T.Group();if(scene.mapData||!['/maps/sunken-temple.svg','/maps/whispering-wood.svg'].includes(scene.map))return group;
 const text=await (await fetch(scene.map)).text(),document=new DOMParser().parseFromString(text,'image/svg+xml');
 const node=(asset:MapElement['asset'],x:number,y:number,size:number):MapElement=>({id:crypto.randomUUID(),kind:'object',asset,x:x-size/2,y:y-size/2,w:size,h:size,rotation:0,shape:'rect',material:'stone',layerId:'props',solid:false,open:false,label:'',color:'#ffffff'});
 for(const use of document.querySelectorAll('use')){const href=use.getAttribute('href');if(href==='#tree'){const transform=use.getAttribute('transform')??'',position=transform.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/),scale=Number(transform.match(/scale\(([-\d.]+)\)/)?.[1]??1);if(position)group.add(makeObject(node('tree',Number(position[1]),Number(position[2]),130*scale),fog));}else if(href==='#column')group.add(makeObject(node('pillar',Number(use.getAttribute('x')),Number(use.getAttribute('y')),65),fog));else if(href==='#torch')group.add(makeObject(node('torch',Number(use.getAttribute('x')),Number(use.getAttribute('y')),50),fog));}
 if(scene.map.includes('sunken-temple')){group.add(makeObject(node('statue',900,375,100),fog));const fountain=new T.Mesh(new T.TorusGeometry(2.8,.16,10,64),fogMaterial(texturedMaterial('#a8aa85','stone',[5,1]),fog));fountain.rotation.x=-Math.PI/2;fountain.position.copy(xyz(900,397,.22));fountain.receiveShadow=true;fountain.castShadow=true;group.add(fountain);const water=new T.Mesh(new T.CircleGeometry(2.6,64),fogMaterial(texturedMaterial('#4c7a78','water',[3,3]),fog));water.rotation.x=-Math.PI/2;water.position.copy(xyz(900,397,.12));group.add(water);}
 return group;
}
