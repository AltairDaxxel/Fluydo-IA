/**
 * Fluydo.IA - API para identificar emitente pelo telefone (uso na URL [telefone])
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEmitenteByTelefone } from '@/lib/emitente';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const telefone = request.nextUrl.searchParams.get('telefone') ?? '';
  if (!telefone.trim()) {
    return NextResponse.json(
      { error: 'Parâmetro telefone é obrigatório.' },
      { status: 400 }
    );
  }
  const emitente = await getEmitenteByTelefone(telefone);
  if (!emitente) {
    return NextResponse.json(
      { error: 'Acesso não autorizado. Telefone não encontrado.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ idEmitente: emitente.id, nome: emitente.nome ?? null });
}
