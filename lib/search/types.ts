export type ProductType = 'ORING' | 'ANEL' | 'RETENTOR' | 'GAXETA' | 'JUNTA' | 'UNKNOWN';
export type ApplicationType = 'EIXO' | 'PISTAO' | 'HASTE' | 'TAMPA' | 'UNKNOWN';
export type MaterialType = 'NBR' | 'VITON' | 'SILICONE' | 'UNKNOWN';

export type SearchPlan = {
  intent: {
    productType: ProductType;
    application?: ApplicationType;
    material?: MaterialType;
    hardness?: string | null;
    color?: string | null;
  };
  dims: {
    dim1?: number | null;
    dim2?: number | null;
    dim3?: number | null;
    dim4?: number | null;
  };
  semantics: {
    internalDiameter?: number | null; // DI
    externalDiameter?: number | null; // DE
    section?: number | null; // seção (O-ring)
    heightOrThickness?: number | null; // altura/espessura (retentor/anel/junta)
  };
  keywords: string[];
  queryMode: 'STRICT' | 'TOLERANCE' | 'BROAD';
  needsClarification: boolean;
  clarifyingQuestion?: string | null;
};

