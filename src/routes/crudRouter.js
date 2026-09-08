import { Router } from 'express';

/** Оборачивает async-хендлер, прокидывает ошибки в error-middleware. */
export function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
}

/** Успешный ответ в едином формате. */
export function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

/**
 * Строит стандартный CRUD-router из сервиса
 * с методами list/get/create/update/remove.
 */
export function crudRouter(service) {
  const r = Router();
  r.get('/', asyncH(async (req, res) => ok(res, await service.list())));
  r.get('/:id', asyncH(async (req, res) => ok(res, await service.get(req.params.id))));
  r.post('/', asyncH(async (req, res) => ok(res, await service.create(req.body), 201)));
  r.put('/:id', asyncH(async (req, res) => ok(res, await service.update(req.params.id, req.body))));
  r.delete('/:id', asyncH(async (req, res) => ok(res, await service.remove(req.params.id))));
  return r;
}
