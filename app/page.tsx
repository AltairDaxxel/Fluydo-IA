'use client';

import { useState, useRef, useEffect } from 'react';

interface Mensagem {
  id: string;
  role: 'user' | 'model';
  text: string;
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
}

export default function ChatPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, digitando]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!digitando) inputRef.current?.focus();
  }, [digitando]);

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
        throw new Error(data?.error ?? 'Erro ao processar o arquivo');
      }
      const modelMsg: Mensagem = {
        id: crypto.randomUUID(),
        role: 'model',
        text: data.text,
        produtos: data.produtos,
      };
      setMensagens((prev) => [...prev, modelMsg]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
    } finally {
      setDigitando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const nomeJaInformado = mensagens.some(
    (m) => m.role === 'model' && m.text.includes('em que posso te ajudar')
  );

  const handleSendMessage = async (textoOverride?: string) => {
    const texto = (textoOverride !== undefined ? textoOverride : input).trim();
    if (!texto || digitando) return;

    const userMsg: Mensagem = {
      id: crypto.randomUUID(),
      role: 'user',
      text: texto,
    };
    setMensagens((prev) => [...prev, userMsg]);
    if (textoOverride === undefined) setInput('');
    setErro(null);
    setDigitando(true);

    try {
      const history = mensagens.map((m) => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.text }],
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texto, history }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? 'Erro ao enviar mensagem');
      }

      const modelMsg: Mensagem = {
        id: crypto.randomUUID(),
        role: 'model',
        text: data.text,
        produtos: data.produtos,
      };
      setMensagens((prev) => [...prev, modelMsg]);
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
          <img
            src="/logo-fluydo.png"
            alt="Fluydo.AI"
            width={180}
            height={44}
            style={styles.logo}
          />
          <div style={styles.headerSlogan}>Solução sob medida com agilidade digital</div>
        </div>
        <div style={styles.headerVersao}>Versão: 1.0.0</div>
      </header>

      <main style={styles.chat}>
        {mensagens.length === 0 && !digitando && (
          <div style={styles.chatInicio}>
            <div style={styles.icone}>💬</div>
            <h2 style={styles.chatInicioTitulo}>Bem-vindo ao Fluydo IA</h2>
            <p style={styles.chatInicioP}>
              Digite uma mensagem abaixo para começar. Você pode encontrar produtos por Código, descrição ou medidas.
            </p>
          </div>
        )}

        {mensagens.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.balao,
              ...(m.role === 'user' ? styles.balaoUser : styles.balaoModel),
            }}
          >
            <div style={m.role === 'user' ? styles.textoUser : styles.textoModel}>
              {m.text}
            </div>
            {m.produtos && m.produtos.length > 0 && (
              <div style={styles.cards}>
                {m.produtos.map((p, idx) => (
                  <div key={p.id} style={{ ...styles.card, ...(idx > 0 ? styles.cardSeparador : {}) }}>
                    {m.produtos && m.produtos.length > 1 && (
                      <div style={styles.cardNumero}>{p.codigo}</div>
                    )}
                    <div style={styles.cardLinha}><strong>Código:</strong> {p.codigo}</div>
                    <div style={styles.cardLinha}><strong>Descrição:</strong> {p.descricao}</div>
                    <div style={styles.cardLinha}><strong>Material:</strong> {p.material ?? '—'}</div>
                    <div style={styles.cardLinha}><strong>Unidade:</strong> {p.unidade ?? '—'}</div>
                    <div style={styles.cardLinha}><strong>Estoque:</strong> {p.estoque}</div>
                    <div style={styles.cardLinha}><strong>Preço unitário:</strong> {p.precoUnitario != null ? (typeof p.precoUnitario === 'number' ? `R$ ${p.precoUnitario.toFixed(2)}` : p.precoUnitario) : '—'}</div>
                  </div>
                ))}
                {m.produtos && m.produtos.length > 1 && (
                  <div style={styles.cardPergunta}>Qual o produto (código) e qual a quantidade? (ex.: código 10)</div>
                )}
              </div>
            )}
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
        <div style={styles.inputRow}>
          <button
            type="button"
            onClick={() => {
              if (digitando) return;
              if (nomeJaInformado) {
                fileInputRef.current?.click();
              } else {
                handleSendMessage('Oi');
              }
            }}
            disabled={digitando}
            style={styles.btnAnexo}
            aria-label={nomeJaInformado ? 'Enviar arquivo ou foto' : 'Iniciar conversa'}
            title={nomeJaInformado ? 'Enviar arquivo ou foto com lista de produtos' : 'Clique para iniciar e informar seu nome'}
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
          onClick={() => window.location.reload()}
          style={styles.btnLimpar}
          aria-label="Limpar e recarregar"
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
    background: 'var(--azul-principal)',
    color: 'var(--branco)',
    padding: '1.5rem 1.25rem',
    minHeight: 100,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: 'var(--sombra)',
  },
  headerLogoWrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  logo: { objectFit: 'contain', height: 44, width: 'auto' },
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
  balao: {
    maxWidth: '50ch',
    padding: '0.75rem 1rem',
    borderRadius: 12,
    alignSelf: 'flex-start',
    wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const,
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
