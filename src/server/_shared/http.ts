import { NextResponse } from "next/server";
import type { Result } from "./result";

// Mapeo de errores conocidos del dominio a status HTTP semánticamente correctos.
// Así el cliente sabe redirigir a login (401), mostrar "sin permiso" (403) o
// 404 en lugar de tratar todo como bad request.
const STATUS_BY_ERROR: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  already_claimed: 409,
  claimed_by_another: 409,
};

export const json = <T>(result: Result<T>, okStatus = 200) =>
  result.ok
    ? NextResponse.json({ data: result.value }, { status: okStatus })
    : NextResponse.json(
        { error: result.error },
        { status: STATUS_BY_ERROR[result.error] ?? 400 },
      );

export const unauthorized = () =>
  NextResponse.json({ error: "unauthenticated" }, { status: 401 });

export const ok = <T>(value: T, status = 200) =>
  NextResponse.json({ data: value }, { status });

export const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
