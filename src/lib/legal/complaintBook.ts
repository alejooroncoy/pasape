// Libro de Reclamaciones virtual — contrato compartido cliente/servidor.
//
// Cumple el Código de Protección y Defensa del Consumidor (Ley 29571) y su
// reglamento (D.S. 011-2011-PCM y modificatorias). La Hoja de Reclamación debe
// registrar: datos del proveedor, datos del consumidor, identificación del bien
// contratado, y el detalle (reclamo o queja) con el pedido del consumidor.
//
// El proveedor tiene un plazo máximo de 15 días hábiles para responder
// (prorrogable justificadamente, sin exceder los 30 días hábiles).

// ⚠️ Completar con los datos reales de la razón social antes de producción.
// El RUC y la dirección fiscal son obligatorios en la Hoja de Reclamación.
export const PROVEEDOR = {
  razonSocial: "Pasape S.A.C.",
  nombreComercial: "Pasape",
  ruc: process.env.NEXT_PUBLIC_PASAPE_RUC ?? "10731724429",
  direccion: "Lima, Perú",
  email: process.env.NEXT_PUBLIC_PASAPE_LEGAL_EMAIL ?? "reclamos@pasa.pe",
} as const;

// Plazo legal de respuesta al consumidor.
export const PLAZO_RESPUESTA_DIAS_HABILES = 15;

// RECLAMO vs QUEJA — el consumidor debe distinguirlos (art. reglamento):
// - Reclamo: disconformidad relacionada a los productos o servicios.
// - Queja: malestar o descontento respecto a la atención al público.
export type TipoReclamacion = "reclamo" | "queja";

export type TipoDocumento = "dni" | "ce" | "pasaporte";

// Producto (bien) o servicio contratado.
export type TipoBien = "producto" | "servicio";

export const TIPO_RECLAMACION_LABEL: Record<TipoReclamacion, string> = {
  reclamo: "Reclamo",
  queja: "Queja",
};

export const TIPO_RECLAMACION_DESCRIPCION: Record<TipoReclamacion, string> = {
  reclamo: "Disconformidad relacionada a los productos o servicios.",
  queja: "Malestar o descontento respecto a la atención al público.",
};

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  dni: "DNI",
  ce: "Carné de extranjería",
  pasaporte: "Pasaporte",
};

export const TIPO_BIEN_LABEL: Record<TipoBien, string> = {
  producto: "Producto",
  servicio: "Servicio",
};

// Payload que viaja del formulario al backend. Los montos se envían en soles
// (número) para el formulario; el backend los persiste en céntimos.
export type ComplaintSubmission = {
  tipo: TipoReclamacion;
  // Consumidor
  nombre: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  domicilio: string;
  telefono?: string;
  email: string;
  esMenorDeEdad: boolean;
  apoderado?: string; // requerido si esMenorDeEdad
  // Bien contratado
  tipoBien: TipoBien;
  montoSoles?: number; // opcional
  descripcionBien: string;
  // Detalle
  detalle: string;
  pedido: string;
  aceptaDeclaracion: boolean;
};

// Código legible que se muestra al consumidor como constancia.
export const formatCodigoReclamacion = (correlativo: number): string =>
  `LR-${String(correlativo).padStart(6, "0")}`;
