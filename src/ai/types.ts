/**
 * Espelha exatamente o SCHEMA DE SAÍDA definido em `extractionPrompt.ts`.
 * Se o schema do prompt mudar, atualize este tipo junto.
 */
export interface ExtractedBusinessProfile {
  businessName: string | null;
  segment: string | null;
  shortDescription: string | null;
  products: string[];
  services: string[];
  targetAudience: string | null;
  operationSummary: string | null;
  teamStructure: {
    worksAlone: boolean | null;
    teamSizeEstimate: string | null;
    rolesMentioned: string[];
  };
  currentFinancialControl: {
    toolsUsed: string[];
    organizationLevel: 'nenhum' | 'informal' | 'parcialmente organizado' | 'organizado' | null;
  };
  customerRelationship: {
    hasRecurringCustomers: boolean | null;
    followsUpWithCustomers: boolean | null;
    notes: string | null;
  };
  painPoints: string[];
  challenges: string[];
  seasonality: {
    hasSeasonalVariation: boolean | null;
    notes: string | null;
  };
  goals: string[];
  processesToOrganize: string[];
  recommendedModules: string[];
  automationOpportunities: string[];
  maturityLevel: 'iniciante' | 'em organização' | 'estruturado' | null;
  missingInformation: string[];
  conflictsOrAmbiguities: string[];
  additionalNotes: string | null;
}
