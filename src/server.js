import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import spacesRouter from './routes/spaces.js';
import workPointsRouter from './routes/workPoints.js';
import toolsRouter from './routes/tools.js';
import toolInstancesRouter from './routes/toolInstances.js';
import servicesRouter from './routes/services.js';
import serviceCategoriesRouter from './routes/serviceCategories.js';
import employeesRouter from './routes/employees.js';
import b24Router from './routes/b24.js';
import bookingsRouter from './routes/bookings.js';
import payrollRouter from './routes/payroll.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, data: { status: 'up' } }));

app.use('/api/spaces', spacesRouter);
app.use('/api/work-points', workPointsRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/tool-instances', toolInstancesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/service-categories', serviceCategoriesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/b24', b24Router);
app.use('/api/bookings', bookingsRouter);
app.use('/api/payroll', payrollRouter);

app.post('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    ok: false,
    error: { message: err.message || 'Внутренняя ошибка', code: err.code || 'INTERNAL' },
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
  });
}

export default app;
