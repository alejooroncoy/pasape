import type { WebauthnCredential } from "../domain/WebauthnCredential";

export type NewWebauthnCredential = {
  profileId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
};

export type WebauthnCredentialRepository = {
  insert: (input: NewWebauthnCredential) => Promise<void>;
  findByCredentialId: (credentialId: string) => Promise<WebauthnCredential | null>;
  listByProfileId: (profileId: string) => Promise<WebauthnCredential[]>;
  updateCounter: (credentialId: string, counter: number) => Promise<void>;
};
