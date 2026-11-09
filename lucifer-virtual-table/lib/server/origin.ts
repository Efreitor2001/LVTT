export function sameOrigin(request:Request):boolean{
 const origin=request.headers.get('origin');if(!origin)return true;
 try{const url=new URL(request.url),expected=process.env.PUBLIC_APP_URL?new URL(process.env.PUBLIC_APP_URL).origin:`${url.protocol}//${request.headers.get('host')??url.host}`;return new URL(origin).origin===expected;}catch{return false;}
}
