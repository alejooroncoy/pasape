import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await IdentityController.me());

export const PATCH = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return json(await IdentityController.updateProfile(body));
};
