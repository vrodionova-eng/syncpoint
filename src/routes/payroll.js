import { Router } from 'express';
import { asyncH, ok } from './crudRouter.js';
import { payrollService } from '../services/payrollService.js';

const r = Router();

r.get('/', asyncH(async (req, res) => ok(res, await payrollService.calc(req.query))));

export default r;
