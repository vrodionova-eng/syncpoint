import { toolsRepo } from '../repositories/toolsRepo.js';
import { toolInstancesRepo } from '../repositories/toolInstancesRepo.js';
import { spacesRepo } from '../repositories/spacesRepo.js';
import { servicesRepo } from '../repositories/servicesRepo.js';
import { bookingsRepo } from '../repositories/bookingsRepo.js';
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors.js';

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
  create: ({ name }) => toolsRepo.create({ name: cleanName(name) }),
  async createWithDistribution({ name, distribution = [] }) {
    const n = cleanName(name);
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
    const bookings = await bookingsRepo.list();
    if (bookings.some((b) => (b.toolInstanceIds || []).includes(id))) {
      throw new ConflictError('Нельзя удалить: экземпляр забронирован в записях');
    }
    const ok = await toolInstancesRepo.remove(id);
    if (!ok) throw new NotFoundError('Экземпляр не найден');
    return { id };
  },
};
