/**
 * Fluydo.IA - Motor de busca por trilhas
 *
 * Regra geral: se nenhuma palavra-chave como "linha" for fornecida e o usuário
 * passar apenas uma informação (um único termo), retorna mensagem pedindo mais detalhes.
 *
 * Trilhas:
 * - CODIGO_DIRETO: 1 token que parece código ou 2 tokens combinados (ex.: cen 2010 → cen.2010); busca por Produtos.Codigo.
 * - A1: exatamente 2 argumentos — um é linha conhecida e o outro é parte do código/descrição; filtra produtos da linha pelo outro termo.
 * - A: busca pelo código da linha ou pela descrição da linha (quando a mensagem contém "linha"); filtra produtos com esse prefixo.
 * - B: remove ruídos, valida produto pelo vocabulário e combina produto com dimensões (DIM1..DIM4).
 * - B1: combina prefixo da linha ou parte do código com o produto.
 * - C: combina produto, material ("mat") ou perfil ("perf") diretamente no CTU e filtra também pelas dimensões.
 *
 * PALAVRAS-CHAVE DE DIMENSÕES (apenas para extrair informações; NUNCA usar na pesquisa CTU):
 * - d1 → dim1, d2 → dim2, d3 → dim3, d4 → dim4
 * - Devem ser consideradas para encontrar as informações na mensagem (parseLabels em busca-prisma).
 * - d1, d2, d3 e d4 não entram nos termos da CTU; só as colunas dim1..dim4 do banco são filtradas por eles.
 *
 * ONDE INTEGRAR O BANCO DE DADOS REAL:
 * - Trilha A: lib/linhas.ts → findLinhaMatch (tabela Linhas), searchProductsByLinha (tabela Produtos por prefixo Codigo).
 * - Trilha B: lib/search/productVocabulary.ts → getVocabularySearchTerms; lib/busca-prisma.ts → buscarProdutosPrisma com structuredDimFilter (Produtos: CTU + dim1..dim4).
 * - Trilha B1: lib/busca-prisma.ts → buscarProdutosPrisma (Produtos, coluna CTU).
 * - Trilha C: lib/busca-prisma.ts → buscarProdutosPrisma (Produtos: CTU, dim1..dim4, Material, Aplicacao; parseLabels na mensagem).
 * - Código direto: lib/busca-prisma.ts → buscarProdutosPorCodigo (Produtos, coluna Codigo).
 * Modo simular (opts.simular = true): nenhuma chamada ao DB; retorna trilha e mensagem contextual.
 */

import { CONFIG_KEYS, getConfig } from './configuracoes';
import {
  buscarProdutosPrisma,
  buscarProdutosPorCodigo,
  parseLabels,
  type ProdutoBuscaResult,
  type StructuredDimFilter,
} from './busca-prisma';
import {
  findLinhaMatch,
  isLinhaBloqueadaOuExclusiva,
  searchProductsByLinha,
  extractLinhaCandidates,
} from './linhas';
import { intelligentSearchEngine } from './search/intelligentSearchEngine';
import { getVocabularySearchTerms } from './search/productVocabulary';

/** Identificador da trilha executada */
export type TrilhaId = 'A' | 'A1' | 'B' | 'B1' | 'C' | 'CODIGO_DIRETO' | 'PEDIR_DETALHES' | 'NENHUMA';

export interface ResultadoMotor {
  /** Trilha que produziu o resultado (ou que seria usada em modo simulado) */
  trilha: TrilhaId;
  /** Produtos retornados (quando integração DB real) */
  produtos?: ProdutoBuscaResult[];
  /** Mensagem de texto para o usuário (ex.: "linha não encontrada", "informe as dimensões") */
  mensagem?: string;
  /** Texto principal da resposta (ex.: "Encontrei N produto(s)...") */
  textoResposta?: string;
  /** true quando executado em modo simulado (nenhuma chamada ao DB) */
  simulado?: boolean;
  /** Contexto extra para debug (ex.: termo usado, linha encontrada) */
  contexto?: Record<string, unknown>;
}

// --- Regra geral: detecção de "apenas uma informação" ---
const PALAVRAS_CHAVE_TRILHA = ['linha'];
/** Rótulos de dimensão: d1→dim1, d2→dim2, d3→dim3, d4→dim4. Usados só para extrair valores; NUNCA na pesquisa CTU. */
const ROTULOS_DIM = new Set(['d1', 'd2', 'd3', 'd4']);
const SAUDACOES = new Set(['oi', 'olá', 'ola', 'bom', 'dia', 'boa', 'tarde', 'noite']);

