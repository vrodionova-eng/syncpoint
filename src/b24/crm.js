import { vibe, unwrap } from '../utils/api.js';

/**
 * Поиск контактов CRM Б24 через VibeCode API.
 * Возвращает [{ id, name, phone }] в нормализованном виде.
 */
export async function searchContacts(query = '') {
  const items = await searchEntity('contacts', query, ['name', 'lastName', 'phone']);
  return items.map(normalize);
}

/** Создать контакт CRM. Возвращает { id, name }. */
export async function createContact({ name, phone }) {
  const fields = { name };
  if (phone) {
    fields.phone = phone;
  }
  const response = await vibe('/contacts', { method: 'POST', body: fields });
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
    phone: typeof phones === 'string' ? phones : first?.VALUE ?? first?.value ?? null,
  };
}

async function searchEntity(entity, query, fields) {
  const params = query.trim() ? fields.map((field) => ({ [`filter[%${field}]`]: query.trim(), limit: 20 })) : [{ limit: 20 }];
  const responses = await Promise.all(params.map((params) => vibe(`/${entity}`, { params })));
  return [...new Map(responses.flatMap(unwrap).map((item) => [item.id ?? item.ID, item])).values()];
}

export async function searchClients(query = '') {
  const [contacts, companies] = await Promise.all([
    searchContacts(query), searchEntity('companies', query, ['title', 'phone']),
  ]);
  return [...contacts.map((c) => ({ ...c, type: 'contact' })),
    ...companies.map((c) => ({ id: Number(c.id ?? c.ID), name: c.title ?? c.TITLE,
      phone: typeof c.phone === 'string' ? c.phone : null, type: 'company' }))];
}
