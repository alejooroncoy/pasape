// Port de verificación OTP: "cómo se genera/envía/valida un código" para
// probar posesión de un canal (hoy: teléfono), desacoplado de quién lo usa
// (hoy: aceptar un invite de equipo). El proveedor guarda el código y su
// expiración — este BC no persiste el código en ningún lado, solo el
// resultado (verificado sí/no) del lado del caller.
//
// Implementaciones: TwilioOtpGateway (SMS, interino).
// Selección: otpGateway() (factory por env OTP_PROVIDER).
//
// Plan a futuro: Twilio (SMS) es el proveedor mientras el canal WhatsApp de
// invites esté apagado (TEAM_INVITE_WHATSAPP_ENABLED). Cuando se reactive,
// el OTP debería moverse a un WhatsApp Authentication template vía Meta
// directo (más barato que Twilio Verify) — ver skill whatsapp-templates para
// el bloqueo pendiente de permiso de cuenta ("Authentication templates" sin
// activar en la WABA). Ese adapter (MetaOtpGateway) todavía no existe.

export interface OtpGateway {
  // "twilio" — se usa en logs y en el mensaje de error.
  readonly providerName: string;
  // ¿Están presentes las envs que este proveedor necesita?
  configured(): boolean;
  // Dispara el envío del código al teléfono (E.164 o cualquier formato,
  // el gateway normaliza). LANZA si el proveedor rechaza.
  sendCode(phone: string): Promise<void>;
  // Valida el código ingresado contra el que el proveedor emitió para ese
  // teléfono. Devuelve true si aprobado, false si inválido/expirado.
  checkCode(phone: string, code: string): Promise<boolean>;
}
