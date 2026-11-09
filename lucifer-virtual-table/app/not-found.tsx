import Link from 'next/link';
import {Flame} from 'lucide-react';
export default function NotFound(){return <div className="account-login"><Flame size={48} color="#c7a775"/><span className="eyebrow">404 / НЕИЗВЕСТНЫЕ ЗЕМЛИ</span><h1>Этой главы пока нет.</h1><p>Страница не найдена. Ваши кампании ждут в личном кабинете.</p><a className="primary" href="/account">К моим кампаниям</a><Link className="muted" href="/">За игровой стол</Link></div>;}
