import type {RollResult} from './types';
export type Wall={id:string;x1:number;y1:number;x2:number;y2:number;open:boolean;kind?:'wall'|'door'|'window';blocksVision?:boolean;blocksMovement?:boolean;source?:'map'};
export type DamagePart={dice:string;type:string};
export type BattleAction={id:string;name:string;description:string;cost:'action'|'bonus'|'reaction';kind:'attack'|'save'|'heal'|'utility';range:number;radius?:number;shape?:'sphere'|'cone'|'line'|'cube';attackBonus?:number;saveAbility?:string;saveDC?:number;halfOnSave?:boolean;damage:DamagePart[];condition?:string;effect:string;level:number;concentration?:boolean;durationRounds?:number;automated:boolean;sequence?:BattleAction[]};
export type CombatEffect={id:string;name:string;kind:string;actorId:string;targetIds:string[];from:{x:number;y:number};to:{x:number;y:number};radius:number;color:string;createdAt:number;results:{id:string;hit:boolean;amount:number;saved?:boolean;critical?:boolean;rolls:RollResult[]}[]};
