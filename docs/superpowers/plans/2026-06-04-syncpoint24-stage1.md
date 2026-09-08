# SyncPoint24 — Этап 1 (Справочники и каркас). План реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочее приложение внутри Битрикс24 (пункт левого меню) с бэкендом на Express, хранилищем в JSON-файлах и пятью справочниками: Пространства, Рабочие точки, Инструменты (с экземплярами), Услуги, Сотрудники.

**Architecture:** Слои — тонкие routers (`src/routes`) → сервисы с валидацией (`src/services`) → репозитории-синглтоны поверх generic JSON-стора (`src/repositories` + `src/storage`). Репозитории — листовые модули без зависимостей (чтобы не было циклов); FK-проверки и ссылочная целостность живут в сервисах, импортирующих нужные репозитории. Фронтенд — vanilla JS: один generic CRUD-компонент + конфиг на каждую вкладку.

**Tech Stack:** Node.js 20 (ES modules), Express 4, dotenv. Тесты — встроенный `node --test` + `node:assert/strict` (без новых зависимостей). Фронтенд — vanilla JS + CSS, тема Б24.

**Спек:** `docs/superpowers/specs/2026-06-04-syncpoint24-stage1-design.md`

**Глобальные соглашения:**
- Формат ответа API: успех `{ ok: true, data }`, ошибка `{ ok: false, error: { message, code } }`.
- id — `newId()` (16 hex-символов). У всех сущностей `createdAt`, `updatedAt` (ISO).
- Каталог данных — `process.env.DATA_DIR` (по умолчанию `./data`; на проде `/opt/data`).
- Фронтенд зовёт API относительными путями (`api/spaces`), без ведущего `/`.

---

## Файловая структура (создаётся за Этап 1)

```
src/
  lib/
    id.js                  ← newId()
    errors.js              ← классы ошибок (Validation/Conflict/NotFound) + статусы
  storage/
    jsonStore.js           ← generic стор: load/persist Map, атомарная запись
  repositories/
    createRepository.js    ← фабрика CRUD поверх jsonStore
    spacesRepo.js          ← синглтон-репозиторий 'spaces.json'
    workPointsRepo.js
    toolsRepo.js
    toolInstancesRepo.js
    servicesRepo.js
    employeesRepo.js
  services/
    spacesService.js
    workPointsService.js
    toolsService.js        ← создание инструмента + экземпляры по распределению
    servicesService.js     ← Услуги: цена по режиму, составные, requiredToolIds
    employeesService.js    ← ручные + импорт из Б24 с дедупликацией
  b24/
    users.js               ← получение пользователей портала через vibe()
  routes/
    crudRouter.js          ← фабрика router'а + asyncH + ok()
    spaces.js  workPoints.js  tools.js  toolInstances.js  services.js  employees.js
    b24.js                 ← GET /api/b24/users
  server.js                ← (модификация) монтаж роутеров, error-middleware, SPA
  public/
    index.html             ← (перезапись) каркас SPA с вкладками
    css/theme-b24.css
    js/
      api.js               ← fetch-обёртка (относительные пути, {ok,data})
      ui.js                ← helpers: el(), modal, crudView (generic)
      app.js               ← навигация по вкладкам, инициализация
      views/
        spaces.js  workPoints.js  tools.js  services.js  employees.js
test/
  helpers.js               ← временный DATA_DIR + сброс кэша сторов
  *.test.js                ← по файлу на сервис/слой
```

---

## Task 1: Тест-раннер, id и ошибки

**Files:**
- Modify: `package.json` (скрипт `test`)
- Create: `src/lib/id.js`
- Create: `src/lib/errors.js`
- Test: `test/lib.test.js`

- [ ] **Step 1: Добавить скрипт тестов в package.json**

В объект `scripts` добавь строку (после `"check"`):

```json
    "test": "node --test",
```

- [ ] **Step 2: Написать падающий тест**

Создай `test/lib.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../src/lib/id.js';
import { ValidationError, ConflictError, NotFoundError } from '../src/lib/errors.js';

test('newId возвращает уникальные строки', () => {
  const a = newId();
  const b = newId();
  assert.equal(typeof a, 'string');
  assert.ok(a.length >= 8);
  assert.notEqual(a, b);
});

test('ошибки несут message, code и http-статус', () => {
  const v = new ValidationError('Укажите название');
  assert.equal(v.status, 400);
  assert.equal(v.code, 'VALIDATION');
  assert.equal(v.message, 'Укажите название');

  assert.equal(new ConflictError('занято').status, 409);
  assert.equal(new NotFoundError().status, 404);
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/id.js'`

- [ ] **Step 4: Реализовать id.js**

Создай `src/lib/id.js`:

```js
import { randomBytes } from 'node:crypto';

/** Короткий случайный id (16 hex-символов). */
export function newId() {
  return randomBytes(8).toString('hex');
}
```

- [ ] **Step 5: Реализовать errors.js**

Создай `src/lib/errors.js`:

```js
/** Базовая ошибка приложения с http-статусом и кодом. */
export class AppError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION') { super(message, code, 400); }
}

export class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') { super(message, code, 409); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Не найдено', code = 'NOT_FOUND') { super(message, code, 404); }
}
```

- [ ] **Step 6: Запустить тест — убедиться, что проходит**

Run: `npm test`
Expected: PASS (2 теста)

- [ ] **Step 7: Commit**

```bash
git add package.json src/lib/id.js src/lib/errors.js test/lib.test.js
git commit -m "feat: lib для id и ошибок + тест-раннер node:test"
```

---

## Task 2: JSON-стор (хранилище)

**Files:**
- Create: `src/storage/jsonStore.js`
- Test: `test/jsonStore.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/jsonStore.test.js`:

```js
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/storage/jsonStore.js'`

- [ ] **Step 3: Реализовать jsonStore.js**

Создай `src/storage/jsonStore.js`:

```js
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function dataDir() {
  return process.env.DATA_DIR || './data';
}

/**
 * Generic стор поверх одного JSON-файла.
 * Держит данные в Map (кэш), пишет атомарно через temp + rename.
 * @param {string} fileName — например 'spaces.json'
 */
export function createJsonStore(fileName) {
  const filePath = () => join(dataDir(), fileName);
  let cache = null;

  async function load() {
    if (cache) return cache;
    cache = new Map();
    const p = filePath();
    if (existsSync(p)) {
      const raw = await readFile(p, 'utf8');
      const arr = JSON.parse(raw || '[]');
      for (const item of arr) cache.set(item.id, item);
    }
    return cache;
  }

  async function persist() {
    await mkdir(dataDir(), { recursive: true });
    const tmp = filePath() + '.tmp';
    await writeFile(tmp, JSON.stringify([...cache.values()], null, 2));
    await rename(tmp, filePath());
  }

  return {
    async all() { return [...(await load()).values()]; },
    async get(id) { return (await load()).get(id) ?? null; },
    async set(item) { (await load()).set(item.id, item); await persist(); return item; },
    async delete(id) {
      const m = await load();
      const ok = m.delete(id);
      if (ok) await persist();
      return ok;
    },
    /** Сбросить кэш (для тестов и смены DATA_DIR). */
    _reset() { cache = null; },
  };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS (все тесты jsonStore + Task 1)

- [ ] **Step 5: Commit**

```bash
git add src/storage/jsonStore.js test/jsonStore.test.js
git commit -m "feat: generic JSON-стор с атомарной записью"
```

---

## Task 3: Фабрика репозиториев + репозитории сущностей

**Files:**
- Create: `src/repositories/createRepository.js`
- Create: `src/repositories/spacesRepo.js`, `workPointsRepo.js`, `toolsRepo.js`, `toolInstancesRepo.js`, `servicesRepo.js`, `employeesRepo.js`
- Test: `test/repository.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/repository.test.js`:

```js
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/repositories/createRepository.js'`

- [ ] **Step 3: Реализовать createRepository.js**

Создай `src/repositories/createRepository.js`:

```js
import { newId } from '../lib/id.js';
import { createJsonStore } from '../storage/jsonStore.js';

const now = () => new Date().toISOString();

/**
 * CRUD-репозиторий поверх JSON-стора. Без валидации — она в сервисах.
 * @param {string} fileName
 */
export function createRepository(fileName) {
  const store = createJsonStore(fileName);
  return {
    list: () => store.all(),
    get: (id) => store.get(id),
    async create(data) {
      const ts = now();
      return store.set({ id: newId(), ...data, createdAt: ts, updatedAt: ts });
    },
    async update(id, patch) {
      const existing = await store.get(id);
      if (!existing) return null;
      return store.set({ ...existing, ...patch, id, updatedAt: now() });
    },
    remove: (id) => store.delete(id),
    /** доступ к стору для тестов (сброс кэша) */
    _store: store,
  };
}
```

- [ ] **Step 4: Реализовать репозитории сущностей**

Создай шесть файлов-синглтонов.

`src/repositories/spacesRepo.js`:
```js
import { createRepository } from './createRepository.js';
export const spacesRepo = createRepository('spaces.json');
```

`src/repositories/workPointsRepo.js`:
```js
import { createRepository } from './createRepository.js';
export const workPointsRepo = createRepository('work-points.json');
```

`src/repositories/toolsRepo.js`:
```js
import { createRepository } from './createRepository.js';
export const toolsRepo = createRepository('tools.json');
```

