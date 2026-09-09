import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
  let pending = Promise.resolve();
  const enqueue = (operation) => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };

  async function load() {
    if (cache) return cache;
    const loaded = new Map();
    const p = filePath();
    if (existsSync(p)) {
      const raw = await readFile(p, 'utf8');
      const arr = JSON.parse(raw || '[]');
      for (const item of arr) loaded.set(item.id, item);
    }
    cache = loaded;
    return cache;
  }

  async function persist(next) {
    await mkdir(dataDir(), { recursive: true });
    const tmp = filePath() + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(tmp, JSON.stringify([...next.values()], null, 2), { flag: 'wx' });
      await rename(tmp, filePath());
      cache = next;
    } finally {
      await unlink(tmp).catch(() => {});
    }
  }

  return {
    all() { return enqueue(async () => [...(await load()).values()]); },
    get(id) { return enqueue(async () => (await load()).get(id) ?? null); },
    set(item) { return enqueue(async () => {
      const next = new Map(await load());
      next.set(item.id, item);
      await persist(next);
      return item;
    }); },
    delete(id) { return enqueue(async () => {
      const m = new Map(await load());
      const ok = m.delete(id);
      if (ok) await persist(m);
      return ok;
    }); },
    /** Сбросить кэш (для тестов и смены DATA_DIR). */
    _reset() { cache = null; },
  };
}
