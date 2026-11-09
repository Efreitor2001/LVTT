import {mapDocumentSchema,compileMapWalls} from './map-document';
import type { WorldState, Command, Member, Token } from './types';
import { stateSchema, tokenSchema, sceneSchema, journalSchema, macroSchema, systemSchema } from './validation';
import {GameError} from './errors';
export {GameError} from './errors';
import {activeCombatToken,movementCost,movementLeft} from './movement';
import {inTokenVision,segmentClear} from './vision';
import {executeBattle,nextTurn,performBasicAction} from './battle';
import {rollDice} from './dice';
export function applyCommand(original:WorldState,command:Command,member:Member):WorldState {
 const state=structuredClone(original), gm=member.role==='gm';
 const scene=state.scenes.find(s=>s.id===state.activeScene)!;
 const token=scene.tokens.find(t=>t.id===command.id);
 const mustGM=()=>{if(!gm)throw new GameError('Доступно только ведущему',403);};
 const ownToken=()=>{if(!token)throw new GameError('Токен не найден',404);if(!gm&&token.ownerId!==member.userId)throw new GameError('Это чужой персонаж',403);};
 switch(command.type){
 case 'move': {
  ownToken();if(state.paused&&!gm)throw new GameError('Ведущий приостановил игру',403);
  const to=tokenSchema.pick({x:true,y:true}).parse(command),path=tokenSchema.pick({x:true,y:true}).array().max(200).parse(command.path??[]);
  if(!gm){
   if(token!.conditions.some(c=>/paralyzed|stunned|unconscious|restrained|grappled|парализован|без сознания|опутан|схвачен|ошеломлён/i.test(c)))throw new GameError('Состояние персонажа запрещает перемещение',403);
   let from={x:token!.x,y:token!.y};for(const point of [...path,to]){if(!segmentClear(scene,from,point,'movement'))throw new GameError('Путь перекрыт стеной',403);from=point;}
   if(state.combat.active){
    if(activeCombatToken(state)!==token!.id)throw new GameError('Сейчас ход другого участника',403);
    const cost=movementCost(scene,token!,to,path,state.system.id==='d20'),left=movementLeft(state,token!);
    if(cost>left+.001)throw new GameError(`Недостаточно движения. Осталось ${left.toFixed(1)} ${scene.unit}`,403);
    state.combat.movement={...state.combat.movement,[token!.id]:(state.combat.movement?.[token!.id]??0)+cost};
   }
  }
  Object.assign(token!,to);break;
 }
 case 'token.update': {ownToken();if(!gm&&state.combat.active)throw new GameError('Во время боя лист меняет ведущий; используйте боевые действия',403);const patch=gm?tokenSchema.omit({id:true,x:true,y:true}).partial().parse(command.patch):tokenSchema.pick({hp:true,conditions:true,attributes:true}).partial().strict().parse(command.patch);Object.assign(token!,patch);break;}
 case 'token.add':mustGM();scene.tokens.push(tokenSchema.parse(command.token));break;
 case 'token.delete':mustGM();scene.tokens=scene.tokens.filter(t=>t.id!==command.id);state.combat.order=state.combat.order.filter(id=>id!==command.id);state.combat.turn=Math.min(state.combat.turn,Math.max(0,state.combat.order.length-1));break;
 case 'scene.activate':mustGM();if(!state.scenes.some(s=>s.id===command.id))throw new GameError('Сцена не найдена');state.activeScene=String(command.id);state.combat={active:false,round:1,turn:0,order:[]};break;
 case 'scene.add':mustGM();state.scenes.push(sceneSchema.parse(command.scene));break;
 case 'scene.update':mustGM();Object.assign(scene,sceneSchema.omit({id:true,tokens:true,drawings:true}).partial().parse(command.patch));break;
 case 'scene.delete':mustGM();if(state.scenes.length===1)throw new GameError('Нужна хотя бы одна сцена');state.scenes=state.scenes.filter(s=>s.id!==command.id);if(state.activeScene===command.id)state.activeScene=state.scenes[0].id;state.combat={active:false,round:1,turn:0,order:[]};break;
 case 'drawing.add':mustGM();scene.drawings.push(sceneSchema.shape.drawings.element.parse(command.drawing));break;
 case 'drawing.undo':mustGM();scene.drawings.pop();break;
 case 'drawing.clear':mustGM();scene.drawings=[];break;
 case 'map.save':mustGM();{const map=mapDocumentSchema.parse(command.map);scene.mapData=map;if(command.mapImage!==undefined)scene.map=sceneSchema.shape.map.parse(command.mapImage);scene.gridSize=map.gridSize;scene.walls=compileMapWalls(map);}break;
 case 'wall.add':mustGM();scene.walls=[...(scene.walls??[]),sceneSchema.shape.walls.unwrap().element.parse(command.wall)];break;
 case 'wall.toggle':mustGM();{const wall=scene.walls?.find(w=>w.id===command.id);if(wall){wall.open=!wall.open;const node=scene.mapData?.elements.find(n=>n.id===wall.id);if(node)node.open=wall.open;}}break;
 case 'wall.clear':mustGM();scene.walls=[];break;
 case 'combat.start':mustGM();if(command.rollInitiative)scene.tokens.forEach(t=>{t.initiative=rollDice('1d20+'+(t.attributes['Ловкость']??0)).total;});state.combat={active:true,round:1,turn:0,order:[...scene.tokens].sort((a,b)=>b.initiative-a.initiative).map(t=>t.id),movement:{},actions:{},bonus:{},reactions:{},dash:{},attacksRemaining:{},effects:[]};if(!scene.tokens.length)throw new GameError('Добавьте участников боя');break;
 case 'combat.next':mustGM();if(!state.combat.active||!state.combat.order.length)throw new GameError('Бой не начат');nextTurn(state);break;
 case 'combat.act':executeBattle(state,member,command);break;
 case 'combat.dash':case 'combat.dodge':case 'combat.end-turn':performBasicAction(state,member,command);break;
 case 'combat.stop':mustGM();state.combat={active:false,round:1,turn:0,order:[]};break;
 case 'journal.save':{mustGM();const note=journalSchema.parse(command.note);state.journal=state.journal.filter(n=>n.id!==note.id);state.journal.push(note);break;}
 case 'journal.delete':mustGM();state.journal=state.journal.filter(n=>n.id!==command.id);break;
 case 'macro.save':{mustGM();const macro=macroSchema.parse(command.macro);state.macros=state.macros.filter(m=>m.id!==macro.id);state.macros.push(macro);break;}
 case 'macro.delete':mustGM();state.macros=state.macros.filter(m=>m.id!==command.id);break;
 case 'system':mustGM();state.system=systemSchema.parse(command.system);break;
 case 'pause':mustGM();state.paused=!state.paused;break;
 case 'ambience':mustGM();if(!['none','rain','wind'].includes(String(command.value)))throw new GameError('Неизвестная атмосфера');state.ambience=String(command.value);break;
 case 'import':mustGM();return stateSchema.parse(command.state);
 default:throw new GameError('Неизвестная команда');
 }
 return stateSchema.parse(state);
}
export function tokenVisible(token:Token,state:WorldState,userId?:string):boolean {
 const scene=state.scenes.find(s=>s.id===state.activeScene)!;
 let visible=!scene.fog||((scene.visionMode??'shared')!=='manual'&&inTokenVision(scene,token,userId));
 for(const d of scene.drawings){if(d.kind==='fog'&&token.x>=Math.min(d.x,d.x2)&&token.x<=Math.max(d.x,d.x2)&&token.y>=Math.min(d.y,d.y2)&&token.y<=Math.max(d.y,d.y2))visible=false;if(d.kind==='reveal'&&Math.hypot(token.x-d.x,token.y-d.y)<=Math.hypot(d.x2-d.x,d.y2-d.y))visible=true;}
 return visible;
}
export function playerView(state:WorldState,userId:string):WorldState {
 const view=structuredClone(state);view.journal=view.journal.filter(n=>n.public);
 view.scenes=view.scenes.filter(s=>s.id===view.activeScene).map(s=>({...s,tokens:s.tokens.filter(t=>!t.hidden&&(t.ownerId===userId||tokenVisible(t,state,userId))).map(t=>({...t,notes:'',attributes:t.ownerId===userId?t.attributes:{}}))}));
 view.combat.currentTokenId=view.scenes[0].tokens.some(t=>t.id===state.combat.order[state.combat.turn])?state.combat.order[state.combat.turn]:null;
 view.combat.order=view.combat.order.filter(id=>view.scenes[0].tokens.some(t=>t.id===id));
 if(view.combat.effects)view.combat.effects=view.combat.effects.filter(e=>view.scenes[0].tokens.some(t=>t.id===e.actorId)).map(e=>({...e,targetIds:e.targetIds.filter(id=>view.scenes[0].tokens.some(t=>t.id===id)),results:e.results.filter(r=>view.scenes[0].tokens.some(t=>t.id===r.id))}));
 view.combat.turn=Math.max(0,view.combat.order.indexOf(state.combat.order[state.combat.turn]));
 return view;
}
