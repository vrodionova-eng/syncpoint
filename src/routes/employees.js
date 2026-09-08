import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { employeesService } from '../services/employeesService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await employeesService.list())));
r.get('/:id', asyncH(async (req, res) => ok(res, await employeesService.get(req.params.id))));
r.post('/', asyncH(async (req, res) => ok(res, await employeesService.addManual(req.body), 201)));
r.post('/import', asyncH(async (req, res) =>
  ok(res, await employeesService.importFromB24(req.body?.users || []), 201)));
r.put('/:id', asyncH(async (req, res) => ok(res, await employeesService.update(req.params.id, req.body))));
r.put('/:id/salary', asyncH(async (req, res) =>
  ok(res, await employeesService.updateSalary(req.params.id, req.body))));
r.delete('/:id', asyncH(async (req, res) => ok(res, await employeesService.remove(req.params.id))));

export default r;
