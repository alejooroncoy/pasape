// Port de verificación OTP: "cómo se genera/envía/valida un código" para
// probar posesión de un canal (hoy: teléfono), desacoplado de quién lo usa
// (hoy: aceptar un invite de equipo). El proveedor guarda el código y su
// expiración — este BC no persiste el código en ningún lado, solo el
// resultado (verificado sí/no) del lado del caller.
//
// Implementaciones: TwilioOtpGateway.
// Selección: otpGateway() (factory por env OTP_PROVIDER).

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
