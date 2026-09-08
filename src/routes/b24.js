import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { fetchB24Users } from '../b24/users.js';
import { searchContacts, createContact } from '../b24/crm.js';
import { ValidationError } from '../lib/errors.js';

const r = Router();

r.get('/users', asyncH(async (req, res) => ok(res, await fetchB24Users())));

r.get('/crm/contacts', asyncH(async (req, res) =>
  ok(res, await searchContacts(String(req.query.query || '')))));

r.post('/crm/contacts', asyncH(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) throw new ValidationError('Укажите имя контакта');
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
  ok(res, await createContact({ name, phone }), 201);
}));

export default r;
