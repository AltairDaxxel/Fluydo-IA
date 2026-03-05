import { describe, expect, test } from 'vitest';
import { getSelectedItems, type QtyMap } from '../lib/orderQuantity';

const produtos = [
  { codigo: 'A1', descricao: 'Produto A', precoUnitario: 10 },
  { codigo: 'B2', descricao: 'Produto B', precoUnitario: 20 },
  { codigo: 'C3', descricao: 'Produto C', precoUnitario: 15 },
];

describe('getSelectedItems', () => {
  test('qty empty for all rows => no items added', () => {
    const qtyMap: QtyMap = {};
    const result = getSelectedItems(produtos, qtyMap);
    expect(result).toEqual([]);
  });

  test('qty filled for 2 products => only those 2 added', () => {
    const qtyMap: QtyMap = { A1: 2, B2: 1 };
    const result = getSelectedItems(produtos, qtyMap);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.codigo === 'A1')).toEqual({ codigo: 'A1', descricao: 'Produto A', quantidade: 2, precoUnitario: 10 });
    expect(result.find((i) => i.codigo === 'B2')).toEqual({ codigo: 'B2', descricao: 'Produto B', quantidade: 1, precoUnitario: 20 });
  });

  test('qty filled with 0 => not added', () => {
    const qtyMap: QtyMap = { A1: 0, B2: 1 };
    const result = getSelectedItems(produtos, qtyMap);
    expect(result).toHaveLength(1);
    expect(result[0].codigo).toBe('B2');
  });

  test('qty empty string => not added', () => {
    const qtyMap: QtyMap = { A1: '', B2: 3 };
    const result = getSelectedItems(produtos, qtyMap);
    expect(result).toHaveLength(1);
    expect(result[0].codigo).toBe('B2');
    expect(result[0].quantidade).toBe(3);
  });

  test('user says "pedir" with qty filled => add selected items (same logic)', () => {
    const qtyMap: QtyMap = { A1: 5, C3: 1 };
    const result = getSelectedItems(produtos, qtyMap);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.codigo === 'A1')?.quantidade).toBe(5);
    expect(result.find((i) => i.codigo === 'C3')?.quantidade).toBe(1);
  });
});
