'use client';

import React, { useState, useRef, useEffect } from 'react';

function MarkdownText({ text }: { text: string }) {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br />');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
import { getSelectedItems, type QtyMap } from '@/lib/orderQuantity';

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

const TEXTO_SAUDACAO = 'Olá, eu sou o Fluydo, assistente virtual de vendas.';
const TEXTO_MENU_INICIAL =
  "Ainda não sabe como pesquisar? Digite ajuda ou ? para ver as dicas.\n\nComo posso te ajudar agora?";

const TEXTO_PESQUISA =
  'Você pode pesquisar por código, descrição ou medidas. Dica: use "medida" + números para filtrar por dimensões (ex.: oring medida 28 x 3,53; retentor medida 110 x 130 x 13). Use "linha" + letras para filtrar pelo início do código (ex.: linha VD). Para perguntas gerais, termine com ?';
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
    aplicacao?: string | null;
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
  /** Artigo de ajuda (FluydoAjuda + exemplos) para renderizar Markdown */
  artigoAjuda?: {
    id: number;
    slug: string;
    titulo: string;
    resumo?: string | null;
    conteudoMd: string;
    exemplos: Array<{ id: number; exemplo: string; observacao?: string | null }>;
  };
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
  /** Quantidade por mensagem e código (messageId -> codigo -> number | ''). Só itens com qtd > 0 entram no pedido. */
  const [quantidadePorMensagem, setQuantidadePorMensagem] = useState<Record<string, QtyMap>>({});
  /** Quantidade editada na tabela do pedido (messageId -> codigo -> quantidade) para exibir no input e manter no carrinho. */
  const [quantidadeCarrinhoPorMensagem, setQuantidadeCarrinhoPorMensagem] = useState<{ [messageId: string]: { [codigo: string]: number } }>({});
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

    // Fluxo especial: comando "pedir"/"incluir no pedido" — só inclui itens com Quantidade preenchida e > 0
    const textoLower = texto.toLowerCase();
    const ehComandoPedir =
      /\bpedir\b/.test(textoLower) ||
      /\bincluir\b/.test(textoLower) ||
      /incluir\s+no\s+pedido/.test(textoLower) ||
      /colocar\s+no\s+pedido/.test(textoLower) ||
      /\badicionar\b/.test(textoLower) ||
      /adicionar\s+ao\s+pedido/.test(textoLower);
    if (ehComandoPedir) {
      const ultimaComProdutos = [...mensagens].reverse().find((m) => m.role === 'model' && m.produtos && m.produtos.length > 0);
      if (ultimaComProdutos && ultimaComProdutos.produtos && ultimaComProdutos.produtos.length > 0) {
        const qtyMap = quantidadePorMensagem[ultimaComProdutos.id] ?? {};
        const selected = getSelectedItems(ultimaComProdutos.produtos, qtyMap) as ItemCarrinho[];

        setMensagens((prev) => [...prev, userMsg]);
        if (textoOverride === undefined) setInput('');

        if (selected.length === 0) {
          const modelMsg: Mensagem = {
            id: crypto.randomUUID(),
            role: 'model',
            text: "Beleza — me diga a quantidade no campo 'Quantidade' dos itens que você quer, e aí eu incluo no pedido.",
            timestamp: Date.now(),
          };
          setMensagens((prev) => [...prev, modelMsg]);
          return;
        }

        setCarrinho((prev) => [...prev, ...selected]);
        const resumo: Mensagem = {
          id: crypto.randomUUID(),
          role: 'model',
          text:
            'Itens incluídos no pedido. Você pode digitar "ver pedido" para conferir, "buscar produto" para pesquisar outro ou "finalizar pedido" para concluir.',
          timestamp: Date.now(),
        };
        setMensagens((prev) => [...prev, resumo]);
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
        ...(data.artigoAjuda ? { artigoAjuda: data.artigoAjuda } : {}),
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

      if (data.downloadPdf) {
        const ultimaComProdutos = [...mensagens].reverse().find((m) => m.role === 'model' && m.produtos && m.produtos.length > 0);
        if (ultimaComProdutos?.produtos?.length) {
          const lista = ultimaComProdutos.produtos.map((p) => ({
            codigo: p.codigo,
            descricao: p.descricao,
            estoque: p.estoque,
            unidade: p.unidade ?? null,
            material: p.material ?? null,
            precoUnitario: p.precoUnitario ?? null,
            ipi: p.ipi ?? null,
            dim1: p.dim1 ?? null,
            dim2: p.dim2 ?? null,
            dim3: p.dim3 ?? null,
            dim4: p.dim4 ?? null,
          }));
          exportarProdutosParaPdf(lista, nomeEmitente);
        }
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
      </header>

      <main style={styles.chat}>
        {mensagens.map((m) => (
          <div key={m.id} style={{ ...styles.balaoWrap, ...(m.produtos && m.produtos.length > 0 || (m.carrinho && m.carrinho.length > 0) ? {} : { maxWidth: '50ch' }) }}>
            <div
              style={{
                ...((m.produtos && m.produtos.length > 0) || (m.carrinho && m.carrinho.length > 0) ? styles.balaoComTabela : styles.balao),
                ...(m.role === 'user' ? styles.balaoUser : styles.balaoModel),
              }}
            >
              {!(m.produtos && m.produtos.length > 0) && !(m.carrinho && m.carrinho.length > 0) && !m.artigoAjuda && (
                <div style={m.role === 'user' ? styles.textoUser : styles.textoModel}>
                  {m.text}
                </div>
              )}
              {m.artigoAjuda && m.role === 'model' && (
                <div style={styles.ajudaArtigo}>
                  <h3 style={styles.ajudaTitulo}>{m.artigoAjuda.titulo}</h3>
                  <div style={styles.ajudaConteudo}>
                    <MarkdownText text={m.artigoAjuda.conteudoMd} />
                  </div>
                  {m.artigoAjuda.exemplos && m.artigoAjuda.exemplos.length > 0 && (
                    <div style={styles.ajudaExemplos}>
                      <div style={styles.ajudaExemplosTitulo}>Exemplos:</div>
                      {m.artigoAjuda.exemplos.map((ex) => (
                        <div key={ex.id} style={styles.ajudaExemploItem}>
                          <span style={styles.ajudaExemplo}>{ex.exemplo}</span>
                          {ex.observacao && <span style={styles.ajudaExemploObs}>{ex.observacao}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            {m.produtos && m.produtos.length > 0 && (() => {
                const produtosOrdenados = [...m.produtos!].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
                const textoContagem = m.text.replace(/^<(\d+)>\s*/, '$1 ');
                const qtyMap = quantidadePorMensagem[m.id] ?? {};
                const setQty = (codigo: string, value: number | '') => {
                  setQuantidadePorMensagem((prev) => {
                    const atual = prev[m.id] ?? {};
                    const novo = { ...atual };
                    if (value === '' || value === 0) delete novo[codigo];
                    else novo[codigo] = value;
                    return { ...prev, [m.id]: novo };
                  });
                };
                const fmtNum = (n: number | null | undefined) => (n != null ? String(n) : '—');
                return (
              <>
                <div style={styles.cardProdutos} id={`produtos-inicio-${m.id}`}>
                  <div className="tabela-produtos-wrap" style={styles.tabelaWrapProdutos}>
                    <div style={{ ...styles.balaoContagem, marginBottom: '0.5rem' }}>{textoContagem}</div>
                    <div style={styles.gridScrollWrap}>
                      <table className="tabela-produtos" style={styles.tabelaProdutos}>
                        <colgroup>
                          <col style={{ width: '25ch' }} />
                          <col style={{ width: '5ch' }} />
                          <col style={{ width: '15ch' }} />
                          <col style={{ width: '15ch' }} />
                          <col style={{ width: '15ch' }} />
                          <col style={{ width: '6ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '100ch' }} />
                          <col style={{ width: '100ch' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={styles.thProdutos}>Código</th>
                            <th style={styles.thProdutos}>Unit.</th>
                            <th style={styles.thProdutosDireita}>Estoque</th>
                            <th style={styles.thProdutos}>Quantidade</th>
                            <th style={styles.thProdutosDireita}>Preço Unit.</th>
                            <th style={styles.thProdutosDireita}>%IPI</th>
                            <th style={styles.thProdutosDireita}>Dim1</th>
                            <th style={styles.thProdutosDireita}>Dim2</th>
                            <th style={styles.thProdutosDireita}>Dim3</th>
                            <th style={styles.thProdutosDireita}>Dim4</th>
                            <th style={styles.thProdutos}>Descrição</th>
                            <th style={styles.thProdutos}>Aplicação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {produtosOrdenados.map((p, idx) => {
                            const zebra = idx % 2 === 0 ? styles.trZebraPar : styles.trZebraImpar;
                            const qtyVal = qtyMap[p.codigo];
                            const qtyDisplay = qtyVal === '' || qtyVal === undefined ? '' : String(qtyVal);
                            return (
                              <tr key={p.id} style={zebra}>
                                <td style={styles.tdProdutos}>{p.codigo}</td>
                                <td style={styles.tdProdutosCentro}>{p.unidade ?? '—'}</td>
                                <td style={styles.tdProdutosDireita}>{p.estoque}</td>
                                <td style={styles.tdProdutos}>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={qtyDisplay}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\D/g, '');
                                      if (raw === '') {
                                        setQty(p.codigo, '');
                                        return;
                                      }
                                      const n = parseInt(raw, 10);
                                      if (!Number.isNaN(n) && n >= 0) setQty(p.codigo, n);
                                    }}
                                    style={styles.inputQty}
                                    aria-label={`Quantidade para ${p.codigo}`}
                                  />
                                </td>
                                <td style={styles.tdProdutosDireita}>{p.precoUnitario != null ? (typeof p.precoUnitario === 'number' ? p.precoUnitario.toFixed(2) : String(p.precoUnitario)) : '—'}</td>
                                <td style={styles.tdProdutosDireita}>{p.ipi != null ? (typeof p.ipi === 'number' ? p.ipi.toFixed(2) : String(p.ipi)) : '—'}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(p.dim1)}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(p.dim2)}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(p.dim3)}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(p.dim4)}</td>
                                <td style={styles.tdProdutosDescricao}>{p.descricao}</td>
                                <td style={styles.tdProdutos}>{p.aplicacao ?? '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
                );
              })()}
            {m.carrinho && m.carrinho.length > 0 && (() => {
              const itens = m.carrinho!;
              const qtyCarrinhoMap = quantidadeCarrinhoPorMensagem[m.id] ?? {};
              const setQtyCarrinho = (codigo: string, value: number) => {
                setQuantidadeCarrinhoPorMensagem((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] ?? {}), [codigo]: value } }));
                if (value === 0) {
                  setCarrinho((prev) => prev.filter((it) => it.codigo !== codigo));
                } else {
                  setCarrinho((prev) => {
                    const idx = prev.findIndex((it) => it.codigo === codigo);
                    if (idx >= 0) return prev.map((it) => (it.codigo === codigo ? { ...it, quantidade: value } : it));
                    const itemFromMessage = itens.find((i) => i.codigo === codigo);
                    if (!itemFromMessage) return prev;
                    return [...prev, { ...itemFromMessage, quantidade: value }];
                  });
                }
              };
              const itemComDims = itens as Array<{ codigo: string; descricao: string; quantidade: number; precoUnitario?: number; unidade?: string; ipi?: number | null; dim1?: number | null; dim2?: number | null; dim3?: number | null; dim4?: number | null; aplicacao?: string }>;
              const valorProdutos = itens.reduce((s, i) => {
                const q = qtyCarrinhoMap[i.codigo] ?? i.quantidade;
                if (q <= 0) return s;
                return s + q * (i.precoUnitario ?? 0);
              }, 0);
              const valorIPI = itens.reduce((s, i) => {
                const q = qtyCarrinhoMap[i.codigo] ?? i.quantidade;
                if (q <= 0) return s;
                const precoUnit = i.precoUnitario ?? 0;
                const ipiPct = (i as { ipi?: number | null }).ipi ?? 0;
                return s + (q * precoUnit * ipiPct) / 100;
              }, 0);
              const totalGeral = valorProdutos + valorIPI;
              const fmtNum = (n: number | null | undefined) => (n != null ? String(n) : '—');
              const fmtMoeda = (v: number) => (v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
              const valorProdutosFormatado = valorProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const valorIPIFormatado = valorIPI.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const totalFormatado = totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return (
                <div style={styles.cardProdutos}>
                  <div className="tabela-produtos-wrap" style={styles.tabelaWrapProdutos}>
                    <div style={{ ...styles.balaoContagem, marginBottom: '0.5rem' }}>Segue seu pedido:</div>
                    <div style={styles.gridScrollWrap}>
                      <table className="tabela-produtos" style={{ ...styles.tabelaProdutos, minWidth: '318ch' }}>
                        <colgroup>
                          <col style={{ width: '10ch' }} />
                          <col style={{ width: '25ch' }} />
                          <col style={{ width: '6ch' }} />
                          <col style={{ width: '15ch' }} />
                          <col style={{ width: '10ch' }} />
                          <col style={{ width: '15ch' }} />
                          <col style={{ width: '6ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '8ch' }} />
                          <col style={{ width: '100ch' }} />
                          <col style={{ width: '100ch' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={styles.thProdutosDireita}>Item</th>
                            <th style={styles.thProdutos}>Código</th>
                            <th style={styles.thProdutos}>Unit.</th>
                            <th style={styles.thProdutosDireita}>Quantidade</th>
                            <th style={styles.thProdutosDireita}>Preço Unit.</th>
                            <th style={styles.thProdutosDireita}>Preço Total</th>
                            <th style={styles.thProdutosDireita}>%IPI</th>
                            <th style={styles.thProdutosDireita}>Dim1</th>
                            <th style={styles.thProdutosDireita}>Dim2</th>
                            <th style={styles.thProdutosDireita}>Dim3</th>
                            <th style={styles.thProdutosDireita}>Dim4</th>
                            <th style={styles.thProdutos}>Descrição</th>
                            <th style={styles.thProdutos}>Aplicação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemComDims.map((item, idx) => {
                            const precoUnit = item.precoUnitario ?? 0;
                            const qty = qtyCarrinhoMap[item.codigo] ?? item.quantidade;
                            const precoTotal = qty * precoUnit;
                            const qtyDisplay = String(qty);
                            const zebra = idx % 2 === 0 ? styles.trZebraPar : styles.trZebraImpar;
                            return (
                              <tr key={`${item.codigo}-${idx}`} style={zebra}>
                                <td style={styles.tdProdutosDireita}>{idx + 1}</td>
                                <td style={styles.tdProdutos}>{item.codigo}</td>
                                <td style={styles.tdProdutosCentro}>{item.unidade ?? '—'}</td>
                                <td style={styles.tdProdutosDireita}>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={qtyDisplay}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\D/g, '');
                                      if (raw === '') {
                                        setQtyCarrinho(item.codigo, 0);
                                        return;
                                      }
                                      const n = parseInt(raw, 10);
                                      if (!Number.isNaN(n) && n >= 0) setQtyCarrinho(item.codigo, n);
                                    }}
                                    style={styles.inputQty}
                                    aria-label={`Quantidade para ${item.codigo}`}
                                  />
                                </td>
                                <td style={styles.tdProdutosDireita}>{fmtMoeda(precoUnit)}</td>
                                <td style={styles.tdProdutosDireita}>{fmtMoeda(precoTotal)}</td>
                                <td style={styles.tdProdutosDireita}>{(item as { ipi?: number | null }).ipi != null ? (Number((item as { ipi?: number | null }).ipi).toFixed(2)) : '—'}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(item.dim1)}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(item.dim2)}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(item.dim3)}</td>
                                <td style={styles.tdProdutosDireita}>{fmtNum(item.dim4)}</td>
                                <td style={styles.tdProdutosDescricao}>{item.descricao}</td>
                                <td style={styles.tdProdutos}>{item.aplicacao ?? '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={styles.totalPedidoMoldura}>
                      Valor dos produtos: {valorProdutosFormatado} | Valor do IPI: {valorIPIFormatado} | Valor Total: {totalFormatado}
                    </div>
                  </div>
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
                          <td style={styles.td}>{r.precoUnitario != null ? Number(r.precoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                          <td style={styles.td}>{r.precoTotal != null ? Number(r.precoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                        </tr>
                        <tr>
                          <td style={styles.tdDescricao} colSpan={7}>{r.descricao || '—'}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {(m.totalArquivo ?? 0) >= 0 && <p style={styles.totalPedido}>Total do pedido: {(m.totalArquivo ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
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
        <div style={styles.balaoInput}>
          <textarea
            ref={inputRef}
            placeholder="Digite uma mensagem"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            style={styles.input}
            disabled={digitando}
            rows={2}
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={digitando || !input.trim()}
            style={{
              ...styles.btnEnviar,
              ...(digitando || !input.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
            aria-label="Enviar"
          >
            ➤
          </button>
        </div>
        <div style={styles.botoesAbaixo}>
          <button
            type="button"
            onClick={() => {
              if (digitando) return;
              fileInputRef.current?.click();
            }}
            disabled={digitando}
            style={styles.btnEnviarArquivo}
            aria-label="Enviar arquivo ou foto com lista de produtos"
            title="Enviar arquivo ou foto com lista de produtos"
          >
            Enviar Arquivo
          </button>
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
        <p style={styles.avisoIa}>daxxel sistemas - 0.1.2 - O Fluydo é uma IA e pode cometer erros.</p>
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
    width: '100%',
    maxWidth: '100%',
    padding: '0.5rem 0.35rem',
    borderRadius: 12,
    alignSelf: 'stretch',
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
  ajudaArtigo: { marginTop: '0.5rem', fontSize: '0.95rem', lineHeight: 1.5, fontFamily: 'inherit', fontStyle: 'italic' },
  ajudaTitulo: { margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'inherit', fontStyle: 'italic' },
  ajudaConteudo: { marginBottom: '0.75rem', fontFamily: 'inherit', fontStyle: 'italic' },
  ajudaExemplos: { marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.1)', fontStyle: 'italic' },
  ajudaExemplosTitulo: { fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.95rem', fontFamily: 'inherit', fontStyle: 'italic' },
  ajudaExemploItem: { marginBottom: '0.25rem' },
  ajudaExemplo: { fontSize: '0.95rem', fontFamily: 'inherit', fontStyle: 'italic' },
  ajudaExemploObs: { marginLeft: '0.5rem', fontSize: '0.95rem', color: 'var(--cinza-texto)', fontFamily: 'inherit', fontStyle: 'italic' },
  digitando: { fontSize: '0.9rem', color: 'var(--cinza-placeholder)', fontWeight: 700, fontStyle: 'italic' },
  tabelaWrap: { marginTop: '0.75rem', overflowX: 'auto' },
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '2px solid var(--azul-principal)', fontWeight: 700, color: 'var(--azul-escuro)' },
  td: { padding: '0.35rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)' },
  tdDescricao: { padding: '0.35rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)' },
  tdTotalPedido: { padding: '0.4rem 0.5rem', borderTop: '2px solid var(--azul-principal)', borderRight: '1px solid rgba(0,0,0,0.12)', fontWeight: 700, fontSize: 'var(--tabela-produtos-fs)', color: 'var(--preto)', fontFamily: 'ui-monospace, monospace' },
  totalPedidoMoldura: { padding: '0.4rem 0.5rem', borderTop: '2px solid var(--azul-principal)', fontWeight: 700, fontSize: 'var(--tabela-produtos-fs)', color: 'var(--preto)', fontFamily: 'ui-monospace, monospace', background: 'var(--azul-resposta)' },
  cardProdutos: {
    marginTop: 0,
    padding: '0.3rem 0.2rem',
    background: 'var(--azul-resposta)',
    maxWidth: '100%',
    minWidth: 0,
  },
  tabelaWrapProdutos: { marginTop: 0, maxWidth: '100%' },
  gridScrollWrap: {
    maxHeight: 'calc(2.5rem * 5)',
    overflowX: 'auto',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  tabelaProdutos: {
    width: '100%',
    minWidth: '302ch',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontSize: 'var(--tabela-produtos-fs)',
    fontFamily: 'ui-monospace, monospace',
  },
  thProdutos: { textAlign: 'left', padding: '0.35rem 0.5rem', borderBottom: '2px solid var(--azul-principal)', borderRight: '1px solid rgba(0,0,0,0.15)', fontWeight: 700, color: '#D6FF38', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap' },
  thProdutosCentro: { textAlign: 'center', padding: '0.35rem 0.5rem', borderBottom: '2px solid var(--azul-principal)', borderRight: '1px solid rgba(0,0,0,0.15)', fontWeight: 700, color: '#D6FF38', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap' },
  thProdutosDireita: { textAlign: 'right', padding: '0.35rem 0.5rem', borderBottom: '2px solid var(--azul-principal)', borderRight: '1px solid rgba(0,0,0,0.15)', fontWeight: 700, color: '#D6FF38', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap' },
  tdProdutos: { padding: '0.3rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', borderRight: '1px solid rgba(0,0,0,0.12)', color: 'var(--preto)', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tdProdutosCentro: { padding: '0.3rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', borderRight: '1px solid rgba(0,0,0,0.12)', color: 'var(--preto)', textAlign: 'center', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap' },
  tdProdutosDireita: { padding: '0.3rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', borderRight: '1px solid rgba(0,0,0,0.12)', color: 'var(--preto)', textAlign: 'right', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tdProdutosDescricao: { padding: '0.3rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', borderRight: '1px solid rgba(0,0,0,0.12)', color: 'var(--cinza-texto)', fontSize: 'var(--tabela-produtos-fs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  inputQty: {
    width: '4rem',
    padding: '0.25rem 0.35rem',
    border: '1px solid rgba(0,0,0,0.2)',
    borderRadius: 6,
    fontSize: 'var(--tabela-produtos-fs)',
    fontFamily: 'inherit',
    textAlign: 'right',
  },
  tdDescricaoProdutos: { padding: '0.18rem 0.35rem', borderBottom: '1px solid rgba(0,0,0,0.08)', borderRight: '1px solid rgba(0,0,0,0.12)', color: 'var(--cinza-texto)', fontSize: 'var(--tabela-produtos-desc-fs)', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: 1.25, minWidth: 0, overflow: 'hidden' },
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
  },
  inputArea: {
    padding: '0.75rem 1rem',
    background: 'var(--branco)',
    borderTop: '1px solid rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  balaoInput: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.5rem',
    padding: '0.5rem 0.6rem',
    borderRadius: 20,
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'var(--azul-fundo)',
    minHeight: 0,
    maxWidth: '100%',
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '0.6rem 0.5rem',
    border: 'none',
    borderRadius: 14,
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    lineHeight: 1.45,
    color: 'var(--preto)',
    outline: 'none',
    resize: 'none',
  },
  btnEnviar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--verde-lima)',
    color: 'var(--preto)',
    fontSize: '1.2rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAnexo: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'var(--branco)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botoesAbaixo: {
    display: 'flex',
    flexDirection: 'row',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  btnEnviarArquivo: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--cinza-placeholder)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnLimpar: {
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
    marginTop: '0.25rem',
    paddingLeft: '0.25rem',
    fontSize: '0.7rem',
    color: 'var(--cinza-placeholder)',
    opacity: 0.85,
  },
};
