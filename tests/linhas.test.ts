import { describe, expect, test } from 'vitest';
import {
  getMensagemLinhaIndisponivel,
  isLinhaBloqueadaOuExclusiva,
  extractLinhaCandidates,
  findLinhaMatch,
  searchProductsByLinha,
  type LinhaMatch,
} from '../lib/linhas';

const MSG_ESPERADA = 'Essa linha de produto é de venda exclusiva, não está disponível.';

describe('Regra Linhas - mensagem bloqueada', () => {
  test('getMensagemLinhaIndisponivel retorna texto exato em português', () => {
    expect(getMensagemLinhaIndisponivel()).toBe(MSG_ESPERADA);
  });

  test('Bloqueada = "S" => linha bloqueada', () => {
    const match: LinhaMatch = {
      id: '1',
      linha: 'XX',
      descricao: 'Linha teste',
      bloqueada: 'S',
      aplicacao: null,
    };
    expect(isLinhaBloqueadaOuExclusiva(match)).toBe(true);
  });

  test('Aplicacao = "Exclusiva" => linha exclusiva', () => {
    const match: LinhaMatch = {
      id: '2',
      linha: 'YY',
      descricao: 'Outra linha',
      bloqueada: null,
      aplicacao: 'Exclusiva',
    };
    expect(isLinhaBloqueadaOuExclusiva(match)).toBe(true);
  });

  test('Bloqueada = "S" e Aplicacao = "Exclusiva" => bloqueada', () => {
    const match: LinhaMatch = {
      id: '3',
      linha: 'ZZ',
      descricao: 'Linha',
      bloqueada: 'S',
      aplicacao: 'Exclusiva',
    };
    expect(isLinhaBloqueadaOuExclusiva(match)).toBe(true);
  });

  test('Bloqueada != "S" e Aplicacao != "Exclusiva" => permitida', () => {
    const match: LinhaMatch = {
      id: '4',
      linha: 'VD',
      descricao: 'Vedações',
      bloqueada: 'N',
      aplicacao: null,
    };
    expect(isLinhaBloqueadaOuExclusiva(match)).toBe(false);
  });

  test('Bloqueada null e Aplicacao null => permitida', () => {
    const match: LinhaMatch = {
      id: '5',
      linha: 'CE',
      descricao: 'Outra',
      bloqueada: null,
      aplicacao: null,
    };
    expect(isLinhaBloqueadaOuExclusiva(match)).toBe(false);
  });
});

describe('Regra Linhas - extractLinhaCandidates', () => {
  test('extrai "case" e "linha case" de "quero comprar um reparo para a linha case"', () => {
    const c = extractLinhaCandidates('quero comprar um reparo para a linha case');
    expect(c).toContain('case');
    expect(c).toContain('linha case');
    expect(c[0]).toBe('quero comprar um reparo para a linha case');
  });

  test('extrai termo após "linha" em "da linha VD"', () => {
    const c = extractLinhaCandidates('da linha VD');
    expect(c).toContain('VD');
    expect(c).toContain('linha VD');
  });

  test('texto vazio retorna array vazio', () => {
    expect(extractLinhaCandidates('')).toEqual([]);
  });
});

describe('Regra Linhas - findLinhaMatch (sem DB)', () => {
  test('userText vazio retorna null', async () => {
    const result = await findLinhaMatch('');
    expect(result).toBeNull();
  });

  test('userText só espaços retorna null', async () => {
    const result = await findLinhaMatch('   ');
    expect(result).toBeNull();
  });
});

describe('Regra Linhas - searchProductsByLinha (sem DB)', () => {
  test('linha vazia retorna array vazio', async () => {
    const result = await searchProductsByLinha('', 'emitente1');
    expect(result).toEqual([]);
  });

  test('idEmitente vazio retorna array vazio', async () => {
    const result = await searchProductsByLinha('VD', '');
    expect(result).toEqual([]);
  });
});
