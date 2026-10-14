export type Snapshot = Record<string, unknown>;
export type ConflictChoice = 'local' | 'remote';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : object(v)
  ? Object.fromEntries(Object.keys(v).sort().filter(key => v[key] !== undefined).map(key => [key, canonical(v[key])])) : v;
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Three-way merge: absence means deletion; never infer a deletion from a stale device. */
export function mergeSnapshots(base: Snapshot, local: Snapshot, remote: Snapshot, choice?: ConflictChoice) {
  if (equal(local, remote)) return { snapshot: remote, conflicts: [] as string[] };
  const conflicts: string[] = [];
  function merge(b: unknown, l: unknown, r: unknown, path: string): unknown {
    if (/^stock_items\.[^.]+\.quantity$/.test(path) && !equal(l, b) && !equal(r, b)) {
      conflicts.push(path); return choice === 'remote' ? r : l;
    }
    if (equal(l, b)) return r;
    if (equal(r, b)) return l;
    if (equal(l, r) && !path.startsWith('stock_items')) return l;
    if (object(b) && object(l) && object(r)) {
      const result: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(b[key], l[key], r[key], `${path}.${key}`);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    // Domain collections have stable ids. Preference arrays retain their ordering semantics.
    if (!path.includes('.') && Array.isArray(b) && Array.isArray(l) && Array.isArray(r)) {
      const key = (item: Record<string, unknown>) => `${item.pluginId ?? ''}:${item.id}`;
      if ([...b, ...l, ...r].every(item => object(item) && typeof item.id === 'string')) {
        const map = (items: Record<string, unknown>[]) => new Map(items.map(item => [key(item), item]));
        const bm = map(b), lm = map(l), rm = map(r);
        const result: unknown[] = [];
        for (const id of new Set([...rm.keys(), ...lm.keys(), ...bm.keys()])) {
          const value = merge(bm.get(id), lm.get(id), rm.get(id), `${path}.${id}`);
          if (value !== undefined) result.push(value);
        }
        return result;
      }
    }
    conflicts.push(path);
    return choice === 'remote' ? r : l;
  }
  const snapshot: Snapshot = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const value = merge(base[key], local[key], remote[key], key);
    if (value !== undefined) snapshot[key] = value;
  }
  if (!choice) {
    const links: Record<string, Record<string, string>> = {
      catalog_items: { stockItemId: 'stock_items' }, orders: { clientId: 'clients', employeeId: 'employees' },
      quotes: { clientId: 'clients', orderId: 'orders' }, contracts: { clientId: 'clients' },
      tasks: { clientId: 'clients', supplierId: 'suppliers', employeeId: 'employees' },
      calendar_events: { taskId: 'tasks', clientId: 'clients' }, transactions: { clientId: 'clients', supplierId: 'suppliers', taskId: 'tasks' },
      stock_movements: { itemId: 'stock_items' }, deliveries: { orderId: 'orders', employeeId: 'employees' },
      appointments: { clientId: 'clients', quoteId: 'quotes' }, commissions: { employeeId: 'employees', orderId: 'orders' },
    };
    const check = (domain: string, record: Record<string, unknown>, field: string, target: string, value: unknown) => {
      if (typeof value !== 'string' || !Array.isArray(snapshot[target])) return;
      if (!(snapshot[target] as Record<string, unknown>[]).some(item => item.id === value)) {
        conflicts.push(`${domain}.:${record.id}.${field}`, `reference:${target}:${value}`);
      }
    };
    for (const [domain, fields] of Object.entries(links)) for (const record of Array.isArray(snapshot[domain]) ? snapshot[domain] as Record<string, unknown>[] : []) {
      for (const [field, target] of Object.entries(fields)) check(domain, record, field, target, record[field]);
      if (['orders', 'quotes'].includes(domain) && Array.isArray(record.items)) for (const item of record.items as Record<string, unknown>[]) {
        check(domain, record, 'items.stockItemId', 'stock_items', item.stockItemId);
        check(domain, record, 'items.catalogItemId', 'catalog_items', item.catalogItemId);
      }
    }
  }
  return { snapshot, conflicts };
}

export const snapshotsEqual = equal;

/** Resolve a rejected operation as a group, including its generated accounting/stock/calendar rows. */
export function conflictGroup(base: Snapshot, local: Snapshot, remote: Snapshot, conflicts: string[]) {
  const changed = new Map<string, { domain: string; id: string; refs: Set<string> }>();
  const references = (value: unknown, refs: Set<string>) => {
    if (Array.isArray(value)) value.forEach(item => references(item, refs));
    else if (object(value)) for (const [key, item] of Object.entries(value)) {
      if (key.endsWith('Id') && typeof item === 'string') refs.add(item);
      else references(item, refs);
    }
  };
  for (const domain of Object.keys(base)) {
    if (!Array.isArray(base[domain]) || !Array.isArray(local[domain]) || !Array.isArray(remote[domain])) continue;
    const map = (snapshot: Snapshot) => new Map((snapshot[domain] as Record<string, unknown>[]).map(item => [String(item.pluginId ?? '') + ':' + item.id, item]));
    const bm = map(base), lm = map(local), rm = map(remote);
    for (const key of new Set([...bm.keys(), ...lm.keys(), ...rm.keys()])) {
      if (equal(bm.get(key), lm.get(key)) && equal(bm.get(key), rm.get(key))) continue;
      const item = lm.get(key) ?? rm.get(key) ?? bm.get(key)!;
      const refs = new Set<string>();
      for (const value of [bm.get(key), lm.get(key), rm.get(key)]) references(value, refs);
      changed.set(domain + '.' + key, { domain, id: String(item.id), refs });
    }
  }
  const affected = new Set([...changed.keys()].filter(key => conflicts.some(path => path === key || path.startsWith(key + '.'))));
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [key, value] of changed) {
      if (affected.has(key)) continue;
      if ([...affected].some(other => { const node = changed.get(other)!; return node.refs.has(value.id) || value.refs.has(node.id); })) { affected.add(key); expanded = true; }
    }
  }
  const financial = new Set(['stock_items', 'stock_movements', 'orders', 'quotes', 'transactions', 'commissions', 'contracts', 'deliveries', 'appointments']);
  return { affected, canKeepLocal: !conflicts.some(path => path.startsWith('reference:')) && ![...affected].some(key => financial.has(changed.get(key)!.domain)) };
}

export function resolveWithRemote(base: Snapshot, local: Snapshot, remote: Snapshot, choice: ConflictChoice = 'remote') {
  const conflicts = mergeSnapshots(base, local, remote).conflicts;
  const merged = mergeSnapshots(base, local, remote, choice);
  const group = conflictGroup(base, local, remote, conflicts);
  for (const domain of Object.keys(base)) {
    if (!Array.isArray(merged.snapshot[domain])) continue;
    const key = (item: Record<string, unknown>) => domain + '.' + String(item.pluginId ?? '') + ':' + item.id;
    const kept = (merged.snapshot[domain] as Record<string, unknown>[]).filter(item => !group.affected.has(key(item)));
    const chosen = ((choice === 'remote' ? remote : local)[domain] as Record<string, unknown>[]).filter(item => group.affected.has(key(item)));
    merged.snapshot[domain] = [...kept, ...chosen];
  }
  return merged.snapshot;
}
