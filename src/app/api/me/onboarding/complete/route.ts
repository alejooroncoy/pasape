import { OnboardingController } from "@/server/identity/onboarding/controllers/rest/OnboardingController";
import { json } from "@/server/_shared/http";

export const POST = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return json(await OnboardingController.complete(body));
};
