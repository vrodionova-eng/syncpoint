import { workPointsRepo } from '../repositories/workPointsRepo.js';
import { spacesRepo } from '../repositories/spacesRepo.js';
import { bookingsRepo } from '../repositories/bookingsRepo.js';
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors.js';

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
    const bookings = await bookingsRepo.list();
    if (bookings.some((b) => b.workPointId === id)) {
      throw new ConflictError('Нельзя удалить: на точку есть записи');
    }
    const ok = await workPointsRepo.remove(id);
    if (!ok) throw new NotFoundError('Рабочая точка не найдена');
    return { id };
  },
};
