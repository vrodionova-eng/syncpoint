import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { toolsService } from '../services/toolsService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await toolsService.listInstances())));
r.post('/', asyncH(async (req, res) => ok(res, await toolsService.addInstance(req.body), 201)));
r.put('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.updateInstance(req.params.id, req.body))));
r.delete('/:id', asyncH(async (req, res) =>
  ok(res, await toolsService.removeInstance(req.params.id))));

export default r;