function isNumberToken(t: string): boolean {
  return /^\d+([.,]\d+)?$/.test((t || '').replace(',', '.')) && !Number.isNaN(parseFloat((t || '').replace(',', '.')));
}

/** Remove rótulos d1,d2,d3,d4 e o valor seguinte da lista de tokens. Usado para montar termos para CTU (nunca incluir d1..d4 na CTU). */
function removerRotulosDimDosTermos(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (ROTULOS_DIM.has(t.toLowerCase())) {
      if (tokens[i + 1] != null && isNumberToken(tokens[i + 1])) i += 1;
      continue;
    }
    out.push(t);
  }
  return out;
}
const RUIDO_CODIGO = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'por', 'um', 'uma', 'o', 'a', 'os', 'as', 'no', 'na', 'nos', 'nas',
  'com', 'em', 'e', 'ou', 'que', 'tem', 'quero', 'preciso', 'precisamos', 'necessito', 'gostaria', 'queria', 'achar', 'buscar', 'busca', 'encontrar', 'pedir', 'pedido',
]);
const PADRAO_CODIGO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function tokenizar(mensagem: string): string[] {
  const texto = (mensagem || '').trim().replace(/,/g, '.');
  const tokens = texto.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const atual = tokens[i].toLowerCase();
    const prox = tokens[i + 1]?.toLowerCase();
    if (atual === 'bom' && prox === 'dia') { i += 1; continue; }
    if (atual === 'boa' && (prox === 'tarde' || prox === 'noite')) { i += 1; continue; }
    if (SAUDACOES.has(atual)) continue;
    out.push(tokens[i]);
  }
  return out;
}

/** Verifica se a mensagem contém alguma palavra-chave que justifica não pedir mais detalhes (ex.: "linha") */
function temPalavraChaveTrilha(mensagem: string): boolean {
  const lower = (mensagem || '').toLowerCase();
  return PALAVRAS_CHAVE_TRILHA.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
}

/** Extrai candidato a código do produto (para Trilha B1). Elimina ruído. */
function extractCodigoCandidato(mensagem: string): string | null {
  const t = (mensagem || '').trim();
  if (!t || t.length < 2) return null;
  const tokens = t.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const candidatos = tokens.filter(
    (s) => s.length >= 2 && PADRAO_CODIGO.test(s) && !RUIDO_CODIGO.has(s.toLowerCase())
  );
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];
  const comSeparador = candidatos.filter((s) => /[._-]/.test(s));
  if (comSeparador.length > 0) return comSeparador.sort((a, b) => b.length - a.length)[0];
  return candidatos.sort((a, b) => b.length - a.length)[0];
}

/** Regra geral: uma única informação sem palavra-chave → pedir mais detalhes */
function aplicarRegraGeral(mensagem: string, tokens: string[]): ResultadoMotor | null {
  const termCount = tokens.length;
  if (termCount > 1) return null;
  if (termCount === 1 && temPalavraChaveTrilha(mensagem)) return null;
  if (termCount === 0) return null;

  return {
    trilha: 'PEDIR_DETALHES',
    mensagem: 'Para eu encontrar o produto certo, informe mais detalhes: código da linha (ex.: linha CEN), descrição do produto com medidas (ex.: retentor d1 140 d2 170) ou código do item.',
    contexto: { termCount, unicoTermo: tokens[0] },
  };
}

/**
 * Trilha A: busca pelo código da linha ou pela descrição da linha; filtra produtos com esse prefixo.
 * Integração banco: Linhas (findLinhaMatch) → Produtos por prefixo de Codigo (searchProductsByLinha).
 */
