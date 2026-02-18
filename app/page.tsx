'use client';

import React, { useState, useRef, useEffect } from 'react';

type ProdutoParaPdf = {
  codigo: string;
  descricao: string;
  estoque: number;
  unidade?: string | null;
  material?: string | null;
  precoUnitario?: number | string | null;
  ipi?: number | null;
  dim1?: number | null;
  dim2?: number | null;
  dim3?: number | null;
  dim4?: number | null;
};

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return String(n);
}

async function exportarProdutosParaPdf(produtos: ProdutoParaPdf[], nomeEmitente: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { jsPDF } = await import('jspdf');
    const { autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const now = new Date();
    const dataHora = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)} - ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const head = [['#', 'Código', 'Estoque', 'Preço Unit.', 'dim1', 'dim2', 'dim3', 'dim4', 'Descrição', 'UN', 'Material']];
    const body = produtos.map((p, idx) => [
      String(idx + 1),
      p.codigo,
      String(p.estoque),
      p.precoUnitario != null ? (typeof p.precoUnitario === 'number' ? p.precoUnitario.toFixed(2) : String(p.precoUnitario)) : '—',
      fmtNum(p.dim1),
      fmtNum(p.dim2),
      fmtNum(p.dim3),
      fmtNum(p.dim4),
      p.descricao,
      p.unidade ?? '—',
      p.material ?? '—',
    ]);
    const startY = 18;
    autoTable(doc, {
      head,
      body,
      startY,
      margin: { left: 8, right: 8 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 248, 255] },
    });
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(dataHora, 8, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(nomeEmitente || 'Emitente', pageWidth / 2, 8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Fl. ${p} de ${pageCount}`, pageWidth - 8, 8, { align: 'right' });
    }
    doc.save(`produtos-fluydo-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error('[PDF]', err);
    alert('Não foi possível gerar o PDF. Tente novamente.');
  }
}

const TEXTO_SAUDACAO = 'Olá, eu sou o Fluydo.IA, assistente virtual de vendas.';
const TEXTO_MENU_INICIAL = 'O que você deseja?\n1 - Procurar por produtos\n2 - Enviar um arquivo com pedido';

const TEXTO_PESQUISA =
  'Você pode pesquisar produtos por código, descrição ou medidas. Mas se quiser fazer uma pergunta específica, como por exemplo, como funciona uma vedação? use sempre o sinal de interrogação no final da frase.';
const PERGUNTA_QUAL_PRODUTO = 'Qual é o produto que devo procurar?';

const TEXTO_USAR_BOTAO_ARQUIVO = 'Use o botão para enviar o arquivo.';
const OPCOES_ARQUIVO = 'As opções de arquivo aceitas são: txt, pdf, ou foto';

interface Mensagem {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** Data/hora da mensagem (Date.now()) para exibir hora:minuto */
  timestamp?: number;
  produtos?: Array<{
    id: string;
    codigo: string;
    descricao: string;
    estoque: number;
    material?: string;
    unidade?: string;
    precoUnitario?: number | string;
    ipi?: number | null;
    dim1?: number | null;
    dim2?: number | null;
    dim3?: number | null;
    dim4?: number | null;
    medidas: { tipo_medida: string; valor_mm: number; unidade?: string }[];
  }>;
  /** Tabela do pedido (mostrar pedido), com coluna Preço Total */
  carrinho?: ItemCarrinho[];
  /** Tabela do pedido vindo do arquivo (item, código, unidade, qtd, estoque, preço unit, total, descrição) */
  itensArquivo?: Array<{ codigo: string; descricao: string; unidade: string; quantidade: number; estoque: number | ''; precoUnitario: number | null; precoTotal: number | null }>;
  totalArquivo?: number;
}

interface ItemCarrinho {
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario?: number;
}

interface ChatPageProps {
  /** ID do emitente (parceiro) identificado pela URL; usado como filtro obrigatório nas APIs */
  idEmitente?: string;
  /** Nome do emitente para cabeçalho do PDF */
  nomeEmitente?: string;
}

