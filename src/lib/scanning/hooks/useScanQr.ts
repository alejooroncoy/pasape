"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { deviceHeaders } from "@/lib/scanning/deviceId";
import type { ScanResult } from "@/server/scanning/domain/ScanResult";

export const useScanQr = (eventSlug: string) =>
  useMutation({
    mutationFn: (qrCode: string) =>
      api.post<ScanResult>(
        "/api/scanning/scan",
        { qrCode, eventSlug },
        { headers: deviceHeaders() },
      ),
  });

// Admisión confiable por ticketId (alta manual desde la lista de asistentes).
export const useAdmitTicket = (eventSlug: string) =>
  useMutation({
    mutationFn: (ticketId: string) =>
      api.post<ScanResult>(
        "/api/scanning/admit",
        { ticketId, eventSlug },
        { headers: deviceHeaders() },
      ),
  });