async function executarTrilhaA(
  mensagem: string,
  idEmitente: string,
  simular: boolean
): Promise<ResultadoMotor | null> {
  if (!/\blinha\b/i.test(mensagem)) return null;

  if (simular) {
    const candidates = extractLinhaCandidates(mensagem);
    return {
      trilha: 'A',
      simulado: true,
      textoResposta: `[Simulado] Trilha A: busca por linha (candidatos: ${candidates.join(', ') || 'nenhum'}). Integração DB: findLinhaMatch → searchProductsByLinha.`,
      contexto: { candidatosLinha: candidates },
    };
  }

  const linhaCandidates = extractLinhaCandidates(mensagem);
  let linhaMatch: Awaited<ReturnType<typeof findLinhaMatch>> = null;
  for (const candidate of linhaCandidates) {
    linhaMatch = await findLinhaMatch(candidate);
    if (linhaMatch) break;
  }

  if (!linhaMatch) {
    const msg = await getConfig(CONFIG_KEYS.MSG_LINHA_NAO_ENCONTRADA);
    return {
      trilha: 'A',
      mensagem: msg ?? 'A linha procurada não foi encontrada. Verifique o código ou a descrição da linha na tabela Linhas.',
      contexto: { candidatos: linhaCandidates },
    };
  }

  if (isLinhaBloqueadaOuExclusiva(linhaMatch)) {
    const msg = await getConfig(CONFIG_KEYS.MSG_LINHA_INDISPONIVEL);
    return {
      trilha: 'A',
      mensagem: msg ?? 'Essa linha de produto é de venda exclusiva, não está disponível.',
      contexto: { linha: linhaMatch.linha },
    };
  }

  // Integração DB real: Produtos com Codigo iniciando no código da linha
  const produtos = await searchProductsByLinha(linhaMatch.linha, idEmitente);
  const msgSucesso = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_LINHA);
  const textoResposta = (msgSucesso ?? 'Encontrei {n} produto(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.').replace(/\{n\}/g, String(produtos.length));
  if (!/\d+\s*produto/.test(textoResposta)) {
    return {
      trilha: 'A',
      produtos,
      textoResposta: `Encontrei ${produtos.length} produto(s). ${textoResposta.trim()}`,
      contexto: { linha: linhaMatch.linha },
    };
  }
  return {
    trilha: 'A',
    produtos,
    textoResposta,
    contexto: { linha: linhaMatch.linha },
  };
}

/**
 * Trilha B: remove ruídos, valida produto pelo vocabulário e combina com dimensões (DIM1..DIM4).
 * Integração banco: getVocabularySearchTerms (vocabulário) + intelligentSearchEngine (dims) → buscarProdutosPrisma com structuredDimFilter.
 */
async function executarTrilhaB(
  mensagem: string,
  idEmitente: string,
  simular: boolean
): Promise<ResultadoMotor | null> {
  const plan = intelligentSearchEngine(mensagem, { preferSearchOverClarify: true });
  const temDims = plan.dims.dim1 != null || plan.dims.dim2 != null || plan.dims.dim3 != null || plan.dims.dim4 != null;
  if (!temDims) return null;

  let vocabTerms: string[] = [];
  try {
    vocabTerms = await getVocabularySearchTerms(mensagem);
  } catch {
    // sem vocabulário ainda assim tenta com termos da mensagem
  }
  const stopWords = new Set(['de', 'da', 'do', 'para', 'com', 'no', 'na', 'em', 'e', 'ou', 'o', 'a', 'preciso', 'quero', 'buscar', 'encontrar']);
  const tokensMsg = mensagem.split(/[\s.\-_/\\]+/).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2 && !stopWords.has(t));
  const tokensParaCTU = removerRotulosDimDosTermos(tokensMsg);
  const temProduto = vocabTerms.length > 0 || tokensParaCTU.length > 0;
  if (!temProduto) return null;

  const structured: StructuredDimFilter = {
    mode: plan.queryMode === 'STRICT' ? 'STRICT' : 'TOLERANCE',
    dim1: plan.dims.dim1 ?? null,
    dim2: plan.dims.dim2 ?? null,
    dim3: plan.dims.dim3 ?? null,
    dim4: plan.dims.dim4 ?? null,
    toleranceMm: 0.2,
  };
  const termoBusca = (vocabTerms.length > 0 ? vocabTerms.join(' ') : tokensParaCTU.join(' ')).trim() || mensagem;

  if (simular) {
    return {
      trilha: 'B',
      simulado: true,
      textoResposta: `[Simulado] Trilha B: produto (vocabulário/tokens) + dimensões. Termo: "${termoBusca}". Dims: dim1=${plan.dims.dim1} dim2=${plan.dims.dim2} dim3=${plan.dims.dim3} dim4=${plan.dims.dim4}. Integração DB: buscarProdutosPrisma(termo, idEmitente, { structuredDimFilter }).`,
      contexto: { termoBusca, dims: plan.dims },
    };
  }

  const produtos = await buscarProdutosPrisma(termoBusca, idEmitente, { structuredDimFilter: structured });
  if (produtos.length === 0) return null;

  const msg = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO);
  const textoResposta = (msg ?? 'Encontrei {n} produto(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.').replace(/\{n\}/g, String(produtos.length));
  return {
    trilha: 'B',
    produtos,
    textoResposta,
    contexto: { termoBusca, dims: plan.dims },
  };
}

