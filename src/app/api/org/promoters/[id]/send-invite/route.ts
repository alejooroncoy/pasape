import { PromoterClaimController } from "@/server/promoters/claim/controllers/rest/PromoterClaimController";
import { json } from "@/server/_shared/http";

export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return json(await PromoterClaimController.sendInvite(id));
};
