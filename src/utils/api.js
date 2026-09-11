// Обёртка над VibeCode API
// Документация: https://vibecode.bitrix24.tech/llms-full.txt

const BASE_URL = process.env.VIBE_BASE_URL || 'https://vibecode.bitrix24.tech/v1';

function getApiKey() {
  const key = process.env.VIBE_API_KEY;
  if (!key) throw new Error('VIBE_API_KEY не задан в .env');
  return key;
}

/**
 * Основной метод для вызова VibeCode API
 * @param {string} path — эндпоинт, например '/deals'
 * @param {object} options — { method, body, params }
 */
export async function vibe(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE_URL}${path}`);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    method,
    headers: {
      'X-Api-Key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || (!data.success && data.error)) {
    throw new Error(`[${data.error?.code || res.status}] ${data.error?.message || JSON.stringify(data.error)}`);
  }

  return data;
}

/**
 * Извлекает массив из ответа VibeCode
 * API возвращает данные в data.data или data.result — обработка обоих форматов
 */
export function unwrap(response) {
  return response?.data ?? response?.result ?? [];
}

/**
 * Получить все записи с автоматической пагинацией
 * @param {string} path — эндпоинт
 * @param {object} params — параметры запроса
 * @param {number} limit — записей за запрос (макс 500)
 */
export async function fetchAll(path, params = {}, limit = 50) {
  const results = [];
  let offset = 0;

  while (true) {
    const response = await vibe(path, { params: { ...params, limit, offset } });
    const items = unwrap(response);
    results.push(...items);
    if (response.meta?.hasMore === false || !items.length || (response.meta?.hasMore !== true && items.length < limit)) break;
    offset += limit;
  }

  return results;
}