/**
 * Trilha B1: combina prefixo da linha ou parte do código com o produto.
 * Integração banco: buscarProdutosPrisma(termo com produto + código candidato).
 */
async function executarTrilhaB1(
  mensagem: string,
  idEmitente: string,
  simular: boolean
): Promise<ResultadoMotor | null> {
  const codigoCandidato = extractCodigoCandidato(mensagem);
  if (!codigoCandidato) return null;

  let vocabTerms: string[] = [];
  try {
    vocabTerms = await getVocabularySearchTerms(mensagem);
  } catch {
    // ignora
  }
  const stopWords = new Set(['de', 'da', 'do', 'para', 'com', 'no', 'na', 'em', 'e', 'ou', 'o', 'a', 'preciso', 'quero', 'buscar', 'encontrar']);
  const tokensMsg = mensagem.split(/[\s.\-_/\\]+/).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2 && !stopWords.has(t));
  const tokensParaCTU = removerRotulosDimDosTermos(tokensMsg);
  const palavrasProduto = vocabTerms.length > 0 ? vocabTerms.join(' ') : tokensParaCTU.join(' ').trim();
  if (!palavrasProduto) return null;

  const termoBusca = (palavrasProduto + ' ' + codigoCandidato).trim();

  if (simular) {
    return {
      trilha: 'B1',
      simulado: true,
      textoResposta: `[Simulado] Trilha B1: produto + prefixo/código. Termo: "${termoBusca}" (código candidato: ${codigoCandidato}). Integração DB: buscarProdutosPrisma(termo, idEmitente).`,
      contexto: { termoBusca, codigoCandidato },
    };
  }

  const produtos = await buscarProdutosPrisma(termoBusca, idEmitente);
  if (produtos.length === 0) return null;

  const msg = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO);
  const textoResposta = (msg ?? 'Encontrei {n} produto(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.').replace(/\{n\}/g, String(produtos.length));
  return {
    trilha: 'B1',
    produtos,
    textoResposta,
    contexto: { termoBusca, codigoCandidato },
  };
}

/**
 * Trilha C: combina produto, material ("mat") ou perfil ("perf") diretamente no CTU e filtra pelas dimensões.
 * Integração banco: parseLabels + buscarProdutosPrisma (CTU + dim1..dim4 + Material + Aplicacao).
 */
async function executarTrilhaC(
  mensagem: string,
  idEmitente: string,
  simular: boolean
): Promise<ResultadoMotor | null> {
  const parsed = parseLabels(mensagem);
  const temTermosCTU = parsed.termosCTU.length > 0;
  const temDims = parsed.dim1 != null || parsed.dim2 != null || parsed.dim3 != null || parsed.dim4 != null;
  const temMatPerfApli = (parsed.material?.length ?? 0) > 0 || (parsed.perfil?.length ?? 0) > 0 || (parsed.aplicacao?.length ?? 0) > 0;
  if (!temTermosCTU && !temDims && !temMatPerfApli) return null;

  if (simular) {
    return {
      trilha: 'C',
      simulado: true,
      textoResposta: `[Simulado] Trilha C: produto + mat/perf no CTU + dimensões. Termos CTU: [${parsed.termosCTU.join(', ')}], dim1=${parsed.dim1} dim2=${parsed.dim2} dim3=${parsed.dim3} dim4=${parsed.dim4}, material=${parsed.material ?? '-'}, perfil=${parsed.perfil ?? '-'}, aplicacao=${parsed.aplicacao ?? '-'}. Integração DB: buscarProdutosPrisma(mensagem, idEmitente) [usa parseLabels internamente].`,
      contexto: { parsed },
    };
  }

  const produtos = await buscarProdutosPrisma(mensagem, idEmitente);
  if (produtos.length === 0) return null;

  const msg = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO);
  const textoResposta = (msg ?? 'Encontrei {n} produto(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.').replace(/\{n\}/g, String(produtos.length));
  return {
    trilha: 'C',
    produtos,
    textoResposta,
    contexto: { termosCTU: parsed.termosCTU, dims: { dim1: parsed.dim1, dim2: parsed.dim2, dim3: parsed.dim3, dim4: parsed.dim4 } },
  };
}

