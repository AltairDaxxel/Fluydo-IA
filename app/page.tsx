'use client';

import React, { useState, useRef, useEffect } from 'react';

const TEXTO_SAUDACAO = 'Olá, eu sou o Fluydo.';
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

export default function ChatPage() {
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
        precoUnitario: typeof p.precoUnitario === 'number' ? p.precoUnitario : undefined,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: texto,
          history,
          cart: carrinho,
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
        <div style={styles.headerVersao}>Versão 1.0.1</div>
      </header>

      <main style={styles.chat}>
        {mensagens.map((m) => (
          <div key={m.id} style={styles.balaoWrap}>
            <div
              style={{
                ...styles.balao,
                ...(m.role === 'user' ? styles.balaoUser : styles.balaoModel),
              }}
            >
              <div style={m.role === 'user' ? styles.textoUser : styles.textoModel}>
                {m.text}
              </div>
            {m.produtos && m.produtos.length > 0 && (
              <div style={styles.tabelaWrap}>
                <table style={styles.tabela}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Item</th>
                      <th style={styles.th}>Código</th>
                      <th style={styles.th}>Unidade</th>
                      <th style={styles.th}>Estoque</th>
                      <th style={styles.th}>Preço Unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.produtos.map((p, idx) => (
                      <React.Fragment key={p.id}>
                        <tr>
                          <td style={styles.td}>{idx + 1}</td>
                          <td style={styles.td}>{p.codigo}</td>
                          <td style={styles.td}>{p.unidade ?? '—'}</td>
                          <td style={styles.td}>{p.estoque}</td>
                          <td style={styles.td}>{p.precoUnitario != null ? (typeof p.precoUnitario === 'number' ? `R$ ${p.precoUnitario.toFixed(2)}` : String(p.precoUnitario)) : '—'}</td>
                        </tr>
                        <tr>
                          <td style={styles.tdDescricao} colSpan={5}>{p.descricao}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            <div style={{ ...styles.balaoRodape, ...(m.role === 'model' ? styles.balaoRodapeModel : {}) }}>
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
    background: 'var(--azul-header)',
    color: 'var(--branco)',
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
  logoTexto: { fontSize: '2rem', fontWeight: 700, color: 'var(--branco)' },
  headerSlogan: { fontSize: '0.85rem', fontWeight: 700 },
  headerVersao: { marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.95 },
  chat: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
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
  balaoRodape: {
    paddingLeft: '0.25rem',
    paddingRight: '0.25rem',
    marginTop: 2,
    fontSize: '0.7rem',
    color: 'var(--cinza-placeholder)',
  },
  balaoRodapeModel: {
    marginLeft: '2.5rem',
  },
  balaoUser: {
    alignSelf: 'flex-start',
    background: 'var(--azul-principal)',
    color: 'var(--branco)',
  },
  balaoModel: {
    alignSelf: 'flex-start',
    marginLeft: '2.5rem',
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
    background: 'var(--azul-header)',
    color: 'var(--branco)',
    fontSize: '1.4rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
