import { employeesRepo } from '../repositories/employeesRepo.js';
import { servicesRepo } from '../repositories/servicesRepo.js';
import { bookingsRepo } from '../repositories/bookingsRepo.js';
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors.js';

const emptySalary = () => ({ mode: null, flatPercent: null, servicePercents: [] });

function cleanName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Укажите имя');
  }
  return name.trim();
}

export const employeesService = {
  list: () => employeesRepo.list(),
  async get(id) {
    const e = await employeesRepo.get(id);
    if (!e) throw new NotFoundError('Сотрудник не найден');
    return e;
  },
  async addManual({ name }) {
    return employeesRepo.create({
      name: cleanName(name),
      source: 'manual',
      b24UserId: null,
      salary: emptySalary(),
    });
  },
  async importFromB24(users = []) {
    const existing = await employeesRepo.list();
    const known = new Set(existing.filter((e) => e.b24UserId != null).map((e) => e.b24UserId));
    const created = [];
    for (const u of users) {
      const b24UserId = Number(u.id);
      if (known.has(b24UserId)) continue;
      known.add(b24UserId);
      created.push(await employeesRepo.create({
        name: cleanName(u.name),
        source: 'b24',
        b24UserId,
        salary: emptySalary(),
      }));
    }
    return created;
  },
  async update(id, { name }) {
    const e = await employeesRepo.update(id, { name: cleanName(name) });
    if (!e) throw new NotFoundError('Сотрудник не найден');
    return e;
  },
  async updateSalary(id, { mode, flatPercent, servicePercents }) {
    const e = await employeesRepo.get(id);
    if (!e) throw new NotFoundError('Сотрудник не найден');

    let salary;
    if (mode === 'flat') {
      const p = Number(flatPercent);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw new ValidationError('Процент должен быть от 0 до 100');
      }
      salary = { mode: 'flat', flatPercent: p, servicePercents: [] };
    } else if (mode === 'perService') {
      const list = Array.isArray(servicePercents) ? servicePercents : [];
      const cleaned = [];
      for (const row of list) {
        const p = Number(row.percent);
        if (!row.serviceId || !Number.isFinite(p) || p < 0 || p > 100) {
          throw new ValidationError('Некорректный процент по услуге (0–100)');
        }
        if (!(await servicesRepo.get(row.serviceId))) {
          throw new ValidationError('Услуга не найдена');
        }
        cleaned.push({ serviceId: row.serviceId, percent: p });
      }
      salary = { mode: 'perService', flatPercent: null, servicePercents: cleaned };
    } else if (mode === null || mode === undefined || mode === '') {
      salary = emptySalary();
    } else {
      throw new ValidationError('Неизвестный режим ЗП');
    }

    return employeesRepo.update(id, { salary });
  },
  async remove(id) {
    const bookings = await bookingsRepo.list();
    if (bookings.some((b) => (b.employeeIds || []).includes(id))) {
      throw new ConflictError('Нельзя удалить: сотрудник участвует в записях');
    }
    const ok = await employeesRepo.remove(id);
    if (!ok) throw new NotFoundError('Сотрудник не найден');
    return { id };
  },
};
