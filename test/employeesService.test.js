import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { employeesService } from '../src/services/employeesService.js';
import { employeesRepo } from '../src/repositories/employeesRepo.js';

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-emp-'));
  employeesRepo._store._reset();
});

test('addManual создаёт сотрудника source=manual c salary-заделом', async () => {
  const e = await employeesService.addManual({ name: 'Иван' });
  assert.equal(e.name, 'Иван');
  assert.equal(e.source, 'manual');
  assert.equal(e.b24UserId, null);
  assert.deepEqual(e.salary, { mode: null, flatPercent: null, servicePercents: [] });
});

test('addManual без имени — ValidationError', async () => {
  await assert.rejects(() => employeesService.addManual({ name: '' }), /Укажите имя/);
});

test('importFromB24 создаёт сотрудников из выбранных пользователей', async () => {
  const created = await employeesService.importFromB24([
    { id: 10, name: 'Пётр' },
    { id: 11, name: 'Анна' },
  ]);
  assert.equal(created.length, 2);
  assert.equal(created[0].source, 'b24');
  assert.equal(created[0].b24UserId, 10);
});

test('importFromB24 пропускает уже импортированных по b24UserId', async () => {
  await employeesService.importFromB24([{ id: 10, name: 'Пётр' }]);
  const second = await employeesService.importFromB24([
    { id: 10, name: 'Пётр (обновл.)' },
    { id: 12, name: 'Новый' },
  ]);
  assert.equal(second.length, 1);
  assert.equal(second[0].b24UserId, 12);
  const all = await employeesService.list();
  assert.equal(all.length, 2);
});