/** Combinações de 2 tokens para tentar como código (ex.: cen 2010 → cen.2010, cen-2010, cen2010). */
function combinacoesCodigo(token0: string, token1: string): string[] {
  const a = (token0 || '').trim();
  const b = (token1 || '').trim();
  if (!a || !b) return [];
  const padrao = /^[A-Za-z0-9._-]+$/i;
  if (!padrao.test(a) || !padrao.test(b)) return [];
  return [`${a}.${b}`, `${a}-${b}`, `${a}${b}`];
}

/** Busca direta por código: 1 token que parece código ou 2 tokens combinados (ex.: cen 2010 → cen.2010). Integração DB: buscarProdutosPorCodigo. */
async function executarCodigoDireto(
  mensagem: string,
  tokens: string[],
  idEmitente: string,
  simular: boolean
): Promise<ResultadoMotor | null> {
  const termoUnico = tokens.length === 1 ? tokens[0] : null;
  const doisTermos = tokens.length === 2 ? [tokens[0], tokens[1]] : null;

  if (termoUnico) {
    const pareceCodigo = /^[A-Za-z0-9._-]+$/i.test(termoUnico) && termoUnico.length >= 2;
    if (!pareceCodigo) return null;
    if (simular) {
      return { trilha: 'CODIGO_DIRETO', simulado: true, textoResposta: `[Simulado] Busca por código direto: "${termoUnico}".`, contexto: { codigo: termoUnico } };
    }
    const produtos = await buscarProdutosPorCodigo(termoUnico, idEmitente);
    if (produtos.length === 0) return null;
    const msg = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_CODIGO);
    return { trilha: 'CODIGO_DIRETO', produtos, textoResposta: msg ?? 'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.', contexto: { codigo: termoUnico } };
  }

  if (doisTermos) {
    const candidatos = combinacoesCodigo(doisTermos[0], doisTermos[1]);
    if (candidatos.length === 0) return null;
    if (simular) {
      return { trilha: 'CODIGO_DIRETO', simulado: true, textoResposta: `[Simulado] Busca por código (2 termos): tentar ${candidatos.join(', ')}.`, contexto: { candidatos } };
    }
    for (const codigo of candidatos) {
      const produtos = await buscarProdutosPorCodigo(codigo, idEmitente);
      if (produtos.length > 0) {
        const msg = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_CODIGO);
        return { trilha: 'CODIGO_DIRETO', produtos, textoResposta: msg ?? 'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.', contexto: { codigo } };
      }
    }
  }

  return null;
}

/**
 * Trilha A1: dois argumentos → um é linha conhecida e o outro é parte do código/descrição.
 * Busca produtos da linha (prefixo Codigo) e filtra pelo outro token em Codigo ou Descricao.
 * Só roda quando há exatamente 2 tokens; se falhar, o motor segue para as outras trilhas.
 */
async function executarTrilhaLinhaMaisCodigo(
  tokens: string[],
  idEmitente: string,
  simular: boolean
): Promise<ResultadoMotor | null> {
  if (tokens.length !== 2) return null;
  const [t0, t1] = [tokens[0].trim(), tokens[1].trim()];
  if (!t0 || !t1) return null;

  if (simular) {
    return {
      trilha: 'A1',
      simulado: true,
      textoResposta: `[Simulado] Trilha A1: 2 argumentos — tentar linha "${t0}" + parte "${t1}" e linha "${t1}" + parte "${t0}".`,
      contexto: { token0: t0, token1: t1 },
    };
  }

  const msgSucesso = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO);
  const textoOk = (n: number) => (msgSucesso ?? 'Encontrei {n} produto(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.').replace(/\{n\}/g, String(n));

  const filtrarPorParte = (produtos: ProdutoBuscaResult[], parte: string): ProdutoBuscaResult[] => {
    const p = parte.toLowerCase();
    return produtos.filter(
      (row) =>
        (row.codigo != null && row.codigo.toLowerCase().includes(p)) ||
        (row.descricao != null && row.descricao.toLowerCase().includes(p))
    );
  };

  for (const [linhaCandidato, parteCodigo] of [
    [t0, t1] as const,
    [t1, t0] as const,
  ]) {
    const linhaMatch = await findLinhaMatch(linhaCandidato);
    if (!linhaMatch || isLinhaBloqueadaOuExclusiva(linhaMatch)) continue;
    const porLinha = await searchProductsByLinha(linhaMatch.linha, idEmitente);
    const filtrados = filtrarPorParte(porLinha, parteCodigo);
    if (filtrados.length > 0) {
      return {
        trilha: 'A1',
        produtos: filtrados,
        textoResposta: textoOk(filtrados.length),
        contexto: { linha: linhaMatch.linha, parteCodigo },
      };
    }
  }

  return null;
}

