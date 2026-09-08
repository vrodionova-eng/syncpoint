/** Базовая ошибка приложения с http-статусом и кодом. */
export class AppError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION') { super(message, code, 400); }
}

export class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') { super(message, code, 409); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Не найдено', code = 'NOT_FOUND') { super(message, code, 404); }
}
