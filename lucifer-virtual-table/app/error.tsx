'use client';
import Link from 'next/link';
import {Flame,RefreshCw} from 'lucide-react';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="account-login"><Flame size={48} color="#c7a775"/><h1>История сделала паузу.</h1><p>Не удалось загрузить стол. Проверьте, запущен ли сервер PostgreSQL, и попробуйте ещё раз.</p><button className="primary" onClick={reset}><RefreshCw size={16}/>Повторить</button><Link className="muted" href="/">Вернуться на главную</Link></div>;}
