// House line icon set, 24x24, 1.6px stroke. Monochrome by design — icons take
// currentColor so context decides the tone.

interface IconProps {
  className?: string;
}

// Nav icons take `filled` for their active state: the same closed path, solid.
// Stroke thins when filled so the glyph keeps its silhouette instead of
// bulking up.
interface NavIconProps extends IconProps {
  filled?: boolean;
}

function base(className?: string, filled = false) {
  return {
    className,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: filled ? 1 : 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function IconHome({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function IconLive({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="3.2" fill={filled ? "currentColor" : "none"} />
      <path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 7.4a6.5 6.5 0 0 1 0 9.2" strokeWidth={filled ? 2.2 : 1.6} />
      <path d="M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 4.6a10.4 10.4 0 0 1 0 14.8" strokeWidth={filled ? 2.2 : 1.6} />
    </svg>
  );
}

export function IconStore({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M4.5 9.5 6 4h12l1.5 5.5M4.5 9.5h15M4.5 9.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20v-6h5v6" fill={filled ? "#000" : "none"} />
    </svg>
  );
}

export function IconTicket({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 6v2.5M14 11v2M14 15.5V18" strokeDasharray="0.1 3.4" stroke={filled ? "#000" : "currentColor"} />
    </svg>
  );
}

export function IconUser({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.2 3.9-5 7-5s5.8 1.8 7 5" />
    </svg>
  );
}

export function IconSpark({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
      <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </svg>
  );
}

export function IconCalendar({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke={filled ? "#000" : "currentColor"} />
    </svg>
  );
}

export function IconCamera({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
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

export function IconSearch({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="10.5" cy="10.5" r="6.5" strokeWidth={filled ? 2.4 : 1.6} />
      <path d="m15.5 15.5 4.5 4.5" strokeWidth={filled ? 2.4 : 1.6} />
    </svg>
  );
}

export function IconBell({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.5 6.5 2.5 6.5H4S6.5 16 6.5 10z" />
      <path d="M10 19.5a2.3 2.3 0 0 0 4 0" />
    </svg>
  );
}

export function IconShield({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M12 3.5 19 6v5.2c0 4.4-2.7 7.6-7 9.3-4.3-1.7-7-4.9-7-9.3V6z" />
      <path d="m9 12 2 2 4-4" stroke={filled ? "#000" : "currentColor"} />
    </svg>
  );
}

// --- Timeline action rail (reply / repost / like / views / bookmark / share).
// The comment, heart and dots icons above complete the set.

export function IconRepost({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 9V7.5a2 2 0 0 1 2-2h9M5 9 2.8 6.6M5 9l2.2-2.4" />
      <path d="M19 15v1.5a2 2 0 0 1-2 2H8M19 15l2.2 2.4M19 15l-2.2 2.4" />
    </svg>
  );
}

export function IconBookmark({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M6 4.5h12v16l-6-4.2-6 4.2z" />
    </svg>
  );
}

export function IconShare({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 15V4M12 4 8.5 7.5M12 4l3.5 3.5" />
      <path d="M5 13v5.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V13" />
    </svg>
  );
}

export function IconStats({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4.5 19.5V13M9.5 19.5V8M14.5 19.5v-9M19.5 19.5V4.5" />
    </svg>
  );
}

// --- Composer affordances (media row under the "What's happening" field).

export function IconImage({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8.75" cy="9.5" r="1.4" />
      <path d="m4 16.5 4.5-4.2 3.6 3.3 3.2-2.8 4.7 4.2" />
    </svg>
  );
}

export function IconGif({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M11 10.2a1.9 1.9 0 1 0 0 3.6c.9 0 1.5-.5 1.5-1.4h-1.2" />
      <path d="M14.8 10.1v3.8M17 13.9v-3.8h2.2M17 12.2h1.8" />
      <path d="M7.4 10.2H6.3a1.9 1.9 0 0 0 0 3.6h1.1v-1.6" />
    </svg>
  );
}

export function IconPoll({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M7.5 15.5V11M12 15.5V8.5M16.5 15.5v-2.5" />
    </svg>
  );
}

export function IconEmoji({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.6 14.2a4 4 0 0 0 6.8 0" />
      <circle cx="9.2" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// --- Shell chrome.

export function IconMore({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="8.4" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMail({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4 8 8 5.2L20 8" stroke={filled ? "#000" : "currentColor"} />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  );
}

export function IconArrowLeft({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 12H4M4 12l6-6M4 12l6 6" />
    </svg>
  );
}

// --- Player chrome (live room control bar).

export function IconPause({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 5.5v13M15 5.5v13" strokeWidth={2.2} />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7" />
      <path d="M19.7 4.5v4.2h-4.2" />
    </svg>
  );
}

export function IconPip({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <rect x="12" y="12" width="7" height="5.5" rx="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTheater({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9h18M3 15h18" />
    </svg>
  );
}

export function IconFullscreen({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" />
    </svg>
  );
}

export function IconVolume({ className, muted }: IconProps & { muted?: boolean }) {
  return (
    <svg {...base(className)}>
      <path d="M4 9.5h3L12 5.5v13L7 14.5H4z" />
      {muted ? (
        <path d="M16 9.5l4 5M20 9.5l-4 5" />
      ) : (
        <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
      )}
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5.5 9.5 12 16l6.5-6.5" />
    </svg>
  );
}

export function IconChevronUp({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5.5 14.5 12 8l6.5 6.5" />
    </svg>
  );
}

/** KASH coin: a ring with a bar, the currency mark used on gift prices. */
export function IconCoin({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.2 9.2h5.6M9.2 14.8h5.6M12 8v8" strokeWidth={1.4} />
    </svg>
  );
}

/** Collapse the chat column back into the stage (arrow into a wall). */
export function IconCollapseRight({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 12h11M15 12l-4-4M15 12l-4 4" />
      <path d="M20 4.5v15" />
    </svg>
  );
}

// Leaving Market Square: box with an arrow escaping it. Marks a link that
// hands the reader to another Ark product.
export function IconExternal({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

// Quote: speech marks. Distinguishes "quote with comment" from a plain repost.
export function IconQuote({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M9.5 5.5A5.5 5.5 0 0 0 4 11v6.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1H6.2A3.5 3.5 0 0 1 9.5 7.5a1 1 0 0 0 0-2Z" />
      <path d="M18.5 5.5A5.5 5.5 0 0 0 13 11v6.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1h-3.8a3.5 3.5 0 0 1 3.3-3.5a1 1 0 0 0 0-2Z" />
    </svg>
  );
}

// The design's own "export" glyph — a rounded box with an arrow leaving its
// top-right corner. Kept apart from IconExternal, which is the house line icon
// at 24px: this is the file's 12px mark, drawn from the exported paths, and it
// takes `currentColor` so a caller can tint it (the ecosystem card's two
// slides use different accents for the same control).
export function IconExportArrow({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden className={className}>
      <path d="M6.50021 5.875C6.40521 5.875 6.31021 5.83999 6.23521 5.765C6.09021 5.62 6.09021 5.38 6.23521 5.235L10.3352 1.135C10.4802 0.989995 10.7202 0.989995 10.8652 1.135C11.0102 1.28 11.0102 1.52 10.8652 1.665L6.76521 5.765C6.69021 5.83999 6.59521 5.875 6.50021 5.875Z" />
      <path d="M11.0001 3.775C10.7951 3.775 10.6251 3.605 10.6251 3.4V1.375H8.6001C8.3951 1.375 8.2251 1.205 8.2251 1C8.2251 0.795 8.3951 0.625 8.6001 0.625H11.0001C11.2051 0.625 11.3751 0.795 11.3751 1V3.4C11.3751 3.605 11.2051 3.775 11.0001 3.775Z" />
      <path d="M7.5 11.375H4.5C1.785 11.375 0.625 10.215 0.625 7.5V4.5C0.625 1.785 1.785 0.625 4.5 0.625H5.5C5.705 0.625 5.875 0.795 5.875 1C5.875 1.205 5.705 1.375 5.5 1.375H4.5C2.195 1.375 1.375 2.195 1.375 4.5V7.5C1.375 9.805 2.195 10.625 4.5 10.625H7.5C9.805 10.625 10.625 9.805 10.625 7.5V6.5C10.625 6.295 10.795 6.125 11 6.125C11.205 6.125 11.375 6.295 11.375 6.5V7.5C11.375 10.215 10.215 11.375 7.5 11.375Z" />
    </svg>
  );
}
