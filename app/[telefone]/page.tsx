'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { EmitenteProvider } from '../context/EmitenteContext';
import { ChatPage } from '../page';

export default function ParceiroPage() {
  const params = useParams();
  const telefone = (params?.telefone as string) ?? '';
  const [idEmitente, setIdEmitente] = useState<string | null>(null);
  const [nomeEmitente, setNomeEmitente] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!telefone || typeof telefone !== 'string') {
      setErro('URL inválida. Use o formato: fluydo.ia.br/[telefone]');
      setCarregando(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/emitente?telefone=${encodeURIComponent(telefone.trim())}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setErro(data?.error ?? 'Acesso não autorizado. Este link não está cadastrado.');
          setIdEmitente(null);
          return;
        }
        if (data.idEmitente) {
          setIdEmitente(data.idEmitente);
          setNomeEmitente(typeof data.nome === 'string' ? data.nome : '');
          setErro(null);
        } else {
          setErro('Acesso não autorizado. Telefone não encontrado.');
        }
      } catch {
        if (!cancelled) setErro('Erro ao verificar acesso. Tente novamente.');
      } finally {
        if (!cancelled) setCarregando(false);
      }
    })();
    return () => { cancelled = true; };
  }, [telefone]);

  if (carregando) {
    return (
      <div style={styles.container}>
        <div style={styles.centered}>
          <p style={styles.loading}>Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (erro || !idEmitente) {
    return (
      <div style={styles.container}>
        <div style={styles.centered}>
          <p style={styles.erroTitulo}>Acesso não autorizado</p>
          <p style={styles.erroTexto}>{erro ?? 'Este link não está cadastrado.'}</p>
        </div>
      </div>
    );
  }

  return (
    <EmitenteProvider idEmitente={idEmitente} nomeEmitente={nomeEmitente}>
      <ChatPage idEmitente={idEmitente} nomeEmitente={nomeEmitente} />
    </EmitenteProvider>
  );
}

const styles: React.CSSProperties & Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: 'var(--azul-fundo)',
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center',
  },
  loading: {
    fontSize: '1.1rem',
    color: 'var(--azul-header)',
    fontWeight: 600,
  },
  erroTitulo: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#b91c1c',
    marginBottom: '0.5rem',
  },
  erroTexto: {
    fontSize: '1rem',
    color: 'var(--cinza-texto)',
    maxWidth: 360,
  },
};
