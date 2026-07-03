import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string; orderId: string; token: string }> };

// Ruta legada: los links de /unlock ya enviados por WhatsApp/email antes del
// rename a /order siguen funcionando — solo reenvían al mismo destino con la
// misma lógica. No borrar mientras existan compras cuyo link viejo siga
// dentro de la ventana de reclamo (72h) o guardado por el asistente.
export default async function LegacyUnlockRedirect({ params }: Props) {
  const { locale, orderId, token } = await params;
  redirect(`/${locale}/order/${orderId}/${token}`);
}
