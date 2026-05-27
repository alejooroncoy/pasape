import { PromoterClaimController } from "@/server/promoters/claim/controllers/rest/PromoterClaimController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params;
  return json(await PromoterClaimController.preview(token));
};
