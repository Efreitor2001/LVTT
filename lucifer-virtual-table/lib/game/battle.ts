import type {WorldState,Token,Member,Command,Scene,RollResult} from './types';
import type {BattleAction,CombatEffect} from './combat-types';
import {GameError} from './errors';
import {rollDice,secureInt} from './dice';
import {activeCombatToken,mapDistance} from './movement';
import {inTokenVision,lineOfSight} from './vision';
const abilityNames:Record<string,string>={str:'Сила',dex:'Ловкость',con:'Телосложение',int:'Интеллект',wis:'Мудрость',cha:'Харизма'};
const colors:Record<string,string>={fire:'#ff914d',cold:'#8fddff',lightning:'#c6adff',healing:'#91e4b3',necrotic:'#bc8ae6',radiant:'#ffe9a3',acid:'#b8dd68',poison:'#9bc77d',force:'#d7b2ff',slash:'#f4d3ad',shield:'#88c8ed'};
export function savingBonus(token:Token,ability:string){return token.saves?.[ability]??token.attributes[abilityNames[ability]??ability]??0;}
function clearConcentration(scene:Scene,actor:Token){
 actor.concentration=null;
 for(const token of scene.tokens){const removed=(token.statusEffects??[]).filter(e=>e.sourceId===actor.id&&e.concentration);token.statusEffects=token.statusEffects?.filter(e=>!removed.includes(e));token.conditions=token.conditions.filter(c=>!removed.some(e=>e.condition===c));}
}
export function nextTurn(state:WorldState,random:(sides:number)=>number=secureInt){
 const scene=state.scenes.find(s=>s.id===state.activeScene)!;
 const previous=scene.tokens.find(t=>t.id===activeCombatToken(state));
 if(previous?.statusEffects){
  const removed=previous.statusEffects.filter(effect=>--effect.rounds<=0||effect.saveAbility&&rollDice(`1d20+${savingBonus(previous,effect.saveAbility)}`,[],[],random).total>=(effect.saveDC??12));
  previous.statusEffects=previous.statusEffects.filter(e=>!removed.includes(e));previous.conditions=previous.conditions.filter(c=>!removed.some(e=>e.condition===c));
 }
 state.combat.turn++;if(state.combat.turn>=state.combat.order.length){state.combat.turn=0;state.combat.round++;}
 const id=state.combat.order[state.combat.turn];delete state.combat.currentTokenId;
 state.combat.movement={...state.combat.movement,[id]:0};state.combat.actions={...state.combat.actions,[id]:false};state.combat.bonus={...state.combat.bonus,[id]:false};state.combat.reactions={...state.combat.reactions,[id]:false};state.combat.dash={...state.combat.dash,[id]:0};state.combat.attacksRemaining={...state.combat.attacksRemaining,[id]:0};
 const actor=scene.tokens.find(t=>t.id===id);if(actor){actor.shieldUntilTurn=false;actor.conditions=actor.conditions.filter(c=>c!=='Уклонение');}
}
export function performBasicAction(state:WorldState,member:Member,command:Command){
 const scene=state.scenes.find(s=>s.id===state.activeScene)!,actor=scene.tokens.find(t=>t.id===command.actorId);if(!actor)throw new GameError('Персонаж не найден');
 if(member.role!=='gm'&&actor.ownerId!==member.userId)throw new GameError('Это чужой персонаж',403);
 if(state.paused&&member.role!=='gm')throw new GameError('Игра приостановлена',403);
 if(actor.hp<=0)throw new GameError('Персонаж без сознания',403);
 if(!state.combat.active)throw new GameError('Сначала начните бой');
 if(activeCombatToken(state)!==actor.id)throw new GameError('Сейчас ход другого участника',403);
 if(command.type==='combat.end-turn'){nextTurn(state);return;}
 if(state.combat.actions?.[actor.id])throw new GameError('Действие на этом ходу уже потрачено',403);
 state.combat.actions={...state.combat.actions,[actor.id]:true};
 if(command.type==='combat.dash')state.combat.dash={...state.combat.dash,[actor.id]:(state.combat.dash?.[actor.id]??0)+(actor.speed??9)};
 if(command.type==='combat.dodge'&&!actor.conditions.includes('Уклонение'))actor.conditions.push('Уклонение');
}
function areaContains(scene:Scene,actor:Token,point:{x:number;y:number},target:Token,action:BattleAction){
 const scale=scene.gridSize/scene.distance,radius=(action.radius??0)*scale;
 if(action.shape==='cone'||action.shape==='line'){
  const dx=point.x-actor.x,dy=point.y-actor.y,length=Math.hypot(dx,dy)||1,x=target.x-actor.x,y=target.y-actor.y,projection=(x*dx+y*dy)/length,cross=Math.abs(x*dy-y*dx)/length;
  return projection>=0&&projection<=radius&&(action.shape==='line'?cross<=scale*.75:Math.atan2(cross,projection)<=Math.PI/6);
 }
 return Math.hypot(target.x-point.x,target.y-point.y)<=radius+.01;
}
export function executeBattle(state:WorldState,member:Member,command:Command,random:(sides:number)=>number=secureInt){
 const scene=state.scenes.find(s=>s.id===state.activeScene)!,actor=scene.tokens.find(t=>t.id===command.actorId),action=command.resolvedAction as BattleAction;
 if(!actor||!action)throw new GameError('Действие или персонаж не найдены');
 const gm=member.role==='gm';if(!gm&&actor.ownerId!==member.userId)throw new GameError('Это чужой персонаж',403);
 if(state.paused&&!gm)throw new GameError('Игра приостановлена',403);
 if(!state.combat.active)throw new GameError('Сначала начните бой');
 if(actor.hp<=0||actor.conditions.some(c=>/Парализован|Без сознания|Ошеломлён/.test(c)))throw new GameError('Персонаж сейчас не может действовать',403);
 if(action.cost!=='reaction'&&activeCombatToken(state)!==actor.id&&!(gm&&command.override===true))throw new GameError('Сейчас ход другого участника',403);
 const budget=action.cost==='bonus'?'bonus':action.cost==='reaction'?'reactions':'actions',remaining=state.combat.attacksRemaining?.[actor.id]??0,extra=action.id==='weapon'&&remaining>0;
 if(state.combat[budget]?.[actor.id]&&!extra&&!(gm&&command.override===true))throw new GameError('Этот ресурс на текущем ходу уже потрачен',403);
 const selected=Array.isArray(command.targetIds)?[...new Set(command.targetIds.filter((id):id is string=>typeof id==='string'))]:[],first=scene.tokens.find(t=>t.id===selected[0]);
 if(!(action.radius??0)&&selected.length>1)throw new GameError('Для этого действия выберите одну цель');
 const supplied=command.point as {x?:unknown;y?:unknown}|undefined;
 const point=first&&!(action.radius??0)?{x:first.x,y:first.y}:supplied&&typeof supplied.x==='number'&&typeof supplied.y==='number'&&Number.isFinite(supplied.x)&&Number.isFinite(supplied.y)?{x:supplied.x,y:supplied.y}:first?{x:first.x,y:first.y}:{x:actor.x,y:actor.y};
 if(point.x<0||point.x>1800||point.y<0||point.y>1200)throw new GameError('Цель находится за пределами карты');
 const selfArea=action.range===0&&(action.radius??0)>0;
 if(!selfArea&&action.range>0&&mapDistance(scene,actor,point,state.system.id==='d20')>action.range+.01)throw new GameError('Цель слишком далеко',403);
 if(!lineOfSight(scene,actor,point))throw new GameError('Цель закрыта стеной',403);
 let targets=(action.radius??0)>0?scene.tokens.filter(t=>areaContains(scene,actor,selfArea&&action.shape!=='cone'&&action.shape!=='line'?actor:point,t,action)&&lineOfSight(scene,selfArea?actor:point,t)):scene.tokens.filter(t=>selected.includes(t.id));
 if(action.id==='spell:shield'||action.range===0&&!(action.radius??0))targets=[actor];
 if(!targets.length&&action.kind!=='utility')throw new GameError('Выберите цель');
 if(!gm&&!(action.radius??0)&&targets.some(t=>t.hidden||scene.fog&&!inTokenVision(scene,t,member.userId)))throw new GameError('Цель недоступна',403);
 if(!gm&&scene.fog&&!(action.radius??0)&&action.range>0&&!inTokenVision(scene,point,member.userId))throw new GameError('Цель вне видимости',403);
 if(action.level>0){const available=actor.spellSlots?.[String(action.level)]??0;if(available<1)throw new GameError('Нет ячеек этого уровня',403);actor.spellSlots={...actor.spellSlots,[String(action.level)]:available-1};}
 if(!extra){state.combat[budget]={...state.combat[budget],[actor.id]:true};if(action.id==='weapon'){const count=actor.classId==='fighter'?(actor.level??1)>=20?4:(actor.level??1)>=11?3:(actor.level??1)>=5?2:1:['barbarian','ranger','paladin','monk'].includes(actor.classId??'')&&(actor.level??1)>=5?2:1;state.combat.attacksRemaining={...state.combat.attacksRemaining,[actor.id]:count-1};}}
 else state.combat.attacksRemaining={...state.combat.attacksRemaining,[actor.id]:remaining-1};
 if(action.concentration){clearConcentration(scene,actor);actor.concentration=action.id;}
 if(action.id==='spell:shield')actor.shieldUntilTurn=true;
 const effect:CombatEffect={id:crypto.randomUUID(),name:action.name,kind:action.effect,actorId:actor.id,targetIds:targets.map(t=>t.id),from:{x:actor.x,y:actor.y},to:point,radius:action.radius??0,color:colors[action.effect]??'#cba5ff',createdAt:Date.now(),results:[]};
 const sharedDamage=new Map<string,RollResult>();
 for(const target of targets){
  const rolls:RollResult[]=[],actions=action.sequence??[action];let total=0,anyHit=false,anyCritical=false,saved=false;
  for(const sub of actions){
   let hit=true,critical=false,multiplier=1;saved=false;
   if(sub.kind==='attack'){
    const dodge=target.conditions.includes('Уклонение'),roll=rollDice(`${dodge?'2d20kl1':'1d20'}+${sub.attackBonus??actor.attackBonus??4}`,[],[],random);rolls.push(roll);
    const natural=roll.groups[0].items.find(i=>!i.dropped)!.value;critical=natural===20;hit=natural!==1&&(critical||roll.total>=target.armor+(target.shieldUntilTurn?5:0));
   }
   if(sub.kind==='save'){
    const roll=rollDice(`1d20+${savingBonus(target,sub.saveAbility??'dex')}`,[],[],random);rolls.push(roll);saved=roll.total>=(sub.saveDC??actor.saveDC??12);if(saved){multiplier=sub.halfOnSave?.5:0;if(!sub.halfOnSave)hit=false;}
   }
   if(hit&&sub.automated){
    for(const part of sub.damage){
     const dice=critical?part.dice.replace(/(\d*)d(\d+)/g,(_,n,s)=>`${2*Number(n||1)}d${s}`):part.dice;
     const key=sub.id+':'+sub.damage.indexOf(part),roll=(action.radius??0)>0&&sub.kind!=='attack'?(sharedDamage.get(key)??rollDice(dice,[],[],random)):rollDice(dice,[],[],random);sharedDamage.set(key,roll);rolls.push(roll);let amount=Math.max(0,Math.floor(roll.total*multiplier));
     if(sub.kind==='heal'){const previous=target.hp;target.hp=Math.min(target.maxHp,target.hp+amount);total-=target.hp-previous;}
     else{
      if(target.immunities?.includes(part.type)||target.shieldUntilTurn&&sub.id==='spell:magic-missile')amount=0;else{if(target.resistances?.includes(part.type))amount=Math.floor(amount/2);if(target.vulnerabilities?.includes(part.type))amount*=2;}
      const absorbed=Math.min(target.tempHp??0,amount);target.tempHp=(target.tempHp??0)-absorbed;target.hp=Math.max(0,target.hp-(amount-absorbed));total+=amount;
      if(target.concentration&&amount>0){const concentration=rollDice(`1d20+${savingBonus(target,'con')}`,[],[],random);rolls.push(concentration);if(concentration.total<Math.max(10,Math.floor(amount/2)))clearConcentration(scene,target);}
     }
    }
    if(sub.condition&&!saved){if(!target.conditions.includes(sub.condition))target.conditions.push(sub.condition);target.statusEffects=[...(target.statusEffects??[]).filter(e=>!(e.sourceId===actor.id&&e.condition===sub.condition)),{id:crypto.randomUUID(),condition:sub.condition,sourceId:actor.id,rounds:sub.durationRounds??10,concentration:!!sub.concentration,saveAbility:sub.saveAbility,saveDC:sub.saveDC}];}
   }
   anyHit||=hit;anyCritical||=critical;
  }
  if(target.hp===0){if(target.concentration)clearConcentration(scene,target);if(!target.conditions.includes('Без сознания'))target.conditions.push('Без сознания');}if(target.hp>0)target.conditions=target.conditions.filter(c=>c!=='Без сознания');
  effect.results.push({id:target.id,hit:anyHit,amount:total,saved,critical:anyCritical,rolls});
 }
 state.combat.effects=[...(state.combat.effects??[]).slice(-19),effect];
}
