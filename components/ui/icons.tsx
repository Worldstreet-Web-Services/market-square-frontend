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

/**
 * `MusicNotesPlus` — the For Creators nav entry, node 225:3255.
 *
 * Exported from the file rather than redrawn, so it is the designer's glyph
 * and not an approximation of it. That makes it the one SOLID icon in a nav
 * of stroked ones: the file's own artwork is a filled Phosphor glyph, and
 * tracing it as 1.6px strokes to match its neighbours would be inventing a
 * different icon. It still takes the nav's colour, because the fill is
 * `currentColor` rather than the file's `#A1A1AA` — the row is grey at rest
 * and `--color-create` when current, exactly like every other entry.
 *
 * `filled` is accepted and unused for the same reason: the glyph has only one
 * form. The active state still reads, since it is carried by the row's tint,
 * border and colour, not by the icon swapping weight.
 */
export function IconForCreators({ className }: IconProps) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M21.75 4.5C21.75 4.69891 21.671 4.88968 21.5303 5.03033C21.3897 5.17098 21.1989 5.25 21 5.25H19.5V6.75C19.5 6.94891 19.421 7.13968 19.2803 7.28033C19.1397 7.42098 18.9489 7.5 18.75 7.5C18.5511 7.5 18.3603 7.42098 18.2197 7.28033C18.079 7.13968 18 6.94891 18 6.75V5.25H16.5C16.3011 5.25 16.1103 5.17098 15.9697 5.03033C15.829 4.88968 15.75 4.69891 15.75 4.5C15.75 4.30109 15.829 4.11032 15.9697 3.96967C16.1103 3.82902 16.3011 3.75 16.5 3.75H18V2.25C18 2.05109 18.079 1.86032 18.2197 1.71967C18.3603 1.57902 18.5511 1.5 18.75 1.5C18.9489 1.5 19.1397 1.57902 19.2803 1.71967C19.421 1.86032 19.5 2.05109 19.5 2.25V3.75H21C21.1989 3.75 21.3897 3.82902 21.5303 3.96967C21.671 4.11032 21.75 4.30109 21.75 4.5ZM20.25 10.5V15.375C20.2503 16.1275 19.9991 16.8584 19.5363 17.4518C19.0736 18.0451 18.4258 18.4668 17.696 18.6499C16.9661 18.8329 16.196 18.7668 15.508 18.462C14.8201 18.1573 14.2537 17.6313 13.8988 16.9678C13.544 16.3042 13.4211 15.5411 13.5496 14.7997C13.6781 14.0583 14.0507 13.3812 14.6082 12.8758C15.1657 12.3704 15.8761 12.0658 16.6265 12.0104C17.3769 11.955 18.1243 12.152 18.75 12.57V10.5C18.75 10.3011 18.829 10.1103 18.9697 9.96967C19.1103 9.82902 19.3011 9.75 19.5 9.75C19.6989 9.75 19.8897 9.82902 20.0303 9.96967C20.171 10.1103 20.25 10.3011 20.25 10.5ZM18.75 15.375C18.75 15.0042 18.64 14.6416 18.434 14.3333C18.228 14.025 17.9351 13.7846 17.5925 13.6427C17.2499 13.5008 16.8729 13.4637 16.5092 13.536C16.1455 13.6084 15.8114 13.787 15.5492 14.0492C15.287 14.3114 15.1084 14.6455 15.036 15.0092C14.9637 15.3729 15.0008 15.7499 15.1427 16.0925C15.2846 16.4351 15.525 16.728 15.8333 16.934C16.1417 17.14 16.5042 17.25 16.875 17.25C17.3723 17.25 17.8492 17.0525 18.2008 16.7008C18.5525 16.3492 18.75 15.8723 18.75 15.375ZM8.25 10.3359V18.375C8.25028 19.1275 7.99909 19.8584 7.53635 20.4518C7.0736 21.0451 6.42584 21.4668 5.69598 21.6499C4.96612 21.8329 4.19603 21.7668 3.50805 21.462C2.82007 21.1573 2.25366 20.6313 1.89883 19.9678C1.54399 19.3042 1.42108 18.5411 1.54961 17.7997C1.67814 17.0583 2.05075 16.3812 2.60823 15.8758C3.16571 15.3704 3.8761 15.0658 4.62652 15.0104C5.37694 14.955 6.12435 15.152 6.75 15.57V5.25C6.75003 5.08275 6.80596 4.92031 6.90889 4.7885C7.01183 4.65668 7.15587 4.56306 7.31813 4.5225L12.5681 3.21C12.7597 3.16557 12.9611 3.19819 13.1289 3.30083C13.2967 3.40346 13.4174 3.5679 13.4651 3.75872C13.5128 3.94953 13.4837 4.15145 13.3839 4.32096C13.2842 4.49048 13.1218 4.61403 12.9319 4.665L8.25 5.83594V8.78906L14.8181 7.1475C15.0097 7.10307 15.2111 7.13569 15.3789 7.23833C15.5467 7.34096 15.6674 7.5054 15.7151 7.69622C15.7628 7.88703 15.7337 8.08895 15.6339 8.25846C15.5342 8.42798 15.3718 8.55153 15.1819 8.6025L8.25 10.3359ZM6.75 18.375C6.75 18.0042 6.64004 17.6416 6.43401 17.3333C6.22798 17.025 5.93515 16.7846 5.59254 16.6427C5.24992 16.5008 4.87292 16.4637 4.50921 16.536C4.1455 16.6084 3.8114 16.787 3.54918 17.0492C3.28696 17.3114 3.10838 17.6455 3.03603 18.0092C2.96368 18.3729 3.00082 18.7499 3.14273 19.0925C3.28464 19.4351 3.52497 19.728 3.83331 19.934C4.14165 20.14 4.50416 20.25 4.875 20.25C5.37229 20.25 5.8492 20.0525 6.20083 19.7008C6.55246 19.3492 6.75 18.8723 6.75 18.375Z" />
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