`src/repositories/toolInstancesRepo.js`:
```js
import { createRepository } from './createRepository.js';
export const toolInstancesRepo = createRepository('tool-instances.json');
```

`src/repositories/servicesRepo.js`:
```js
import { createRepository } from './createRepository.js';
export const servicesRepo = createRepository('services.json');
```

`src/repositories/employeesRepo.js`:
```js
import { createRepository } from './createRepository.js';
export const employeesRepo = createRepository('employees.json');
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/repositories/
git add test/repository.test.js
git commit -m "feat: фабрика репозиториев и синглтоны сущностей"
```

---

## Task 4: Сервис и роутер «Пространства» + общий crudRouter

**Files:**
- Create: `src/services/spacesService.js`
- Create: `src/routes/crudRouter.js`
- Create: `src/routes/spaces.js`
- Test: `test/spacesService.test.js`

- [ ] **Step 1: Написать падающий тест сервиса**

Создай `test/spacesService.test.js`:

```js
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/services/spacesService.js'`

- [ ] **Step 3: Реализовать spacesService.js**

Создай `src/services/spacesService.js`:

```js
import { spacesRepo } from '../repositories/spacesRepo.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

function cleanName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Укажите название');
  }
  return name.trim();
}

export const spacesService = {
  list: () => spacesRepo.list(),
  async get(id) {
    const s = await spacesRepo.get(id);
    if (!s) throw new NotFoundError('Пространство не найдено');
    return s;
  },
  create: ({ name }) => spacesRepo.create({ name: cleanName(name) }),
  async update(id, { name }) {
    const s = await spacesRepo.update(id, { name: cleanName(name) });
    if (!s) throw new NotFoundError('Пространство не найдено');
    return s;
  },
  async remove(id) {
    // Ссылочная целостность добавляется в Task 9.
    const ok = await spacesRepo.remove(id);
    if (!ok) throw new NotFoundError('Пространство не найдено');
    return { id };
  },
};
```

- [ ] **Step 4: Реализовать crudRouter.js**

Создай `src/routes/crudRouter.js`:

```js
import { Router } from 'express';

/** Оборачивает async-хендлер, прокидывает ошибки в error-middleware. */
export function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
}

/** Успешный ответ в едином формате. */
export function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

/**
 * Строит стандартный CRUD-router из сервиса
 * с методами list/get/create/update/remove.
 */
export function crudRouter(service) {
  const r = Router();
  r.get('/', asyncH(async (req, res) => ok(res, await service.list())));
  r.get('/:id', asyncH(async (req, res) => ok(res, await service.get(req.params.id))));
  r.post('/', asyncH(async (req, res) => ok(res, await service.create(req.body), 201)));
  r.put('/:id', asyncH(async (req, res) => ok(res, await service.update(req.params.id, req.body))));
  r.delete('/:id', asyncH(async (req, res) => ok(res, await service.remove(req.params.id))));
  return r;
}
```

- [ ] **Step 5: Реализовать routes/spaces.js**

Создай `src/routes/spaces.js`:

```js
import { crudRouter } from './crudRouter.js';
import { spacesService } from '../services/spacesService.js';

export default crudRouter(spacesService);
```

- [ ] **Step 6: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/spacesService.js src/routes/crudRouter.js src/routes/spaces.js test/spacesService.test.js
git commit -m "feat: сервис и роутер Пространств + общий crudRouter"
```

---

## Task 5: Сервис и роутер «Рабочие точки» (FK на пространство)

**Files:**
- Create: `src/services/workPointsService.js`
- Create: `src/routes/workPoints.js`
- Test: `test/workPointsService.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/workPointsService.test.js`:

```js
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/services/workPointsService.js'`

- [ ] **Step 3: Реализовать workPointsService.js**

Создай `src/services/workPointsService.js`:

```js
import { workPointsRepo } from '../repositories/workPointsRepo.js';
import { spacesRepo } from '../repositories/spacesRepo.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

function cleanName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Укажите название');
  }
  return name.trim();
}

async function requireSpace(spaceId) {
  if (!spaceId) throw new ValidationError('Выберите пространство');
  if (!(await spacesRepo.get(spaceId))) throw new ValidationError('Пространство не найдено');
}

export const workPointsService = {
  list: () => workPointsRepo.list(),
  async get(id) {
    const wp = await workPointsRepo.get(id);
    if (!wp) throw new NotFoundError('Рабочая точка не найдена');
    return wp;
  },
  async create({ name, spaceId }) {
    const n = cleanName(name);
    await requireSpace(spaceId);
    return workPointsRepo.create({ name: n, spaceId });
  },
  async update(id, { name, spaceId }) {
    const n = cleanName(name);
    await requireSpace(spaceId);
    const wp = await workPointsRepo.update(id, { name: n, spaceId });
    if (!wp) throw new NotFoundError('Рабочая точка не найдена');
    return wp;
  },
  async remove(id) {
    const ok = await workPointsRepo.remove(id);
    if (!ok) throw new NotFoundError('Рабочая точка не найдена');
    return { id };
  },
};
```

- [ ] **Step 4: Реализовать routes/workPoints.js**

Создай `src/routes/workPoints.js`:

```js
import { crudRouter } from './crudRouter.js';
import { workPointsService } from '../services/workPointsService.js';

export default crudRouter(workPointsService);
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/workPointsService.js src/routes/workPoints.js test/workPointsService.test.js
git commit -m "feat: сервис и роутер Рабочих точек с FK на пространство"
```

---

## Task 6: Инструменты + Экземпляры (создание по распределению, CRUD экземпляров)

**Files:**
- Create: `src/services/toolsService.js`
- Create: `src/routes/tools.js`
- Create: `src/routes/toolInstances.js`
- Test: `test/toolsService.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/toolsService.test.js`:

```js
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/services/toolsService.js'`

- [ ] **Step 3: Реализовать toolsService.js**

Создай `src/services/toolsService.js`:

```js
import { toolsRepo } from '../repositories/toolsRepo.js';
import { toolInstancesRepo } from '../repositories/toolInstancesRepo.js';
import { spacesRepo } from '../repositories/spacesRepo.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

function cleanName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Укажите название');
  }
  return name.trim();
}

async function requireSpaceOrNull(spaceId) {
  if (spaceId === null || spaceId === undefined) return null;
  if (!(await spacesRepo.get(spaceId))) throw new ValidationError('Пространство не найдено');
  return spaceId;
}

async function requireTool(toolId) {
  const t = await toolsRepo.get(toolId);
  if (!t) throw new ValidationError('Инструмент не найден');
  return t;
}

export const toolsService = {
  list: () => toolsRepo.list(),
  async get(id) {
    const t = await toolsRepo.get(id);
    if (!t) throw new NotFoundError('Инструмент не найден');
    return t;
  },
  /** Создать инструмент. Тело { name } — без экземпляров (для PUT-совместимости). */
  create: ({ name }) => toolsRepo.create({ name: cleanName(name) }),
  /** Создать инструмент + N экземпляров по распределению пространств. */
  async createWithDistribution({ name, distribution = [] }) {
    const n = cleanName(name);
    // Сначала валидируем все пространства, потом создаём — чтобы не плодить мусор.
    const normalized = [];
    for (const row of distribution) {
      const spaceId = await requireSpaceOrNull(row.spaceId ?? null);
      const count = Number(row.count) || 0;
      if (count < 0) throw new ValidationError('Количество не может быть отрицательным');
      normalized.push({ spaceId, count });
    }
    const tool = await toolsRepo.create({ name: n });
    const instances = [];
    for (const { spaceId, count } of normalized) {
      for (let i = 0; i < count; i++) {
        instances.push(await toolInstancesRepo.create({ toolId: tool.id, spaceId, label: null }));
      }
    }
    return { tool, instances };
  },
  async update(id, { name }) {
    const t = await toolsRepo.update(id, { name: cleanName(name) });
    if (!t) throw new NotFoundError('Инструмент не найден');
    return t;
  },
  async remove(id) {
    // Ссылочная целостность — Task 9.
    const ok = await toolsRepo.remove(id);
    if (!ok) throw new NotFoundError('Инструмент не найден');
    return { id };
  },

  // --- Экземпляры ---
  listInstances: () => toolInstancesRepo.list(),
  async addInstance({ toolId, spaceId = null, label = null }) {
    await requireTool(toolId);
    const s = await requireSpaceOrNull(spaceId);
    return toolInstancesRepo.create({ toolId, spaceId: s, label });
  },
  async updateInstance(id, { spaceId, label }) {
    const s = await requireSpaceOrNull(spaceId ?? null);
    const inst = await toolInstancesRepo.update(id, { spaceId: s, label: label ?? null });
    if (!inst) throw new NotFoundError('Экземпляр не найден');
    return inst;
  },
  async removeInstance(id) {
    const ok = await toolInstancesRepo.remove(id);
    if (!ok) throw new NotFoundError('Экземпляр не найден');
    return { id };
  },
};
```

- [ ] **Step 4: Реализовать routes/tools.js**

Создай `src/routes/tools.js`:

```js
import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { toolsService } from '../services/toolsService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await toolsService.list())));
r.get('/:id', asyncH(async (req, res) => ok(res, await toolsService.get(req.params.id))));

// POST создаёт инструмент сразу с распределением экземпляров.
r.post('/', asyncH(async (req, res) =>
  ok(res, await toolsService.createWithDistribution(req.body), 201)));

r.put('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.update(req.params.id, req.body))));
r.delete('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.remove(req.params.id))));

export default r;
```

