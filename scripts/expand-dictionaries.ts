import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArrayLiteralExpression, Node, Project, SourceFile, VariableDeclaration } from 'ts-morph';

type Engine = 'taskEngine' | 'financialEngine' | 'calendarEngine';
type PendingTerms = { label: string; terms: string[] };

interface DictionaryTarget {
  engine: Engine;
  filePath: string;
  constantName: string;
  label: string;
  array: ArrayLiteralExpression;
  values: string[];
}

interface TargetReport {
  engine: Engine;
  constant: string;
  proposed: number;
  accepted: number;
  discardedDuplicates: number;
  conflicts: number;
  acceptedTerms: string[];
  conflictTerms: string[];
  errors?: string[];
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = resolve(ROOT, 'scripts/expand-dictionaries.report.json');
const PENDING_PATH = resolve(ROOT, 'scripts/pending-terms.json');
const files: Record<Engine, string> = {
  taskEngine: resolve(ROOT, 'src/engine/taskEngine/dictionaries.ts'),
  financialEngine: resolve(ROOT, 'src/engine/financialEngine/dictionaries.ts'),
  calendarEngine: resolve(ROOT, 'src/engine/calendarEngine/dictionaries.ts'),
};

function usage(): never {
  console.error('Uso: npx tsx scripts/expand-dictionaries.ts --dry-run [--only NOME[,NOME]]');
  console.error('     npx tsx scripts/expand-dictionaries.ts --apply [--only=NOME[,NOME]]');
  process.exit(2);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stringValues(array: ArrayLiteralExpression): string[] {
  return array.getElements()
    .filter((element) => Node.isStringLiteral(element) || Node.isNoSubstitutionTemplateLiteral(element))
    .map((element) => element.getLiteralValue());
}

function isExported(declaration: VariableDeclaration): boolean {
  return declaration.getVariableStatement()?.isExported() ?? false;
}

function collectTargets(sourceFile: SourceFile, engine: Engine): DictionaryTarget[] {
  const targets: DictionaryTarget[] = [];
  for (const declaration of sourceFile.getVariableDeclarations()) {
    if (!isExported(declaration)) continue;
    const initializer = declaration.getInitializer();
    if (!initializer) continue;
    const name = declaration.getName();
    if (Node.isArrayLiteralExpression(initializer)) {
      const values = stringValues(initializer);
      if (values.length || initializer.getElements().length === 0) {
        targets.push({ engine, filePath: sourceFile.getFilePath(), constantName: name, label: name, array: initializer, values });
      }
      continue;
    }
    if (!Node.isObjectLiteralExpression(initializer)) continue;
    for (const property of initializer.getProperties()) {
      if (!Node.isPropertyAssignment(property)) continue;
      const value = property.getInitializer();
      if (!value || !Node.isArrayLiteralExpression(value)) continue;
      const values = stringValues(value);
      if (!values.length && value.getElements().length !== 0) continue;
      targets.push({
        engine,
        filePath: sourceFile.getFilePath(),
        constantName: name,
        label: `${name}.${property.getName().replace(/^['"]|['"]$/g, '')}`,
        array: value,
        values,
      });
    }
  }
  return targets;
}

function readPending(): PendingTerms[] {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(PENDING_PATH, 'utf8')); } catch (error) {
    throw new Error(`Não foi possível ler ${PENDING_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(parsed)) throw new Error('pending-terms.json deve conter um array');
  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || typeof (item as PendingTerms).label !== 'string' || !Array.isArray((item as PendingTerms).terms) || (item as PendingTerms).terms.some((term) => typeof term !== 'string')) {
      throw new Error(`Entrada ${index + 1} de pending-terms.json é inválida`);
    }
    return item as PendingTerms;
  });
}

function existingTerms(targets: DictionaryTarget[]): Map<string, DictionaryTarget[]> {
  const index = new Map<string, DictionaryTarget[]>();
  for (const target of targets) for (const value of target.values) {
    const key = normalize(value);
    index.set(key, [...(index.get(key) ?? []), target]);
  }
  return index;
}

function isEngineConflict(target: DictionaryTarget, other: DictionaryTarget): boolean {
  return (target.engine === 'taskEngine' && other.engine === 'financialEngine') ||
    (target.engine === 'financialEngine' && other.engine === 'taskEngine');
}

function addTerm(array: ArrayLiteralExpression, value: string): void {
  const values = stringValues(array);
  const sorted = values.every((item, index) => index === 0 || normalize(item).localeCompare(normalize(values[index - 1]), 'pt-BR') >= 0);
  if (!sorted) { array.addElement(JSON.stringify(value)); return; }
  const index = values.findIndex((item) => normalize(item).localeCompare(normalize(value), 'pt-BR') > 0);
  array.insertElement(index < 0 ? values.length : index, JSON.stringify(value));
}

function testFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? testFiles(path) : entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

function parseOnly(args: string[]): string[] | undefined {
  const index = args.findIndex((arg) => arg === '--only');
  const inline = args.find((arg) => arg.startsWith('--only='));
  const value = inline?.slice('--only='.length) ?? (index >= 0 ? args[index + 1] : undefined);
  if (index >= 0 && (!value || value.startsWith('--'))) usage();
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run');
  if (apply === dryRun) usage();
  const only = parseOnly(args);
  const pending = readPending().filter((item) => !only || only.includes(item.label));
  const project = new Project({ tsConfigFilePath: resolve(ROOT, 'tsconfig.json'), skipAddingFilesFromTsConfig: true });
  const sourceFiles = (Object.entries(files) as [Engine, string][]).map(([engine, filePath]) => [engine, project.addSourceFileAtPath(filePath)] as const);
  const allTargets = sourceFiles.flatMap(([engine, sourceFile]) => collectTargets(sourceFile, engine));
  const byLabel = new Map(allTargets.map((target) => [target.label, target]));
  const selected = pending.map((item) => {
    const target = byLabel.get(item.label);
    if (!target) throw new Error(`Dicionário não encontrado para "${item.label}"`);
    return { target, terms: item.terms };
  });
  if (!selected.length) throw new Error('Nenhum termo pendente selecionado');
  const index = existingTerms(allTargets);
  const snapshots = new Map<string, string>(sourceFiles.map(([, sourceFile]) => [sourceFile.getFilePath(), sourceFile.getFullText()]));
  const reports: TargetReport[] = [];

  for (const { target, terms } of selected) {
    const report: TargetReport = { engine: target.engine, constant: target.label, proposed: terms.length, accepted: 0, discardedDuplicates: 0, conflicts: 0, acceptedTerms: [], conflictTerms: [] };
    const seen = new Set<string>();
    for (const suggestion of terms) {
      const value = suggestion.trim();
      const key = normalize(value);
      if (!value || seen.has(key) || index.has(key)) { report.discardedDuplicates++; continue; }
      seen.add(key);
      const collision = index.get(key)?.find((other) => other !== target && isEngineConflict(target, other));
      if (collision) { report.conflicts++; report.conflictTerms.push(value); continue; }
      report.accepted++; report.acceptedTerms.push(value); index.set(key, [target]);
      if (apply) addTerm(target.array, value);
    }
    reports.push(report);
  }

  writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), mode: apply ? 'apply' : 'dry-run', targets: reports }, null, 2) + '\n', 'utf8');
  for (const item of reports) {
    if (item.acceptedTerms.length) console.log(`\n${item.constant}:`);
    for (const term of item.acceptedTerms) console.log(`+ ${JSON.stringify(term)}`);
    for (const term of item.conflictTerms) console.log(`! conflito: ${JSON.stringify(term)}`);
  }
  if (!apply) return;

  try {
    await project.save();
    const testCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    execFileSync(testCommand, ['tsx', '--test', ...testFiles(resolve(ROOT, 'src/engine')), ...testFiles(resolve(ROOT, 'src/store'))], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  } catch (error) {
    for (const [filePath, contents] of snapshots) writeFileSync(filePath, contents, 'utf8');
    console.error(`Expansão revertida após falha: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Termos revertidos: ${reports.flatMap((item) => item.acceptedTerms).join(', ') || '(nenhum)'}`);
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
