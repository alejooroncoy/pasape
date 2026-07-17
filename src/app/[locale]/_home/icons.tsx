// Iconos inline del landing Cartelera. Stroke=currentColor para reaccionar al color del padre.
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const PinIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={11} height={11} viewBox="0 0 11 11" {...base} strokeWidth={1.3} {...p}>
    <path d="M5.5 1.5c2 0 3.5 1.5 3.5 3.4 0 2.4-3.5 5.1-3.5 5.1S2 7.3 2 4.9c0-1.9 1.5-3.4 3.5-3.4z" />
    <circle cx="5.5" cy="4.7" r="1.1" />
  </svg>
);

export const CaretIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={9} height={9} viewBox="0 0 9 9" {...base} strokeWidth={1.3} {...p}>
    <path d="M2 3.5l2.5 2.5L7 3.5" />
  </svg>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={16} height={16} viewBox="0 0 16 16" {...base} strokeWidth={1.6} {...p}>
    <circle cx="7" cy="7" r="5" />
    <path d="M11 11l3 3" />
  </svg>
);

export const HeartIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} {...p}>
    <path d="M9 15.5s-5.5-3.4-5.5-7.3C3.5 5.9 5.1 4.5 7 4.5c1.1 0 2 .5 2 1.5 0-1 .9-1.5 2-1.5 1.9 0 3.5 1.4 3.5 3.7 0 3.9-5.5 7.3-5.5 7.3z" />
  </svg>
);

export const TicketIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.4} {...p}>
    <path d="M2.5 6.5a1.5 1.5 0 003 0V5h7v1.5a1.5 1.5 0 003 0V4.5a1 1 0 00-1-1h-11a1 1 0 00-1 1v2zm0 5a1.5 1.5 0 013 0V13h7v-1.5a1.5 1.5 0 013 0v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z" />
  </svg>
);

export const WaIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={14} height={14} viewBox="0 0 22 22" fill="currentColor" {...p}>
    <path d="M11 2C6 2 2 6 2 11c0 1.6.4 3.1 1.2 4.4L2 20l4.7-1.2c1.3.7 2.8 1.1 4.3 1.1 5 0 9-4 9-9s-4-9-9-9zm5 13c-.2.6-1.2 1.2-1.7 1.2-.4.1-.9.1-1.5-.1-.3-.1-.8-.3-1.3-.5-2.4-1-3.9-3.4-4-3.6-.1-.2-1-1.3-1-2.4 0-1.1.6-1.7.8-1.9.2-.2.4-.3.6-.3h.4c.2 0 .3 0 .5.4l.7 1.6c.1.2.1.4 0 .5l-.3.4c-.1.1-.2.3-.1.5.2.3.7 1.2 1.5 1.9.9.8 1.7 1 1.9 1.1.2.1.3.1.5-.1.1-.2.6-.7.7-.9.1-.2.3-.2.5-.1.2.1 1.4.6 1.6.8.2.1.3.2.4.3.1.1.1.6-.2 1.2z" />
  </svg>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={14} height={14} viewBox="0 0 14 14" {...base} strokeWidth={1.6} {...p}>
    <path d="M3 3l8 8M11 3l-8 8" />
  </svg>
);

export const ArrowRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={14} height={14} viewBox="0 0 14 14" {...base} strokeWidth={1.6} {...p}>
    <path d="M3 7h8M7 3l4 4-4 4" />
  </svg>
);

export const MusicIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.6} {...p}>
    <path d="M5 13a2 2 0 100 4 2 2 0 000-4zm10-2a2 2 0 100 4 2 2 0 000-4zM7 13V3l8-1v10" />
  </svg>
);

export const DjIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.6} {...p}>
    <path d="M3 9c0-3 3-6 6-6s6 3 6 6c0 4-3 6-6 6s-6-2-6-6zm6-3v6m-3-3h6" />
  </svg>
);

export const AfterIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.6} {...p}>
    <path d="M9 3v12M3 9h12M5 5l8 8M13 5l-8 8" />
  </svg>
);

export const ComedyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.6} {...p}>
    <path d="M4 6h10v6c0 2-2 3-5 3s-5-1-5-3V6zm3-3h4M6 11s1 2 3 2 3-2 3-2" />
  </svg>
);

export const CultureIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.6} {...p}>
    <rect x="3" y="4" width="12" height="10" rx="1.5" />
    <path d="M3 8h12M7 4v10" />
  </svg>
);

export const TalkIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.6} {...p}>
    <path d="M3 5.5A2.5 2.5 0 015.5 3h7A2.5 2.5 0 0115 5.5V10a2.5 2.5 0 01-2.5 2.5H8l-3.5 3v-3H5.5A2.5 2.5 0 013 10V5.5z" />
    <path d="M6.5 6.5h5M6.5 9h3.5" />
  </svg>
);

export const SportIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 18 18" {...base} strokeWidth={1.6} {...p}>
    <circle cx="9" cy="9" r="6" />
    <path d="M9 5v4l3 2" />
  </svg>
);

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 22 22" {...base} strokeWidth={1.6} {...p}>
    <path d="M3 10l8-6 8 6v8a1 1 0 01-1 1h-4v-6H8v6H4a1 1 0 01-1-1v-8z" />
  </svg>
);

export const CompassIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 22 22" {...base} strokeWidth={1.6} {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="M14.5 7.5l-1.6 4-4 1.6 1.6-4 4-1.6z" />
  </svg>
);

export const UserIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 22 22" {...base} strokeWidth={1.6} {...p}>
    <circle cx="11" cy="8" r="3.2" />
    <path d="M4 18.5C5 15.5 7.5 14 11 14s6 1.5 7 4.5" />
  </svg>
);