- [ ] **Step 5: Реализовать routes/toolInstances.js**

Создай `src/routes/toolInstances.js`:

```js
import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { toolsService } from '../services/toolsService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await toolsService.listInstances())));
r.post('/', asyncH(async (req, res) => ok(res, await toolsService.addInstance(req.body), 201)));
r.put('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.updateInstance(req.params.id, req.body))));
r.delete('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.removeInstance(req.params.id))));

export default r;
```

- [ ] **Step 6: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/toolsService.js src/routes/tools.js src/routes/toolInstances.js test/toolsService.test.js
git commit -m "feat: Инструменты и Экземпляры (создание по распределению, CRUD экземпляров)"
```

---

## Task 7: Услуги (цена по режиму, составные, requiredToolIds)

**Files:**
- Create: `src/services/servicesService.js`
- Create: `src/routes/services.js`
- Test: `test/servicesService.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/servicesService.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servicesService } from '../src/services/servicesService.js';
import { toolsService } from '../src/services/toolsService.js';
import { servicesRepo } from '../src/repositories/servicesRepo.js';
import { toolsRepo } from '../src/repositories/toolsRepo.js';
import { toolInstancesRepo } from '../src/repositories/toolInstancesRepo.js';

let tool;
beforeEach(async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-srv-'));
  servicesRepo._store._reset();
  toolsRepo._store._reset();
  toolInstancesRepo._store._reset();
  tool = (await toolsService.createWithDistribution({ name: 'Фен', distribution: [] })).tool;
});

test('простая услуга с фикс-ценой', async () => {
  const s = await servicesService.create({ name: 'Смыв', isComposite: false, priceType: 'fixed', price: 40 });
  assert.equal(s.price, 40);
  assert.equal(s.priceType, 'fixed');
  assert.equal(s.compositeSum, null);
  assert.deepEqual(s.childServiceIds, []);
});

test('простая услуга с диапазоном', async () => {
  const s = await servicesService.create({ name: 'Полир', isComposite: false, priceType: 'range', priceMin: 100, priceMax: 300 });
  assert.equal(s.priceMin, 100);
  assert.equal(s.priceMax, 300);
});

test('диапазон min>max — ValidationError', async () => {
  await assert.rejects(
    () => servicesService.create({ name: 'X', isComposite: false, priceType: 'range', priceMin: 300, priceMax: 100 }),
    /Минимум не может быть больше максимума/,
  );
});

test('составная auto не требует price', async () => {
  const a = await servicesService.create({ name: 'A', isComposite: false, priceType: 'fixed', price: 10 });
  const b = await servicesService.create({ name: 'B', isComposite: false, priceType: 'fixed', price: 20 });
  const c = await servicesService.create({ name: 'Комплекс', isComposite: true, compositeSum: 'auto', childServiceIds: [a.id, b.id] });
  assert.equal(c.compositeSum, 'auto');
  assert.equal(c.priceType, null);
  assert.deepEqual(c.childServiceIds, [a.id, b.id]);
});

test('составная ссылается на несуществующую под-услугу — ValidationError', async () => {
  await assert.rejects(
    () => servicesService.create({ name: 'K', isComposite: true, compositeSum: 'auto', childServiceIds: ['нет'] }),
    /Под-услуга не найдена/,
  );
});

test('запрет цикла: услуга не может включать саму себя через update', async () => {
  const a = await servicesService.create({ name: 'A', isComposite: false, priceType: 'fixed', price: 10 });
  const k = await servicesService.create({ name: 'K', isComposite: true, compositeSum: 'auto', childServiceIds: [a.id] });
  await assert.rejects(
    () => servicesService.update(k.id, { name: 'K', isComposite: true, compositeSum: 'auto', childServiceIds: [k.id] }),
    /цикл/i,
  );
});

test('requiredToolIds валидируется против существующих инструментов', async () => {
  const s = await servicesService.create({ name: 'Сушка', isComposite: false, priceType: 'fixed', price: 50, requiredToolIds: [tool.id] });
  assert.deepEqual(s.requiredToolIds, [tool.id]);
});

