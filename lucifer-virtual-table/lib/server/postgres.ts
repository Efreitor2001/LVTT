import 'server-only';
import pg from 'pg';
pg.types.setTypeParser(20,Number);
const globalDb=globalThis as typeof globalThis & {lvtPool?:pg.Pool};
export function getPool(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is not configured');
 if(!globalDb.lvtPool){globalDb.lvtPool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:12,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,statement_timeout:15000});globalDb.lvtPool.on('error',()=>console.error('PostgreSQL idle connection lost; pool will reconnect.'));}
 return globalDb.lvtPool;
}
function placeholders(sql:string){let i=0;return sql.replace(/\?/g,()=>'$'+(++i));}
function normalize(row:Record<string,unknown>){for(const [lower,camel] of [['userid','userId'],['createdat','createdAt'],['lastseen','lastSeen']])if(lower in row){row[camel]=row[lower];delete row[lower];}return row;}
class Statement {
 values:unknown[]=[];
 constructor(public sql:string){}
 bind(...values:unknown[]){const statement=new Statement(this.sql);statement.values=values;return statement;}
 async first<T=Record<string,unknown>>():Promise<T|null>{const row=(await getPool().query(placeholders(this.sql),this.values)).rows[0];return row?normalize(row) as T:null;}
 async all<T=Record<string,unknown>>():Promise<{results:T[]}>{return {results:(await getPool().query(placeholders(this.sql),this.values)).rows.map(normalize) as T[]};}
 async run(){const result=await getPool().query(placeholders(this.sql),this.values);return {meta:{changes:result.rowCount??0}};}
}
export const database={
 prepare:(sql:string)=>new Statement(sql),
 async batch(statements:Statement[]){const client=await getPool().connect();try{await client.query('BEGIN');const results=[];for(const s of statements)results.push(await client.query(placeholders(s.sql),s.values));await client.query('COMMIT');return results;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
};