/**
 * The wink: a one-tap "I find you interesting", addressed to a person.
 *
 * NOT an eye. `IconEye` sits directly above this and means "views" — a tally
 * of who looked at a post. Interest is a thing a face does, not a thing an
 * organ does, and an eye pointed at a stranger reads as surveillance, which is
 * the exact wrong note for a signal we are asking people to send warmly.
 *
 * NOT a poke either. That word carries a decade of other people's meaning; the
 * product calls this a wink and the glyph has to be one.
 *
 * So: a face. One eye open as a dot, the other closed as a short downward arc
 * with an upward flick at its outer end — the lash line that makes a closed eye
 * read as a WINK rather than as someone asleep — and a curved mouth. The mouth
 * is what carries the warmth; without it the face is neutral and the wink
 * turns knowing rather than friendly.
 *
 * House rules kept, so it sits in the set: 24x24, `currentColor`, 1.6 stroke
 * from `base()`. The open eye is drawn as a filled dot rather than a stroked
 * circle because at 16px a stroked 1.2r circle closes into a blob; a filled
 * one stays a clean point. It is deliberately NOT a `NavIconProps` icon — a
 * "filled" wink would be a solid disc with no face left in it, and the sent
 * state is carried by colour and a tinted ring at the call site instead.
 */
export function IconWink({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.75" />
      {/* Open eye, viewer's left. A dot, not a ring — see above. */}
      <circle cx="9.1" cy="10" r="0.85" fill="currentColor" stroke="none" />
      {/* Closed eye with its lash flick. */}
      <path d="M13 10.35q1 -1.05 2.3 0" />
      <path d="M15.3 10.35l0.85 -0.85" />
      {/* The smile. Short of the cheeks, so the face is not a bowl. */}
      <path d="M8.9 14.35q3.1 2.15 6.2 0" />
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

/**
 * Save it to the device — the same tray `IconShare` draws, with the arrow
 * turned round. Share sends it out, download brings it down; drawing them as
 * one shape flipped is what makes the pair read as a pair.
 */
export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 4v11M12 15l-3.5-3.5M12 15l3.5-3.5" />
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

/**
 * The raised hand: asking for the floor.
 *
 * Four fingers rising over a thumb folded across the palm. Drawn to the file's
 * own convention — 24-box, 1.6 stroke, round caps, currentColor — rather than
 * imported, because an icon from another set reads as a foreign object next to
 * these even when nobody can say why.
 */
export function IconHand({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 11V5.5a1.5 1.5 0 1 1 3 0V11m0 0V4.5a1.5 1.5 0 1 1 3 0V11m0 0V6.5a1.5 1.5 0 1 1 3 0V14c0 3.9-2.6 6.5-6 6.5-2.6 0-4.2-1.2-5.4-3.3L5 14.2a1.5 1.5 0 0 1 2.4-1.7L8 13.2V11Z" />
    </svg>
  );
}

/**
 * A house: a room you can talk in.
 *
 * Two people under one roof rather than a building — the nav entry is not
 * about property, it is about the two visible sections a house has, speakers
 * and audience. Drawn to the file's own convention (24-box, 1.6 stroke, round
 * caps, currentColor) and filled for the active nav state like the other
 * navigation glyphs.
 */
export function IconHouses({ className, filled }: NavIconProps) {
  return (
    <svg {...base(className, filled)}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z" />
      <circle cx="9.5" cy="12.5" r="1.6" fill="none" />
      <circle cx="14.5" cy="12.5" r="1.6" fill="none" />
      <path d="M8 17.2c1-.9 2.4-1.4 4-1.4s3 .5 4 1.4" fill="none" />
    </svg>
  );
}

/**
 * Microphone — the gist-room mark.
 *
 * Drawn here rather than exported from the design file: the house set had no
 * mic of its own (the live cockpit only ever renders a LEVEL meter), and one
 * more line glyph on the same 24 grid at the same 1.6px stroke is the cheap
 * answer. An imported SVG would arrive with its own weight and sit beside
 * fifty icons that share one.
 */
export function IconMic({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
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

/** Leaving: a door with an arrow out. The gist room header's red control
    (node 129:11905) and the only exit glyph in the set. */
export function IconLogout({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 3.5h2.6a2.4 2.4 0 0 1 2.4 2.4v12.2a2.4 2.4 0 0 1-2.4 2.4h-2.6" />
      <path d="M9.8 16.2 5.6 12l4.2-4.2M5.6 12h9.6" />
    </svg>
  );
}

/** The file's `vuesax/outline/people` at 12 — five heads and a shoulder line.
    It marks a GROUP row in the inbox (node 31:6589), where it is the one
    purple mark on an otherwise white row. */
export function IconPeople({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="7.5" r="3" />
      <circle cx="17" cy="7.5" r="2.4" />
      <path d="M3.4 18.2c0-2.9 2.5-4.7 5.6-4.7s5.6 1.8 5.6 4.7" />
      <path d="M17 13.9c2.3.2 3.9 1.7 3.9 4" />
    </svg>
  );
}
