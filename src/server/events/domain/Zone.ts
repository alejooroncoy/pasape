// Puerta (zona) de validación de un evento. De cara al organizador se llama
// "Puerta"; en datos sigue siendo `zones`.
//
// - La puerta principal (isDefault) valida TODAS las entradas — es un comodín y
//   su `ticketTypeIds` se ignora (va vacío). El organizador nunca la crea ni la
//   edita; la pone el trigger de la DB.
// - Las puertas custom validan solo las entradas en `ticketTypeIds` (N:M: una
//   entrada puede estar en varias puertas).
export type Zone = {
  id: string;
  eventId: string;
  name: string;
  isDefault: boolean;
  /** IDs de ticket_types que valida esta puerta. Vacío en la principal (= todas). */
  ticketTypeIds: string[];
};
