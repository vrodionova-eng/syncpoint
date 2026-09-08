import { vibe, unwrap } from '../utils/api.js';

/**
 * Поиск контактов CRM Б24 через VibeCode API.
 * Возвращает [{ id, name, phone }] в нормализованном виде.
 */
export async function searchContacts(query = '') {
  const response = await vibe('/crm/contacts', { params: { query, limit: 20 } });
  const items = unwrap(response);
  return items.map(normalize);
}

/** Создать контакт CRM. Возвращает { id, name }. */
export async function createContact({ name, phone }) {
  const fields = { NAME: name };
  if (phone) {
    fields.PHONE = [{ VALUE: phone, VALUE_TYPE: 'WORK' }];
  }
  const response = await vibe('/crm/contacts', { method: 'POST', body: fields });
  const data = response?.data ?? response?.result ?? {};
  const id = data.id ?? data.ID ?? data;
  return { id: Number(id), name };
}

function normalize(c) {
  const phones = c.PHONE || c.phone || [];
  const first = Array.isArray(phones) ? phones[0] : null;
  return {
    id: Number(c.ID ?? c.id),
    name: [c.NAME ?? c.name, c.LAST_NAME ?? c.lastName].filter(Boolean).join(' ').trim()
      || (c.SECOND_NAME ?? '') || `Контакт ${c.ID ?? c.id}`,
    phone: first?.VALUE ?? first?.value ?? null,
  };
}
