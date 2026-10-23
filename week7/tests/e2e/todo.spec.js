'use strict';

const { test, expect } = require('@playwright/test');

// The server keeps todos in memory, so wipe them through the API before each test.
test.beforeEach(async ({ page, request }) => {
  const todos = await (await request.get('/api/todos')).json();
  for (const t of todos) await request.delete(`/api/todos/${t.id}`);
  await page.goto('/');
});

async function addTodo(page, title) {
  await page.getByLabel('New todo title').fill(title);
  await page.getByRole('button', { name: 'Add' }).click();
}

test('page loads with an empty list', async ({ page }) => {
  await expect(page).toHaveTitle('Todo App');
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
  await expect(page.locator('#count')).toHaveText('0 items left');
});

test('adding a todo shows it in the list and updates the counter', async ({ page }) => {
  await addTodo(page, 'Write e2e tests');
  await expect(page.locator('#todo-list li')).toHaveCount(1);
  await expect(page.locator('#todo-list li .title')).toHaveText('Write e2e tests');
  await expect(page.locator('#count')).toHaveText('1 item left');
  await expect(page.getByLabel('New todo title')).toHaveValue('');
});

test('submitting an empty title shows a validation error', async ({ page }) => {
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('alert')).toHaveText('title must not be empty');
  await expect(page.locator('#todo-list li')).toHaveCount(0);
});

test('completing a todo strikes it through and updates the counter', async ({ page }) => {
  await addTodo(page, 'one');
  await addTodo(page, 'two');
  await expect(page.locator('#count')).toHaveText('2 items left');

  await page.getByLabel('Toggle one').check();
  await expect(page.locator('#todo-list li.done .title')).toHaveText('one');
  await expect(page.locator('#count')).toHaveText('1 item left');
});

test('filters show the right subsets', async ({ page }) => {
  await addTodo(page, 'active task');
  await addTodo(page, 'finished task');
  await page.getByLabel('Toggle finished task').check();

  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await expect(page.locator('#todo-list li')).toHaveCount(1);
  await expect(page.locator('#todo-list .title')).toHaveText('active task');

  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('#todo-list li')).toHaveCount(1);
  await expect(page.locator('#todo-list .title')).toHaveText('finished task');

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('#todo-list li')).toHaveCount(2);
});

test('deleting a todo removes it', async ({ page }) => {
  await addTodo(page, 'temporary');
  await page.getByRole('button', { name: 'Delete temporary' }).click();
  await expect(page.locator('#todo-list li')).toHaveCount(0);
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
});

test('clear completed removes only completed todos', async ({ page }) => {
  await addTodo(page, 'keep me');
  await addTodo(page, 'remove me');
  await page.getByLabel('Toggle remove me').check();

  await page.getByRole('button', { name: 'Clear completed' }).click();
  await expect(page.locator('#todo-list li')).toHaveCount(1);
  await expect(page.locator('#todo-list .title')).toHaveText('keep me');
});

test('todos persist across a page reload (stored on the server)', async ({ page }) => {
  await addTodo(page, 'survive reload');
  await page.reload();
  await expect(page.locator('#todo-list .title')).toHaveText('survive reload');
});
