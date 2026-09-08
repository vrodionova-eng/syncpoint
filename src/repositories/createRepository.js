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
