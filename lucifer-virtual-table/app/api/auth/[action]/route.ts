import {z} from 'zod';
import {cookies} from 'next/headers';
import {getPool} from '../../../../lib/server/postgres';
import {getCurrentUser,hashPassword,verifyPassword,startSession,endSession,rateLimit,digest} from '../../../../lib/server/auth';
import {sameOrigin} from '../../../../lib/server/origin';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
 try{
  if(!sameOrigin(request))return Response.json({error:'Недопустимый источник запроса'},{status:403});
  const text=await request.text();if(text.length>5000)return Response.json({error:'Запрос слишком большой'},{status:413});const data=JSON.parse(text),{action}=await params,db=getPool();
  if(action==='logout'){await endSession();return Response.json({ok:true});}
  if(action==='password'){
   const user=await getCurrentUser();if(!user)return Response.json({error:'Войдите в аккаунт'},{status:401});
   const p=z.object({current:z.string().min(1).max(128),password:z.string().min(12).max(128)}).parse(data);await rateLimit('password:'+user.userId,8,900000);
   const {rows}=await db.query('SELECT password_hash FROM accounts WHERE id=$1',[user.userId]);if(!await verifyPassword(p.current,rows[0].password_hash))return Response.json({error:'Текущий пароль неверен'},{status:400});
   const current=(await cookies()).get('lvt_session')?.value;await db.query('UPDATE accounts SET password_hash=$1 WHERE id=$2',[await hashPassword(p.password),user.userId]);await db.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2',[user.userId,current?digest(current):'']);return Response.json({ok:true});
  }
  const input=z.object({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(action==='register'?12:1).max(128),name:z.string().trim().min(1).max(60).optional()}).parse(data);
  await rateLimit('auth:'+digest(input.email),10,900000);
  if(action==='register'){
   const addr=process.env.TRUST_PROXY==='true'?request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown':'local';await rateLimit('register:'+digest(addr),30,3600000);
   const id=crypto.randomUUID(),now=Date.now(),hash=await hashPassword(input.password),client=await db.connect();
   try{await client.query('BEGIN');await client.query('INSERT INTO accounts(id,email,password_hash,created_at) VALUES($1,$2,$3,$4)',[id,input.email,hash,now]);await client.query('INSERT INTO profiles(user_id,name,created_at) VALUES($1,$2,$3)',[id,input.name??input.email.split('@')[0],now]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');if((e as {code?:string}).code==='23505')return Response.json({error:'Аккаунт с этой почтой уже существует'},{status:409});throw e;}finally{client.release();}
   await startSession(id);return Response.json({ok:true}, {status:201});
  }
  if(action==='login'){
   const {rows}=await db.query('SELECT id,password_hash FROM accounts WHERE email=$1',[input.email]);
   // Do equal-cost password work even when the address is unknown.
   const fallback='scrypt-v1:000000000000000000000000000000000000000000000000:'+ '0'.repeat(128);
   const valid=await verifyPassword(input.password,rows[0]?.password_hash??fallback);if(!rows[0]||!valid)return Response.json({error:'Неверная почта или пароль'},{status:401});
   await startSession(rows[0].id);return Response.json({ok:true});
  }
  return Response.json({error:'Маршрут не найден'},{status:404});
 }catch(e){if(e instanceof z.ZodError)return Response.json({error:e.issues.map(i=>i.path.includes('password')?'Пароль: от 12 до 128 символов':i.message).join('; ')},{status:400});if(e instanceof SyntaxError)return Response.json({error:'Некорректный запрос'},{status:400});if(e instanceof Error&&e.message.includes('много попыток'))return Response.json({error:e.message},{status:429});console.error('Authentication failed');return Response.json({error:'Сервис входа недоступен. Попробуйте позже.'},{status:503});}
}
