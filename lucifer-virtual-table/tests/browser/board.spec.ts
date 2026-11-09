import {test,expect} from '@playwright/test';
test('selection stays centred on its token over time and zoom',async({page})=>{
 await page.goto('/');await page.locator('.app-shell[data-ready="true"]').waitFor();
 await page.locator('[data-token="aelin"]').click();
 const maximum=await page.evaluate(async()=>{
  let max=0;
  for(let i=0;i<15;i++){const ring=document.querySelector('.selection-ring')!.getBoundingClientRect(),token=document.querySelector('[data-token="aelin"]>circle[r="34"]')!.getBoundingClientRect();max=Math.max(max,Math.hypot(ring.x+ring.width/2-token.x-token.width/2,ring.y+ring.height/2-token.y-token.height/2));await new Promise(r=>setTimeout(r,100));}
  return max;
 });
 expect(maximum).toBeLessThan(1);
 await page.getByRole('button',{name:'Увеличить карту',exact:true}).click();
 const offset=await page.evaluate(()=>{const a=document.querySelector('.selection-ring')!.getBoundingClientRect(),b=document.querySelector('[data-token="aelin"]>circle[r="34"]')!.getBoundingClientRect();return Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2);});
 expect(offset).toBeLessThan(1);
});
test('fullscreen expands the scene, preserves zoom and restores layout',async({page})=>{
 await page.goto('/');await page.locator('.app-shell[data-ready="true"]').waitFor();
 await page.getByRole('button',{name:'Увеличить карту',exact:true}).click();
 const zoom=await page.locator('.zoom-controls>span').innerText(),before=await page.locator('.board').boundingBox();
 await page.getByRole('button',{name:'Полный экран',exact:true}).click();
 await expect(page.locator('.board')).toHaveClass(/board-expanded/);
 await expect(page.locator('.zoom-controls>span')).toHaveText(zoom);
 await expect.poll(async()=>{const r=await page.locator('.board').boundingBox();return Math.round(r!.width);}).toBe(page.viewportSize()!.width);
 await page.getByRole('button',{name:'Выйти из полного экрана',exact:true}).click();
 await expect(page.locator('.board')).not.toHaveClass(/board-expanded/);
 await expect.poll(async()=>Math.round((await page.locator('.board').boundingBox())!.width)).toBe(Math.round(before!.width));
 await expect(page.locator('.zoom-controls>span')).toHaveText(zoom);
});
