// Port del TRANSPORTE de WhatsApp: el "cómo se manda" (qué proveedor, con qué
// credenciales), desacoplado del "qué se manda" (delivery, claim, invitación…).
//
// Clave del diseño: Kapso es un proxy que habla EXACTAMENTE el mismo dialecto
// que la Cloud API de Meta. Un mensaje `template` tiene el mismo shape para los
// dos. Lo único que cambia entre proveedores es la URL base y el header de auth
// — eso vive en cada adapter (Kapso/Meta), no aquí. Por eso el shape de los
// componentes es parte del port y no del adapter.
//
// Implementaciones: KapsoWhatsAppGateway, MetaWhatsAppGateway.
// Selección: whatsAppGateway() (factory por env WHATSAPP_PROVIDER).

export type WhatsAppBodyParameter = {
  type: "text";
  parameter_name: string;
  text: string;
};

export type WhatsAppButtonParameter = {
  type: "text";
  text: string;
};

// Componentes de un template de la Cloud API de Meta que usamos hoy: cuerpo con
// parámetros nombrados y, opcionalmente, un botón URL dinámico.
export type WhatsAppComponent =
  | { type: "body"; parameters: WhatsAppBodyParameter[] }
  | {
      type: "button";
      sub_type: "url";
      index: string;
      parameters: WhatsAppButtonParameter[];
    };

export type SendTemplateInput = {
  // Teléfono en cualquier formato (con/sin "+", con/sin "whatsapp:"): el gateway
  // lo normaliza a E.164 antes de enviar.
  to: string;
  templateName: string;
  languageCode: string;
  components: WhatsAppComponent[];
};

export type SendTextInput = {
  to: string;
  body: string;
};

export interface WhatsAppGateway {
  // "kapso" | "meta" — se usa en logs y en el mensaje de error (que además queda
  // grabado en notification_dispatches.error, p.ej. "kapso 401: ...").
  readonly providerName: string;
  // ¿Están presentes las envs que este proveedor necesita para enviar?
  configured(): boolean;
  // Envía un template. LANZA si el proveedor rechaza (para que el caller lo
  // registre como `failed`). No devuelve boolean: el éxito es "no lanzó".
  sendTemplate(input: SendTemplateInput): Promise<void>;
  // Envía texto libre — solo válido dentro de la ventana de 24h de una
  // conversación que el usuario ya inició (ver HttpWhatsAppGateway.sendText).
  sendText(input: SendTextInput): Promise<void>;
}
