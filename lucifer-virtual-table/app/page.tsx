import { getCurrentUser } from '../lib/server/auth';
import Table from '../components/table/Table';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getCurrentUser();return <Table user={user?{id:user.userId,name:user.displayName}:null}/>;}