test('requiredToolIds с несуществующим инструментом — ValidationError', async () => {
  await assert.rejects(
    () => servicesService.create({ name: 'X', isComposite: false, priceType: 'fixed', price: 1, requiredToolIds: ['нет'] }),
    /Инструмент не найден/,
  );
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/services/servicesService.js'`

- [ ] **Step 3: Реализовать servicesService.js**

Создай `src/services/servicesService.js` (сущность «Услуга»):

```js
import { servicesRepo } from '../repositories/servicesRepo.js';
import { toolsRepo } from '../repositories/toolsRepo.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

function cleanName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Укажите название');
  }
  return name.trim();
}

function num(v, label) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`Некорректная цена: ${label}`);
  return n;
}

async function validateTools(requiredToolIds = []) {
  for (const id of requiredToolIds) {
    if (!(await toolsRepo.get(id))) throw new ValidationError('Инструмент не найден');
  }
  return [...requiredToolIds];
}

async function validateChildren(childServiceIds = [], selfId = null) {
  const ids = [...childServiceIds];
  for (const id of ids) {
    if (id === selfId) throw new ValidationError('Обнаружен цикл: услуга включает саму себя');
    if (!(await servicesRepo.get(id))) throw new ValidationError('Под-услуга не найдена');
  }
  // Проверка косвенного цикла: обход вглубь от каждой под-услуги.
  if (selfId) await assertNoCycle(ids, selfId);
  return ids;
}

async function assertNoCycle(childIds, selfId) {
  const seen = new Set();
  const stack = [...childIds];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === selfId) throw new ValidationError('Обнаружен цикл во вложенных услугах');
    if (seen.has(cur)) continue;
    seen.add(cur);
    const node = await servicesRepo.get(cur);
    if (node?.isComposite) stack.push(...(node.childServiceIds || []));
  }
}

/** Собирает нормализованный объект услуги из входных данных. */
async function buildService(body, selfId = null) {
  const name = cleanName(body.name);
  const requiredToolIds = await validateTools(body.requiredToolIds);
  const isComposite = Boolean(body.isComposite);

  if (isComposite) {
    const compositeSum = body.compositeSum;
    if (!['auto', 'fixed', 'manual'].includes(compositeSum)) {
      throw new ValidationError('Укажите способ суммы составной услуги');
    }
    const childServiceIds = await validateChildren(body.childServiceIds, selfId);
    if (childServiceIds.length === 0) throw new ValidationError('Добавьте хотя бы одну под-услугу');
    return {
      name, isComposite: true, compositeSum, childServiceIds,
      priceType: null,
      price: compositeSum === 'fixed' ? num(body.price, 'фикс') : null,
      priceMin: null, priceMax: null,
      requiredToolIds,
    };
  }

  // Простая услуга
  const priceType = body.priceType;
  if (!['fixed', 'range'].includes(priceType)) {
    throw new ValidationError('Укажите тип цены (фикс или диапазон)');
  }
  if (priceType === 'fixed') {
    return {
      name, isComposite: false, priceType: 'fixed',
      price: num(body.price, 'фикс'), priceMin: null, priceMax: null,
      compositeSum: null, childServiceIds: [], requiredToolIds,
    };
  }
  const priceMin = num(body.priceMin, 'мин');
  const priceMax = num(body.priceMax, 'макс');
  if (priceMin > priceMax) throw new ValidationError('Минимум не может быть больше максимума');
  return {
    name, isComposite: false, priceType: 'range',
    price: null, priceMin, priceMax,
    compositeSum: null, childServiceIds: [], requiredToolIds,
  };
}

export const servicesService = {
  list: () => servicesRepo.list(),
  async get(id) {
    const s = await servicesRepo.get(id);
    if (!s) throw new NotFoundError('Услуга не найдена');
    return s;
  },
  async create(body) {
    return servicesRepo.create(await buildService(body, null));
  },
  async update(id, body) {
    const existing = await servicesRepo.get(id);
    if (!existing) throw new NotFoundError('Услуга не найдена');
    return servicesRepo.update(id, await buildService(body, id));
  },
  async remove(id) {
    // Ссылочная целостность (входит в childServiceIds другой услуги) — Task 9.
    const ok = await servicesRepo.remove(id);
    if (!ok) throw new NotFoundError('Услуга не найдена');
    return { id };
  },
};
```

- [ ] **Step 4: Реализовать routes/services.js**

Создай `src/routes/services.js`:

```js
import { crudRouter } from './crudRouter.js';
import { servicesService } from '../services/servicesService.js';

export default crudRouter(servicesService);
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/servicesService.js src/routes/services.js test/servicesService.test.js
git commit -m "feat: Услуги — валидация цены по режиму, составные, requiredToolIds"
```

---

## Task 8: Сотрудники + прокси пользователей Б24 + импорт с дедупликацией

**Files:**
- Create: `src/b24/users.js`
- Create: `src/services/employeesService.js`
- Create: `src/routes/employees.js`
- Create: `src/routes/b24.js`
- Test: `test/employeesService.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/employeesService.test.js`:

```js
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
  // повторный id=10 пропущен, добавлен только 12
  assert.equal(second.length, 1);
  assert.equal(second[0].b24UserId, 12);
  const all = await employeesService.list();
  assert.equal(all.length, 2);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/services/employeesService.js'`

- [ ] **Step 3: Реализовать employeesService.js**

Создай `src/services/employeesService.js`:

```js
import { employeesRepo } from '../repositories/employeesRepo.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

const emptySalary = () => ({ mode: null, flatPercent: null, servicePercents: [] });

function cleanName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Укажите имя');
  }
  return name.trim();
}

export const employeesService = {
  list: () => employeesRepo.list(),
  async get(id) {
    const e = await employeesRepo.get(id);
    if (!e) throw new NotFoundError('Сотрудник не найден');
    return e;
  },
  addManual({ name }) {
    return employeesRepo.create({
      name: cleanName(name),
      source: 'manual',
      b24UserId: null,
      salary: emptySalary(),
    });
  },
  /** Импорт из Б24. users: [{ id, name }]. Пропускает уже импортированных по b24UserId. */
  async importFromB24(users = []) {
    const existing = await employeesRepo.list();
    const known = new Set(existing.filter((e) => e.b24UserId != null).map((e) => e.b24UserId));
    const created = [];
    for (const u of users) {
      const b24UserId = Number(u.id);
      if (known.has(b24UserId)) continue;
      known.add(b24UserId);
      created.push(await employeesRepo.create({
        name: cleanName(u.name),
        source: 'b24',
        b24UserId,
        salary: emptySalary(),
      }));
    }
    return created;
  },
  async update(id, { name }) {
    const e = await employeesRepo.update(id, { name: cleanName(name) });
    if (!e) throw new NotFoundError('Сотрудник не найден');
    return e;
  },
  async remove(id) {
    const ok = await employeesRepo.remove(id);
    if (!ok) throw new NotFoundError('Сотрудник не найден');
    return { id };
  },
};
```

- [ ] **Step 4: Реализовать b24/users.js**

Создай `src/b24/users.js`:

```js
import { vibe, unwrap } from '../utils/api.js';

/**
 * Получить пользователей портала Б24 через VibeCode API.
 * Возвращает [{ id, name }] в нормализованном виде.
 */
export async function fetchB24Users() {
  const response = await vibe('/users', { params: { limit: 200 } });
  const items = unwrap(response);
  return items.map((u) => ({
    id: u.ID ?? u.id,
    name: [u.NAME ?? u.name, u.LAST_NAME ?? u.lastName].filter(Boolean).join(' ').trim()
      || (u.EMAIL ?? `Пользователь ${u.ID ?? u.id}`),
  }));
}
```

- [ ] **Step 5: Реализовать routes/employees.js**

Создай `src/routes/employees.js`:

```js
import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { employeesService } from '../services/employeesService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await employeesService.list())));
r.get('/:id', asyncH(async (req, res) => ok(res, await employeesService.get(req.params.id))));
// POST /api/employees — ручное добавление
r.post('/', asyncH(async (req, res) => ok(res, await employeesService.addManual(req.body), 201)));
// POST /api/employees/import — импорт выбранных пользователей Б24
r.post('/import', asyncH(async (req, res) =>
  ok(res, await employeesService.importFromB24(req.body?.users || []), 201)));
r.put('/:id', asyncH(async (req, res) => ok(res, await employeesService.update(req.params.id, req.body))));
r.delete('/:id', asyncH(async (req, res) => ok(res, await employeesService.remove(req.params.id))));

export default r;
```

Примечание: `/import` объявлен до `/:id` не требуется (разные методы POST vs PUT/GET), но порядок POST `/import` перед POST `/` неважен — пути не пересекаются.

- [ ] **Step 6: Реализовать routes/b24.js**

Создай `src/routes/b24.js`:

```js
import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { fetchB24Users } from '../b24/users.js';

const r = Router();

r.get('/users', asyncH(async (req, res) => ok(res, await fetchB24Users())));

export default r;
```

- [ ] **Step 7: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS (тесты сервиса; b24-прокси проверяется вручную при наличии ключа)

- [ ] **Step 8: Commit**

```bash
git add src/b24/users.js src/services/employeesService.js src/routes/employees.js src/routes/b24.js test/employeesService.test.js
git commit -m "feat: Сотрудники (ручные + импорт Б24 с дедупликацией) и прокси /api/b24/users"
```

---

## Task 9: Ссылочная целостность при удалении

**Files:**
- Modify: `src/services/spacesService.js` (remove)
- Modify: `src/services/toolsService.js` (remove)
- Modify: `src/services/servicesService.js` (remove)
- Test: `test/integrity.test.js`

- [ ] **Step 1: Написать падающий тест**

Создай `test/integrity.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spacesService } from '../src/services/spacesService.js';
import { workPointsService } from '../src/services/workPointsService.js';
import { toolsService } from '../src/services/toolsService.js';
import { servicesService } from '../src/services/servicesService.js';
import { spacesRepo } from '../src/repositories/spacesRepo.js';
import { workPointsRepo } from '../src/repositories/workPointsRepo.js';
import { toolsRepo } from '../src/repositories/toolsRepo.js';
import { toolInstancesRepo } from '../src/repositories/toolInstancesRepo.js';
import { servicesRepo } from '../src/repositories/servicesRepo.js';

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-int-'));
  for (const r of [spacesRepo, workPointsRepo, toolsRepo, toolInstancesRepo, servicesRepo]) {
    r._store._reset();
  }
});

test('нельзя удалить пространство с рабочей точкой', async () => {
  const sp = await spacesService.create({ name: 'A' });
  await workPointsService.create({ name: 'Т', spaceId: sp.id });
  await assert.rejects(() => spacesService.remove(sp.id), (e) => e.status === 409);
});

test('нельзя удалить пространство с экземпляром инструмента', async () => {
  const sp = await spacesService.create({ name: 'A' });
  await toolsService.createWithDistribution({ name: 'Фен', distribution: [{ spaceId: sp.id, count: 1 }] });
  await assert.rejects(() => spacesService.remove(sp.id), (e) => e.status === 409);
});

test('пустое пространство удаляется', async () => {
  const sp = await spacesService.create({ name: 'A' });
  assert.deepEqual(await spacesService.remove(sp.id), { id: sp.id });
});

test('нельзя удалить инструмент с экземплярами', async () => {
  const { tool } = await toolsService.createWithDistribution({ name: 'Фен', distribution: [{ spaceId: null, count: 1 }] });
  await assert.rejects(() => toolsService.remove(tool.id), (e) => e.status === 409);
});

test('нельзя удалить инструмент, указанный в услуге', async () => {
  const { tool } = await toolsService.createWithDistribution({ name: 'Фен', distribution: [] });
  await servicesService.create({ name: 'Сушка', isComposite: false, priceType: 'fixed', price: 10, requiredToolIds: [tool.id] });
  await assert.rejects(() => toolsService.remove(tool.id), (e) => e.status === 409);
});

test('нельзя удалить услугу, входящую в составную', async () => {
  const a = await servicesService.create({ name: 'A', isComposite: false, priceType: 'fixed', price: 10 });
  await servicesService.create({ name: 'K', isComposite: true, compositeSum: 'auto', childServiceIds: [a.id] });
  await assert.rejects(() => servicesService.remove(a.id), (e) => e.status === 409);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — удаления проходят без проверок (ожидался статус 409)

- [ ] **Step 3: Обновить remove в spacesService.js**

В `src/services/spacesService.js` добавь импорты вверху (после существующих):

```js
import { workPointsRepo } from '../repositories/workPointsRepo.js';
import { toolInstancesRepo } from '../repositories/toolInstancesRepo.js';
import { ConflictError } from '../lib/errors.js';
```

Замени метод `remove` на:

```js
  async remove(id) {
    const wps = await workPointsRepo.list();
    if (wps.some((w) => w.spaceId === id)) {
      throw new ConflictError('Нельзя удалить: в пространстве есть рабочие точки');
    }
    const insts = await toolInstancesRepo.list();
    if (insts.some((i) => i.spaceId === id)) {
      throw new ConflictError('Нельзя удалить: в пространстве есть экземпляры инструментов');
    }
    const ok = await spacesRepo.remove(id);
    if (!ok) throw new NotFoundError('Пространство не найдено');
    return { id };
  },
```

- [ ] **Step 4: Обновить remove в toolsService.js**

В `src/services/toolsService.js` добавь импорт `ConflictError`:

```js
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors.js';
```

И импорт репозитория услуг:

```js
import { servicesRepo } from '../repositories/servicesRepo.js';
```

Замени метод `remove` (инструмента) на:

```js
  async remove(id) {
    const insts = await toolInstancesRepo.list();
    if (insts.some((i) => i.toolId === id)) {
      throw new ConflictError('Нельзя удалить: у инструмента есть экземпляры');
    }
    const services = await servicesRepo.list();
    if (services.some((s) => (s.requiredToolIds || []).includes(id))) {
      throw new ConflictError('Нельзя удалить: инструмент указан в услуге');
    }
    const ok = await toolsRepo.remove(id);
    if (!ok) throw new NotFoundError('Инструмент не найден');
    return { id };
  },
```

- [ ] **Step 5: Обновить remove в servicesService.js**

В `src/services/servicesService.js` добавь `ConflictError` в импорт ошибок:

```js
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors.js';
```

Замени метод `remove` на:

```js
  async remove(id) {
    const all = await servicesRepo.list();
    if (all.some((s) => s.id !== id && (s.childServiceIds || []).includes(id))) {
      throw new ConflictError('Нельзя удалить: услуга входит в составную услугу');
    }
    const ok = await servicesRepo.remove(id);
    if (!ok) throw new NotFoundError('Услуга не найдена');
    return { id };
  },
```

- [ ] **Step 6: Запустить — убедиться, что проходит**

Run: `npm test`
Expected: PASS (вся тестовая база)

- [ ] **Step 7: Commit**

```bash
git add src/services/spacesService.js src/services/toolsService.js src/services/servicesService.js test/integrity.test.js
git commit -m "feat: ссылочная целостность при удалении (пространства, инструменты, услуги)"
```

---

## Task 10: Монтаж сервера (роутеры, error-middleware, health, SPA)

**Files:**
- Modify: `src/server.js`
- Test: `test/server.test.js`

- [ ] **Step 1: Написать падающий тест (поднимаем app на порту 0 и бьём fetch)**

Создай `test/server.test.js`:

```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import app from '../src/server.js';
import { spacesRepo } from '../src/repositories/spacesRepo.js';

let server, base;
before(async () => {
  await new Promise((res) => { server = app.listen(0, res); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sp-srv-http-'));
  spacesRepo._store._reset();
});

test('GET /api/health → ok', async () => {
  const r = await fetch(`${base}/api/health`);
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.ok, true);
});

test('CRUD пространства через HTTP', async () => {
  const create = await fetch(`${base}/api/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Пост 1' }),
  });
  assert.equal(create.status, 201);
  const { data } = await create.json();
  assert.equal(data.name, 'Пост 1');

  const list = await (await fetch(`${base}/api/spaces`)).json();
  assert.equal(list.data.length, 1);
});

test('ошибка валидации → 400 и {ok:false}', async () => {
  const r = await fetch(`${base}/api/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' }),
  });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'VALIDATION');
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `/api/health` отдаёт 404 (роутеры ещё не смонтированы)

- [ ] **Step 3: Переписать server.js**

Замени содержимое `src/server.js` на:

```js
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import spacesRouter from './routes/spaces.js';
import workPointsRouter from './routes/workPoints.js';
import toolsRouter from './routes/tools.js';
import toolInstancesRouter from './routes/toolInstances.js';
import servicesRouter from './routes/services.js';
import employeesRouter from './routes/employees.js';
import b24Router from './routes/b24.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

// Health-check
app.get('/api/health', (req, res) => res.json({ ok: true, data: { status: 'up' } }));

// Справочники
app.use('/api/spaces', spacesRouter);
app.use('/api/work-points', workPointsRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/tool-instances', toolInstancesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/b24', b24Router);

// Битрикс24 открывает приложение через POST (iframe-протокол) — отдаём тот же index.html
app.post('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Единый обработчик ошибок: AppError → его статус/код, иначе 500
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    ok: false,
    error: { message: err.message || 'Внутренняя ошибка', code: err.code || 'INTERNAL' },
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});

export default app;
```

Примечание: `app.listen` при импорте в тестах поднимет порт `PORT` (3000). Чтобы тесты не конфликтовали, тест поднимает **отдельный** инстанс на порту 0 — двойной `listen` на разных портах допустим. Если в окружении порт 3000 занят, экспортируй приложение без вызова `listen`, обернув запуск в условие. Для простоты оставляем как есть; при проблемах в CI замени последний блок на:

```js
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
}
```
и устанавливай `NODE_ENV=test` в тестовом запуске.

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `NODE_ENV=test npm test`
Expected: PASS

(Если используешь вариант с условным `listen`, добавь в `package.json` скрипт `"test": "NODE_ENV=test node --test"`.)

- [ ] **Step 5: Commit**

```bash
git add src/server.js test/server.test.js package.json
git commit -m "feat: монтаж роутеров, error-middleware, health, SPA-ответ на POST /"
```

---

## Task 11: Фронтенд-каркас (тема, api.js, ui.js, app.js, вкладки)

**Files:**
- Overwrite: `src/public/index.html`
- Create: `src/public/css/theme-b24.css`
- Create: `src/public/js/api.js`
- Create: `src/public/js/ui.js`
- Create: `src/public/js/app.js`

- [ ] **Step 1: Перезаписать index.html**

Замени `src/public/index.html` на:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SyncPoint24 — Настройки</title>
  <link rel="stylesheet" href="css/theme-b24.css" />
</head>
<body>
  <div class="layout">
    <nav class="sidebar" id="tabs"></nav>
    <main class="content">
      <h1 id="view-title">Настройки</h1>
      <div id="view"></div>
    </main>
  </div>
  <div id="modal-root"></div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Создать тему theme-b24.css**

Создай `src/public/css/theme-b24.css`:

```css
:root {
  --b24-bg: #f4f6f8;
  --b24-surface: #ffffff;
  --b24-border: #dfe3e8;
  --b24-text: #232a33;
  --b24-muted: #7a8593;
  --b24-primary: #2fc6f6;
  --b24-primary-d: #1ba8d4;
  --b24-danger: #f1361d;
  --gap: 16px;
  --radius: 8px;
}
* { box-sizing: border-box; }
body {
  margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif;
  background: var(--b24-bg); color: var(--b24-text);
}
.layout { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.sidebar { background: var(--b24-surface); border-right: 1px solid var(--b24-border); padding: var(--gap) 0; }
.sidebar button {
  display: block; width: 100%; text-align: left; padding: 12px 20px;
  background: none; border: none; cursor: pointer; font-size: 15px; color: var(--b24-text);
}
.sidebar button.active { background: var(--b24-bg); border-left: 3px solid var(--b24-primary); font-weight: 600; }
.content { padding: 24px 32px; }
h1 { font-size: 22px; margin: 0 0 20px; }
.row { display: flex; justify-content: space-between; align-items: center;
  background: var(--b24-surface); border: 1px solid var(--b24-border);
  border-radius: var(--radius); padding: 12px 16px; margin-bottom: 8px; }
.row .meta { color: var(--b24-muted); font-size: 13px; }
.btn { background: var(--b24-primary); color: #fff; border: none; border-radius: var(--radius);
  padding: 9px 16px; cursor: pointer; font-size: 14px; }
.btn:hover { background: var(--b24-primary-d); }
.btn.secondary { background: var(--b24-surface); color: var(--b24-text); border: 1px solid var(--b24-border); }
.btn.danger { background: var(--b24-danger); }
.btn.link { background: none; color: var(--b24-primary-d); padding: 4px 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.field { margin-bottom: 12px; }
.field label { display: block; font-size: 13px; color: var(--b24-muted); margin-bottom: 4px; }
.field input, .field select { width: 100%; padding: 8px 10px; border: 1px solid var(--b24-border);
  border-radius: var(--radius); font-size: 14px; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--b24-bg);
  border: 1px solid var(--b24-border); color: var(--b24-muted); }
.banner { background: #fff6e5; border: 1px solid #ffd591; padding: 10px 14px; border-radius: var(--radius);
  margin-bottom: 16px; font-size: 14px; }
.error { color: var(--b24-danger); font-size: 13px; margin-top: 6px; }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; }
.modal { background: var(--b24-surface); border-radius: var(--radius); padding: 24px;
  width: 440px; max-width: 92vw; max-height: 88vh; overflow: auto; }
.modal h2 { margin: 0 0 16px; font-size: 18px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.checklist { border: 1px solid var(--b24-border); border-radius: var(--radius); max-height: 240px;
  overflow: auto; padding: 8px; }
.checklist label { display: flex; align-items: center; gap: 8px; padding: 4px; font-size: 14px; }
.muted { color: var(--b24-muted); font-size: 14px; }
```

- [ ] **Step 3: Создать api.js (относительные пути!)**

Создай `src/public/js/api.js`:

```js
// Все запросы — ОТНОСИТЕЛЬНЫМ путём ('api/...'), т.к. приложение
// публикуется под /<логин>/<проект>/. Ведущий '/' сломал бы адресацию.
async function request(path, options = {}) {
  const res = await fetch(`api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let payload = {};
  try { payload = await res.json(); } catch { /* пустой ответ */ }
  if (!res.ok || payload.ok === false) {
    const msg = payload?.error?.message || `Ошибка ${res.status}`;
    throw new Error(msg);
  }
  return payload.data;
}

export const api = {
  list: (entity) => request(entity),
  create: (entity, body) => request(entity, { method: 'POST', body }),
  update: (entity, id, body) => request(`${entity}/${id}`, { method: 'PUT', body }),
  remove: (entity, id) => request(`${entity}/${id}`, { method: 'DELETE' }),
  post: (path, body) => request(path, { method: 'POST', body }),
  get: (path) => request(path),
};
```

- [ ] **Step 4: Создать ui.js (helpers + generic crudView)**

Создай `src/public/js/ui.js`:

```js
/** Создать DOM-элемент: el('div', {class:'x'}, [child, 'text']) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Модалка с произвольным содержимым и кнопками. onSubmit может бросать — покажем ошибку. */
export function openModal({ title, body, submitLabel = 'Сохранить', onSubmit }) {
  const root = document.getElementById('modal-root');
  const errBox = el('div', { class: 'error' });
  const close = () => (root.innerHTML = '');

  const submit = el('button', { class: 'btn', onclick: async () => {
    errBox.textContent = '';
    try { await onSubmit(); close(); }
    catch (e) { errBox.textContent = e.message; }
  } }, submitLabel);

  const modal = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target.classList.contains('modal-bg')) close(); } }, [
    el('div', { class: 'modal' }, [
      el('h2', {}, title),
      body,
      errBox,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn secondary', onclick: close }, 'Отмена'),
        submit,
      ]),
    ]),
  ]);
  root.innerHTML = '';
  root.append(modal);
}

