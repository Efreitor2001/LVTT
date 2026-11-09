import {getCurrentUser} from '../../lib/server/auth';
import Account from '../../components/account/Account';
export const dynamic='force-dynamic';
export default async function AccountPage(){const user=await getCurrentUser();return <Account user={user?{name:user.displayName,email:user.email}:null}/>;}
