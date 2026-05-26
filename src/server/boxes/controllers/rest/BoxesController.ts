import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseBoxRepository as repo } from "../../infrastructure/repositories/SupabaseBoxRepository";
import {
  createBoxForTicket,
  getBoxByTicket,
  getBoxByToken,
  joinBox,
} from "../../application/BoxServices";
import type { Box } from "../../domain/Box";

const createSchema = z.object({
  ticketId: z.string().uuid(),
  capacity: z.number().int().min(2).max(20).default(6),
});

const joinSchema = z.object({
  token: z.string().min(1),
  holderName: z.string().min(1),
  holderDni: z.string().nullable().optional(),
});

export const BoxesController = {
  async create(input: unknown): Promise<Result<Box>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return createBoxForTicket(
      { repo },
      { ticketId: parsed.data.ticketId, ownerId: auth.value.profileId, capacity: parsed.data.capacity },
    );
  },

  async byToken(token: string): Promise<Result<Box>> {
    const box = await getBoxByToken({ repo }, token);
    if (!box) return err("not_found");
    return { ok: true, value: box };
  },

  async forTicket(ticketId: string): Promise<Result<Box | null>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return { ok: true, value: await getBoxByTicket({ repo }, ticketId, auth.value.profileId) };
  },

  async join(input: unknown): Promise<Result<Box>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return joinBox(
      { repo },
      {
        token: parsed.data.token,
        profileId: auth.value.profileId,
        holderName: parsed.data.holderName,
        holderDni: parsed.data.holderDni ?? null,
      },
    );
  },
};
