import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spacesService } from '../src/services/spacesService.js';
import { spacesRepo } from '../src/repositories/spacesRepo.js';

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-spaces-'));
  spacesRepo._store._reset();
});

test('create создаёт пространство с обрезанным именем', async () => {
  const s = await spacesService.create({ name: '  Пост 1  ' });
  assert.equal(s.name, 'Пост 1');
});

test('create с пустым именем — ValidationError', async () => {
  await assert.rejects(() => spacesService.create({ name: '   ' }), /Укажите название/);
});

test('get несуществующего — NotFoundError (status 404)', async () => {
  await assert.rejects(() => spacesService.get('нет'), (e) => e.status === 404);
});

test('remove несуществующего — NotFoundError', async () => {
  await assert.rejects(() => spacesService.remove('нет'), (e) => e.status === 404);
});
