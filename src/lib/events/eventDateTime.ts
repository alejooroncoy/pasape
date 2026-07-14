// Separa un ISO + timezone del evento en date/time locales de ese timezone —
// lo que esperan DatePicker/TimePicker (inputs separados, no un solo ISO).
export function isoToDateTime(iso: string, tz: string): { date: string; time: string } {
  const d = new Date(iso);
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date: dateFmt.format(d), time: timeFmt.format(d) };
}