/** Текстовое поле формы. Возвращает {field, input}. */
export function textField(label, value = '') {
  const input = el('input', { type: 'text', value });
  return { field: el('div', { class: 'field' }, [el('label', {}, label), input]), input };
}

/** Выпадающий список. options: [{value,label}]. */
export function selectField(label, options, value = '') {
  const select = el('select', {});
  for (const o of options) {
    const opt = el('option', { value: o.value }, o.label);
    if (String(o.value) === String(value)) opt.selected = true;
    select.append(opt);
  }
  return { field: el('div', { class: 'field' }, [el('label', {}, label), select]), select };
}

/**
 * Generic CRUD-вкладка.
 * config: { entity, title, render(item), buildForm(item?) → {body, collect()}, onCreate(data) }
 * Если задан onCreate — используется он вместо api.create (для нестандартного POST).
 */
export async function crudView(mount, config, api) {
  async function refresh() {
    mount.innerHTML = '';
    const toolbar = el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn', onclick: () => openForm() }, config.addLabel || 'Добавить'),
      ...(config.extraButtons ? config.extraButtons(refresh) : []),
    ]);
    mount.append(toolbar);

    let items = [];
    try { items = await api.list(config.entity); }
    catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); }

    if (!items.length) mount.append(el('div', { class: 'muted' }, 'Пока пусто.'));
    for (const item of items) {
      mount.append(el('div', { class: 'row' }, [
        config.render(item),
        el('div', {}, [
          el('button', { class: 'btn link', onclick: () => openForm(item) }, 'Изменить'),
          el('button', { class: 'btn link', onclick: () => del(item) }, 'Удалить'),
        ]),
      ]));
    }
  }

  function openForm(item) {
    const { body, collect } = config.buildForm(item);
    openModal({
      title: item ? 'Изменить' : (config.addLabel || 'Добавить'),
      body,
      onSubmit: async () => {
        const data = collect();
        if (item) await api.update(config.entity, item.id, data);
        else if (config.onCreate) await config.onCreate(data);
        else await api.create(config.entity, data);
        await refresh();
      },
    });
  }

  async function del(item) {
    if (!confirm('Удалить запись?')) return;
    try { await api.remove(config.entity, item.id); await refresh(); }
    catch (e) { alert(e.message); }
  }

  await refresh();
}
```

- [ ] **Step 5: Создать app.js (навигация по вкладкам)**

Создай `src/public/js/app.js`:

```js
import { el } from './ui.js';
import { api } from './api.js';
import { spacesView } from './views/spaces.js';
import { workPointsView } from './views/workPoints.js';
import { toolsView } from './views/tools.js';
import { servicesView } from './views/services.js';
import { employeesView } from './views/employees.js';

