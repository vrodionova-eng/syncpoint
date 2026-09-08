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
