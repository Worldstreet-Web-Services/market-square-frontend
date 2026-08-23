// House line icon set, 24x24, 1.6px stroke. Monochrome by design — icons take
// currentColor so context decides the tone.

interface IconProps {
  className?: string;
}

function base(className?: string) {
  return {
    className,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function IconHome({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function IconLive({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 7.4a6.5 6.5 0 0 1 0 9.2" />
      <path d="M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 4.6a10.4 10.4 0 0 1 0 14.8" />
    </svg>
  );
}

export function IconStore({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4.5 9.5 6 4h12l1.5 5.5M4.5 9.5h15M4.5 9.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

export function IconTicket({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 6v2.5M14 11v2M14 15.5V18" strokeDasharray="0.1 3.4" />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.2 3.9-5 7-5s5.8 1.8 7 5" />
    </svg>
  );
}

export function IconSpark({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
      <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}

export function IconCamera({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="7" width="13" height="11" rx="2" />
      <path d="M16.5 11l4-2.5v8L16.5 14" />
    </svg>
  );
}

export function IconHeart({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(className)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
    </svg>
  );
}

export function IconComment({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 12a8 8 0 1 0-3.1 6.3L20.5 20l-1-3.6A8 8 0 0 0 20 12z" />
    </svg>
  );
}

export function IconFlag({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 21V4.5M6 4.5c3-1.8 6 1.8 9 0V13c-3 1.8-6-1.8-9 0" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

export function IconX({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 11.5 20 4l-4.5 16-4-6.5z" />
      <path d="M11.5 13.5 20 4" />
    </svg>
  );
}

export function IconEye({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCopy({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M5.5 15.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  );
}

export function IconLink({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </svg>
  );
}

export function IconDots({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="5.5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      <circle cx="18.5" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}
