import { bookingsRepo } from '../repositories/bookingsRepo.js';
import { workPointsRepo } from '../repositories/workPointsRepo.js';
import { employeesRepo } from '../repositories/employeesRepo.js';
import { servicesRepo } from '../repositories/servicesRepo.js';
import { toolsRepo } from '../repositories/toolsRepo.js';
import { toolInstancesRepo } from '../repositories/toolInstancesRepo.js';
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors.js';

const MIN_DURATION_MS = 5 * 60 * 1000;

function parseTime(v, label) {
  const t = Date.parse(v);
  if (!Number.isFinite(t)) throw new ValidationError(`Некорректная дата: ${label}`);
  return t;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Цена услуги по умолчанию (range — по минимуму, manual — 0).
function defaultPrice(svc, byId) {
  if (!svc) return 0;
  if (svc.isComposite) {
    if (svc.compositeSum === 'fixed') return svc.price ?? 0;
    if (svc.compositeSum === 'auto') {
      return (svc.childServiceIds || []).reduce((sum, id) => sum + defaultPrice(byId.get(id), byId), 0);
    }
    return 0; // manual
  }
  if (svc.priceType === 'fixed') return svc.price ?? 0;
  return svc.priceMin ?? 0; // range — консервативно по минимуму
}

function isEstimatedPrice(svc, byId) {
  if (!svc) return false;
  if (svc.isComposite) {
    if (svc.compositeSum === 'manual') return true;
    if (svc.compositeSum === 'auto') return (svc.childServiceIds || []).some((id) => isEstimatedPrice(byId.get(id), byId));
    return false;
  }
  return svc.priceType === 'range';
}

async function validateBody(body) {
  const workPoint = await workPointsRepo.get(body.workPointId);
  if (!workPoint) throw new ValidationError('Рабочая точка не найдена');

  const start = parseTime(body.start, 'начало');
  const end = parseTime(body.end, 'конец');
  if (end <= start) throw new ValidationError('Конец должен быть позже начала');
  if (end - start < MIN_DURATION_MS) throw new ValidationError('Минимальная длительность записи — 5 минут');

  const employeeIds = Array.isArray(body.employeeIds) ? [...new Set(body.employeeIds)] : [];
  if (!employeeIds.length) throw new ValidationError('Выберите хотя бы одного участника');
  for (const id of employeeIds) {
    if (!(await employeesRepo.get(id))) throw new ValidationError('Сотрудник не найден');
  }

  const serviceIds = Array.isArray(body.serviceIds) ? [...new Set(body.serviceIds)] : [];
  if (!serviceIds.length) throw new ValidationError('Выберите хотя бы одну услугу');
  const services = [];
  for (const id of serviceIds) {
    const s = await servicesRepo.get(id);
    if (!s) throw new ValidationError('Услуга не найдена');
    services.push(s);
  }

  let priceOverride = null;
  if (body.priceOverride !== null && body.priceOverride !== undefined && body.priceOverride !== '') {
    priceOverride = Number(body.priceOverride);
    if (!Number.isFinite(priceOverride) || priceOverride < 0) throw new ValidationError('Некорректная сумма');
  }

  let client = null;
  if (body.client && body.client.contactId != null) {
    client = { contactId: Number(body.client.contactId), name: String(body.client.name || '').trim() };
  }

  return {
    workPoint,
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
    employeeIds,
    serviceIds,
    services,
    priceOverride,
    client,
    note: body.note ? String(body.note).trim() : null,
  };
}

async function assertNoConflict(workPointId, startMs, endMs, excludeId = null) {
  const all = await bookingsRepo.list();
  for (const b of all) {
    if (b.id === excludeId || b.workPointId !== workPointId) continue;
    if (overlaps(startMs, endMs, Date.parse(b.start), Date.parse(b.end))) {
      const fmt = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      throw new ConflictError(`Точка занята: с ${fmt(b.start)} до ${fmt(b.end)}`);
    }
  }
}

// Мягкий подбор экземпляров: для каждого нужного инструмента берём первый
// свободный экземпляр пространства точки (или общий, spaceId = null), не занятый
// в других записях на это время. Нехватка — предупреждение, не блокировка.
async function assignTools(spaceId, services, startMs, endMs, excludeId) {
  const neededToolIds = [];
  const neededCounts = new Map();
  for (const s of services) {
    for (const tid of s.requiredToolIds || []) {
      if (!neededToolIds.includes(tid)) neededToolIds.push(tid);
      // Services in one booking share tools; reserve the largest requirement.
      neededCounts.set(tid, Math.max(neededCounts.get(tid) || 0, s.requiredToolCounts?.[tid] ?? 1));
    }
  }
  if (!neededToolIds.length) return { toolInstanceIds: [], warnings: [] };

  const [instances, all, tools] = await Promise.all([
    toolInstancesRepo.list(), bookingsRepo.list(), toolsRepo.list(),
  ]);
  const toolName = new Map(tools.map((t) => [t.id, t.name]));
  const serviceByTool = new Map();
  for (const s of services) {
    for (const tid of s.requiredToolIds || []) {
      if (!serviceByTool.has(tid)) serviceByTool.set(tid, s.name);
    }
  }

  const busy = new Set();
  for (const b of all) {
    if (b.id === excludeId) continue;
    if (overlaps(startMs, endMs, Date.parse(b.start), Date.parse(b.end))) {
      for (const iid of b.toolInstanceIds || []) busy.add(iid);
    }
  }

  const assigned = [];
  const warnings = [];
  for (const tid of neededToolIds) {
    const candidates = instances
      .filter((i) => i.toolId === tid && (i.spaceId === spaceId || i.spaceId == null) && !busy.has(i.id))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    candidates.sort((a, b) => Number(b.spaceId === spaceId) - Number(a.spaceId === spaceId));
    const picks = candidates.slice(0, neededCounts.get(tid));
    for (const pick of picks) {
      assigned.push(pick.id);
      busy.add(pick.id); // не выдать один экземпляр дважды внутри одной записи
    }
    if (picks.length < neededCounts.get(tid)) {
      warnings.push(`Не хватает инструмента «${toolName.get(tid) || tid}» для услуги «${serviceByTool.get(tid)}»`);
    }
  }
  return { toolInstanceIds: assigned, warnings };
}

function computePrice(services, priceOverride) {
  if (priceOverride != null) return { priceTotal: priceOverride, priceEstimated: false };
  const byId = new Map();
  return {
    priceTotal: services.reduce((sum, s) => sum + defaultPrice(s, byId), 0),
    priceEstimated: services.some((s) => isEstimatedPrice(s, byId)),
  };
}

export const bookingsService = {
  async list({ from, to, workPointId, spaceId } = {}) {
    let all = await bookingsRepo.list();
    if (workPointId) all = all.filter((b) => b.workPointId === workPointId);
    if (spaceId) all = all.filter((b) => b.spaceId === spaceId);
    const fromMs = from ? Date.parse(from) : null;
    const toMs = to ? Date.parse(to) : null;
    if (Number.isFinite(fromMs)) all = all.filter((b) => Date.parse(b.end) > fromMs);
    if (Number.isFinite(toMs)) all = all.filter((b) => Date.parse(b.start) < toMs);
    return all.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  },

  async get(id) {
    const b = await bookingsRepo.get(id);
    if (!b) throw new NotFoundError('Запись не найдена');
    return b;
  },

  async create(body) {
    const v = await validateBody(body);
    const startMs = Date.parse(v.startIso);
    const endMs = Date.parse(v.endIso);
    await assertNoConflict(v.workPoint.id, startMs, endMs);

    const { toolInstanceIds, warnings } = await assignTools(
      v.workPoint.spaceId, v.services, startMs, endMs, null,
    );
    const { priceTotal, priceEstimated } = computePrice(v.services, v.priceOverride);

    const booking = await bookingsRepo.create({
      workPointId: v.workPoint.id,
      spaceId: v.workPoint.spaceId,
      start: v.startIso,
      end: v.endIso,
      employeeIds: v.employeeIds,
      serviceIds: v.serviceIds,
      priceOverride: v.priceOverride,
      priceTotal,
      client: v.client,
      toolInstanceIds,
      warnings,
      note: v.note,
    });
    return { booking, priceEstimated, warnings };
  },

  async update(id, body) {
    const existing = await bookingsRepo.get(id);
    if (!existing) throw new NotFoundError('Запись не найдена');

    const v = await validateBody(body);
    const startMs = Date.parse(v.startIso);
    const endMs = Date.parse(v.endIso);
    await assertNoConflict(v.workPoint.id, startMs, endMs, id);

    const { toolInstanceIds, warnings } = await assignTools(
      v.workPoint.spaceId, v.services, startMs, endMs, id,
    );
    const { priceTotal, priceEstimated } = computePrice(v.services, v.priceOverride);

    const booking = await bookingsRepo.update(id, {
      workPointId: v.workPoint.id,
      spaceId: v.workPoint.spaceId,
      start: v.startIso,
      end: v.endIso,
      employeeIds: v.employeeIds,
      serviceIds: v.serviceIds,
      priceOverride: v.priceOverride,
      priceTotal,
      client: v.client,
      toolInstanceIds,
      warnings,
      note: v.note,
    });
    return { booking, priceEstimated, warnings };
  },

  async remove(id) {
    const ok = await bookingsRepo.remove(id);
    if (!ok) throw new NotFoundError('Запись не найдена');
    return { id };
  },
};
