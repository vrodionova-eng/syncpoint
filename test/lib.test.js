import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../src/lib/id.js';
import { AppError, ValidationError, ConflictError, NotFoundError } from '../src/lib/errors.js';

test('newId возвращает уникальные строки', () => {
  const a = newId();
  const b = newId();
  assert.equal(typeof a, 'string');
  assert.equal(a.length, 16);
  assert.notEqual(a, b);
});

test('ошибки несут message, code и http-статус', () => {
  const v = new ValidationError('Укажите название');
  assert.equal(v.status, 400);
  assert.equal(v.code, 'VALIDATION');
  assert.equal(v.message, 'Укажите название');

  assert.ok(v instanceof AppError);
  assert.equal(new ConflictError('занято').status, 409);
  assert.equal(new NotFoundError().status, 404);
});
