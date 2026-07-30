/**
 * Gerador de identificadores aleatórios "fake" (não é um UUID v4 real, mas
 * cumpre o mesmo papel: ids únicos e tokens de sessão para o backend
 * simulado). Quando o backend real (Django) entrar, ids e tokens passarão
 * a vir do servidor e esta função deixa de ser usada.
 */
export function generateId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}${timestamp}${random}`;
}

export function generateFakeToken(): string {
  return generateId('tok_');
}
