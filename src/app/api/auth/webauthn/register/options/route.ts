import { json } from "@/server/_shared/http";
import { generatePasskeyRegistrationOptions } from "@/server/identity/webauthn/application/GenerateRegistrationOptions";

export const POST = async () => {
  return json(await generatePasskeyRegistrationOptions());
};
