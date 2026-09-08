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
