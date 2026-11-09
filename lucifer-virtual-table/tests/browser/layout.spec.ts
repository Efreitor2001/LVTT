import {test,expect} from '@playwright/test';
test('all dialogs fit a short viewport and keep the close control visible',async({page})=>{
 await page.setViewportSize({width:1366,height:650});await page.goto('/');await page.locator('.app-shell[data-ready="true"]').waitFor();
 for(const name of ['Правила системы','Библиотека костей','Журнал кампании','Настройки стола','Горячие клавиши','Настроить сцену']){
  await page.getByRole('button',{name,exact:true}).click();const dialog=page.locator('dialog[open]');await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(8);expect(box!.y+box!.height).toBeLessThanOrEqual(642);expect(box!.x).toBeGreaterThan(0);
  await expect(dialog.getByRole('button',{name:'Закрыть окно'})).toBeInViewport();await dialog.getByRole('button',{name:'Закрыть окно'}).click();
 }
});
test('ping expands at its map location and fullscreen exit restores the scene',async({page})=>{
 await page.goto('/');await page.locator('.app-shell[data-ready="true"]').waitFor();
 const before=await page.locator('.board').boundingBox(),scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));
 await page.getByRole('button',{name:'Полный экран',exact:true}).click();await page.getByRole('button',{name:'Выйти из полного экрана'}).click();
 await expect.poll(async()=>Math.round((await page.locator('.board').boundingBox())!.height)).toBe(Math.round(before!.height));
 expect(await page.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual(scroll);
 await page.getByRole('button',{name:'Указать на карте'}).click();
 const target={x:before!.x+before!.width*.6,y:before!.y+before!.height*.5};await page.mouse.click(target.x,target.y);
 const error=await page.evaluate(async p=>{let max=0;for(let i=0;i<12;i++){const box=document.querySelector('.map-ping')!.getBoundingClientRect();max=Math.max(max,Math.hypot(box.x+box.width/2-p.x,box.y+box.height/2-p.y));await new Promise(r=>setTimeout(r,100));}return max;},target);expect(error).toBeLessThan(2);
});
