import { PersistenceError } from './persistenceErrors';

export const businessCollections = ['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items'] as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const invalid = (message: string): never => { throw new PersistenceError(message, '22023'); };
/** Validate before sending and before presenting success. Legacy dates remain intact. */
export function assertBusinessSnapshot(snapshot: Record<string, unknown>) {
  if (!object(snapshot.preferences)) invalid('Configurações inválidas. Revise antes de salvar.');
  if (JSON.stringify(snapshot).length > 2_000_000) invalid('A conta excedeu o tamanho permitido. Solicite suporte antes de continuar.');
  for (const domain of businessCollections) {
    const items = snapshot[domain];
    if (!Array.isArray(items) || items.length > 5000) invalid(`Coleção inválida: ${domain}.`);
    const seen = new Set<string>();
    for (const item of items as unknown[]) {
      if (!object(item) || typeof item.id !== 'string' || !item.id.length || item.id.length > 100) invalid(`Registro inválido em ${domain}.`);
      const row = item as Record<string, unknown>;
      const id = `${row.pluginId ?? ''}:${row.id}`;
      if (seen.has(id)) invalid(`Registro duplicado em ${domain}.`);
      seen.add(id);
      const field = ['clients','suppliers','employees','stock_items','catalog_items'].includes(domain) ? 'name'
        : ['tasks','calendar_events','transactions'].includes(domain) ? 'description' : null;
      if (field && (typeof row[field] !== 'string' || !(row[field] as string).trim() || (row[field] as string).length > (field === 'name' ? 200 : 2000))) invalid(`O campo ${field === 'name' ? 'nome' : 'descrição'} excede o limite ou está vazio.`);
      for (const key of ['amount','total','value','quantity','unitPrice','commissionRate']) {
        if (key in row && (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || Math.abs(row[key] as number) > 1_000_000_000 || (key !== 'amount' && domain !== 'stock_movements' && (row[key] as number) < 0))) invalid(`Valor inválido em ${domain}.`);
      }
      if (domain === 'employees' && typeof row.commissionRate === 'number' && row.commissionRate > 100) invalid('A comissão deve estar entre 0 e 100%.');
      if (domain === 'orders' || domain === 'quotes') {
        if (!Array.isArray(row.items) || row.items.length > 200) invalid('Itens do documento inválidos.');
        for (const line of row.items as unknown[]) if (!object(line) || typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0 || typeof line.unitPrice !== 'number' || !Number.isFinite(line.unitPrice) || line.unitPrice < 0) invalid('Revise quantidade e preço de todos os itens.');
      }
    }
  }
}
