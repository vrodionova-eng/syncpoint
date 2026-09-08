import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { bookingsService } from '../services/bookingsService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await bookingsService.list(req.query))));
r.get('/:id', asyncH(async (req, res) => ok(res, await bookingsService.get(req.params.id))));
r.post('/', asyncH(async (req, res) => ok(res, await bookingsService.create(req.body), 201)));
r.put('/:id', asyncH(async (req, res) => ok(res, await bookingsService.update(req.params.id, req.body))));
r.delete('/:id', asyncH(async (req, res) => ok(res, await bookingsService.remove(req.params.id))));

export default r;