const TABS = [
  { id: 'spaces', label: 'Пространства', view: spacesView },
  { id: 'work-points', label: 'Рабочие точки', view: workPointsView },
  { id: 'tools', label: 'Инструменты', view: toolsView },
  { id: 'services', label: 'Услуги', view: servicesView },
  { id: 'employees', label: 'Сотрудники', view: employeesView },
];

const tabsNav = document.getElementById('tabs');
const viewMount = document.getElementById('view');
const titleEl = document.getElementById('view-title');

function activate(tab) {
  [...tabsNav.children].forEach((b) => b.classList.toggle('active', b.dataset.id === tab.id));
  titleEl.textContent = tab.label;
  viewMount.innerHTML = '';
  tab.view(viewMount, api);
}

for (const tab of TABS) {
  tabsNav.append(el('button', { 'data-id': tab.id, onclick: () => activate(tab) }, tab.label));
}
activate(TABS[0]);
```

- [ ] **Step 6: Создать временные заглушки вьюх (чтобы импорт не падал)**

Создай по файлу-заглушке (будут заменены в Task 12–15). Каждая:

`src/public/js/views/spaces.js`:
```js
export function spacesView(mount) { mount.append(document.createTextNode('…')); }
```
Аналогично создай `workPoints.js`, `tools.js`, `services.js`, `employees.js` с такими же функциями `workPointsView`, `toolsView`, `servicesView`, `employeesView` (по одной строке, имя экспорта = `<entity>View`).

- [ ] **Step 7: Ручная проверка каркаса**

Run: `node src/server.js` (нужен `.env` с любым `VIBE_API_KEY`, иначе `utils/api.js` завершится — на этом шаге достаточно валидной строки-ключа).
Открой `http://localhost:3000`. Ожидается: слева 5 вкладок, переключаются, заголовок меняется.
Останови сервер (Ctrl+C).

- [ ] **Step 8: Commit**

```bash
git add src/public/
git commit -m "feat: фронтенд-каркас — тема Б24, api/ui/app, навигация по вкладкам"
```

---

## Task 12: Вьюхи «Пространства» и «Рабочие точки»

**Files:**
- Overwrite: `src/public/js/views/spaces.js`
- Overwrite: `src/public/js/views/workPoints.js`

- [ ] **Step 1: Реализовать spaces.js**

Замени `src/public/js/views/spaces.js`:

```js
import { el, textField, crudView } from '../ui.js';

export function spacesView(mount, api) {
  crudView(mount, {
    entity: 'spaces',
    addLabel: 'Добавить пространство',
    render: (s) => el('div', {}, [el('b', {}, s.name)]),
    buildForm: (item) => {
      const name = textField('Название', item?.name || '');
      return { body: el('div', {}, [name.field]), collect: () => ({ name: name.input.value }) };
    },
  }, api);
}
```

- [ ] **Step 2: Реализовать workPoints.js**

Замени `src/public/js/views/workPoints.js`:

```js
import { el, textField, selectField, crudView } from '../ui.js';

export function workPointsView(mount, api) {
  crudView(mount, {
    entity: 'work-points',
    addLabel: 'Добавить рабочую точку',
    render: (wp) => el('div', {}, [
      el('b', {}, wp.name),
      el('span', { class: 'meta' }, `  · ${wp._spaceName || ''}`),
    ]),
    buildForm: async () => {},
  }, api);

  // Переопределяем buildForm с подгрузкой пространств (нужен async-список).
  // Для простоты пере-инициализируем вью после загрузки пространств:
  loadAndRender(mount, api);
}

async function loadAndRender(mount, api) {
  let spaces = [];
  try { spaces = await api.list('spaces'); } catch { spaces = []; }
  const spaceName = (id) => spaces.find((s) => s.id === id)?.name || '—';

  crudView(mount, {
    entity: 'work-points',
    addLabel: 'Добавить рабочую точку',
    render: (wp) => el('div', {}, [el('b', {}, wp.name), el('span', { class: 'meta' }, `  · ${spaceName(wp.spaceId)}`)]),
    buildForm: (item) => {
      const name = textField('Название', item?.name || '');
      const space = selectField('Пространство',
        spaces.map((s) => ({ value: s.id, label: s.name })), item?.spaceId || '');
      return {
        body: el('div', {}, [name.field, space.field]),
        collect: () => ({ name: name.input.value, spaceId: space.select.value }),
      };
    },
  }, api);
}
```

Примечание: первый вызов `crudView` в `workPointsView` сразу перетирается `loadAndRender` — оставлен только `loadAndRender`. Упростим: тело `workPointsView` = только `loadAndRender(mount, api);` (убери первый `crudView`).

Итоговый `workPoints.js`:

```js
import { el, textField, selectField, crudView } from '../ui.js';

export function workPointsView(mount, api) {
  loadAndRender(mount, api);
}

async function loadAndRender(mount, api) {
  let spaces = [];
  try { spaces = await api.list('spaces'); } catch { spaces = []; }
  const spaceName = (id) => spaces.find((s) => s.id === id)?.name || '—';

  crudView(mount, {
    entity: 'work-points',
    addLabel: 'Добавить рабочую точку',
    render: (wp) => el('div', {}, [el('b', {}, wp.name), el('span', { class: 'meta' }, `  · ${spaceName(wp.spaceId)}`)]),
    buildForm: (item) => {
      const name = textField('Название', item?.name || '');
      const space = selectField('Пространство',
        spaces.map((s) => ({ value: s.id, label: s.name })), item?.spaceId || '');
      return {
        body: el('div', {}, [name.field, space.field]),
        collect: () => ({ name: name.input.value, spaceId: space.select.value }),
      };
    },
  }, api);
}
```

- [ ] **Step 3: Ручная проверка**

Run: `node src/server.js`, открой приложение.
Создай пространство «Пост 1». На вкладке «Рабочие точки» создай точку с выбором пространства. Убедись, что точка показывает имя пространства, а удаление непустого пространства даёт ошибку.
Останови сервер.

- [ ] **Step 4: Commit**

