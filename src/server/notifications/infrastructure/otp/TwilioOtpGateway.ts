import type { OtpGateway } from "../../ports/OtpGateway";

// Twilio Verify API v2 — Twilio genera, expira y valida el código por su
// cuenta; no guardamos el código acá, solo llamamos a estos dos endpoints.
// Docs: https://www.twilio.com/docs/verify/api/verification
//
// Envs:
//   TWILIO_ACCOUNT_SID        — SID de la cuenta (empieza con "AC...")
//   TWILIO_AUTH_TOKEN         — Auth Token de la cuenta
//   TWILIO_VERIFY_SERVICE_SID — SID del Verify Service (empieza con "VA...")
const GRAPH_BASE = "https://verify.twilio.com/v2";

export class TwilioOtpGateway implements OtpGateway {
  readonly providerName = "twilio";

  private accountSid(): string | null {
    return process.env.TWILIO_ACCOUNT_SID ?? null;
  }

  private authToken(): string | null {
    return process.env.TWILIO_AUTH_TOKEN ?? null;
  }

  private serviceSid(): string | null {
    return process.env.TWILIO_VERIFY_SERVICE_SID ?? null;
  }

  configured(): boolean {
    return Boolean(this.accountSid() && this.authToken() && this.serviceSid());
  }

  private authHeader(): string {
    const basic = Buffer.from(`${this.accountSid()}:${this.authToken()}`).toString("base64");
    return `Basic ${basic}`;
  }

  async sendCode(phone: string): Promise<void> {
    const serviceSid = this.serviceSid();
    if (!this.configured() || !serviceSid) {
      throw new Error(`${this.providerName}: proveedor sin configurar (faltan credenciales)`);
    }

    const res = await fetch(`${GRAPH_BASE}/Services/${serviceSid}/Verifications`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, Channel: "sms" }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`${this.providerName} ${res.status}: ${errText.slice(0, 200)}`);
    }
  }

  async checkCode(phone: string, code: string): Promise<boolean> {
    const serviceSid = this.serviceSid();
    if (!this.configured() || !serviceSid) {
      throw new Error(`${this.providerName}: proveedor sin configurar (faltan credenciales)`);
    }

    const res = await fetch(`${GRAPH_BASE}/Services/${serviceSid}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, Code: code }),
    });

    // Twilio devuelve 404 cuando no hay verificación pendiente para ese To
    // (ya expiró o nunca se pidió) — lo tratamos como "no válido", no como error.
    if (res.status === 404) return false;
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`${this.providerName} ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { status?: string };
    return data.status === "approved";
  }
}
