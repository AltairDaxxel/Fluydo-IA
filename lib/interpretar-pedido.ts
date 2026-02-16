/**
 * Interpreta texto como possível lista de produtos, busca no estoque e monta o pedido.
 */

import type { Produto } from '@/types';
import { consultarEstoque } from './estoque';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

export interface ItemPedidoInterpretado {
  termo: string;
  quantidade: number;
}

export interface PedidoInterpretado {
  isLista: boolean;
  itens: Array<{ produto: Produto; quantidade: number }>;
  naoEncontrados: Array<{ termo: string; quantidade: number }>;
  textoResposta: string;
}

function parseJsonArray(str: string): ItemPedidoInterpretado[] {
  const trimmed = str.trim();
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is ItemPedidoInterpretado =>
          p && typeof p === 'object' && typeof (p as ItemPedidoInterpretado).termo === 'string' && typeof (p as ItemPedidoInterpretado).quantidade === 'number'
      )
      .map((p) => ({ termo: String(p.termo).trim(), quantidade: Number(p.quantidade) || 1 }));
  } catch {
    return [];
  }
}

export async function interpretarListaProdutos(texto: string): Promise<PedidoInterpretado> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return {
      isLista: false,
      itens: [],
      naoEncontrados: [],
      textoResposta: 'Erro: API não configurada.',
    };
  }

  const promptUsuario = `Analise o texto abaixo. Se for uma lista de produtos (códigos, descrições e quantidades), extraia cada item.
Responda APENAS com um JSON array, sem explicação, no formato: [{"termo": "código ou descrição do produto", "quantidade": número}]
Se não for lista de produtos, responda apenas: []

Texto:
${texto.slice(0, 6000)}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: promptUsuario,
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    return {
      isLista: false,
      itens: [],
      naoEncontrados: [],
      textoResposta: 'Não consegui processar o documento.',
    };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim() || '[]';
  const itens = parseJsonArray(content);

  if (itens.length === 0) {
    return {
      isLista: false,
      itens: [],
      naoEncontrados: [],
      textoResposta: 'Não identifiquei uma lista de produtos no documento. Pode descrever o pedido ou enviar outro arquivo?',
    };
  }

  const listaComResultado: Array<{
    termo: string;
    quantidade: number;
    produto?: Produto;
  }> = [];

  for (const item of itens) {
    const [porCodigo, porDescricao] = await Promise.all([
      consultarEstoque({ codigo: item.termo }),
      consultarEstoque({ descricao: item.termo }),
    ]);
    const porId = new Map<string, Produto>();
    [...porCodigo, ...porDescricao].forEach((p) => porId.set(p.id, p));
    const produtos = Array.from(porId.values());
    if (produtos.length > 0) {
      listaComResultado.push({ termo: item.termo, quantidade: item.quantidade, produto: produtos[0] });
    } else {
      listaComResultado.push({ termo: item.termo, quantidade: item.quantidade });
    }
  }

  const itensEncontrados = listaComResultado.filter((x) => x.produto) as Array<{ produto: Produto; quantidade: number; termo: string }>;
  const naoEncontrados = listaComResultado.filter((x) => !x.produto).map((x) => ({ termo: x.termo, quantidade: x.quantidade }));

  let textoResposta = '';
  if (itensEncontrados.length > 0) {
    textoResposta = 'Lista do seu arquivo (encontrados):\n\n';
    itensEncontrados.forEach((item, i) => {
      textoResposta += `${i + 1}. ${item.termo} – Qtd: ${item.quantidade}\n`;
      textoResposta += `   → ${item.produto.codigo} – ${item.produto.descricao}\n\n`;
    });
    if (naoEncontrados.length > 0) {
      textoResposta += `Não encontrei no estoque: ${naoEncontrados.map((n) => n.termo).join(', ')}.\n\n`;
    }
  } else {
    textoResposta = `Nenhum produto encontrado no estoque para: ${naoEncontrados.map((n) => n.termo).join(', ')}.\n\n`;
  }
  textoResposta += 'Em que mais posso te ajudar?';

  return {
    isLista: true,
    itens: itensEncontrados.map((x) => ({ produto: x.produto, quantidade: x.quantidade })),
    naoEncontrados,
    textoResposta,
  };
}
