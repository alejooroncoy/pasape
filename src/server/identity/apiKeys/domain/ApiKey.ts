/** Identidad resuelta a partir de una API key válida — lo que el MCP necesita
 *  para actuar "como" el organizador dueño de la key. */
export type ApiKeyIdentity = {
  apiKeyId: string;
  organizationId: string;
  createdBy: string;
};
