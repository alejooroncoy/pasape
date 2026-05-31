import { NextRequest } from "next/server";
import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await IdentityController.listFollows());

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await IdentityController.follow(body));
};

export const DELETE = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await IdentityController.unfollow(body));
};
