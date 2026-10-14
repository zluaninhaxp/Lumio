export class PersistenceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'PersistenceError'; }
}
export function isRejectedValidation(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error
    && ['23502', '23503', '23514', '23505', '22023', '22P02'].includes(String(error.code));
}