export function ChatPage({ idEmitente = '', nomeEmitente = '' }: ChatPageProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => {
    const t = Date.now();
    return [
      { id: 'inicial-1', role: 'model', text: TEXTO_SAUDACAO, timestamp: t },
      { id: 'inicial-2', role: 'model', text: TEXTO_MENU_INICIAL, timestamp: t },
    ];
  });
  const [input, setInput] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [pendingFileOrder, setPendingFileOrder] = useState<ItemCarrinho[] | null>(null);
  const [aguardandoAlterarArquivo, setAguardandoAlterarArquivo] = useState(false);
  const [aguardandoExcluirArquivo, setAguardandoExcluirArquivo] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [logoErro, setLogoErro] = useState(false);
  /** Página atual da tabela de produtos por mensagem (id da mensagem -> página 0-based) */
  const [paginaProdutosPorMensagem, setPaginaProdutosPorMensagem] = useState<Record<string, number>>({});
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatarDataHora = (ts?: number) => {
    if (ts == null) return '--/--/-- --:--';
    const d = new Date(ts);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const aa = d.getFullYear().toString().slice(-2);
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${dd}/${mm}/${aa} ${hh}:${min}`;
  };

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, digitando]);

  // Sempre devolver o foco para a caixa de mensagem após qualquer interação (nova mensagem, fim de digitação, Limpar, etc.)
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(t);
  }, [mensagens, digitando]);

  const handleUploadOrder = async (file: File) => {
    if (digitando) return;
    const userMsg: Mensagem = {
      id: crypto.randomUUID(),
      role: 'user',
      text: `Enviei um arquivo: ${file.name}`,
    };
    setMensagens((prev) => [...prev, userMsg]);
    setErro(null);
    setDigitando(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (idEmitente) formData.append('idEmitente', idEmitente);
      const res = await fetch('/api/upload-order', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'TIPO_INVALIDO' || (data?.error && /tipo de arquivo inválido|formato não suportado/i.test(data.error))) {
          setMensagens((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'model', text: 'Tipo de arquivo inválido', timestamp: Date.now() },
            { id: crypto.randomUUID(), role: 'model', text: `${TEXTO_USAR_BOTAO_ARQUIVO}\n${OPCOES_ARQUIVO}`, timestamp: Date.now() },
          ]);
        } else {
          setErro(data?.error ?? 'Erro ao processar o arquivo');
        }
        setDigitando(false);
        return;
      }
      if (data.tipoResposta === 'pedidoArquivo' && data.itensArquivo?.length) {
        const itens: ItemCarrinho[] = data.itensArquivo.map((r: { codigo: string; descricao: string; quantidade: number; precoUnitario?: number | null }) => ({
          codigo: r.codigo,
          descricao: r.descricao || r.codigo,
          quantidade: r.quantidade,
          precoUnitario: r.precoUnitario ?? undefined,
        }));
        setPendingFileOrder(itens);
        const tabelaMsg: Mensagem = {
          id: crypto.randomUUID(),
          role: 'model',
          text: '',
          itensArquivo: data.itensArquivo,
          totalArquivo: data.total ?? 0,
        };
        const opcoesMsg: Mensagem = {
          id: crypto.randomUUID(),
          role: 'model',
          text: '1 - Salvar pedido\n2 - Alterar Produto\n3 - Excluir produto',
        };
        setMensagens((prev) => [...prev, tabelaMsg, opcoesMsg]);
      } else {
        setMensagens((prev) => [...prev, { id: crypto.randomUUID(), role: 'model', text: data?.text || 'Arquivo processado.', timestamp: Date.now() }]);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
    } finally {
      setDigitando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const podeAnexar = true;

  const handleSendMessage = async (textoOverride?: string) => {
    const texto = (textoOverride !== undefined ? textoOverride : input).trim();
    if (!texto || digitando) return;

    const userMsg: Mensagem = {
      id: crypto.randomUUID(),
      role: 'user',
      text: texto,
      timestamp: Date.now(),
    };
    const ultimaModelText = [...mensagens].reverse().find((m) => m.role === 'model')?.text ?? '';
    const ultimaEraOpcoesArquivo = /1\s*-\s*Salvar pedido/i.test(ultimaModelText) && /3\s*-\s*Excluir produto/i.test(ultimaModelText);

    if (pendingFileOrder && texto === '1' && ultimaEraOpcoesArquivo) {
      setMensagens((prev) => [...prev, userMsg]);
      if (textoOverride === undefined) setInput('');
      setCarrinho((prev) => [...prev, ...pendingFileOrder]);
      setPendingFileOrder(null);
      setMensagens((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'model', text: 'Pedido salvo.', timestamp: Date.now() },
        { id: crypto.randomUUID(), role: 'model', text: TEXTO_SAUDACAO, timestamp: Date.now() },
        { id: crypto.randomUUID(), role: 'model', text: TEXTO_MENU_INICIAL, timestamp: Date.now() },
      ]);
      setDigitando(false);
      return;
    }

    const matchAlterar = texto.match(/^(\d+)\s*[,]\s*(\d+)$/) || texto.match(/^(\d+)\s+(\d+)$/);
    if (pendingFileOrder && aguardandoAlterarArquivo && matchAlterar) {
      const itemIdx = parseInt(matchAlterar[1], 10) - 1;
      const qtd = Math.max(1, parseInt(matchAlterar[2], 10));
      if (itemIdx >= 0 && itemIdx < pendingFileOrder.length) {
        const updated = pendingFileOrder.map((it, i) => (i === itemIdx ? { ...it, quantidade: qtd } : it));
        setPendingFileOrder(updated);
        setAguardandoAlterarArquivo(false);
        setMensagens((prev) => [...prev, userMsg]);
        if (textoOverride === undefined) setInput('');
        const itensArquivo = updated.map((it) => ({
          codigo: it.codigo,
          descricao: it.descricao,
          unidade: 'Un',
          quantidade: it.quantidade,
          estoque: '' as number | '',
          precoUnitario: it.precoUnitario ?? null,
          precoTotal: (it.precoUnitario ?? 0) * it.quantidade || null,
        }));
        const total = updated.reduce((s, it) => s + it.quantidade * (it.precoUnitario ?? 0), 0);
        setMensagens((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'model', text: '', itensArquivo, totalArquivo: total, timestamp: Date.now() },
          { id: crypto.randomUUID(), role: 'model', text: '1 - Salvar pedido\n2 - Alterar Produto\n3 - Excluir produto', timestamp: Date.now() },
        ]);
        setDigitando(false);
        return;
      }
    }

    if (pendingFileOrder && aguardandoExcluirArquivo && /^\d+$/.test(texto)) {
      const itemIdx = parseInt(texto, 10) - 1;
      if (itemIdx >= 0 && itemIdx < pendingFileOrder.length) {
        const updated = pendingFileOrder.filter((_, i) => i !== itemIdx);
        setPendingFileOrder(updated.length > 0 ? updated : null);
        setAguardandoExcluirArquivo(false);
        setMensagens((prev) => [...prev, userMsg]);
        if (textoOverride === undefined) setInput('');
        if (updated.length === 0) {
          setMensagens((prev) => [...prev, { id: crypto.randomUUID(), role: 'model', text: 'Nenhum item no pedido do arquivo.', timestamp: Date.now() }]);
        } else {
          const itensArquivo = updated.map((it) => ({
            codigo: it.codigo,
            descricao: it.descricao,
            unidade: 'Un',
            quantidade: it.quantidade,
            estoque: '' as number | '',
            precoUnitario: it.precoUnitario ?? null,
            precoTotal: (it.precoUnitario ?? 0) * it.quantidade || null,
          }));
          const total = updated.reduce((s, it) => s + it.quantidade * (it.precoUnitario ?? 0), 0);
          setMensagens((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'model', text: '', itensArquivo, totalArquivo: total, timestamp: Date.now() },
            { id: crypto.randomUUID(), role: 'model', text: '1 - Salvar pedido\n2 - Alterar Produto\n3 - Excluir produto', timestamp: Date.now() },
          ]);
        }
        setDigitando(false);
        return;
      }
    }

    setMensagens((prev) => [...prev, userMsg]);
    if (textoOverride === undefined) setInput('');
    setErro(null);
    setDigitando(true);

    try {
      const history = mensagens.map((m) => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.text }],
      }));

      const ultimaComProdutos = [...mensagens].reverse().find((m) => m.role === 'model' && m.produtos && m.produtos.length > 0);
      const lastProducts = ultimaComProdutos?.produtos?.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        descricao: p.descricao,
        estoque: p.estoque,
        medidas: p.medidas,
        unidade: p.unidade ?? undefined,
        material: p.material ?? undefined,
        precoUnitario: typeof p.precoUnitario === 'number' ? p.precoUnitario : undefined,
        ipi: p.ipi ?? undefined,
        dim1: p.dim1 ?? undefined,
        dim2: p.dim2 ?? undefined,
        dim3: p.dim3 ?? undefined,
        dim4: p.dim4 ?? undefined,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: texto,
          history,
          cart: carrinho,
          ...(idEmitente ? { idEmitente } : {}),
          ...(lastProducts?.length ? { lastProducts } : {}),
          ...(ultimaEraOpcoesArquivo ? { ultimaMensagemEraOpcoesArquivo: true } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? 'Erro ao enviar mensagem');
      }

      if (data.clearCart) setCarrinho([]);
      else if (data.cart) setCarrinho(data.cart);

      if (data.text?.includes('Indique o produto e a quantidade')) setAguardandoAlterarArquivo(true);
      else setAguardandoAlterarArquivo(false);
      if (data.text?.includes('Indique o produto (ex: 1)')) setAguardandoExcluirArquivo(true);
      else setAguardandoExcluirArquivo(false);

      const now = Date.now();
      const modelMsg: Mensagem = {
        id: crypto.randomUUID(),
        role: 'model',
        text: data.text,
        timestamp: now,
        produtos: data.produtos,
        ...(data.exibirCarrinho && data.cart?.length && !data.carrinhoEmBalaoSeparado ? { carrinho: data.cart } : {}),
      };
      setMensagens((prev) => [...prev, modelMsg]);

      if (data.carrinhoEmBalaoSeparado && data.cart?.length) {
        setMensagens((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'model', text: '', carrinho: data.cart, timestamp: Date.now() },
        ]);
      }

      if (data.textoPergunta) {
        const perguntaMsg: Mensagem = {
          id: crypto.randomUUID(),
          role: 'model',
          text: data.textoPergunta,
          timestamp: Date.now(),
        };
        setMensagens((prev) => [...prev, perguntaMsg]);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro de conexão');
    } finally {
      setDigitando(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLogoWrap}>
          {logoErro ? (
            <span style={styles.logoTexto}>Fluydo IA</span>
          ) : (
            <img
              src="/LogoFluydo.png"
              alt="Fluydo.AI"
              style={styles.logo}
              onError={() => setLogoErro(true)}
            />
          )}
          <div style={styles.headerSlogan}>Solução sob medida com agilidade digital</div>
        </div>
        <div style={styles.headerVersao}>Versão 1.1.6</div>
      </header>

      <main style={styles.chat}>
        {mensagens.map((m) => (
          <div key={m.id} style={{ ...styles.balaoWrap, ...(m.produtos && m.produtos.length > 0 ? {} : { maxWidth: '50ch' }) }}>
            <div
              style={{
                ...(m.produtos && m.produtos.length > 0 ? styles.balaoComTabela : styles.balao),
                ...(m.role === 'user' ? styles.balaoUser : styles.balaoModel),
              }}
            >
              {!(m.produtos && m.produtos.length > 0) && (
                <div style={m.role === 'user' ? styles.textoUser : styles.textoModel}>
                  {m.text}
                </div>
              )}
            {m.produtos && m.produtos.length > 0 && (() => {
                const ITENS_POR_PAGINA = 10;
                const produtosOrdenados = [...m.produtos!].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
                const pagina = paginaProdutosPorMensagem[m.id] ?? 0;
                const totalPaginas = Math.max(1, Math.ceil(produtosOrdenados.length / ITENS_POR_PAGINA));
                const paginaAtual = Math.min(pagina, totalPaginas - 1);
                const inicio = (paginaAtual === totalPaginas - 1 && produtosOrdenados.length > ITENS_POR_PAGINA)
                  ? Math.max(0, produtosOrdenados.length - ITENS_POR_PAGINA)
                  : paginaAtual * ITENS_POR_PAGINA;
                const produtosPagina = produtosOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA);
                const textoContagem = m.text.replace(/^<(\d+)>\s*/, '$1 ');
                return (
              <>
                <div style={styles.cardProdutos} id={`produtos-inicio-${m.id}`}>
                  <div className="tabela-produtos-wrap" style={styles.tabelaWrapProdutos}>
                    <div style={{ ...styles.balaoContagem, marginBottom: '0.5rem' }}>{textoContagem}</div>
                    <div style={{ maxHeight: 'calc(2.5rem * 21)', overflow: 'auto' }}>
                      <table className="tabela-produtos" style={styles.tabelaProdutos}>
                        <colgroup>
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '21%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '11%' }} />
                          <col style={{ width: '11%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '12%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={styles.thProdutos}>#</th>
                            <th style={styles.thProdutos}>Código</th>
                            <th style={styles.thProdutosDireita}>Estoque</th>
                            <th style={styles.thProdutosDireita}>Preço Unit.</th>
                            <th style={styles.thProdutosDireita}>dim1</th>
                            <th style={styles.thProdutosDireita}>dim2</th>
                            <th style={styles.thProdutosDireita}>dim3</th>
                            <th style={styles.thProdutosDireita}>dim4</th>
                          </tr>
                        </thead>
                        <tbody>
                          {produtosPagina.map((p, idx) => {
                            const zebra = idx % 2 === 0 ? styles.trZebraPar : styles.trZebraImpar;
                            const fmtNum = (n: number | null | undefined) => (n != null ? String(n) : '—');
                            const numeroItem = inicio + idx + 1;
                            return (
                              <React.Fragment key={p.id}>
                                <tr style={zebra}>
                                  <td style={styles.tdProdutos}>{numeroItem}</td>
                                  <td style={styles.tdProdutos}>{p.codigo}</td>
                                  <td style={styles.tdProdutosDireita}>{p.estoque}</td>
                                  <td style={styles.tdProdutosDireita}>{p.precoUnitario != null ? (typeof p.precoUnitario === 'number' ? p.precoUnitario.toFixed(2) : String(p.precoUnitario)) : '—'}</td>
                                  <td style={styles.tdProdutosDireita}>{fmtNum(p.dim1)}</td>
                                  <td style={styles.tdProdutosDireita}>{fmtNum(p.dim2)}</td>
                                  <td style={styles.tdProdutosDireita}>{fmtNum(p.dim3)}</td>
                                  <td style={styles.tdProdutosDireita}>{fmtNum(p.dim4)}</td>
                                </tr>
                                <tr style={zebra}>
                                  <td className="td-descricao-mobile" style={styles.tdDescricaoProdutos} colSpan={6}>{p.descricao}</td>
                                  <td style={styles.tdProdutosCentro}>{p.unidade ?? '—'}</td>
                                  <td style={styles.tdProdutos}>{p.material ?? '—'}</td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ ...styles.balaoContagem, marginTop: '0.5rem' }}>{textoContagem}</div>
                    <div id={`produtos-fim-${m.id}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '0.5rem', gap: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => setPaginaProdutosPorMensagem((prev) => ({ ...prev, [m.id]: 0 }))}
                        disabled={paginaAtual === 0}
                        style={{ ...styles.btnPdf, marginRight: 0, minWidth: '2.5rem', fontWeight: 700, opacity: paginaAtual === 0 ? 0.6 : 1, cursor: paginaAtual === 0 ? 'not-allowed' : 'pointer' }}
                        aria-label="Primeira página"
                      >
                        <strong>{'<|'}</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaginaProdutosPorMensagem((prev) => ({ ...prev, [m.id]: Math.max(0, (prev[m.id] ?? 0) - 1) }))}
                        disabled={paginaAtual === 0}
                        style={{ ...styles.btnPdf, marginRight: 0, minWidth: '2.5rem', fontWeight: 700, opacity: paginaAtual === 0 ? 0.6 : 1, cursor: paginaAtual === 0 ? 'not-allowed' : 'pointer' }}
                        aria-label="Página anterior"
                      >
                        <strong>{'<'}</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaginaProdutosPorMensagem((prev) => ({ ...prev, [m.id]: (prev[m.id] ?? 0) + 1 }))}
                        disabled={paginaAtual >= totalPaginas - 1}
                        style={{ ...styles.btnPdf, marginRight: 0, minWidth: '2.5rem', fontWeight: 700, opacity: paginaAtual >= totalPaginas - 1 ? 0.6 : 1, cursor: paginaAtual >= totalPaginas - 1 ? 'not-allowed' : 'pointer' }}
                        aria-label="Próxima página"
                      >
                        <strong>{'>'}</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaginaProdutosPorMensagem((prev) => ({ ...prev, [m.id]: totalPaginas - 1 }))}
                        disabled={paginaAtual >= totalPaginas - 1}
                        style={{ ...styles.btnPdf, marginRight: 0, minWidth: '2.5rem', fontWeight: 700, opacity: paginaAtual >= totalPaginas - 1 ? 0.6 : 1, cursor: paginaAtual >= totalPaginas - 1 ? 'not-allowed' : 'pointer' }}
                        aria-label="Última página"
                      >
                        <strong>{'|>'}</strong>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => exportarProdutosParaPdf(produtosOrdenados.map((p) => ({ codigo: p.codigo, descricao: p.descricao, estoque: p.estoque, unidade: p.unidade ?? null, material: p.material ?? null, precoUnitario: p.precoUnitario ?? null, ipi: p.ipi ?? null, dim1: p.dim1 ?? null, dim2: p.dim2 ?? null, dim3: p.dim3 ?? null, dim4: p.dim4 ?? null })), nomeEmitente)}
                  style={styles.btnPdf}
                  aria-label="Baixar lista de produtos em PDF"
                >
                  📄 Baixar PDF
                </button>
              </>
                );
              })()}
            {m.carrinho && m.carrinho.length > 0 && (() => {
              const itens = m.carrinho!;
              const totalPedido = itens.reduce((s, i) => s + (i.quantidade * (i.precoUnitario ?? 0)), 0);
              return (
                <div style={styles.tabelaWrap}>
                  <table style={styles.tabela}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Item</th>
                        <th style={styles.th}>Código</th>
                        <th style={styles.th}>Unidade</th>
                        <th style={styles.th}>Quantidade</th>
                        <th style={styles.th}>Preço Unit.</th>
                        <th style={styles.th}>Preço Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item, idx) => {
                        const precoUnit = item.precoUnitario ?? 0;
                        const precoTotal = item.quantidade * precoUnit;
                        return (
                          <React.Fragment key={`${item.codigo}-${idx}`}>
                            <tr>
                              <td style={styles.td}>{idx + 1}</td>
                              <td style={styles.td}>{item.codigo}</td>
                              <td style={styles.td}>Un</td>
                              <td style={styles.td}>{item.quantidade}</td>
                              <td style={styles.td}>{precoUnit > 0 ? `R$ ${precoUnit.toFixed(2)}` : '—'}</td>
                              <td style={styles.td}>{precoTotal > 0 ? `R$ ${precoTotal.toFixed(2)}` : '—'}</td>
                            </tr>
                            <tr>
                              <td style={styles.tdDescricao} colSpan={6}>{item.descricao}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  <p style={styles.totalPedido}>Total do pedido: R$ {totalPedido.toFixed(2)}</p>
                </div>
              );
            })()}
            {m.itensArquivo && m.itensArquivo.length > 0 && (
              <div style={styles.tabelaWrap}>
                <table style={styles.tabela}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Item</th>
                      <th style={styles.th}>Código</th>
                      <th style={styles.th}>Unidade</th>
                      <th style={styles.th}>Quantidade</th>
                      <th style={styles.th}>Estoque</th>
                      <th style={styles.th}>Preço Unit.</th>
                      <th style={styles.th}>Preço Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.itensArquivo.map((r, idx) => (
                      <React.Fragment key={`${r.codigo}-${idx}`}>
                        <tr>
                          <td style={styles.td}>{idx + 1}</td>
                          <td style={styles.td}>{r.codigo}</td>
                          <td style={styles.td}>{r.unidade}</td>
                          <td style={styles.td}>{r.quantidade}</td>
                          <td style={styles.td}>{r.estoque === '' ? '—' : r.estoque}</td>
                          <td style={styles.td}>{r.precoUnitario != null ? `R$ ${Number(r.precoUnitario).toFixed(2)}` : '—'}</td>
                          <td style={styles.td}>{r.precoTotal != null ? `R$ ${Number(r.precoTotal).toFixed(2)}` : '—'}</td>
                        </tr>
                        <tr>
                          <td style={styles.tdDescricao} colSpan={7}>{r.descricao || '—'}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {(m.totalArquivo ?? 0) >= 0 && <p style={styles.totalPedido}>Total do pedido: R$ {(m.totalArquivo ?? 0).toFixed(2)}</p>}
              </div>
            )}
            </div>
            <div style={{ ...styles.balaoRodape, ...(m.role === 'model' ? styles.balaoRodapeModel : styles.balaoRodapeUser) }}>
              {m.role === 'user' ? 'Você' : 'Fluydo'} - {formatarDataHora(m.timestamp)}
            </div>
          </div>
        ))}

        {digitando && (
          <div style={{ ...styles.balao, ...styles.balaoModel }}>
            <div style={styles.digitando}>Digitando...</div>
          </div>
        )}

        {erro && (
          <div style={styles.erro}>{erro}</div>
        )}

        <div ref={fimRef} />
      </main>

      <p style={styles.avisoIa}>O Fluydo é uma IA e pode cometer erros.</p>

      <div style={styles.inputArea}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUploadOrder(f);
          }}
        />
        <div style={styles.inputRow}>
          <button
            type="button"
            onClick={() => {
              if (digitando) return;
              fileInputRef.current?.click();
            }}
            disabled={digitando}
            style={styles.btnAnexo}
            aria-label="Enviar arquivo ou foto com lista de produtos"
            title="Enviar arquivo ou foto com lista de produtos"
          >
            📎
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite uma mensagem"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            style={styles.input}
            disabled={digitando}
            autoFocus
          />
          <button
          type="button"
          onClick={handleSendMessage}
          disabled={digitando || !input.trim()}
          style={{
            ...styles.btn,
            ...(digitando || !input.trim() ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
          }}
          aria-label="Enviar"
          >
            ➤
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (digitando) return;
            const t = Date.now();
            setMensagens([
              { id: 'inicial-1', role: 'model', text: TEXTO_SAUDACAO, timestamp: t },
              { id: 'inicial-2', role: 'model', text: TEXTO_MENU_INICIAL, timestamp: t },
            ]);
            setCarrinho([]);
            setPendingFileOrder(null);
            setAguardandoAlterarArquivo(false);
            setAguardandoExcluirArquivo(false);
            setErro(null);
          }}
          disabled={digitando}
          style={styles.btnLimpar}
          aria-label="Limpar conversa e recomeçar"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  header: {
    background: 'var(--branco)',
    padding: '1rem 1.25rem',
    minHeight: 130,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: 'var(--sombra)',
  },
  headerLogoWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  logo: { objectFit: 'contain', height: 88, width: 'auto', display: 'block' },
  logoTexto: { fontSize: '2rem', fontWeight: 700, color: '#D6FF38' },
  headerSlogan: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--azul-header)',
    paddingBottom: '0.35rem',
    borderBottom: '2px solid var(--azul-header)',
  },
  headerVersao: { marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--azul-header)' },
  chat: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 0.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  chatInicio: {
    textAlign: 'center',
    color: 'var(--cinza-placeholder)',
    maxWidth: 280,
    margin: 'auto',
  },
  icone: { fontSize: '4rem', marginBottom: '0.5rem', opacity: 0.6 },
  chatInicioTitulo: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--azul-escuro)',
    marginBottom: '0.35rem',
  },
  chatInicioP: { fontSize: '0.9rem' },
  balaoWrap: { display: 'flex', flexDirection: 'column', gap: '0.2rem', alignSelf: 'stretch' },
  balao: {
    maxWidth: '50ch',
    padding: '0.75rem 1rem',
    borderRadius: 12,
    alignSelf: 'flex-start',
    wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  balaoComTabela: {
    maxWidth: '100%',
    padding: '0.5rem 0.35rem',
    borderRadius: 12,
    alignSelf: 'flex-start',
    wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  balaoContagem: {
    marginTop: '0.5rem',
    padding: '0.4rem 0.6rem',
    borderRadius: 10,
    background: 'var(--azul-resposta)',
    border: '1px solid rgba(30, 64, 175, 0.2)',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--preto)',
    alignSelf: 'flex-start',
  },
  balaoRodape: {
    paddingLeft: '0.25rem',
    paddingRight: '0.25rem',
    marginTop: 2,
    fontSize: '0.7rem',
    color: 'var(--cinza-placeholder)',
  },
  balaoRodapeModel: {
    marginLeft: 0,
  },
  balaoRodapeUser: {
    alignSelf: 'flex-end',
    marginRight: 0,
  },
  balaoUser: {
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    background: 'var(--azul-principal)',
    color: 'var(--branco)',
  },
  balaoModel: {
    alignSelf: 'flex-start',
    marginLeft: 0,
    marginRight: 'auto',
    background: 'var(--azul-resposta)',
    color: 'var(--preto)',
    border: '1px solid rgba(30, 64, 175, 0.2)',
  },
  textoUser: { fontSize: '0.95rem', color: 'var(--branco)', fontWeight: 500 },
  textoModel: { fontSize: '0.95rem', whiteSpace: 'pre-wrap', fontWeight: 700, fontStyle: 'italic', color: 'var(--preto)' },
  digitando: { fontSize: '0.9rem', color: 'var(--cinza-placeholder)', fontWeight: 700, fontStyle: 'italic' },
  tabelaWrap: { marginTop: '0.75rem', overflowX: 'auto' },
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '2px solid var(--azul-principal)', fontWeight: 700, color: 'var(--azul-escuro)' },
  td: { padding: '0.35rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)' },
  tdDescricao: { padding: '0.35rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)' },
  cardProdutos: {
    marginTop: 0,
    padding: '0.3rem 0.2rem',
    background: 'var(--azul-resposta)',
    maxWidth: '100%',
    minWidth: 0,
  },
  tabelaWrapProdutos: { marginTop: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' },
  tabelaProdutos: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 'var(--tabela-produtos-fs)', fontFamily: 'ui-monospace, monospace' },
  thProdutos: { textAlign: 'left', padding: '0.2rem 0.35rem', borderBottom: '2px solid var(--azul-principal)', fontWeight: 700, color: '#D6FF38', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 },
  thProdutosCentro: { textAlign: 'center', padding: '0.2rem 0.35rem', borderBottom: '2px solid var(--azul-principal)', fontWeight: 700, color: '#D6FF38', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 },
  thProdutosDireita: { textAlign: 'right', padding: '0.2rem 0.35rem', borderBottom: '2px solid var(--azul-principal)', fontWeight: 700, color: '#D6FF38', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 },
  tdProdutos: { padding: '0.18rem 0.35rem', borderBottom: '1px solid rgba(0,0,0,0.08)', color: 'var(--preto)', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 },
  tdProdutosCentro: { padding: '0.18rem 0.35rem', borderBottom: '1px solid rgba(0,0,0,0.08)', color: 'var(--preto)', textAlign: 'center', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 },
  tdProdutosDireita: { padding: '0.18rem 0.35rem', borderBottom: '1px solid rgba(0,0,0,0.08)', color: 'var(--preto)', textAlign: 'right', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 },
  tdDescricaoProdutos: { padding: '0.18rem 0.35rem', borderBottom: '1px solid rgba(0,0,0,0.08)', color: 'var(--cinza-texto)', fontSize: 'var(--tabela-produtos-desc-fs)', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: 1.25, minWidth: 0, overflow: 'hidden' },
  trZebraPar: { background: 'rgba(255,255,255,0.5)' },
  trZebraImpar: { background: 'rgba(147, 197, 253, 0.25)' },
  btnPdf: {
    marginTop: '0.5rem',
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--azul-escuro)',
    background: 'var(--verde-lima)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  totalPedido: { marginTop: '0.5rem', marginBottom: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--azul-escuro)' },
  tabelaPergunta: { marginTop: '0.5rem', marginBottom: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--azul-escuro)' },
  cards: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' },
  card: {
    padding: '0.6rem 0.75rem',
    background: 'var(--azul-fundo)',
    borderRadius: 8,
    borderLeft: '3px solid var(--azul-claro)',
  },
  cardSeparador: { marginTop: '1rem' },
  cardNumero: { fontWeight: 700, color: 'var(--azul-principal)', marginBottom: '0.35rem' },
  cardLinha: { fontSize: '0.85rem', marginTop: '0.2rem', lineHeight: 1.4 },
  cardPergunta: { fontSize: '0.9rem', fontWeight: 600, marginTop: '0.5rem', color: 'var(--azul-escuro)' },
  erro: {
    padding: '0.5rem 0.75rem',
    background: '#fef2f2',
    color: '#b91c1c',
    borderRadius: 8,
    fontSize: '0.9rem',
  },
  inputArea: {
    padding: '0.75rem 1rem',
    background: 'var(--branco)',
    borderTop: '1px solid rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  inputRow: { display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: 0 },
  btnAnexo: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'var(--azul-fundo)',
    fontSize: '1.4rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnLimpar: {
    alignSelf: 'flex-start',
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--cinza-placeholder)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  avisoIa: {
    margin: 0,
    marginTop: '0.5rem',
    marginBottom: '0.35rem',
    paddingLeft: 'calc(1rem + 48px + 0.5rem)',
    paddingRight: '1rem',
    fontSize: '0.75rem',
    color: 'var(--cinza-placeholder)',
  },
  input: {
    flex: 1,
    padding: '0.75rem 1rem',
    border: 'none',
    borderRadius: 24,
    background: 'var(--azul-fundo)',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#000',
    outline: 'none',
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--verde-lima)',
    color: 'var(--preto)',
    fontSize: '1.4rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

/** Página raiz: orienta a acessar via URL do parceiro (fluydo.ia.br/[telefone]) */
export default function RootPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--azul-fundo)', alignContent: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' as const }}>
      <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--verde-lima)', marginBottom: '0.5rem' }}>Fluydo.IA</p>
      <p style={{ fontSize: '1.1rem', color: 'var(--cinza-texto)', marginBottom: '0.5rem' }}>Acesse via o link do seu parceiro.</p>
      <p style={{ fontSize: '0.95rem', color: 'var(--azul-header)', fontWeight: 600 }}>Exemplo: fluydo.ia.br/11999998888</p>
    </div>
  );
}
