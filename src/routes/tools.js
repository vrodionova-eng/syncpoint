import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { toolsService } from '../services/toolsService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await toolsService.list())));
r.get('/:id', asyncH(async (req, res) => ok(res, await toolsService.get(req.params.id))));
r.post('/', asyncH(async (req, res) =>
  ok(res, await toolsService.createWithDistribution(req.body), 201)));
r.put('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.update(req.params.id, req.body))));
r.delete('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.remove(req.params.id))));

export default r;
