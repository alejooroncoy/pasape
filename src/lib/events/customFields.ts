import { z } from "zod";

// Tipos calcados de Luma (Registration → Custom Questions), sin la rama Web3
// (ETH/Solana) que no aplica a Pasape. Único módulo compartido: MCP, API REST,
// backend de checkout y el render del formulario en el comprador importan
// esto — nunca redefinir el shape en otro lado.
export const CUSTOM_FIELD_TYPES = [
  "text",
  "long_text",
  "checkbox",
  "single_select",
  "multiple_select",
  "url",
  "phone",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texto corto",
  long_text: "Texto largo",
  checkbox: "Casilla (sí/no)",
  single_select: "Selección única",
  multiple_select: "Selección múltiple",
  url: "Enlace",
  phone: "Teléfono",
};

const SELECT_TYPES = new Set<CustomFieldType>(["single_select", "multiple_select"]);

// Schema base SIN refinar: expuesto aparte porque `.omit()`/`.extend()` no
// se pueden encadenar sobre un schema con `.refine()` (zod tira "omit()
// cannot be used on object schemas containing refinements"). Cualquier lugar
// que necesite una variante del shape (ej. el MCP, con `id` opcional) parte
// de este objeto base y le vuelve a aplicar `withSelectOptionsRule`.
export const customFieldObjectSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(140),
  type: z.enum(CUSTOM_FIELD_TYPES),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const withSelectOptionsRule = <T extends z.ZodType<{ type: CustomFieldType; options?: string[] }>>(
  schema: T,
) =>
  schema.refine(
    (f) => !SELECT_TYPES.has(f.type) || (f.options && f.options.length >= 2),
    { message: "select_needs_at_least_two_options", path: ["options"] },
  );

export const customFieldSchema = withSelectOptionsRule(customFieldObjectSchema);

export type CustomField = z.infer<typeof customFieldObjectSchema>;

export const customFieldsSchema = z.array(customFieldSchema).max(20);

export const isSelectField = (type: CustomFieldType): boolean => SELECT_TYPES.has(type);
