export function buildEntityResolutionPrompt(domain: string, domainNodes: unknown, userMessage: string): string {
  return `Resolva somente com a taxonomia fornecida a categoria genérica e, apenas com evidência textual específica, a subcategoria. Domínio: ${domain}\nTaxonomia: ${JSON.stringify(domainNodes)}\nMensagem: "${userMessage}"\nRetorne apenas JSON com genericId, specificId, specificCandidates, genericConfidence, specificConfidence e matchedTerm. Nunca invente ids; se houver ambiguidade, specificId deve ser null.`;
}