/**
 * Executa o motor de busca por trilhas.
 * Ordem: regra geral → código direto (1 ou 2 tokens) → linha + parte código (2 tokens) → Trilha A → B → B1 → C.
 * Quando simular = true, não consulta o banco; retorna qual trilha seria usada e mensagem contextual.
 */
export async function executarMotorBusca(
  mensagem: string,
  idEmitente: string,
  opts?: { simular?: boolean }
): Promise<ResultadoMotor> {
  const simular = opts?.simular === true;
  const idEmit = (idEmitente || '').trim();
  const msgTrim = (mensagem || '').trim();
  if (!msgTrim) {
    return {
      trilha: 'PEDIR_DETALHES',
      mensagem: 'Digite o produto, código ou linha que deseja pesquisar.',
      simulado: false,
    };
  }

  const tokens = tokenizar(mensagem);

  // Regra geral: apenas uma informação e sem palavra-chave "linha" → pedir mais detalhes
  const regraGeral = aplicarRegraGeral(mensagem, tokens);
  if (regraGeral) {
    if (!simular) {
      const msgConfig = await getConfig(CONFIG_KEYS.MSG_PEDIR_ESPECIFICACOES);
      regraGeral.mensagem = msgConfig ?? regraGeral.mensagem;
    }
    return regraGeral;
  }

  // Código direto: 1 token que parece código ou 2 tokens combinados (ex.: cen 2010 → cen.2010)
  const codigoDir = await executarCodigoDireto(mensagem, tokens, idEmit, simular);
  if (codigoDir) return codigoDir;

  // Trilha A1: 2 argumentos — um é linha conhecida e o outro é parte do código/descrição
  const trilhaA1 = await executarTrilhaLinhaMaisCodigo(tokens, idEmit, simular);
  if (trilhaA1) return trilhaA1;

  // Trilha A: linha (quando a mensagem contém a palavra "linha")
  const trilhaA = await executarTrilhaA(mensagem, idEmit, simular);
  if (trilhaA) return trilhaA;

  // Trilha B: vocabulário + dimensões
  const trilhaB = await executarTrilhaB(mensagem, idEmit, simular);
  if (trilhaB) return trilhaB;

  // Trilha B1: produto + prefixo/código
  const trilhaB1 = await executarTrilhaB1(mensagem, idEmit, simular);
  if (trilhaB1) return trilhaB1;

  // Trilha C: produto + mat/perf no CTU + dimensões
  const trilhaC = await executarTrilhaC(mensagem, idEmit, simular);
  if (trilhaC) return trilhaC;

  // Fallback: busca contextual pela mensagem inteira (CTU) — mesma lógica que Trilha C sem rótulos
  if (!simular && idEmit) {
    const produtos = await buscarProdutosPrisma(mensagem, idEmit);
    if (produtos.length > 0) {
      const msg = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO);
      const textoResposta = (msg ?? 'Encontrei {n} produto(s).').replace(/\{n\}/g, String(produtos.length));
      return { trilha: 'C', produtos, textoResposta, contexto: { fallback: true } };
    }
  }

  const msgNenhum = await getConfig(CONFIG_KEYS.MSG_NENHUM_RESULTADO);
  return {
    trilha: 'NENHUMA',
    mensagem: msgNenhum ?? 'Não encontrei nada com essa busca. Pode tentar com o código, a descrição ou as medidas do produto.',
    contexto: { mensagem: msgTrim },
  };
}
