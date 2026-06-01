"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { ScanResult } from "@/server/scanning/domain/ScanResult";

export const useScanQr = (eventSlug: string) =>
  useMutation({
    mutationFn: (qrCode: string) =>
      api.post<ScanResult>("/api/scanning/scan", { qrCode, eventSlug }),
  });
