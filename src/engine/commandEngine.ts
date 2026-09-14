import type { PluginId } from '../plugins/registry';

export type CommandAction =
  | 'add_client'
  | 'add_supplier'
  | 'add_employee'
  | 'add_stock'
  | 'add_catalog'
  | 'add_generic';

export interface ParsedCommand {
  action: CommandAction;
  command: string;
  args: Record<string, string>;
  positional: string[];
  raw: string;
  pluginId?: PluginId;
}

export interface CommandMenuRequest {
  menu: 'clientes' | 'fornecedores' | 'equipe' | 'estoque' | 'catalogo' | 'vendas' | 'orcamentos' | 'entregas' | 'contratos' | 'comissoes' | 'agenda';
  raw: string;
}

export interface CommandDefinition {
  name: string;
  aliases: string[];
  action?: CommandAction;
  pluginId?: PluginId;
  label: string;
  usage: string;
  required: string[];
  menuOnly?: boolean;
}

const definitions: CommandDefinition[] = [
  { name: 'cliente', aliases: [], label: 'Clientes', usage: 'Adicionar, consultar, editar ou excluir clientes', required: [], menuOnly: true },
  { name: 'fornecedor', aliases: [], label: 'Fornecedores', usage: 'Adicionar, consultar, editar ou excluir fornecedores', required: [], menuOnly: true },
  { name: 'estoque', aliases: [], label: 'Estoque', usage: 'Adicionar itens, dar entrada, dar baixa ou consultar saldo', required: [], menuOnly: true },
  { name: 'catalogo', aliases: [], label: 'Catálogo', usage: 'Adicionar produtos/serviços ou consultar o catálogo', required: [], menuOnly: true },
  { name: 'venda', aliases: ['vendas'], label: 'Vendas', usage: 'Criar venda, consultar pedidos ou ver vendas da semana', required: [], menuOnly: true },
  { name: 'orcamento', aliases: ['orcamentos'], label: 'Orçamentos', usage: 'Criar, consultar, aprovar ou recusar orçamentos', required: [], menuOnly: true },
  { name: 'entrega', aliases: ['entregas'], label: 'Entregas', usage: 'Criar entrega ou consultar entregas pendentes', required: [], menuOnly: true },
  { name: 'contrato', aliases: ['contratos'], label: 'Contratos', usage: 'Criar contrato ou consultar vencimentos', required: [], menuOnly: true },
  { name: 'comissao', aliases: ['comissoes'], label: 'Comissões', usage: 'Consultar ou fechar comissões', required: [], menuOnly: true },
  { name: 'agenda', aliases: [], label: 'Agenda', usage: 'Agendar atendimento ou consultar horários', required: [], menuOnly: true },
  { name: 'funcionario', aliases: ['funcionarios'], label: 'Equipe', usage: 'Adicionar ou consultar funcionários', required: [], menuOnly: true },
  { name: 'adicionarcliente', aliases: ['cliente', 'addcliente'], action: 'add_client', label: 'Adicionar cliente', usage: '/adicionarcliente nome="Maria" contato="11999999999" observacoes="VIP"', required: ['nome'] },
  { name: 'adicionarfornecedor', aliases: ['fornecedor', 'addfornecedor'], action: 'add_supplier', label: 'Adicionar fornecedor', usage: '/adicionarfornecedor nome="Atacado Silva" contato="..." prazo="30 dias"', required: ['nome'] },
  { name: 'adicionarequipe', aliases: ['equipe', 'addfuncionario'], action: 'add_employee', label: 'Adicionar funcionário', usage: '/adicionarequipe nome="João" funcao="Vendedor" contato="..." comissao="10"', required: ['nome'] },
  { name: 'adicionarestoque', aliases: ['estoque', 'addestoque'], action: 'add_stock', label: 'Adicionar item ao estoque', usage: '/adicionarestoque nome="Arroz" quantidade="10" unidade="kg" categoria="Mercearia" minimo="2"', required: ['nome'] },
  { name: 'adicionarcatalogo', aliases: ['catalogo', 'addcatalogo'], action: 'add_catalog', label: 'Adicionar item ao catálogo', usage: '/adicionarcatalogo nome="Corte" tipo="servico" preco="50" unidade="un"', required: ['nome'] },
];

const normalize = (value: string) => value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function getCommandDefinitions(): CommandDefinition[] { return definitions; }

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote = '';
  for (const char of input) {
    if (quote) {
      if (char === quote) quote = '';
      else current += char;
    } else if (char === '"' || char === "'") quote = char;
    else if (/\s/.test(char)) { if (current) { tokens.push(current); current = ''; } }
    else current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseCommand(input: string): ParsedCommand | CommandMenuRequest | { help: true; raw: string } | null {
  const raw = input.trim();
  if (!raw.startsWith('/')) return null;
  const tokens = tokenize(raw.slice(1));
  const command = normalize(tokens.shift() ?? '');
  if (!command || command === 'ajuda' || command === 'help') return { help: true, raw };
  const definition = definitions.find((item) => item.name === command || item.aliases.includes(command));
  if (!definition?.action && definition?.menuOnly) {
    const menuNames: Record<string, CommandMenuRequest['menu']> = {
      cliente: 'clientes', fornecedor: 'fornecedores', funcionario: 'equipe', estoque: 'estoque',
      catalogo: 'catalogo', venda: 'vendas', orcamento: 'orcamentos', entrega: 'entregas',
      contrato: 'contratos', comissao: 'comissoes', agenda: 'agenda',
    };
    return { menu: menuNames[definition.name] ?? 'clientes', raw };
  }
  if (!definition?.action) return { help: true, raw };
  if (tokens.length === 0 && definition.aliases.includes(command)) {
    const menu = definition.action === 'add_client' ? 'clientes'
      : definition.action === 'add_supplier' ? 'fornecedores'
      : definition.action === 'add_employee' ? 'equipe'
      : definition.action === 'add_stock' ? 'estoque' : 'catalogo';
    return { menu, raw };
  }

  const args: Record<string, string> = {};
  const positional: string[] = [];
  for (const token of tokens) {
    const separator = token.indexOf('=');
    if (separator > 0) args[normalize(token.slice(0, separator))] = token.slice(separator + 1).trim();
    else positional.push(token);
  }
  if (!args.nome && positional.length) args.nome = positional.join(' ');
  return { action: definition.action, command, args, positional, raw, pluginId: definition.pluginId };
}

export function commandDefinition(input: string): CommandDefinition | undefined {
  const command = normalize(input.replace(/^\//, '').split(/\s/)[0]);
  return definitions.find((item) => item.name === command || item.aliases.includes(command));
}

export function buildCommandHelp(): string {
  return ['Comandos rápidos:', ...definitions.map((item) => `${item.usage}`), 'Use /ajuda para ver esta lista.'].join('\n');
}

export function missingCommandFields(command: ParsedCommand): string[] {
  const definition = definitions.find((item) => item.name === command.command || item.aliases.includes(command.command));
  return (definition?.required ?? []).filter((field) => !command.args[field]);
}
