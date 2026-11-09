'use client';
import { useEffect,useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({title,subtitle,onClose,children,wide=false,full=false}:{title:string;subtitle?:string;onClose:()=>void;children:React.ReactNode;wide?:boolean;full?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current,prior=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';d?.showModal();return()=>{d?.close();document.body.style.overflow=overflow;prior?.focus({preventScroll:true});};},[]);
 return <dialog className={`modal ${wide?'wide':''} ${full?'full-modal':''}`} ref={ref} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={title}><div className="modal-heading"><div><span className="eyebrow">LUCIFER VIRTUAL TABLE</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Закрыть окно"><X size={20}/></button></div><div className="modal-content">{children}</div></dialog>;
}
