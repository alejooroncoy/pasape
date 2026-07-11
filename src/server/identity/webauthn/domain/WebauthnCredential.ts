export type WebauthnCredential = {
  id: string;
  profileId: string;
  credentialId: string; // base64url, id del authenticator
  publicKey: string; // base64url
  counter: number;
  deviceLabel: string | null;
  transports: string[] | null;
  createdAt: string;
  lastUsedAt: string | null;
};