```bash
git add src/public/js/views/spaces.js src/public/js/views/workPoints.js
git commit -m "feat: вьюхи Пространств и Рабочих точек"
```

---

## Task 13: Вьюха «Инструменты» (распределение + экземпляры)

**Files:**
- Overwrite: `src/public/js/views/tools.js`

- [ ] **Step 1: Реализовать tools.js**

Замени `src/public/js/views/tools.js`:

```js
import { el, textField, openModal } from '../ui.js';

export function toolsView(mount, api) {
  render(mount, api);
}

async function render(mount, api) {
  mount.innerHTML = '';
  mount.append(el('div', { class: 'toolbar' }, [
    el('button', { class: 'btn', onclick: () => openCreate(mount, api) }, 'Добавить инструмент'),
  ]));

  let tools = [], instances = [], spaces = [];
  try {
    [tools, instances, spaces] = await Promise.all([
      api.list('tools'), api.list('tool-instances'), api.list('spaces'),
    ]);
  } catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); }

  const spaceName = (id) => (id == null ? 'без пространства' : (spaces.find((s) => s.id === id)?.name || '—'));

  if (!tools.length) mount.append(el('div', { class: 'muted' }, 'Пока пусто.'));
  for (const tool of tools) {
    const own = instances.filter((i) => i.toolId === tool.id);
    const list = el('div', {}, own.map((i) =>
      el('div', { class: 'meta' }, [
        `• ${spaceName(i.spaceId)} `,
        el('button', { class: 'btn link', onclick: () => delInstance(i, mount, api) }, '✕'),
      ])));
    mount.append(el('div', { class: 'row' }, [
      el('div', {}, [el('b', {}, tool.name), el('div', { class: 'meta' }, `Экземпляров: ${own.length}`), list]),
      el('div', {}, [
        el('button', { class: 'btn link', onclick: () => addInstance(tool, spaces, mount, api) }, '+ экземпляр'),
        el('button', { class: 'btn link', onclick: () => del(tool, mount, api) }, 'Удалить'),
      ]),
    ]));
  }
}

function openCreate(mount, api) {
  // Форма: имя + строки распределения (пространство + количество).
  let spacesCache = [];
  const rowsWrap = el('div', {});
  const name = textField('Название инструмента');

  const addRow = () => {
    const sel = el('select', {});
    sel.append(el('option', { value: '' }, 'без пространства'));
    for (const s of spacesCache) sel.append(el('option', { value: s.id }, s.name));
    const count = el('input', { type: 'number', min: '0', value: '1', style: 'width:80px' });
    rowsWrap.append(el('div', { class: 'field', style: 'display:flex;gap:8px;align-items:flex-end' }, [
      el('div', { style: 'flex:1' }, [el('label', {}, 'Пространство'), sel]),
      el('div', {}, [el('label', {}, 'Кол-во'), count]),
    ]));
    rowsWrap.lastChild._get = () => ({ spaceId: sel.value || null, count: Number(count.value) || 0 });
  };

  api.list('spaces').then((s) => { spacesCache = s; addRow(); });

  openModal({
    title: 'Новый инструмент',
    body: el('div', {}, [
      name.field,
      el('div', { class: 'muted' }, 'Распределение экземпляров по пространствам:'),
      rowsWrap,
      el('button', { class: 'btn secondary', onclick: addRow }, '+ строка'),
    ]),
    onSubmit: async () => {
      const distribution = [...rowsWrap.children].map((r) => r._get()).filter((d) => d.count > 0);
      await api.create('tools', { name: name.input.value, distribution });
      await render(mount, api);
    },
  });
}

function addInstance(tool, spaces, mount, api) {
  const sel = el('select', {});
  sel.append(el('option', { value: '' }, 'без пространства'));
  for (const s of spaces) sel.append(el('option', { value: s.id }, s.name));
  openModal({
    title: `Экземпляр: ${tool.name}`,
    body: el('div', { class: 'field' }, [el('label', {}, 'Пространство'), sel]),
    onSubmit: async () => {
      await api.create('tool-instances', { toolId: tool.id, spaceId: sel.value || null });
      await render(mount, api);
    },
  });
}

async function delInstance(inst, mount, api) {
  try { await api.remove('tool-instances', inst.id); await render(mount, api); }
  catch (e) { alert(e.message); }
}

async function del(tool, mount, api) {
  if (!confirm('Удалить инструмент?')) return;
  try { await api.remove('tools', tool.id); await render(mount, api); }
  catch (e) { alert(e.message); }
}
```

- [ ] **Step 2: Ручная проверка**

Run: `node src/server.js`, открой приложение.
Создай инструмент «Фен» с распределением: Пространство A = 2, Пространство B = 4. Убедись: показывается «Экземпляров: 6», список по пространствам. Добавь/удали экземпляр. Попробуй удалить инструмент с экземплярами — должна быть ошибка.
Останови сервер.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/views/tools.js
git commit -m "feat: вьюха Инструментов с распределением и экземплярами"
```

---

## Task 14: Вьюха «Услуги» (режимы цены + нужные инструменты)

**Files:**
- Overwrite: `src/public/js/views/services.js`

- [ ] **Step 1: Реализовать services.js**

Замени `src/public/js/views/services.js`:

```js
import { el, textField, openModal } from '../ui.js';

export function servicesView(mount, api) {
  render(mount, api);
}

async function render(mount, api) {
  mount.innerHTML = '';
  mount.append(el('div', { class: 'toolbar' }, [
    el('button', { class: 'btn', onclick: () => openForm(mount, api) }, 'Добавить услугу'),
  ]));

  let services = [], tools = [];
  try { [services, tools] = await Promise.all([api.list('services'), api.list('tools')]); }
  catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); }

  if (!services.length) mount.append(el('div', { class: 'muted' }, 'Пока пусто.'));
  for (const s of services) {
    mount.append(el('div', { class: 'row' }, [
      el('div', {}, [el('b', {}, s.name), el('div', { class: 'meta' }, priceText(s))]),
      el('div', {}, [
        el('button', { class: 'btn link', onclick: () => openForm(mount, api, s) }, 'Изменить'),
        el('button', { class: 'btn link', onclick: () => del(s, mount, api) }, 'Удалить'),
      ]),
    ]));
  }
}

function priceText(s) {
  if (s.isComposite) return `составная (${s.compositeSum})`;
  if (s.priceType === 'fixed') return `${s.price} ₽`;
  return `${s.priceMin}–${s.priceMax} ₽`;
}

async function openForm(mount, api, item) {
  const [services, tools] = await Promise.all([api.list('services'), api.list('tools')]);
  const others = services.filter((s) => s.id !== item?.id);

  const name = textField('Название', item?.name || '');

  // Переключатель простая/составная
  const kind = el('select', {});
  kind.append(el('option', { value: 'simple' }, 'Простая'));
  kind.append(el('option', { value: 'composite' }, 'Составная'));
  kind.value = item?.isComposite ? 'composite' : 'simple';

  // Простая: тип цены + поля
  const priceType = el('select', {});
  priceType.append(el('option', { value: 'fixed' }, 'Фиксированная'));
  priceType.append(el('option', { value: 'range' }, 'Диапазон'));
  priceType.value = item?.priceType || 'fixed';
  const price = el('input', { type: 'number', min: '0', value: item?.price ?? '' });
  const priceMin = el('input', { type: 'number', min: '0', value: item?.priceMin ?? '' });
  const priceMax = el('input', { type: 'number', min: '0', value: item?.priceMax ?? '' });

  // Составная: способ суммы + под-услуги (чеклист)
  const compositeSum = el('select', {});
  for (const [v, l] of [['auto', 'Сумма под-услуг'], ['fixed', 'Своя цена'], ['manual', 'Указать при записи']]) {
    compositeSum.append(el('option', { value: v }, l));
  }
  compositeSum.value = item?.compositeSum || 'auto';
  const childChecks = others.map((o) => {
    const cb = el('input', { type: 'checkbox', value: o.id });
    if (item?.childServiceIds?.includes(o.id)) cb.checked = true;
    return { id: o.id, cb, node: el('label', {}, [cb, ` ${o.name}`]) };
  });

  // Нужные инструменты
  const toolChecks = tools.map((t) => {
    const cb = el('input', { type: 'checkbox', value: t.id });
    if (item?.requiredToolIds?.includes(t.id)) cb.checked = true;
    return { id: t.id, cb, node: el('label', {}, [cb, ` ${t.name}`]) };
  });

  const simpleBox = el('div', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Тип цены'), priceType]),
    el('div', { class: 'field' }, [el('label', {}, 'Цена (фикс)'), price]),
    el('div', { class: 'field' }, [el('label', {}, 'Мин'), priceMin]),
    el('div', { class: 'field' }, [el('label', {}, 'Макс'), priceMax]),
  ]);
  const compositeBox = el('div', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Способ суммы'), compositeSum]),
    el('div', { class: 'field' }, [el('label', {}, 'Под-услуги'),
      el('div', { class: 'checklist' }, childChecks.map((c) => c.node))]),
  ]);

  const syncVisibility = () => {
    const composite = kind.value === 'composite';
    compositeBox.style.display = composite ? 'block' : 'none';
    simpleBox.style.display = composite ? 'none' : 'block';
    price.parentElement.style.display = priceType.value === 'fixed' ? 'block' : 'none';
    priceMin.parentElement.style.display = priceType.value === 'range' ? 'block' : 'none';
    priceMax.parentElement.style.display = priceType.value === 'range' ? 'block' : 'none';
  };
  kind.addEventListener('change', syncVisibility);
  priceType.addEventListener('change', syncVisibility);

  const body = el('div', {}, [
    name.field,
    el('div', { class: 'field' }, [el('label', {}, 'Вид услуги'), kind]),
    simpleBox,
    compositeBox,
    el('div', { class: 'field' }, [el('label', {}, 'Нужные инструменты'),
      el('div', { class: 'checklist' }, toolChecks.length ? toolChecks.map((c) => c.node) : [el('span', { class: 'muted' }, 'нет инструментов')])]),
  ]);
  setTimeout(syncVisibility, 0);

  openModal({
    title: item ? 'Изменить услугу' : 'Новая услуга',
    body,
    onSubmit: async () => {
      const requiredToolIds = toolChecks.filter((c) => c.cb.checked).map((c) => c.id);
      let data;
      if (kind.value === 'composite') {
        data = {
          name: name.input.value, isComposite: true,
          compositeSum: compositeSum.value,
          childServiceIds: childChecks.filter((c) => c.cb.checked).map((c) => c.id),
          price: compositeSum.value === 'fixed' ? Number(price.value) : null,
          requiredToolIds,
        };
      } else {
        data = {
          name: name.input.value, isComposite: false, priceType: priceType.value,
          price: priceType.value === 'fixed' ? Number(price.value) : null,
          priceMin: priceType.value === 'range' ? Number(priceMin.value) : null,
          priceMax: priceType.value === 'range' ? Number(priceMax.value) : null,
          requiredToolIds,
        };
      }
      if (item) await api.update('services', item.id, data);
      else await api.create('services', data);
      await render(mount, api);
    },
  });
}

