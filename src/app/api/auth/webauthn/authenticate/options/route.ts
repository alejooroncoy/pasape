import { json } from "@/server/_shared/http";
import { generatePasskeyAuthenticationOptions } from "@/server/identity/webauthn/application/GenerateAuthenticationOptions";

export const POST = async () => {
  return json(await generatePasskeyAuthenticationOptions());
};
