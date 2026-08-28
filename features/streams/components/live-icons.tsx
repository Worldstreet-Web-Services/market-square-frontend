/**
 * Icons exported from the Live design rather than approximated.
 *
 * These are the source paths, kept verbatim so the shapes match the design
 * exactly; only the hard-coded stroke colours are swapped for currentColor so
 * one path can serve both the white count pill and the green join pill.
 */

interface IconProps {
  className?: string;
}

/** The broadcast/signal glyph beside every viewer count. */
export function IconBroadcast({ className }: IconProps) {
  return (
    <svg viewBox="0 0 21 16" fill="none" className={className} aria-hidden>
      <path
        d="M12.5996 7.11715C13.0135 7.34999 13.0135 7.94531 12.5996 8.17815L9.58035 9.87647C9.17403 10.105 8.67305 9.81164 8.67305 9.34597V5.94932C8.67305 5.48365 9.17433 5.19056 9.58004 5.41852L12.5996 7.11715Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        d="M3.6134 14.5344C1.78697 12.7079 0.760898 10.2307 0.760898 7.64764C0.760898 5.06462 1.78697 2.5874 3.6134 0.760898M17.3869 14.5344C19.2133 12.7079 20.2394 10.2307 20.2394 7.64764C20.2394 5.06462 19.2133 2.5874 17.3869 0.760898M6.19589 11.9519C5.05435 10.8103 4.41304 9.26204 4.41304 7.64764C4.41304 6.03324 5.05435 4.48495 6.19589 3.34339M14.8044 11.9519C15.9459 10.8103 16.5872 9.26204 16.5872 7.64764C16.5872 6.03324 15.9459 4.48495 14.8044 3.34339"
        stroke="currentColor"
        strokeWidth="1.5218"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The filled variant, used inside the green "Click to join Live" pill. */
export function IconBroadcastFilled({ className }: IconProps) {
  return (
    <svg viewBox="0 0 21 16" fill="none" className={className} aria-hidden>
      <path
        d="M12.5996 7.11715C13.0135 7.34999 13.0135 7.94531 12.5996 8.17815L9.58035 9.87647C9.17403 10.105 8.67305 9.81164 8.67305 9.34597V5.94932C8.67305 5.48365 9.17433 5.19056 9.58004 5.41852L12.5996 7.11715Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        d="M3.6134 14.5344C1.78697 12.7079 0.760898 10.2307 0.760898 7.64764C0.760898 5.06462 1.78697 2.5874 3.6134 0.760898M17.3869 14.5344C19.2133 12.7079 20.2394 10.2307 20.2394 7.64764C20.2394 5.06462 19.2133 2.5874 17.3869 0.760898M6.19589 11.9519C5.05435 10.8103 4.41304 9.26204 4.41304 7.64764C4.41304 6.03324 5.05435 4.48495 6.19589 3.34339M14.8044 11.9519C15.9459 10.8103 16.5872 9.26204 16.5872 7.64764C16.5872 6.03324 15.9459 4.48495 14.8044 3.34339"
        stroke="currentColor"
        strokeWidth="1.5218"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The design's search glyph — a circle with a detached handle stroke. */
export function IconSearchLive({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M7.66732 14C11.1651 14 14.0007 11.1645 14.0007 7.66667C14.0007 4.16887 11.1651 1.33334 7.66732 1.33334C4.16951 1.33334 1.33398 4.16887 1.33398 7.66667C1.33398 11.1645 4.16951 14 7.66732 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.6673 14.6667L13.334 13.3333"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The hero's speaker glyph. Rotate/flip is never applied — it is drawn upright. */
export function IconSpeaker({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M11.8833 16.5359C12.2193 16.5359 12.4615 16.2886 12.4615 15.9575V8.072C12.4615 7.74083 12.2193 7.46387 11.8732 7.46387C11.631 7.46387 11.4728 7.58263 11.2058 7.81993L8.88228 9.88142C8.85254 9.91095 8.80803 9.92593 8.75867 9.92593H7.29034C6.58834 9.92593 6.24219 10.2769 6.24219 11.0234V12.9913C6.24219 13.738 6.58812 14.0888 7.29034 14.0888H8.75846C8.80803 14.0888 8.85254 14.1035 8.88228 14.1333L11.2058 16.2148C11.4481 16.4321 11.6409 16.5361 11.8831 16.5361"
        fill="currentColor"
      />
      <path
        d="M16.1546 15.5276C16.3471 15.656 16.5845 15.6067 16.723 15.4088C17.3755 14.4993 17.7562 13.2881 17.7562 12.0224C17.7562 10.7518 17.3805 9.54055 16.723 8.63077C16.5796 8.43798 16.3471 8.38862 16.1544 8.51708C15.9666 8.64575 15.9369 8.88791 16.0852 9.10053"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The 20x20 chevron inside the hero's circular prev/next buttons. */
export function IconChevronUpThick({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M15 12.5L10 7.5L5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
