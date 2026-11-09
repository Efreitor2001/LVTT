import {catalogPage,catalogEntry,characterOptions,actorActions,spellAction,monsterToken,characterToken} from '../../../lib/server/catalog';
import {GameError} from '../../../lib/game/errors';
import {tokenSchema} from '../../../lib/game/validation';
import type {Scene,Command} from '../../../lib/game/types';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(request:Request){try{const p=new URL(request.url).searchParams,kind=p.get('kind')??'monsters',id=p.get('id');if(kind==='creation')return Response.json(characterOptions());return Response.json(id?catalogEntry(kind,id):catalogPage(kind,(p.get('q')??'').slice(0,100),Math.max(0,Math.min(10000,Number(p.get('offset'))||0)),50));}catch(error){return Response.json({error:error instanceof Error?error.message:'Каталог недоступен'},{status:error instanceof GameError?error.status:500});}}
export async function POST(request:Request){
 try{
  const text=await request.text();if(text.length>30000)return Response.json({error:'Запрос слишком большой'},{status:413});
  const input=JSON.parse(text),settings=z.object({unit:z.string().min(1).max(10),gridSize:z.number().min(20).max(150),distance:z.number().min(.1).max(1000)}).parse(input.scene);
  const scene:Scene={id:'preview',name:'Preview',subtitle:'',map:'',grid:'square',fog:false,tokens:[],drawings:[],...settings};
  if(input.kind==='monster-token')return Response.json({token:monsterToken(String(input.command.monsterId),scene)});
  if(input.kind==='character-token')return Response.json({token:characterToken(input.command as Command,scene)});
  const actor=tokenSchema.parse(input.actor);
  if(input.kind==='actions')return Response.json({actions:actorActions(actor,scene)});
  if(input.kind==='action'){const id=String(input.actionId),action=id.startsWith('spell:')?spellAction(id.slice(6),actor,scene,typeof input.slotLevel==='number'?input.slotLevel:undefined):actorActions(actor,scene).find(a=>a.id===id);if(!action)throw new GameError('Действие не найдено');return Response.json({action});}
  throw new GameError('Неизвестный запрос');
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Не удалось подготовить действие'},{status:error instanceof GameError?error.status:400});}
}
