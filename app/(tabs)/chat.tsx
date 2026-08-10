import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { parseMessage, buildBotResponse } from '../../src/engine/regexEngine';
import { useAppStore } from '../../src/store';
import VoiceInput from '../components/onboarding/VoiceInput';
import { MASCOT_IMAGES } from '../../src/data/mascotExpressions';
import { suggestedDueDate } from '../../src/utils/supplier';

interface Message {
  id: string;
  type: 'user' | 'bot' | 'fallback';
  text: string;
  actions?: string[];
  timestamp: Date;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '0',
    type: 'bot',
    text: 'Olá! Pode digitar qualquer coisa aqui — gastos, tarefas, compromissos. Eu cuido do resto. 👋',
    timestamp: new Date(),
  },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { addTransaction, addTask, addEvent, addPedido, pedidos, clienteItems, transactions, fornecedorItems, estoqueItems, moveEstoqueItem } = useAppStore();

  const resolveClient = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase().replace(/^(?:do|da|de)\s+/i, '');
    return clienteItems.filter((client) => client.name.toLowerCase().includes(normalized) || normalized.includes(client.name.toLowerCase()));
  }, [clienteItems]);

  const formatMoney = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const resolveSupplier = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase().replace(/^(?:do|da|de)\s+/i, '');
    return fornecedorItems.filter((supplier) => supplier.name.toLowerCase().includes(normalized) || normalized.includes(supplier.name.toLowerCase()));
  }, [fornecedorItems]);
  const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
  const resolveStockItem = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase();
    return estoqueItems.filter((item) => item.name.toLowerCase().includes(normalized) || normalized.includes(item.name.toLowerCase()));
  }, [estoqueItems]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text,
      timestamp: new Date(),
    };

    const parsed = parseMessage(text);
    let botText = buildBotResponse(parsed);

    let actions: string[] = [];
    let botType: 'bot' | 'fallback' = 'bot';

    if (parsed.intent === 'ORDER_CREATE' || parsed.intent === 'ORDER_OPEN_QUERY' || parsed.intent === 'SALES_WEEK_QUERY') {
      if (parsed.intent === 'ORDER_OPEN_QUERY') {
        const openOrders = pedidos.filter((order) => order.status === 'aberto');
        botText = openOrders.length ? `Pedidos em aberto: ${openOrders.map((order) => `#${order.id.slice(-6)}`).join(', ')}.` : 'Não há pedidos em aberto.';
      } else if (parsed.intent === 'SALES_WEEK_QUERY') {
        const now = new Date();
        const start = new Date(now);
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - day + 1);
        start.setHours(0, 0, 0, 0);
        const sold = pedidos.filter((order) => order.status === 'concluido' && new Date(order.createdAt) >= start).reduce((sum, order) => sum + order.total, 0);
        botText = `Você vendeu ${formatMoney(sold)} nesta semana.`;
      } else {
        const matches = resolveClient(parsed.entities.clientName || '');
        if (matches.length === 0) botText = `Não encontrei o cliente "${parsed.entities.clientName}". Cadastre-o em Clientes antes de registrar o pedido.`;
        else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo.`;
        else {
          const stockMatch = estoqueItems.find((item) => item.name.trim().toLowerCase() === (parsed.entities.orderItemName || '').trim().toLowerCase());
          const quantity = parsed.entities.orderQuantity || 0;
          const unitPrice = parsed.entities.unitPrice || 0;
          const id = addPedido({ clientId: matches[0].id, items: [{ id: `${Date.now()}`, name: parsed.entities.orderItemName || 'Item', quantity, unitPrice, stockItemId: stockMatch?.id }], total: quantity * unitPrice, status: 'aberto', date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), createdAt: new Date().toISOString() });
          botText = `✓ Pedido ${id.slice(-6)} aberto para ${matches[0].name}: ${quantity}x ${parsed.entities.orderItemName} por ${formatMoney(quantity * unitPrice)}. Conclua o pedido para gerar a receita e baixar o estoque.`;
        }
      }
    } else if (parsed.intent === 'STOCK_BALANCE_QUERY' || parsed.intent === 'STOCK_DECREASE' || parsed.intent === 'STOCK_LOW_QUERY') {
      if (parsed.intent === 'STOCK_LOW_QUERY') {
        const lowItems = estoqueItems.filter((item) => item.quantity < item.minAlert);
        botText = lowItems.length ? `Estão acabando: ${lowItems.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(', ')}.` : 'Nenhum item está abaixo do mínimo.';
      } else {
        const matches = resolveStockItem(parsed.entities.stockItemName || '');
        if (matches.length === 0) botText = `Não encontrei o item "${parsed.entities.stockItemName}" no estoque.`;
        else if (matches.length > 1) botText = `Encontrei mais de um item parecido com "${parsed.entities.stockItemName}". Informe o nome completo.`;
        else if (parsed.intent === 'STOCK_BALANCE_QUERY') botText = `Você tem ${matches[0].quantity} ${matches[0].unit} de ${matches[0].name}.`;
        else if (moveEstoqueItem(matches[0].id, -(parsed.entities.value || 0), 'uso interno')) botText = `✓ Baixa de ${parsed.entities.value} ${matches[0].unit} de ${matches[0].name} registrada.`;
        else botText = `Não foi possível dar baixa: o estoque de ${matches[0].name} não pode ficar negativo.`;
      }
    } else if (parsed.intent === 'SUPPLIER_BALANCE_QUERY' || parsed.intent === 'SUPPLIER_DUE_QUERY') {
      const matches = resolveSupplier(parsed.entities.supplierName || '');
      if (matches.length === 0) botText = `Não encontrei um fornecedor chamado "${parsed.entities.supplierName}". Cadastre-o em Fornecedores antes de consultar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um fornecedor parecido com "${parsed.entities.supplierName}". Informe o nome completo.`;
      else if (parsed.intent === 'SUPPLIER_BALANCE_QUERY') {
        const debt = transactions.filter((transaction) => transaction.supplierId === matches[0].id && transaction.amount < 0 && !transaction.supplierPaid).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
        botText = `Você deve ${formatMoney(debt)} para ${matches[0].name}.`;
      } else {
        const purchases = transactions.filter((transaction) => transaction.supplierId === matches[0].id && transaction.amount < 0).sort((a, b) => b.id.localeCompare(a.id));
        botText = purchases[0]?.supplierDueDate ? `A última compra de ${matches[0].name} vence em ${formatDate(purchases[0].supplierDueDate)}.` : `A última compra de ${matches[0].name} não tem vencimento informado.`;
      }
    } else if (parsed.intent === 'CLIENT_PAYMENT_QUERY' || parsed.intent === 'CLIENT_PENDING_QUERY') {
      const matches = resolveClient(parsed.entities.clientName || '');
      if (matches.length === 0) botText = `Não encontrei um cliente chamado "${parsed.entities.clientName}". Cadastre-o em Clientes antes de consultar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo para eu continuar.`;
      else if (parsed.intent === 'CLIENT_PAYMENT_QUERY') {
        const total = transactions.filter((transaction) => transaction.clientId === matches[0].id && transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
        botText = `${matches[0].name} já pagou ${formatMoney(total)} nas receitas vinculadas.`;
      } else {
        botText = /pend[eê]ncia|aberto|deve/i.test(matches[0].notes) ? `${matches[0].name} tem uma pendência registrada nas observações: ${matches[0].notes}` : `Não há pendência registrada para ${matches[0].name}.`;
      }
    } else if (parsed.intent === 'UNKNOWN') {
      botType = 'fallback';
    } else if (parsed.intent === 'EXPENSE_RECORD' || parsed.intent === 'INCOME_RECORD') {
      actions = ['Editar', 'Excluir'];
      if (parsed.intent === 'EXPENSE_RECORD') {
        const supplierMatches = parsed.entities.supplierName ? resolveSupplier(parsed.entities.supplierName) : [];
        if (parsed.entities.category === 'Fornecedores' && (supplierMatches.length !== 1)) {
          actions = [];
          botText = supplierMatches.length > 1 ? 'Encontrei mais de um fornecedor parecido. Informe o nome completo antes de registrar.' : `Não encontrei o fornecedor "${parsed.entities.supplierName || 'informado'}". Cadastre-o em Fornecedores antes de registrar.`;
        } else {
          const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const supplier = supplierMatches[0];
          addTransaction({ date, description: parsed.entities.description || 'Despesa', amount: -(parsed.entities.value || 0), category: parsed.entities.category || 'Outros', supplierId: supplier?.id, supplierDueDate: supplier ? (parsed.entities.paymentDays !== undefined ? suggestedDueDate(date, `${parsed.entities.paymentDays} dias`) : suggestedDueDate(date, supplier.paymentTerm)) : undefined, supplierPaid: supplier ? false : undefined });
          botText = supplier ? `✓ Compra de ${formatMoney(parsed.entities.value || 0)} para ${supplier.name} registrada como pendente.` : botText;
        }
      } else {
        const matches = resolveClient(parsed.entities.description || '');
        if (matches.length > 1) {
          botText = `Encontrei mais de um cliente parecido com "${parsed.entities.description}". Informe o nome completo antes de registrar.`;
          botType = 'bot';
        } else if (matches.length === 0 && parsed.entities.description && parsed.entities.description !== 'Receita') {
          botText = `Não encontrei um cliente chamado "${parsed.entities.description}". Você quer cadastrá-lo antes de registrar essa receita?`;
          botType = 'bot';
        } else {
        addTransaction({
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          description: parsed.entities.description || 'Receita',
          amount: parsed.entities.value || 0,
          category: 'Receita',
          clientId: matches[0]?.id,
        });
        }
      }
    } else if (parsed.intent === 'TASK_ADD') {
      actions = ['Concluir'];
      addTask({ description: parsed.entities.description || '', done: false, dueDate: null, priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString() });
    } else if (parsed.intent === 'TASK_WITH_DATE') {
      actions = ['Concluir'];
      addEvent({
        date: new Date().toISOString().split('T')[0],
        time: null,
        description: parsed.entities.description || '',
        done: false,
        type: 'task',
      });
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      type: botType,
      text: botText,
      actions,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    scrollToBottom();
  }, [input, addTransaction, addTask, addEvent, addPedido, pedidos, resolveClient, resolveSupplier, resolveStockItem, transactions, estoqueItems, moveEstoqueItem]);

  const handleVoiceCapture = useCallback((transcript: string) => {
    if (!transcript.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: transcript.trim(),
      timestamp: new Date(),
    };

    const parsed = parseMessage(transcript.trim());
    let botText = buildBotResponse(parsed);

    let actions: string[] = [];
    let botType: 'bot' | 'fallback' = 'bot';

    if (parsed.intent === 'ORDER_CREATE' || parsed.intent === 'ORDER_OPEN_QUERY' || parsed.intent === 'SALES_WEEK_QUERY') {
      if (parsed.intent === 'ORDER_OPEN_QUERY') {
        const openOrders = pedidos.filter((order) => order.status === 'aberto');
        botText = openOrders.length ? `Pedidos em aberto: ${openOrders.map((order) => `#${order.id.slice(-6)}`).join(', ')}.` : 'Não há pedidos em aberto.';
      } else if (parsed.intent === 'SALES_WEEK_QUERY') {
        const now = new Date();
        const start = new Date(now);
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - day + 1);
        start.setHours(0, 0, 0, 0);
        const sold = pedidos.filter((order) => order.status === 'concluido' && new Date(order.createdAt) >= start).reduce((sum, order) => sum + order.total, 0);
        botText = `Você vendeu ${formatMoney(sold)} nesta semana.`;
      } else {
        const matches = resolveClient(parsed.entities.clientName || '');
        if (matches.length === 0) botText = `Não encontrei o cliente "${parsed.entities.clientName}". Cadastre-o em Clientes antes de registrar o pedido.`;
        else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo.`;
        else {
          const stockMatch = estoqueItems.find((item) => item.name.trim().toLowerCase() === (parsed.entities.orderItemName || '').trim().toLowerCase());
          const quantity = parsed.entities.orderQuantity || 0;
          const unitPrice = parsed.entities.unitPrice || 0;
          const id = addPedido({ clientId: matches[0].id, items: [{ id: `${Date.now()}`, name: parsed.entities.orderItemName || 'Item', quantity, unitPrice, stockItemId: stockMatch?.id }], total: quantity * unitPrice, status: 'aberto', date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), createdAt: new Date().toISOString() });
          botText = `✓ Pedido ${id.slice(-6)} aberto para ${matches[0].name}: ${quantity}x ${parsed.entities.orderItemName} por ${formatMoney(quantity * unitPrice)}. Conclua o pedido para gerar a receita e baixar o estoque.`;
        }
      }
    } else if (parsed.intent === 'STOCK_BALANCE_QUERY' || parsed.intent === 'STOCK_DECREASE' || parsed.intent === 'STOCK_LOW_QUERY') {
      if (parsed.intent === 'STOCK_LOW_QUERY') {
        const lowItems = estoqueItems.filter((item) => item.quantity < item.minAlert);
        botText = lowItems.length ? `Estão acabando: ${lowItems.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(', ')}.` : 'Nenhum item está abaixo do mínimo.';
      } else {
        const matches = resolveStockItem(parsed.entities.stockItemName || '');
        if (matches.length === 0) botText = `Não encontrei o item "${parsed.entities.stockItemName}" no estoque.`;
        else if (matches.length > 1) botText = `Encontrei mais de um item parecido com "${parsed.entities.stockItemName}". Informe o nome completo.`;
        else if (parsed.intent === 'STOCK_BALANCE_QUERY') botText = `Você tem ${matches[0].quantity} ${matches[0].unit} de ${matches[0].name}.`;
        else if (moveEstoqueItem(matches[0].id, -(parsed.entities.value || 0), 'uso interno')) botText = `✓ Baixa de ${parsed.entities.value} ${matches[0].unit} de ${matches[0].name} registrada.`;
        else botText = `Não foi possível dar baixa: o estoque de ${matches[0].name} não pode ficar negativo.`;
      }
    } else if (parsed.intent === 'SUPPLIER_BALANCE_QUERY' || parsed.intent === 'SUPPLIER_DUE_QUERY') {
      const matches = resolveSupplier(parsed.entities.supplierName || '');
      if (matches.length === 0) botText = `Não encontrei um fornecedor chamado "${parsed.entities.supplierName}". Cadastre-o em Fornecedores antes de consultar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um fornecedor parecido com "${parsed.entities.supplierName}". Informe o nome completo.`;
      else if (parsed.intent === 'SUPPLIER_BALANCE_QUERY') {
        const debt = transactions.filter((transaction) => transaction.supplierId === matches[0].id && transaction.amount < 0 && !transaction.supplierPaid).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
        botText = `Você deve ${formatMoney(debt)} para ${matches[0].name}.`;
      } else {
        const purchases = transactions.filter((transaction) => transaction.supplierId === matches[0].id && transaction.amount < 0).sort((a, b) => b.id.localeCompare(a.id));
        botText = purchases[0]?.supplierDueDate ? `A última compra de ${matches[0].name} vence em ${formatDate(purchases[0].supplierDueDate)}.` : `A última compra de ${matches[0].name} não tem vencimento informado.`;
      }
    } else if (parsed.intent === 'CLIENT_PAYMENT_QUERY' || parsed.intent === 'CLIENT_PENDING_QUERY') {
      const matches = resolveClient(parsed.entities.clientName || '');
      if (matches.length === 0) botText = `Não encontrei um cliente chamado "${parsed.entities.clientName}". Cadastre-o em Clientes antes de consultar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo para eu continuar.`;
      else if (parsed.intent === 'CLIENT_PAYMENT_QUERY') {
        const total = transactions.filter((transaction) => transaction.clientId === matches[0].id && transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
        botText = `${matches[0].name} já pagou ${formatMoney(total)} nas receitas vinculadas.`;
      } else {
        botText = /pend[eê]ncia|aberto|deve/i.test(matches[0].notes) ? `${matches[0].name} tem uma pendência registrada nas observações: ${matches[0].notes}` : `Não há pendência registrada para ${matches[0].name}.`;
      }
    } else if (parsed.intent === 'UNKNOWN') {
      botType = 'fallback';
    } else if (parsed.intent === 'EXPENSE_RECORD' || parsed.intent === 'INCOME_RECORD') {
      actions = ['Editar', 'Excluir'];
      if (parsed.intent === 'EXPENSE_RECORD') {
        const supplierMatches = parsed.entities.supplierName ? resolveSupplier(parsed.entities.supplierName) : [];
        if (parsed.entities.category === 'Fornecedores' && supplierMatches.length !== 1) {
          actions = [];
          botText = supplierMatches.length > 1 ? 'Encontrei mais de um fornecedor parecido. Informe o nome completo antes de registrar.' : `Não encontrei o fornecedor "${parsed.entities.supplierName || 'informado'}". Cadastre-o em Fornecedores antes de registrar.`;
        } else {
          const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const supplier = supplierMatches[0];
          addTransaction({ date, description: parsed.entities.description || 'Despesa', amount: -(parsed.entities.value || 0), category: parsed.entities.category || 'Outros', supplierId: supplier?.id, supplierDueDate: supplier ? (parsed.entities.paymentDays !== undefined ? suggestedDueDate(date, `${parsed.entities.paymentDays} dias`) : suggestedDueDate(date, supplier.paymentTerm)) : undefined, supplierPaid: supplier ? false : undefined });
          botText = supplier ? `✓ Compra de ${formatMoney(parsed.entities.value || 0)} para ${supplier.name} registrada como pendente.` : botText;
        }
      } else {
        const matches = resolveClient(parsed.entities.description || '');
        if (matches.length > 1) {
          botText = `Encontrei mais de um cliente parecido com "${parsed.entities.description}". Informe o nome completo antes de registrar.`;
        } else if (matches.length === 0 && parsed.entities.description && parsed.entities.description !== 'Receita') {
          botText = `Não encontrei um cliente chamado "${parsed.entities.description}". Você quer cadastrá-lo antes de registrar essa receita?`;
        } else {
        addTransaction({
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          description: parsed.entities.description || 'Receita',
          amount: parsed.entities.value || 0,
          category: 'Receita',
          clientId: matches[0]?.id,
        });
        }
      }
    } else if (parsed.intent === 'TASK_ADD') {
      actions = ['Concluir'];
      addTask({ description: parsed.entities.description || '', done: false, dueDate: null, priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString() });
    } else if (parsed.intent === 'TASK_WITH_DATE') {
      actions = ['Concluir'];
      addEvent({
        date: new Date().toISOString().split('T')[0],
        time: null,
        description: parsed.entities.description || '',
        done: false,
        type: 'task',
      });
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      type: botType,
      text: botText,
      actions,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    scrollToBottom();
  }, [scrollToBottom, addTransaction, addTask, addEvent, addPedido, pedidos, resolveClient, resolveSupplier, resolveStockItem, transactions, estoqueItems, moveEstoqueItem]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isTransactionReport = item.actions?.some((a) => a === 'Editar' || a === 'Excluir');

    const renderBotAvatar = (expression: 'neutro' | 'confuso' | 'piscando') => (
      <Image source={MASCOT_IMAGES[expression]} style={styles.botAvatarImage} resizeMode="contain" />
    );

    if (item.type === 'user') {
      return (
        <View style={styles.userBubbleContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'fallback') {
      return (
        <View style={styles.botRow}>
          {renderBotAvatar('confuso')}
          <View style={styles.botContent}>
            <View style={styles.botBubble}>
              <Text style={styles.botText}>
                Não consegui identificar o que você quer registrar. O que você quer fazer?
              </Text>
            </View>
            <View style={styles.quickActionsRow}>
              {['Registrar gasto', 'Adicionar tarefa', 'Outra coisa'].map((label) => (
                <TouchableOpacity key={label} style={styles.quickActionBtn}>
                  <Text style={styles.quickActionText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.botRow}>
        {renderBotAvatar(isTransactionReport ? 'piscando' : 'neutro')}
        <View style={styles.botContent}>
          <View style={styles.botBubble}>
            <Text style={styles.botText}>{item.text}</Text>
          </View>
          {item.actions && item.actions.length > 0 && (
            <View style={styles.actionsRow}>
              {item.actions.map((action) => (
                <TouchableOpacity key={action} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{action}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/lumio.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>OJ</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            {!input && (
              <Text
                style={styles.inputPlaceholder}
                numberOfLines={1}
                ellipsizeMode="tail"
                pointerEvents="none"
              >
                Digite aqui...
              </Text>
            )}
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholderTextColor="transparent"
              onSubmitEditing={handleSend}
              returnKeyType="send"
              numberOfLines={1}
            />
          </View>
          <VoiceInput
            onCapture={handleVoiceCapture}
            onPartialResult={setInput}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLogo: {
    width: 98,
    height: 30,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },

  messagesList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },

  userBubbleContainer: { alignItems: 'flex-end', marginVertical: Spacing.xs },
  userBubble: {
    backgroundColor: Colors.bubbleUser,
    borderRadius: Radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: '80%',
  },
  userText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: '#FFFFFF',
    lineHeight: 22,
  },

  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    marginTop: 2,
    overflow: 'hidden',
  },
  botAvatarImage: {
    width: 36,
    height: 36,
    marginTop: 2,
  },
  botContent: { flex: 1, gap: Spacing.xs },
  botBubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderTopLeftRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignSelf: 'flex-start',
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  botText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 22,
  },

  actionsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  quickActionsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  quickActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.bgCard,
  },
  quickActionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
});
