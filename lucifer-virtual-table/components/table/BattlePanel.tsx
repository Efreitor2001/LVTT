'use client';
import {useEffect,useState} from 'react';
import {Crosshair,Flame,Footprints,Shield,SkipForward} from 'lucide-react';
import type {World,Command} from '../../lib/game/types';
import type {BattleAction} from '../../lib/game/combat-types';
import {activeCombatToken,movementLeft} from '../../lib/game/movement';
export type Aim={id?:string;x:number;y:number}|null;
export default function BattlePanel({world,userId,selected,aim,aiming,onAim,onTarget,command,notify}:{world:World;userId:string;selected:string|null;aim:Aim;aiming:boolean;onAim:(a:boolean)=>void;onTarget:(aim:Aim)=>void;command:(c:Command)=>Promise<boolean>;notify:(message:string)=>void}){
 const state=world.state,scene=state.scenes.find(s=>s.id===state.activeScene)!,actor=scene.tokens.find(t=>t.id===selected)??scene.tokens.find(t=>t.id===activeCombatToken(state)),gm=world.role==='gm';
 const [actions,setActions]=useState<BattleAction[]>([]),[actionId,setAction]=useState('weapon'),[slotChoice,setSlot]=useState<{id:string;level:number}>({id:'',level:0}),[override,setOverride]=useState(false),[busy,setBusy]=useState(false);
 const can=!!actor&&(gm||actor.ownerId===userId),action=actions.find(a=>a.id===actionId)??actions[0],slot=slotChoice.id===action?.id?slotChoice.level:action?.level??0;
 useEffect(()=>{if(!actor||!can)return;const controller=new AbortController();const request=world.id==='demo'?fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'actions',actor,scene:{unit:scene.unit,gridSize:scene.gridSize,distance:scene.distance}}),signal:controller.signal}):fetch('/api/worlds/'+world.id+'/actions?token='+actor.id,{signal:controller.signal});request.then(r=>r.json()).then((d:unknown)=>setActions((d as {actions:BattleAction[]}).actions??[])).catch(()=>{});return()=>controller.abort();},[actor?.id,actor?.abilities?.join(','),actor?.level,world.id,can]);
 if(!actor)return null;
 const turn=activeCombatToken(state)===actor.id,cost=action?.cost==='bonus'?'bonus':action?.cost==='reaction'?'reactions':'actions',spent=state.combat[cost]?.[actor.id]??false,known=actor.spellSlots??{};
 async function cast(){
  if(!action||!actor)return;setBusy(true);let prepared=action;
  try{
   if(world.id==='demo'){const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'action',actor,scene:{unit:scene.unit,gridSize:scene.gridSize,distance:scene.distance},actionId:action.id,slotLevel:slot})});const d=await r.json() as {action:BattleAction;error?:string};if(!r.ok)throw new Error(d.error);prepared=d.action;}
   await command({type:'combat.act',actorId:actor.id,actionId:action.id,slotLevel:slot||undefined,targetIds:aim?.id?[aim.id]:[],point:aim?{x:aim.x,y:aim.y}:undefined,resolvedAction:prepared,override});onAim(false);
  }catch(error){notify(error instanceof Error?error.message:'Не удалось выполнить действие');}finally{setBusy(false);}
 }
 return <div className="battle-panel">
  <div className="battle-actor"><span className="eyebrow">ДЕЙСТВИЯ ПЕРСОНАЖА</span><h3>{actor.name}</h3><span className={turn?'turn-label':'muted'}>{turn?'Его ход':'Выбранный персонаж'}</span></div>
  <div className="battle-resources"><span><Footprints size={13}/>{movementLeft(state,actor).toFixed(1)} / {actor.speed??9} {scene.unit}</span><span className={state.combat.actions?.[actor.id]?'spent':''}>◆ Действие</span><span className={state.combat.bonus?.[actor.id]?'spent':''}>◇ Бонус</span><span className={state.combat.reactions?.[actor.id]?'spent':''}>↶ Реакция</span></div>
  {can?<><label>Действие<select aria-label="Боевое действие" value={action?.id??''} onChange={e=>{setAction(e.target.value);onAim(false);}}>{actions.map(a=><option key={a.id} value={a.id}>{a.level?'✦ '+a.level:'◇'} · {a.name}</option>)}</select></label>
   {action&&<><div className="ability-description"><strong>{action.name}</strong><small>{action.range} {scene.unit} · {action.cost==='bonus'?'Бонусное действие':action.cost==='reaction'?'Реакция':'Действие'}{action.radius?' · Область '+action.radius+' '+scene.unit:''}</small><details><summary>Описание и особые правила</summary><p>{action.description}</p><p className="muted">{action.automated?'Броски, урон, лечение и базовые состояния рассчитываются автоматически. Особые условия описания проверяет ведущий.':'Особые правила этого действия разрешает ведущий; ресурс расходуется, а действие отмечается в журнале.'}</p></details></div>
    {action.level>0&&<label>Ячейка<select aria-label="Уровень ячейки заклинания" value={slot} onChange={e=>setSlot({id:action.id,level:Number(e.target.value)})}>{Array.from({length:10-action.level},(_,i)=>i+action.level).map(n=><option key={n} value={n} disabled={!(known[String(n)]>0)}>{n} уровень · осталось {known[String(n)]??0}</option>)}</select></label>}
    <label>Цель<select aria-label="Цель боевого действия" value={aim?.id??''} onChange={e=>{const t=scene.tokens.find(t=>t.id===e.target.value);onTarget(t?{id:t.id,x:t.x,y:t.y}:null);}}><option value="">Выберите цель…</option>{scene.tokens.map(t=><option key={t.id} value={t.id}>{t.name} · {t.hp} HP</option>)}</select></label>
    <button className={aiming?'primary full':'secondary full'} onClick={()=>onAim(!aiming)}><Crosshair size={15}/>{aiming?'Выберите точку на карте':'Указать цель на карте'}</button>
    {aim&&!aim.id&&<p className="aim-caption">Точка: {Math.round(aim.x)}, {Math.round(aim.y)}</p>}
    <button className="primary full cast-button" disabled={busy||!turn&&action.cost!=='reaction'&&!override||spent&&!(action.id==='weapon'&&(state.combat.attacksRemaining?.[actor.id]??0)>0)&&!override} onClick={()=>void cast()}><Flame size={17}/>{busy?'Разрешаем действие…':action.kind==='attack'?'Атаковать':'Применить'}</button>
   </>}
   <div className="basic-actions"><button disabled={!turn||state.combat.actions?.[actor.id]} onClick={()=>void command({type:'combat.dash',actorId:actor.id})}><Footprints size={15}/>Рывок</button><button disabled={!turn||state.combat.actions?.[actor.id]} onClick={()=>void command({type:'combat.dodge',actorId:actor.id})}><Shield size={15}/>Уклонение</button><button disabled={!turn} onClick={()=>void command({type:'combat.end-turn',actorId:actor.id})}><SkipForward size={15}/>Конец хода</button></div>
   {gm&&<label className="check-label"><input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/>Разрешить действие вне очереди</label>}
  </>:<p className="hint">Выберите своего персонажа. Чужими действиями управляет владелец или ведущий.</p>}
  <div className="battle-log"><h4>Журнал боя</h4>{(state.combat.effects??[]).slice(-6).reverse().map(effect=><details key={effect.id}><summary><span style={{color:effect.color}}>✦</span> {effect.name}<small>{effect.results.reduce((n,r)=>n+r.amount,0)}</small></summary>{effect.results.map(r=><p key={r.id}><b>{scene.tokens.find(t=>t.id===r.id)?.name}</b> · {r.critical?'Критическое попадание · ':''}{r.hit?r.amount<0?'Лечение '+(-r.amount):'Урон '+r.amount:'Промах'}{r.saved?' · спасбросок успешен':''}<span>{r.rolls.map(roll=>roll.formula+' = '+roll.total).join(' · ')}</span></p>)}</details>)}</div>
 </div>;
}
