import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonStore } from '../src/storage/jsonStore.js';

let store;
beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-store-'));
  store = createJsonStore('things.json');
  store._reset();
});

test('пустой стор отдаёт пустой массив', async () => {
  assert.deepEqual(await store.all(), []);
});

test('set сохраняет и возвращает элемент, get читает по id', async () => {
  await store.set({ id: '1', name: 'a' });
  assert.deepEqual(await store.get('1'), { id: '1', name: 'a' });
  assert.equal(await store.get('нет'), null);
});

test('данные пишутся на диск в виде массива', async () => {
  await store.set({ id: '1', name: 'a' });
  const file = join(process.env.DATA_DIR, 'things.json');
  assert.ok(existsSync(file));
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), [{ id: '1', name: 'a' }]);
});

test('delete удаляет, возвращает true/false', async () => {
  await store.set({ id: '1', name: 'a' });
  assert.equal(await store.delete('1'), true);
  assert.equal(await store.delete('1'), false);
  assert.deepEqual(await store.all(), []);
});

test('новый стор читает ранее записанный файл', async () => {
  await store.set({ id: '1', name: 'a' });
  const store2 = createJsonStore('things.json');
  store2._reset();
  assert.deepEqual(await store2.get('1'), { id: '1', name: 'a' });
});
