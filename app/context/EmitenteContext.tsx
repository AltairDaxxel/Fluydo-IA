'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Contexto do emitente identificado pela URL (www.fluydo.ia.br/[telefone]). Usado para filtrar todas as buscas. */
const EmitenteContext = createContext<{ idEmitente: string; nomeEmitente: string } | null>(null);

export function EmitenteProvider({
  idEmitente,
  nomeEmitente = '',
  children,
}: {
  idEmitente: string;
  nomeEmitente?: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ idEmitente, nomeEmitente: nomeEmitente ?? '' }), [idEmitente, nomeEmitente]);
  return (
    <EmitenteContext.Provider value={value}>
      {children}
    </EmitenteContext.Provider>
  );
}

export function useEmitente(): { idEmitente: string; nomeEmitente: string } {
  const ctx = useContext(EmitenteContext);
  return { idEmitente: ctx?.idEmitente ?? '', nomeEmitente: ctx?.nomeEmitente ?? '' };
}
