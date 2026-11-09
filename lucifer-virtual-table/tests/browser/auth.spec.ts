import {test,expect} from '@playwright/test';
test('registration, password change, logout and login use PostgreSQL sessions',async({page})=>{
 const email='auth-ui-'+crypto.randomUUID()+'@example.test',password='Original-strong-password-2026',next='Changed-strong-password-2026';
 await page.goto('/login');await page.getByRole('button',{name:'Зарегистрироваться',exact:true}).click();
 await page.getByLabel('Имя за столом').fill('Путешественник');
 await page.getByLabel('Электронная почта').fill(email);await page.getByLabel('Пароль',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Создать аккаунт',exact:true}).click();
 await expect(page).toHaveURL(/account/);await expect(page.getByRole('heading',{name:'Путешественник',exact:true})).toBeVisible();
 const cookies=await page.context().cookies();expect(cookies.find(c=>c.name==='lvt_session')?.httpOnly).toBe(true);
 await page.getByRole('button',{name:'Профиль и настройки'}).click();
 await page.getByLabel('Текущий пароль',{exact:true}).fill(password);await page.getByLabel('Новый пароль',{exact:true}).fill(next);
 await page.getByRole('button',{name:'Изменить пароль',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Пароль изменён');
 await page.getByRole('link',{name:'Выйти',exact:true}).click();await expect(page).toHaveURL(/login/);
 await page.getByLabel('Электронная почта').fill(email);await page.getByLabel('Пароль',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.locator('.form-error')).toContainText('Неверная');
 await page.getByLabel('Пароль',{exact:true}).fill(next);await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page).toHaveURL(/account/);
});
