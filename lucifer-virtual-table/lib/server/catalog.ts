import 'server-only';
import monstersJson from '../../data/srd2014/monsters.json';
import spellsJson from '../../data/srd2014/spells.json';
import racesJson from '../../data/srd2014/races.json';
import subracesJson from '../../data/srd2014/subraces.json';
import classesJson from '../../data/srd2014/classes.json';
import subclassesJson from '../../data/srd2014/subclasses.json';
import traitsJson from '../../data/srd2014/traits.json';
import featuresJson from '../../data/srd2014/features.json';
import conditionsJson from '../../data/srd2014/conditions.json';
import equipmentJson from '../../data/srd2014/equipment.json';
import levelsJson from '../../data/srd2014/levels.json';
import type {BattleAction} from '../game/combat-types';
import type {Command,Scene,Token,WorldState} from '../game/types';
import {GameError} from '../game/errors';
type Row={index:string;name:string;desc?:string|string[];[key:string]:unknown};
type Damage={damage_type?:{index:string};damage_dice?:string;damage_at_slot_level?:Record<string,string>;damage_at_character_level?:Record<string,string>};
type Spell=Row & {level:number;range:string;casting_time:string;damage?:Damage[];heal_at_slot_level?:Record<string,string>;attack_type?:string;concentration?:boolean;duration:string;dc?:{dc_type:{index:string};dc_success:string};area_of_effect?:{type:string;size:number};school:{index:string}};
type MonsterAction={name:string;desc:string;attack_bonus?:number;damage?:Damage[];dc?:{dc_type:{index:string};dc_value:number;success_type:string};usage?:{type:string};actions?:unknown[]};
type Monster=Row & {armor_class:{value:number}[];hit_points:number;speed:Record<string,string>;challenge_rating:number;actions:MonsterAction[];senses?:Record<string,string>;proficiencies?:{value:number;proficiency:{index:string}}[];damage_resistances:string[];damage_immunities:string[];damage_vulnerabilities:string[]};
const datasets:Record<string,Row[]>={monsters:monstersJson as unknown as Row[],spells:spellsJson as unknown as Row[],races:racesJson as unknown as Row[],subraces:subracesJson as unknown as Row[],classes:classesJson as unknown as Row[],subclasses:subclassesJson as unknown as Row[],traits:traitsJson as unknown as Row[],features:featuresJson as unknown as Row[],conditions:conditionsJson as unknown as Row[],equipment:equipmentJson as unknown as Row[]};
const names:Record<string,string>={human:'Человек',elf:'Эльф',dwarf:'Дварф',halfling:'Полурослик',gnome:'Гном','half-elf':'Полуэльф','half-orc':'Полуорк',dragonborn:'Драконорождённый',tiefling:'Тифлинг',fighter:'Воин',wizard:'Волшебник',rogue:'Плут',ranger:'Следопыт',cleric:'Жрец',druid:'Друид',paladin:'Паладин',bard:'Бард',barbarian:'Варвар',monk:'Монах',sorcerer:'Чародей',warlock:'Колдун',goblin:'Гоблин',orc:'Орк',skeleton:'Скелет',zombie:'Зомби',wolf:'Волк',ogre:'Огр',troll:'Тролль','ancient-red-dragon':'Древний красный дракон','adult-red-dragon':'Взрослый красный дракон','fire-bolt':'Огненный снаряд',fireball:'Огненный шар','magic-missile':'Волшебная стрела','cure-wounds':'Лечение ран','healing-word':'Лечащее слово',shield:'Щит','hold-person':'Удержание личности','ray-of-frost':'Ледяной луч','burning-hands':'Огненные ладони','eldritch-blast':'Мистический заряд','sacred-flame':'Священное пламя','guiding-bolt':'Направленный снаряд','lightning-bolt':'Молния','cone-of-cold':'Конус холода','ice-storm':'Град','acid-arrow':'Кислотная стрела','inflict-wounds':'Нанесение ран','chill-touch':'Леденящее прикосновение',sleep:'Сон',bless:'Благословение',bane:'Порча',haste:'Ускорение',slow:'Замедление',invisibility:'Невидимость',fly:'Полёт','high-elf':'Высший эльф','hill-dwarf':'Холмовой дварф','lightfoot-halfling':'Легконогий полурослик','rock-gnome':'Скальный гном'};
export const catalogCounts=Object.fromEntries(Object.entries(datasets).map(([key,rows])=>[key,rows.length]));
export function feet(scene:Scene,n:number){return /ft|фут/i.test(scene.unit)?n:n*.3;}
function text(value:unknown):string[]{return Array.isArray(value)?value.map(String):typeof value==='string'?[value]:[];}
export function catalogPage(kind:string,query='',offset=0,limit=50){
 const rows=datasets[kind];if(!rows)throw new GameError('Каталог не найден',404);
 const q=query.toLocaleLowerCase();const filtered=rows.filter(r=>(r.name+' '+(names[r.index]??'')+' '+String(r.type??'')).toLocaleLowerCase().includes(q));
 return {count:filtered.length,counts:catalogCounts,items:filtered.slice(offset,offset+limit).map(r=>({id:r.index,name:names[r.index]??r.name,originalName:r.name,summary:kind==='monsters'?`CR ${r.challenge_rating} · ${r.type} · HP ${r.hit_points}`:kind==='spells'?`Уровень ${r.level} · ${r.range} · ${r.casting_time}`:String(r.size??r.hit_die??r.level??'SRD 5.1')}))};
}
export function catalogEntry(kind:string,id:string){
 const row=datasets[kind]?.find(r=>r.index===id);if(!row)throw new GameError('Запись не найдена',404);
 const description=[...text(row.desc),...text(row.age),...text(row.size_description),...text(row.language_desc),...text(row.higher_level)];
 const facts=Object.entries(row).filter(([k,v])=>!['name','index','url','desc','age','alignment','size_description','language_desc','higher_level','image'].includes(k)&&(typeof v==='number'||typeof v==='string')).map(([key,value])=>({key,value:String(value)}));
 return {id:row.index,name:names[row.index]??row.name,originalName:row.name,description,facts,source:'SRD 5.1 · 2014 · CC BY 4.0',raw:row};
}
function formula(table:Record<string,string>|undefined,level:number){if(!table)return undefined;const key=Object.keys(table).map(Number).filter(n=>n<=level).sort((a,b)=>b-a)[0];return key===undefined?undefined:table[String(key)];}
export function spellAction(id:string,actor:Token,scene:Scene,slot?:number):BattleAction{
 const s=(datasets.spells as Spell[]).find(s=>s.index===id);if(!s)throw new GameError('Заклинание не найдено',404);
 const level=slot??s.level;if(!Number.isInteger(level)||level<s.level||level>9||s.level===0&&level!==0)throw new GameError('Неверный уровень ячейки');
 const modifier=actor.classId==='wizard'?actor.attributes['Интеллект']??0:['cleric','druid','ranger','monk'].includes(actor.classId??'')?actor.attributes['Мудрость']??0:['bard','sorcerer','paladin','warlock'].includes(actor.classId??'')?actor.attributes['Харизма']??0:Math.max(actor.attributes['Интеллект']??0,actor.attributes['Мудрость']??0,actor.attributes['Харизма']??0);
 const damage=(s.damage??[]).flatMap(d=>{const dice=formula(d.damage_at_slot_level,level)??formula(d.damage_at_character_level,actor.level??1);return dice?[{dice,type:d.damage_type?.index??'force'}]:[];});
 const heal=formula(s.heal_at_slot_level,level)?.replaceAll('MOD',String(modifier));if(heal)damage.push({dice:heal,type:'healing'});
 const conditions:Record<string,string>={'hold-person':'Парализован','blindness-deafness':'Ослеплён'};
 const beams=id==='eldritch-blast'?(actor.level??1)>=17?4:(actor.level??1)>=11?3:(actor.level??1)>=5?2:1:id==='scorching-ray'?level+1:1;
 const kind=heal?'heal':s.attack_type?'attack':s.dc?'save':'utility';
 const effect=heal?'healing':s.school.index==='abjuration'?'shield':damage[0]?.type??(s.concentration?'arcane':'utility');
 const action:BattleAction={id:'spell:'+id,name:names[id]??s.name,description:text(s.desc).join('\n\n'),cost:s.casting_time.includes('reaction')?'reaction':s.casting_time.includes('bonus')?'bonus':'action',kind,range:feet(scene,Number.parseFloat(s.range)||(/touch/i.test(s.range)?5:0)),radius:s.area_of_effect?feet(scene,s.area_of_effect.size):0,shape:s.area_of_effect?.type as BattleAction['shape'],attackBonus:actor.spellAttackBonus??2+Math.floor(((actor.level??1)-1)/4)+modifier,saveAbility:s.dc?.dc_type.index,saveDC:actor.saveDC??12,halfOnSave:s.dc?.dc_success==='half',damage,condition:conditions[id],effect,level,concentration:s.concentration,automated:!!(heal||s.attack_type||s.duration==='Instantaneous'&&damage.length||conditions[id]||id==='shield')};
 if(beams>1)action.sequence=Array.from({length:beams},()=>({...action}));return action;
}
function monsterAction(monster:Monster,index:number,actor:Token,scene:Scene):BattleAction{
 const a=monster.actions[index];if(!a)throw new GameError('Действие не найдено');
 const reach=a.desc.match(/(?:reach|range)\s+(\d+)/i),radius=a.desc.match(/(\d+)-foot (?:cone|radius|line)/i);
 return {id:'monster:'+index,name:a.name,description:a.desc,cost:'action',kind:a.attack_bonus!==undefined?'attack':a.dc?'save':'utility',range:feet(scene,reach?Number(reach[1]):radius?Number(radius[1]):5),radius:radius?feet(scene,Number(radius[1])):0,shape:/cone/i.test(a.desc)?'cone':/line/i.test(a.desc)?'line':'sphere',attackBonus:a.attack_bonus??actor.attackBonus??4,saveDC:a.dc?.dc_value??12,saveAbility:a.dc?.dc_type.index,halfOnSave:a.dc?.success_type==='half'||/half as much damage/i.test(a.desc),damage:(a.damage??[]).filter(d=>d.damage_dice).map(d=>({dice:d.damage_dice!,type:d.damage_type?.index??'physical'})),effect:a.damage?.[0]?.damage_type?.index??'slash',level:0,automated:!!(a.damage?.some(d=>d.damage_dice)||a.attack_bonus!==undefined)};
}
export function actorActions(actor:Token,scene:Scene){
 const weapon:BattleAction={id:'weapon',name:'Атака оружием',description:'Бросок атаки против защиты цели. На натуральной 20 кости урона удваиваются.',cost:'action',kind:'attack',range:actor.attackRange??feet(scene,5),attackBonus:actor.attackBonus??4,damage:[{dice:actor.damage??'1d8+2',type:'slashing'}],effect:'slash',level:0,automated:true};
 const monster=(datasets.monsters as Monster[]).find(m=>m.index===actor.monsterId);
 return [weapon,...(actor.abilities??[]).map(id=>spellAction(id,actor,scene)),...(monster?.actions??[]).map((_,i)=>monsterAction(monster!,i,actor,scene))];
}
export function resolveAction(state:WorldState,command:Command,gm:boolean):BattleAction{
 const scene=state.scenes.find(s=>s.id===state.activeScene)!,actor=scene.tokens.find(t=>t.id===command.actorId);if(!actor)throw new GameError('Персонаж не найден',404);
 const id=String(command.actionId);
 if(id.startsWith('spell:')){const spell=id.slice(6);if(!gm&&!actor.abilities?.includes(spell))throw new GameError('Персонаж не знает это заклинание',403);return spellAction(spell,actor,scene,typeof command.slotLevel==='number'?command.slotLevel:undefined);}
 const action=actorActions(actor,scene).find(a=>a.id===id);if(!action)throw new GameError('Действие недоступно',403);return action;
}
export function monsterToken(id:string,scene:Scene):Token{
 const m=(datasets.monsters as Monster[]).find(m=>m.index===id);if(!m)throw new GameError('Монстр не найден',404);
 const attributes=Object.fromEntries([['Сила','strength'],['Ловкость','dexterity'],['Телосложение','constitution'],['Интеллект','intelligence'],['Мудрость','wisdom'],['Харизма','charisma']].map(([ru,en])=>[ru,Math.floor((Number(m[en])-10)/2)]));
 const saves=Object.fromEntries((m.proficiencies??[]).filter(p=>p.proficiency.index.startsWith('saving-throw-')).map(p=>[p.proficiency.index.slice(13),p.value]));
 return {id:crypto.randomUUID(),name:names[id]??m.name,x:1050,y:570,color:'#c97658',portrait:'enemy',hp:m.hit_points,maxHp:m.hit_points,armor:m.armor_class?.[0]?.value??10,initiative:attributes['Ловкость']??0,hidden:false,ownerId:null,attributes,conditions:[],notes:'SRD 5.1: '+m.name,speed:feet(scene,Number.parseFloat(m.speed.walk??'0')),vision:feet(scene,Number.parseFloat(m.senses?.darkvision??'30')),faction:'hostile',monsterId:id,level:Math.max(1,Math.min(20,Math.ceil(m.challenge_rating))),saves,resistances:m.damage_resistances.filter(s=>s.length<=100),immunities:m.damage_immunities.filter(s=>s.length<=100),vulnerabilities:m.damage_vulnerabilities.filter(s=>s.length<=100),abilities:[],spellSlots:{}};
}
export function characterOptions(){return {races:datasets.races.map(r=>({id:r.index,name:names[r.index]??r.name})),classes:datasets.classes.map(r=>({id:r.index,name:names[r.index]??r.name})),spells:(datasets.spells as Spell[]).map(s=>({id:s.index,name:names[s.index]??s.name,level:s.level,classes:(s.classes as {index:string}[]).map(c=>c.index)}))};}
export function characterToken(command:Command,scene:Scene):Token{
 const race=datasets.races.find(r=>r.index===command.species),characterClass=datasets.classes.find(c=>c.index===command.classId),level=Number(command.level??1);
 if(!race||!characterClass||!Number.isInteger(level)||level<1||level>20)throw new GameError('Выберите расу, класс и уровень 1–20');
 const raw=command.scores as Record<string,number>,keys=['str','dex','con','int','wis','cha'],ru=['Сила','Ловкость','Телосложение','Интеллект','Мудрость','Харизма'];
 if(!raw||keys.some(k=>!Number.isInteger(raw[k])||raw[k]<3||raw[k]>20))throw new GameError('Характеристики должны быть в пределах 3–20');
 const scores={...raw};for(const bonus of race.ability_bonuses as {ability_score:{index:string};bonus:number}[])scores[bonus.ability_score.index]+=bonus.bonus;
 const attributes=Object.fromEntries(keys.map((k,i)=>[ru[i],Math.floor((scores[k]-10)/2)]));
 const progression=(levelsJson as unknown as {class:{index:string};level:number;features:{name:string}[];prof_bonus:number;spellcasting?:Record<string,number>;class_specific?:Record<string,unknown>}[]).filter(l=>l.class.index===characterClass.index&&l.level<=level),last=progression.find(l=>l.level===level);
 const slots=Object.fromEntries(Object.entries(last?.spellcasting??{}).filter(([k])=>k.startsWith('spell_slots_level_')).map(([k,v])=>[k.slice(18),v]));
 const maxSlot=Math.max(0,...Object.entries(slots).filter(([,v])=>v>0).map(([k])=>Number(k)));
 const selected=Array.isArray(command.abilities)?command.abilities.map(String):[];
 if(selected.length>50||selected.some(id=>!(datasets.spells as Spell[]).some(s=>s.index===id&&(s.classes as {index:string}[]).some(c=>c.index===characterClass.index)&&s.level<=maxSlot)))throw new GameError('В списке есть заклинание, недоступное этому классу или уровню');
 const casting=characterClass.index==='wizard'?attributes['Интеллект']:['cleric','druid','ranger','monk'].includes(characterClass.index)?attributes['Мудрость']:attributes['Харизма'],proficiency=last?.prof_bonus??2;
 const hitDie=Number(characterClass.hit_die),hp=Math.max(level,hitDie+attributes['Телосложение']+(level-1)*(Math.floor(hitDie/2)+1+attributes['Телосложение']));
 const ranged=['ranger','rogue'].includes(characterClass.index),attackModifier=ranged?attributes['Ловкость']:attributes['Сила'];
 return {id:crypto.randomUUID(),name:String(command.name??names[race.index]??race.name).slice(0,100),x:570,y:690,color:'#89b59c',portrait:characterClass.index==='wizard'||characterClass.index==='sorcerer'?'mage':ranged?'ranger':'warrior',hp,maxHp:hp,armor:10+attributes['Ловкость'],initiative:attributes['Ловкость'],hidden:false,ownerId:typeof command.ownerId==='string'?command.ownerId:null,attributes,conditions:[],notes:'SRD 5.1 · '+race.name+' · '+characterClass.name,speed:feet(scene,Number(race.speed)),vision:feet(scene,(race.traits as {index:string}[]).some(t=>t.index==='darkvision')?60:30),faction:'party',level,species:race.index,classId:characterClass.index,abilities:selected,spellSlots:slots,attackBonus:proficiency+attackModifier,spellAttackBonus:proficiency+casting,attackRange:feet(scene,ranged?80:5),damage:'1d8'+(attackModifier<0?'':'+')+attackModifier,saveDC:8+proficiency+casting,saves:Object.fromEntries((characterClass.saving_throws as {index:string}[]).map(s=>[s.index,attributes[ru[keys.indexOf(s.index)]]+proficiency])),traits:[...(race.traits as {name:string}[]).map(t=>t.name),...progression.flatMap(p=>p.features.map(f=>f.name))].slice(0,100)};
}
