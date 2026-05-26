import { OnboardingController } from "@/server/identity/onboarding/controllers/rest/OnboardingController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await OnboardingController.getState());
