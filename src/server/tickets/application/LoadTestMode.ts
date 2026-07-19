import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const HEADER = "x-pasape-load-test";

const secretsMatch = (provided: string | null, expected: string): boolean => {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Modo de carga deliberadamente cerrado. Solo existe para probar el flujo de
 * compra real en producción sin convertir el endpoint público en un bypass de
 * rate-limit/antibot ni enviar WhatsApps de prueba. Requiere tres cosas:
 * flag global, secreto por header y allow-list explícita de eventos.
 */
export const isAuthorizedLoadTest = (req: NextRequest, eventId: string | null): boolean => {
  if (process.env.LOAD_TEST_ENABLED !== "true" || !eventId) return false;

  const secret = process.env.LOAD_TEST_SECRET;
  if (!secret || !secretsMatch(req.headers.get(HEADER), secret)) return false;

  const allowedEvents = new Set(
    (process.env.LOAD_TEST_EVENT_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

  return allowedEvents.has(eventId);
};
