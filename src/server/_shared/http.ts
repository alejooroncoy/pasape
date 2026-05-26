import { NextResponse } from "next/server";
import type { Result } from "./result";

export const json = <T>(result: Result<T>, okStatus = 200, errStatus = 400) =>
  result.ok
    ? NextResponse.json({ data: result.value }, { status: okStatus })
    : NextResponse.json({ error: result.error }, { status: errStatus });

export const unauthorized = () =>
  NextResponse.json({ error: "unauthenticated" }, { status: 401 });

export const ok = <T>(value: T, status = 200) =>
  NextResponse.json({ data: value }, { status });

export const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
