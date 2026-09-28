/**
 * Gerador de IDs legados preservados na migração para tabelas remotas.
 */
export function generateId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}${timestamp}${random}`;
}
