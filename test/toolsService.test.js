import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toolsService } from '../src/services/toolsService.js';
import { spacesService } from '../src/services/spacesService.js';
import { spacesRepo } from '../src/repositories/spacesRepo.js';
import { toolsRepo } from '../src/repositories/toolsRepo.js';
import { toolInstancesRepo } from '../src/repositories/toolInstancesRepo.js';

let spaceA, spaceB;
beforeEach(async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-tools-'));
  spacesRepo._store._reset();
  toolsRepo._store._reset();
  toolInstancesRepo._store._reset();
  spaceA = await spacesService.create({ name: 'A' });
  spaceB = await spacesService.create({ name: 'B' });
});

test('createWithDistribution создаёт инструмент и экземпляры по пространствам', async () => {
  const { tool, instances } = await toolsService.createWithDistribution({
    name: 'Фен',
    distribution: [
      { spaceId: spaceA.id, count: 2 },
      { spaceId: spaceB.id, count: 4 },
    ],
  });
  assert.equal(tool.name, 'Фен');
  assert.equal(instances.length, 6);
  assert.equal(instances.filter((i) => i.spaceId === spaceA.id).length, 2);
  assert.equal(instances.filter((i) => i.spaceId === spaceB.id).length, 4);
  instances.forEach((i) => assert.equal(i.toolId, tool.id));
});

test('строка распределения без пространства даёт общие экземпляры (spaceId=null)', async () => {
  const { instances } = await toolsService.createWithDistribution({
    name: 'Пылесос',
    distribution: [{ spaceId: null, count: 1 }],
  });
  assert.equal(instances.length, 1);
  assert.equal(instances[0].spaceId, null);
});

test('распределение со ссылкой на несуществующее пространство — ValidationError', async () => {
  await assert.rejects(
    () => toolsService.createWithDistribution({ name: 'Х', distribution: [{ spaceId: 'нет', count: 1 }] }),
    /Пространство не найдено/,
  );
});

test('createWithDistribution без имени — ValidationError', async () => {
  await assert.rejects(
    () => toolsService.createWithDistribution({ name: '', distribution: [] }),
    /Укажите название/,
  );
});

test('addInstance добавляет один экземпляр существующему инструменту', async () => {
  const { tool } = await toolsService.createWithDistribution({ name: 'Фен', distribution: [] });
  const inst = await toolsService.addInstance({ toolId: tool.id, spaceId: spaceA.id });
  assert.equal(inst.toolId, tool.id);
  assert.equal(inst.spaceId, spaceA.id);
});

test('addInstance для несуществующего инструмента — ValidationError', async () => {
  await assert.rejects(
    () => toolsService.addInstance({ toolId: 'нет', spaceId: null }),
    /Инструмент не найден/,
  );
});
