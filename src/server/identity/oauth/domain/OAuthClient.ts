export type OAuthClient = {
  id: string;
  clientName: string;
  redirectUris: string[];
};

/** Identidad resuelta a partir de un access token válido — misma forma que
 *  ApiKeyIdentity, para que el MCP no le importe si vino de OAuth o de una
 *  API key manual (fallback interno). */
export type OAuthIdentity = {
  organizationId: string;
  createdBy: string;
};
