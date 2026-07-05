import type { WhatsAppComponent } from "../../ports/WhatsAppGateway";

// Helpers para armar los componentes de un template sin repetir el shape verboso
// de Meta en cada sender.

// Cuerpo con parámetros NOMBRADOS: bodyComponent({ holder_name: "Ana", ... }).
export const bodyComponent = (params: Record<string, string>): WhatsAppComponent => ({
  type: "body",
  parameters: Object.entries(params).map(([name, text]) => ({
    type: "text",
    parameter_name: name,
    text,
  })),
});

// Botón URL dinámico (index 0). El botón solo admite variables POSICIONALES, por
// eso recibe el valor suelto (típicamente un token que se concatena a la URL
// base configurada en el template de Meta).
export const urlButtonComponent = (value: string): WhatsAppComponent => ({
  type: "button",
  sub_type: "url",
  index: "0",
  parameters: [{ type: "text", text: value }],
});
