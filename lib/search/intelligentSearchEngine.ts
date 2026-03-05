import { extractKeywords, inferApplication, inferMaterial, inferProductType, parseMeasures } from './measureParser';
import type { SearchPlan } from './types';

type EngineOptions = {
  /** Quando true, tenta evitar perguntas e começar com BROAD. */
  preferSearchOverClarify?: boolean;
};

function hasTwoDimsForORing(plan: SearchPlan): boolean {
  return (plan.semantics.internalDiameter ?? null) != null && (plan.semantics.section ?? null) != null;
}

function hasThreeDimsForRetentor(plan: SearchPlan): boolean {
  return (
    (plan.semantics.internalDiameter ?? null) != null &&
    (plan.semantics.externalDiameter ?? null) != null &&
    (plan.semantics.heightOrThickness ?? null) != null
  );
}

/**
 * Determinístico e seguro: interpreta texto do usuário e decide:
 * - intenção (tipo/material/aplicação)
 * - mapeamento de medidas para DI/DE/seção/altura
 * - modo de busca (STRICT/TOLERANCE/BROAD)
 * - se precisa perguntar algo (uma pergunta só)
 */
export function intelligentSearchEngine(input: string, opts: EngineOptions = {}): SearchPlan {
  const productType = inferProductType(input);
  const material = inferMaterial(input);
  const application = inferApplication(input);
  const parsed = parseMeasures(input);
  const keywords = extractKeywords(input);

  const plan: SearchPlan = {
    intent: {
      productType,
      application,
      material,
      hardness: null,
      color: null,
    },
    dims: {},
    semantics: { ...parsed.semantics },
    keywords,
    queryMode: 'BROAD',
    needsClarification: false,
    clarifyingQuestion: null,
  };

  // Heurísticas por produto
  if (productType === 'ORING') {
    // Padrão mais comum: "DI x SEÇÃO"
    // Se veio A x B (2 números) e não há semântica explícita, assume DI=A e seção=B.
    if ((plan.semantics.internalDiameter ?? null) == null && (plan.semantics.section ?? null) == null && parsed.numbers.length >= 2) {
      plan.semantics.internalDiameter = parsed.numbers[0];
      plan.semantics.section = parsed.numbers[1];
    } else if ((plan.semantics.internalDiameter ?? null) == null && parsed.numbers.length === 1) {
      // "oring 28" / "oring para eixo 28" → DI provável
      plan.semantics.internalDiameter = parsed.numbers[0];
    }

    if (hasTwoDimsForORing(plan)) {
      // Mapeamento conhecido: dim1 = DI, dim3 = seção
      plan.dims.dim1 = plan.semantics.internalDiameter ?? null;
      plan.dims.dim3 = plan.semantics.section ?? null;
      plan.queryMode = 'STRICT';
    } else if ((plan.semantics.internalDiameter ?? null) != null) {
      plan.dims.dim1 = plan.semantics.internalDiameter ?? null;
      plan.queryMode = 'BROAD';
      plan.needsClarification = !opts.preferSearchOverClarify;
      plan.clarifyingQuestion = 'Você sabe também a seção/espessura? Ex.: 28 x 3,53';
    } else {
      plan.queryMode = 'BROAD';
      plan.needsClarification = true;
      plan.clarifyingQuestion = 'Para este O-ring, você tem as medidas (ex.: 28 x 3,53) ou o código? E qual material e dureza (ex.: NBR70)?';
    }
  } else if (productType === 'RETENTOR') {
    // Padrão: DI x DE x ALTURA
    if (
      (plan.semantics.internalDiameter ?? null) == null &&
      (plan.semantics.externalDiameter ?? null) == null &&
      (plan.semantics.heightOrThickness ?? null) == null &&
      parsed.numbers.length >= 3
    ) {
      plan.semantics.internalDiameter = parsed.numbers[0];
      plan.semantics.externalDiameter = parsed.numbers[1];
      plan.semantics.heightOrThickness = parsed.numbers[2];
    } else if ((plan.semantics.internalDiameter ?? null) == null && parsed.numbers.length === 1) {
      plan.semantics.internalDiameter = parsed.numbers[0];
    }

    if (hasThreeDimsForRetentor(plan)) {
      // Aqui não inferimos qual dim é altura no DB; vamos mapear para dim1/dim2/dim4 por padrão
      plan.dims.dim1 = plan.semantics.internalDiameter ?? null;
      plan.dims.dim2 = plan.semantics.externalDiameter ?? null;
      plan.dims.dim4 = plan.semantics.heightOrThickness ?? null;
      plan.queryMode = 'STRICT';
    } else if ((plan.semantics.internalDiameter ?? null) != null) {
      plan.dims.dim1 = plan.semantics.internalDiameter ?? null;
      plan.queryMode = 'BROAD';
      plan.needsClarification = !opts.preferSearchOverClarify;
      plan.clarifyingQuestion = 'Normalmente o retentor vem em 3 medidas (DI x DE x altura). Você sabe as outras duas? Ex.: 110 x 130 x 13';
    } else {
      plan.queryMode = 'BROAD';
      plan.needsClarification = true;
      plan.clarifyingQuestion = 'Para este retentor, você tem as medidas (Interno x Externo x Altura) ou o código? Ex.: 110 x 130 x 13. E qual material e dureza (ex.: NBR70)?';
    }
  } else if (productType === 'ANEL' || productType === 'GAXETA' || productType === 'JUNTA') {
    // Se tiver A x B, preserva como dims genéricos (sem forçar mapping).
    if (parsed.numbers.length >= 2) {
      plan.semantics.internalDiameter = plan.semantics.internalDiameter ?? parsed.numbers[0];
      plan.semantics.section = plan.semantics.section ?? parsed.numbers[1];
      plan.dims.dim1 = plan.semantics.internalDiameter ?? null;
      plan.dims.dim3 = plan.semantics.section ?? null;
      plan.queryMode = 'TOLERANCE';
    } else if (parsed.numbers.length === 1) {
      plan.semantics.internalDiameter = plan.semantics.internalDiameter ?? parsed.numbers[0];
      plan.dims.dim1 = plan.semantics.internalDiameter ?? null;
      plan.queryMode = 'BROAD';
      plan.needsClarification = !opts.preferSearchOverClarify;
    } else {
      plan.queryMode = 'BROAD';
      plan.needsClarification = true;
    }
  } else {
    // UNKNOWN: tenta aproveitar números como broad.
    if (parsed.numbers.length > 0) {
      plan.dims.dim1 = parsed.numbers[0];
    }
    plan.queryMode = 'BROAD';
  }

  return plan;
}

