import {roomStream} from '../../../../../lib/server/room-stream';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return await roomStream(request,(await params).id);}catch{return Response.json({error:'Канал комнаты временно недоступен'},{status:503});}}
