import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRepository } from '../src/repositories/createRepository.js';

let repo;
beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-repo-'));
  repo = createRepository('things.json');
  repo._store._reset();
});

test('create проставляет id и таймстемпы', async () => {
  const item = await repo.create({ name: 'a' });
  assert.ok(item.id);
  assert.equal(item.name, 'a');
  assert.ok(item.createdAt);
  assert.equal(item.createdAt, item.updatedAt);
});

test('list возвращает созданные элементы', async () => {
  await repo.create({ name: 'a' });
  await repo.create({ name: 'b' });
  assert.equal((await repo.list()).length, 2);
});

test('update мержит патч, меняет updatedAt, сохраняет id', async () => {
  const a = await repo.create({ name: 'a' });
  const upd = await repo.update(a.id, { name: 'b' });
  assert.equal(upd.id, a.id);
  assert.equal(upd.name, 'b');
  assert.equal(upd.createdAt, a.createdAt);
});

test('update несуществующего возвращает null', async () => {
  assert.equal(await repo.update('нет', { name: 'x' }), null);
});

test('remove возвращает true/false', async () => {
  const a = await repo.create({ name: 'a' });
  assert.equal(await repo.remove(a.id), true);
  assert.equal(await repo.remove(a.id), false);
});
