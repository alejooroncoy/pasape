import type { SVGProps } from "react";

type IconName =
  | "link"
  | "qr"
  | "bolt"
  | "id"
  | "gift"
  | "chart"
  | "users"
  | "share"
  | "spark"
  | "arrow-right"
  | "arrow-up-right"
  | "check"
  | "whatsapp"
  | "close";

type Props = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  width?: number | string;
  height?: number | string;
};

export function Icon({ name, width = 18, height = 18, ...rest }: Props) {
  const common = {
    width,
    height,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
  switch (name) {
    case "link":
      return (
        <svg {...common}>
          <path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
          <path d="M14 10a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 20.07l1.5-1.5" />
        </svg>
      );
    case "qr":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3" />
          <path d="M20 14v3" />
          <path d="M14 20h3" />
          <path d="M20 20v1" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case "id":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="12" r="2.2" />
          <path d="M14 10h4" />
          <path d="M14 14h3" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
          <path d="M12 8v13" />
          <path d="M12 8c-1.5-3-5-3-5-1s2 2 5 1zm0 0c1.5-3 5-3 5-1s-2 2-5 1z" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-5" />
          <path d="M13 16V9" />
          <path d="M18 16v-3" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3.2" />
          <path d="M3 19c.6-3 3.2-4.6 6-4.6S14.4 16 15 19" />
          <circle cx="16.5" cy="8.5" r="2.5" />
          <path d="M16.5 13.5c2 0 4 1.4 4.5 3.5" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="M8.2 11l7.6-4.4" />
          <path d="M8.2 13l7.6 4.4" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3v4" />
          <path d="M12 17v4" />
          <path d="M3 12h4" />
          <path d="M17 12h4" />
          <path d="M5.5 5.5l2.5 2.5" />
          <path d="M16 16l2.5 2.5" />
          <path d="M5.5 18.5L8 16" />
          <path d="M16 8l2.5-2.5" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="M13 5l7 7-7 7" />
        </svg>
      );
    case "arrow-up-right":
      return (
        <svg {...common}>
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} strokeWidth={2}>
          <path d="M5 12.5l5 5L19 7" />
        </svg>
      );
    case "close":
      return (
        <svg {...common} strokeWidth={1.8}>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg
          {...common}
          fill="currentColor"
          stroke="none"
        >
          <path d="M19.05 4.91A10 10 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.44 1.32 4.94L2.05 22l5.31-1.39a9.9 9.9 0 0 0 4.67 1.19h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zM12.04 20.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.15.83.84-3.07-.2-.31a8.22 8.22 0 0 1-1.26-4.34c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.48-.01a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07s.89 2.4 1.02 2.57c.12.16 1.76 2.69 4.27 3.77.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28z" />
        </svg>
      );
    default:
      return null;
  }
}
