/**
 * Script para validar que as interfaces são importáveis e tipagem está correta.
 * Execute: npx tsc --noEmit (ou npm run typecheck)
 */
import type { Loja, Pedido, Produto, ItemPedido } from '@/types';
import { calcularComissao, COMISSAO_PERCENTUAL } from '@/types';

const loja: Loja = {
  id: '1',
  nome: 'Loja Exemplo',
  mensalidade: 350,
  ativo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const produto: Produto = {
  id: '1',
  codigo: 'VD-001',
  descricao: 'Vedação O-Ring',
  estoque: 100,
  ativo: true,
  medidas: [{ tipo_medida: 'diametro_interno', valor_mm: 50, unidade: 'mm' }],
};

const item: ItemPedido = {
  produtoId: '1',
  codigo: 'VD-001',
  descricao: 'Vedação O-Ring',
  quantidade: 2,
  precoUnitario: 25.5,
  subtotal: 51,
};

const valorTotal = 51;
const comissao = calcularComissao(valorTotal);

const pedido: Pedido = {
  id: '1',
  lojaId: loja.id,
  valorTotal,
  valorComissao: comissao,
  itens: [item],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Uso de tipos garante que o código compila
console.log(COMISSAO_PERCENTUAL, pedido.valorComissao, loja.mensalidade, produto.medidas.length);
