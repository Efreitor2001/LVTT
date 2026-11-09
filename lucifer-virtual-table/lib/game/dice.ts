import type { CustomDie, RollGroup, RollItem, RollResult } from './types';

export class DiceError extends Error {}
export function secureInt(sides: number): number {
  if (!Number.isSafeInteger(sides) || sides < 2 || sides > 1_000_000_000) throw new DiceError('Число граней: от 2 до 1 000 000 000');
  const limit = Math.floor(0x100000000 / sides) * sides;
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= limit);
  return (data[0] % sides) + 1;
}
type Compare = (v: number) => boolean;
export function rollDice(formula: string, custom: CustomDie[] = [], cancellations: [string,string][] = [], random: (sides: number) => number = secureInt): RollResult {
  const input = formula.trim().replace(/\s+/g, '').replace(/d%/gi, 'd100');
  if (!input || input.length > 300) throw new DiceError('Формула должна содержать от 1 до 300 символов');
  let pos = 0, budget = 0, depth = 0;
  const groups: RollGroup[] = [];
  const symbols: Record<string, number> = Object.create(null);
  const peek = (pattern: RegExp) => input.slice(pos).match(pattern);
  const readNumber = () => { const m = peek(/^\d+/); if (!m) throw new DiceError(`Ожидалось число, позиция ${pos + 1}`); pos += m[0].length; return Number(m[0]); };
  function comparator(): Compare {
    const m = peek(/^(>=|<=|=|>|<)(-?\d+)/);
    if (!m) throw new DiceError('Укажите условие, например >=5');
    pos += m[0].length; const n = Number(m[2]);
    return (v) => m[1] === '>=' ? v >= n : m[1] === '<=' ? v <= n : m[1] === '>' ? v > n : m[1] === '<' ? v < n : v === n;
  }
  function dice(count: number): number {
    const start = pos; pos++;
    let faces: CustomDie['faces'] | undefined, sides = 0;
    if (/f/i.test(input[pos] ?? '')) { pos++; faces = [{label:'−',value:-1},{label:'0',value:0},{label:'+',value:1}]; sides = 3; }
    else if (input[pos] === '[') { const end = input.indexOf(']', pos); if (end < 0) throw new DiceError('Закройте имя кости: d[имя]'); const id = input.slice(pos+1,end); pos = end+1; faces = custom.find(d => d.id === id)?.faces; if (!faces || faces.length < 2) throw new DiceError(`Неизвестная кость: ${id}`); sides = faces.length; }
    else { sides = readNumber(); if (sides < 2 || sides > 1_000_000_000) throw new DiceError('Число граней: от 2 до 1 000 000 000'); }
    if (count < 1 || count > 200 || !Number.isInteger(count)) throw new DiceError('В одной группе допускается от 1 до 200 костей');
    const baseEnd = pos;
    let explode: Compare | undefined, reroll: Compare | undefined, once = false, keep: {mode:string;n:number} | undefined, success: Compare | undefined, failure: Compare | undefined;
    const seen = new Set<string>();
    while (pos < input.length) {
      let modifier = '';
      if (input[pos] === '!') { modifier = '!'; pos++; explode = /^[<>=]/.test(input[pos] ?? '') ? comparator() : (v) => v === (faces ? Math.max(...faces.map(f=>f.value)) : sides); }
      else if (peek(/^ro?/i)) { const m=peek(/^ro?/i)!; modifier='r'; pos+=m[0].length; once=m[0].toLowerCase()==='ro'; reroll=comparator(); }
      else if (peek(/^(kh|kl|dh|dl)/i)) { const m=peek(/^(kh|kl|dh|dl)/i)!; modifier='keep'; pos+=2; keep={mode:m[0].toLowerCase(),n:readNumber()}; if (keep.n>200) throw new DiceError('Слишком много сохраняемых костей'); }
      else if (peek(/^cs/i)) { modifier='success'; pos+=2; success=comparator(); }
      else if (peek(/^cf/i)) { modifier='failure'; pos+=2; failure=comparator(); }
      else if (/^[<>=]/.test(input[pos])) { modifier='success'; success=comparator(); }
      else break;
      if (seen.has(modifier)) throw new DiceError('Модификатор указан повторно'); seen.add(modifier);
    }
    const items: RollItem[] = [];
    const draw = (): RollItem => { if (++budget > 1000) throw new DiceError('Превышен предел 1000 бросков: проверьте взрывы и перебросы'); const index = random(sides); if (!Number.isInteger(index) || index<1 || index>sides) throw new DiceError('Некорректный источник случайности'); const f=faces?.[index-1]; return {value:f?.value ?? index,label:f?.label ?? String(index),symbols:f?.symbols}; };
    for (let i=0;i<count;i++) {
      let item=draw(), retries=0;
      while (reroll?.(item.value) && (!once || retries === 0)) { items.push({...item,dropped:true,rerolled:true}); item=draw(); retries++; }
      items.push(item);
      while (explode?.(item.value)) { item={...draw(),exploded:true}; items.push(item); }
    }
    const active=items.filter(d=>!d.dropped);
    if (keep) { const sorted=[...active].sort((a,b)=>a.value-b.value); const n=Math.min(keep.n,sorted.length); const retained = keep.mode==='kh' ? sorted.slice(-n || sorted.length) : keep.mode==='kl' ? sorted.slice(0,n) : keep.mode==='dh' ? sorted.slice(0,sorted.length-n) : sorted.slice(n); const set=new Set(retained); active.forEach(d=>{ if(!set.has(d))d.dropped=true; }); }
    const total = items.filter(d=>!d.dropped).reduce((sum,d)=> { for(const [k,v] of Object.entries(d.symbols ?? {})) symbols[k]=(symbols[k]??0)+v; return sum + (success ? Number(success(d.value)) - Number(failure?.(d.value) ?? false) : d.value); },0);
    groups.push({notation:`${count}${input.slice(start,baseEnd)}`,items,total,successes:!!success}); return total;
  }
  function primary(): number {
    if (++depth > 30) throw new DiceError('Слишком глубокая вложенность');
    let v: number;
    if(input[pos]==='(') { pos++; v=expression(); if(input[pos++]!==')')throw new DiceError('Не закрыта скобка'); }
    else if(input[pos]==='+' || input[pos]==='-') { const sign=input[pos++]; v=primary()*(sign==='-'?-1:1); }
    else if (/d/i.test(input[pos]??'')) v=dice(1);
    else { v=readNumber(); if (/d/i.test(input[pos]??'')) v=dice(v); }
    depth--; return v;
  }
  function product(): number { let v=primary(); while(input[pos]==='*'||input[pos]==='/') { const op=input[pos++], rhs=primary(); if(op==='/' && rhs===0)throw new DiceError('Деление на ноль'); v=op==='*'?v*rhs:v/rhs; } return v; }
  function expression(): number { let v=product(); while(input[pos]==='+'||input[pos]==='-') { const op=input[pos++],rhs=product(); v=op==='+'?v+rhs:v-rhs; } return v; }
  const total=expression();
  if(pos!==input.length) throw new DiceError(`Неизвестный символ «${input[pos]}», позиция ${pos+1}`);
  if(!Number.isFinite(total)||Math.abs(total)>Number.MAX_SAFE_INTEGER)throw new DiceError('Результат выходит за допустимый диапазон');
  for(const [a,b] of cancellations) {const n=Math.min(symbols[a]??0,symbols[b]??0); if(n>0){symbols[a]-=n;symbols[b]-=n;} }
  return {formula,total,groups,symbols:Object.fromEntries(Object.entries(symbols).filter(([,v])=>v!==0))};
}
