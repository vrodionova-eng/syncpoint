import { fetchAll } from '../utils/api.js';

/**
 * Получить пользователей портала Б24 через VibeCode API.
 * Возвращает [{ id, name }] в нормализованном виде.
 */
export async function fetchB24Users() {
  const items = await fetchAll('/users', { 'filter[active]': 'true' });
  return items.map((u) => ({
    id: u.ID ?? u.id,
    name: [u.NAME ?? u.name, u.LAST_NAME ?? u.lastName].filter(Boolean).join(' ').trim()
      || (u.EMAIL ?? `Пользователь ${u.ID ?? u.id}`),
  }));
}
