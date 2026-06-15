"use client";

import { useRouter } from "@/i18n/navigation";

export function BackButton() {
  const router = useRouter();
  const hasHistory = typeof window !== "undefined" && window.history.length > 1;

  const handleBack = () => {
    if (hasHistory) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="absolute left-5 top-5 z-20 lg:left-10 lg:top-8">
      <button
        type="button"
        onClick={handleBack}
        aria-label={hasHistory ? "Volver" : "Inicio"}
        className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
      >
        {hasHistory ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 6.5L8 2l6 4.5V14a.5.5 0 01-.5.5h-4V10h-3v4.5h-4A.5.5 0 012 14V6.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
