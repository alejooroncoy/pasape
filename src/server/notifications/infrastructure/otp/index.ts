import type { OtpGateway } from "../../ports/OtpGateway";
import { TwilioOtpGateway } from "./TwilioOtpGateway";

export { TwilioOtpGateway } from "./TwilioOtpGateway";

// Factory del proveedor de OTP. Cambiar de proveedor = cambiar UNA env var
// (OTP_PROVIDER), sin tocar la application layer.
//   OTP_PROVIDER=twilio → Twilio Verify (default)
export const otpGateway = (): OtpGateway => {
  const provider = (process.env.OTP_PROVIDER ?? "twilio").toLowerCase();
  switch (provider) {
    case "twilio":
      return new TwilioOtpGateway();
    default:
      console.warn(`[otpGateway] proveedor desconocido "${provider}" — uso twilio`);
      return new TwilioOtpGateway();
  }
};
