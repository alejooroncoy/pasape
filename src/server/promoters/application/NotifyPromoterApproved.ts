// Avisa al promotor recién aprobado por sus dos canales (WhatsApp + correo).
// Se dispara fire-and-forget desde PromotersController.decide: sin esto, el
// postulante que cerró la pestaña de "en revisión" nunca se enteraba de que lo
// aprobaron (el realtime solo redirige con la pantalla abierta), pese a que la
// invitación le promete un aviso por WhatsApp.
//
// Best-effort por diseño: cada canal degrada a no-op si le falta el dato de
// contacto o el proveedor no está configurado. Nunca lanza — la aprobación ya
// se guardó y no debe fallar por un aviso.

import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { promoterApprovedWhatsAppSender } from "@/server/notifications/infrastructure/PromoterApprovedWhatsAppSender";
import { promoterApprovedEmailSender } from "@/server/notifications/infrastructure/PromoterApprovedEmailSender";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/+$/, "");

export type NotifyPromoterApprovedInput = {
  /** profile_id del promotor aprobado (= applicant_id de la solicitud). */
  promoterId: string;
  orgName: string;
  eventTitle: string;
  /** Código del link de venta del promotor (para /r/{code}). */
  promoterCode: string;
};

export const notifyPromoterApproved = async (
  input: NotifyPromoterApprovedInput,
): Promise<void> => {
  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", input.promoterId)
    .maybeSingle<{ full_name: string | null; email: string | null; phone: string | null }>();

  if (!profile) {
    console.warn("[notifyPromoterApproved] perfil no encontrado — skip", input.promoterId);
    return;
  }

  const panelUrl = `${APP_ORIGIN}/es/promo`;
  const shareUrl = `${APP_ORIGIN}/r/${input.promoterCode}`;
  const phone = profile.phone ?? "";
  const email = profile.email ?? "";

  // Ambos canales en paralelo; cada uno best-effort. Un teléfono demasiado corto
  // no es un teléfono válido para WhatsApp — evitamos el envío (y el error).
  const [waSent, emailSent] = await Promise.all([
    phone.replace(/\D/g, "").length >= 9
      ? promoterApprovedWhatsAppSender.send({
          to: phone,
          promoterName: profile.full_name ?? "Promotor",
          orgName: input.orgName,
          eventTitle: input.eventTitle,
        })
      : Promise.resolve(false),
    email
      ? promoterApprovedEmailSender.send({
          to: email,
          promoterName: profile.full_name,
          orgName: input.orgName,
          eventTitle: input.eventTitle,
          panelUrl,
          shareUrl,
        })
      : Promise.resolve(false),
  ]);

  console.info(
    `[notifyPromoterApproved] promoter=${input.promoterId} whatsapp=${waSent} email=${emailSent}`,
  );
};
