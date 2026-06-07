// La implementación isomórfica vive en @/lib/tickets/signedQr (client-safe, sin
// node), para que la consuman el comprador, el portero y el server. Este shim la
// re-exporta bajo el dominio de tickets para los callers server-side y los tests.
export * from "@/lib/tickets/signedQr";
