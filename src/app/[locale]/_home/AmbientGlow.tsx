export function AmbientGlow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-100px] z-0 h-[1000px] w-[1500px] -translate-x-1/2 blur-[80px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(184,124,255,0.28), rgba(168,85,247,0.12) 40%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[80%] top-[60vh] z-0 h-[700px] w-[800px] -translate-x-1/2 blur-[100px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(184,124,255,0.10), transparent 70%)",
        }}
      />
    </>
  );
}
