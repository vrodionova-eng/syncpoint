import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workPointsService } from '../src/services/workPointsService.js';
import { spacesService } from '../src/services/spacesService.js';
import { spacesRepo } from '../src/repositories/spacesRepo.js';
import { workPointsRepo } from '../src/repositories/workPointsRepo.js';

let space;
beforeEach(async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-wp-'));
  spacesRepo._store._reset();
  workPointsRepo._store._reset();
  space = await spacesService.create({ name: 'Пост 1' });
});

test('create требует существующее пространство', async () => {
  const wp = await workPointsService.create({ name: 'Точка A', spaceId: space.id });
  assert.equal(wp.spaceId, space.id);
});

test('create с несуществующим spaceId — ValidationError', async () => {
  await assert.rejects(
    () => workPointsService.create({ name: 'X', spaceId: 'нет' }),
    /Пространство не найдено/,
  );
});

test('create без имени — ValidationError', async () => {
  await assert.rejects(() => workPointsService.create({ name: '', spaceId: space.id }), /Укажите название/);
});
