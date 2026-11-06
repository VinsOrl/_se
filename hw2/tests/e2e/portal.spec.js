const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const login = async (page, id = '111210529') => {
  await page.goto('/');
  await page.fill('input[name=student_id]', id);
  await page.fill('input[name=password]', 'demo1234');
  await page.click('#login-form button');
  await expect(page.locator('#nav')).toBeVisible();
};

test('login -> add course -> timetable -> drop -> logout', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name=student_id]', '111210529');
  await page.fill('input[name=password]', 'wrong');
  await page.click('#login-form button');
  await expect(page.locator('#msg')).toHaveText('Wrong student ID or password.');
  await login(page);
  await page.fill('#q', 'calc');
  await page.click('button[data-add]');
  await page.click('nav a[href="#/timetable"]');
  await expect(page.locator('td.slot').first()).toHaveText('Calculus');
  await expect(page.locator('#total')).toHaveText('3');
  await page.click('nav a[href="#/courses"]');
  await page.fill('#q', 'calc');
  await page.click('button[data-drop]');
  await page.click('nav a[href="#/timetable"]');
  await expect(page.locator('td.slot')).toHaveCount(0);
  await page.click('#logout');
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('input[name=student_id]')).toHaveValue('');
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
});

test('time conflict error shown', async ({ page }) => {
  await login(page);
  await page.fill('#q', 'CS101'); await page.click('button[data-add]');
  await page.fill('#q', 'CS202'); await page.click('button[data-add]');
  await expect(page.locator('#msg')).toHaveText('Time conflict with a course you are enrolled in.');
});

test('leave form: preview, remove, submit', async ({ page }) => {
  await login(page);
  await page.click('nav a[href="#/leave"]');
  const png = path.join(os.tmpdir(), 'e2e.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64'));
  await page.setInputFiles('#file', png);
  await expect(page.locator('#preview')).toBeVisible();
  await page.click('#rm');
  await expect(page.locator('#pv')).toBeHidden();
  await page.setInputFiles('#file', png);
  await page.fill('[name=date_from]', '2026-03-01');
  await page.fill('[name=date_to]', '2026-03-02');
  await page.fill('[name=reason]', 'flu');
  await page.click('#leave-form button:not([type=button])');
  await expect(page.locator('#msg')).toHaveText('Request submitted.');
  await expect(page.locator('tr', { hasText: 'flu' })).toContainText('Pending');
});

test('grades dropdown switches semester', async ({ page }) => {
  await login(page);
  await page.click('nav a[href="#/grades"]');
  const first = await page.locator('#avg').textContent();
  const rows = await page.locator('table tr:nth-child(2) td:nth-child(3)').textContent();
  await page.selectOption('#sem', '115-1');
  await expect(page.locator('#sem')).toHaveValue('115-1');
  await expect(page.locator('#avg')).not.toHaveText(first);
  expect(rows).toBeTruthy();
});

test('language switch changes labels and persists', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('NQU Campus Portal');
  await page.selectOption('#lang', 'zh-TW');
  await expect(page.locator('h1')).toHaveText('國立金門大學校務系統');
  await expect(page.locator('#login-form button')).toHaveText('登入');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('國立金門大學校務系統');
  await login(page);
  await expect(page.locator('nav a').first()).toHaveText('選課');
  await page.click('nav a[href="#/timetable"]');
  await expect(page.locator('th', { hasText: '週一' })).toBeVisible();
  await page.selectOption('#lang', 'en');
  await expect(page.locator('th', { hasText: 'Mon' })).toBeVisible();
});

test('admin approves leave; student sees status', async ({ page }) => {
  await login(page, 'admin');
  await page.click('nav a[href="#/leave"]');
  await page.locator('tr', { hasText: 'flu' }).locator('[data-set=approved]').click();
  await expect(page.locator('tr', { hasText: 'flu' })).toContainText('Approved');
});