async function del(s, mount, api) {
  if (!confirm('Удалить услугу?')) return;
  try { await api.remove('services', s.id); await render(mount, api); }
  catch (e) { alert(e.message); }
}
```

- [ ] **Step 2: Ручная проверка**

Run: `node src/server.js`, открой приложение.
- Создай простую услугу «Смыв» фикс 40 ₽.
- Создай простую услугу с диапазоном.
- Создай составную услугу из двух простых (способ «сумма под-услуг»).
- Отметь «Нужные инструменты» = Фен.
- Проверь, что нельзя удалить услугу, входящую в составную (ошибка).
Останови сервер.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/views/services.js
git commit -m "feat: вьюха Услуг — режимы цены, составные, нужные инструменты"
```

---

## Task 15: Вьюха «Сотрудники» (импорт из Б24 + ручное добавление)

**Files:**
- Overwrite: `src/public/js/views/employees.js`

- [ ] **Step 1: Реализовать employees.js**

Замени `src/public/js/views/employees.js`:

```js
import { el, textField, openModal } from '../ui.js';

export function employeesView(mount, api) {
  render(mount, api);
}

async function render(mount, api) {
  mount.innerHTML = '';
  mount.append(el('div', { class: 'toolbar' }, [
    el('button', { class: 'btn', onclick: () => importFromB24(mount, api) }, 'Загрузить из Битрикс24'),
    el('button', { class: 'btn secondary', onclick: () => addManual(mount, api) }, 'Добавить вручную'),
  ]));

  let employees = [];
  try { employees = await api.list('employees'); }
  catch (e) { mount.append(el('div', { class: 'banner' }, e.message)); }

  if (!employees.length) mount.append(el('div', { class: 'muted' }, 'Пока пусто.'));
  for (const e of employees) {
    mount.append(el('div', { class: 'row' }, [
      el('div', {}, [el('b', {}, e.name), ' ', el('span', { class: 'badge' }, e.source === 'b24' ? 'Б24' : 'вручную')]),
      el('button', { class: 'btn link', onclick: () => del(e, mount, api) }, 'Удалить'),
    ]));
  }
}

function addManual(mount, api) {
  const name = textField('Имя сотрудника');
  openModal({
    title: 'Добавить вручную',
    body: el('div', {}, [name.field]),
    onSubmit: async () => { await api.create('employees', { name: name.input.value }); await render(mount, api); },
  });
}

async function importFromB24(mount, api) {
  let users = [];
  try { users = await api.get('b24/users'); }
  catch (e) {
    openModal({ title: 'Импорт из Битрикс24', body: el('div', { class: 'banner' }, `Не удалось загрузить пользователей Б24: ${e.message}`), submitLabel: 'Ок', onSubmit: async () => {} });
    return;
  }
  const checks = users.map((u) => {
    const cb = el('input', { type: 'checkbox', value: u.id });
    return { user: u, cb, node: el('label', {}, [cb, ` ${u.name}`]) };
  });
  openModal({
    title: 'Выберите сотрудников',
    body: el('div', { class: 'checklist' }, checks.length ? checks.map((c) => c.node) : [el('span', { class: 'muted' }, 'Пользователи не найдены')]),
    submitLabel: 'Импортировать',
    onSubmit: async () => {
      const selected = checks.filter((c) => c.cb.checked).map((c) => c.user);
      await api.post('employees/import', { users: selected });
      await render(mount, api);
    },
  });
}

async function del(e, mount, api) {
  if (!confirm('Удалить сотрудника?')) return;
  try { await api.remove('employees', e.id); await render(mount, api); }
  catch (err) { alert(err.message); }
}
```

- [ ] **Step 2: Ручная проверка**

Run: `npm run check` — убедись, что ключ рабочий («API connection OK»). Затем `node src/server.js`.
- «Добавить вручную» → создай сотрудника, проверь бейдж «вручную».
- «Загрузить из Битрикс24» → выбери пользователей, импортируй, проверь бейдж «Б24».
- Повторный импорт тех же пользователей не создаёт дублей.
Останови сервер.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/views/employees.js
git commit -m "feat: вьюха Сотрудников — импорт из Б24 и ручное добавление"
```

---

## Task 16: Финал — changelog, .env.example, прогон тестов и проверка

**Files:**
- Modify: `docs/changelog.md`
- Modify: `.env.example` (добавить DATA_DIR)

- [ ] **Step 1: Добавить DATA_DIR в .env.example**

В `.env.example` добавь в конец секции «Приложение»:

```
# Каталог данных (JSON-хранилище). Локально ./data, на проде /opt/data
DATA_DIR=./data
```

- [ ] **Step 2: Записать changelog**

Добавь в начало `docs/changelog.md` запись:

```markdown
## 2026-06-04 — Этап 1: справочники и каркас

- Бэкенд Express + JSON-хранилище (атомарная запись, кэш в памяти).
- Справочники: Пространства, Рабочие точки, Инструменты (+ экземпляры по распределению),
  Услуги (фикс/диапазон/составные, нужные инструменты), Сотрудники (Б24-импорт + ручные).
- Ссылочная целостность при удалении.
- Фронтенд: тема Б24, вкладки настроек, generic CRUD-вью.
- Покрытие тестами: lib, стор, репозитории, все сервисы, целостность, HTTP-роуты.
```

- [ ] **Step 3: Полный прогон тестов**

Run: `NODE_ENV=test npm test`
Expected: PASS — все тесты зелёные, без падений.

- [ ] **Step 4: Финальная ручная проверка end-to-end**

Run: `node src/server.js`, пройди сценарий: пространство → рабочая точка → инструмент с распределением → услуга (простая, диапазон, составная, с инструментом) → сотрудник (ручной + импорт). Проверь блокировки удаления.

- [ ] **Step 5: Commit**

```bash
git add docs/changelog.md .env.example
git commit -m "docs: changelog Этапа 1 + DATA_DIR в .env.example"
```

---

## Самопроверка плана (выполнена при написании)

**Покрытие спека:**
- Размещение в Б24 (LEFT_MENU, POST /) → Task 10. ✓
- Бэкенд + JSON-хранилище + DATA_DIR → Tasks 2, 10, 16. ✓
- Space / WorkPoint / Tool / ToolInstance / Service / Employee → Tasks 4–8. ✓
- requiredToolIds в услуге → Task 7. ✓
- Распределение экземпляров по пространствам + общий (null) → Task 6. ✓
- Цена: fixed/range/составная auto/fixed/manual + запрет циклов → Task 7. ✓
- Задел salary у сотрудника → Task 8. ✓
- Импорт Б24 + дедупликация по b24UserId → Task 8. ✓
- Ссылочная целостность при удалении (3 правила) → Task 9. ✓
- Формат ответа {ok,data|error} + error-middleware → Tasks 4, 10. ✓
- Б24-прокси /api/b24/users + мягкая обработка ошибок → Tasks 8, 15. ✓
- Фронтенд: вкладки, формы, относительные пути API → Tasks 11–15. ✓
- Тестирование (services, repo, routes, smoke) → распределено по задачам. ✓

**Не входит в Этап 1** (соответствует спеку): календарь, записи, чекбоксы участников, CRM-клиенты, расчёт ЗП, переопределение суммы записи, роли. Не планируется здесь. ✓

**Согласованность имён:** `createWithDistribution`, `addInstance`, `importFromB24`, `requiredToolIds`, `compositeSum`, `childServiceIds`, `salary` — используются одинаково в сервисах, тестах и фронтенде.

**Плейсхолдеры:** не обнаружены — код приведён в каждом шаге.
