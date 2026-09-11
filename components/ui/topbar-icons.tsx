"use client";

/**
 * THE TOP BAR'S GLYPHS — node 225:3641, exported from the file.
 *
 * `vuesax/linear/search-normal` (225:3682), the location mark (225:3689) and
 * the pill's caret (225:3687). Recoloured to `currentColor`, so one glyph
 * serves the resting and hover states of each control.
 *
 * DO NOT redraw these. Re-export from the file.
 */

/** `vuesax/linear/search-normal`, 16px — the top bar's search field. */
export function IconTopSearch({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.66683 14.0007C11.1646 14.0007 14.0002 11.1651 14.0002 7.66732C14.0002 4.16951 11.1646 1.33398 7.66683 1.33398C4.16903 1.33398 1.3335 4.16951 1.3335 7.66732C1.3335 11.1651 4.16903 14.0007 7.66683 14.0007Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.6668 14.6673L13.3335 13.334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** The 32px location mark on the current-location pill. */
export function IconLocationPin({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2.5C13.33 2.5 10.7199 3.29176 8.49981 4.77516C6.27974 6.25856 4.54942 8.36697 3.52763 10.8338C2.50585 13.3006 2.2385 16.015 2.7594 18.6337C3.28031 21.2525 4.56606 23.6579 6.45406 25.5459C8.34207 27.434 10.7475 28.7197 13.3663 29.2406C15.985 29.7615 18.6994 29.4942 21.1662 28.4724C23.633 27.4506 25.7414 25.7203 27.2248 23.5002C28.7082 21.2801 29.5 18.67 29.5 16C29.496 12.4208 28.0724 8.98932 25.5416 6.45844C23.0107 3.92756 19.5792 2.50397 16 2.5ZM26.5 16C26.5003 17.148 26.3115 18.2883 25.9413 19.375L20.875 16.25C20.5784 16.0662 20.246 15.9478 19.9 15.9025L17.0475 15.5175C16.6066 15.4607 16.1585 15.5217 15.7488 15.6943C15.3391 15.8669 14.9824 16.1449 14.715 16.5H14.2063L13.8675 15.8C13.7028 15.4572 13.4617 15.1568 13.1626 14.9219C12.8635 14.6869 12.5145 14.5238 12.1425 14.445L11.8075 14.375L12.3075 13.5H14.1063C14.5286 13.4999 14.944 13.3928 15.3138 13.1888L16.845 12.3438C17.0129 12.2499 17.1697 12.1375 17.3125 12.0087L20.6775 8.9675C20.9432 8.72723 21.1541 8.43268 21.296 8.10379C21.4379 7.77491 21.5075 7.41937 21.5 7.06125C23.0272 8.00037 24.2886 9.31492 25.1638 10.8796C26.0391 12.4444 26.4991 14.2071 26.5 16ZM17.595 5.625L18.37 7.0125L15.3438 9.75L13.9775 10.5H12.0175C11.5772 10.5005 11.1448 10.617 10.7639 10.8378C10.3829 11.0585 10.0669 11.3758 9.84751 11.7575L9.28626 12.7388L8.46001 10.535L9.69876 7.6075C10.8164 6.76746 12.0907 6.15933 13.4467 5.81887C14.8027 5.47841 16.2131 5.4125 17.595 5.625ZM5.50001 16C5.49975 14.8621 5.68553 13.7317 6.05001 12.6538L7.01751 15.235C7.16349 15.6279 7.40644 15.9775 7.72376 16.2513C8.04108 16.5252 8.42248 16.7143 8.83251 16.8013L11.2738 17.3263L11.6488 18.0888C11.813 18.4251 12.0503 18.7205 12.3434 18.9534C12.6364 19.1863 12.9778 19.3509 13.3425 19.435L12.7175 20.825C12.5186 21.2716 12.455 21.7666 12.5345 22.2489C12.6141 22.7313 12.8333 23.1797 13.165 23.5387L13.1913 23.5662L15.4613 25.9037L15.35 26.4775C12.6842 26.3095 10.1824 25.1329 8.35288 23.1868C6.52333 21.2407 5.50329 18.6711 5.50001 16ZM18.4563 26.2075C18.5273 25.8233 18.5078 25.4278 18.3993 25.0524C18.2908 24.677 18.0963 24.3321 17.8313 24.045L17.805 24.0175L15.59 21.7362L17.0113 18.5462L19.3863 18.8662L24.565 22.0513C23.0979 24.1294 20.9279 25.6058 18.4563 26.2075Z" fill="currentColor"/>
    </svg>
  );
}

/** The pill's dropdown caret — a 7x3.5 chevron at a 2px stroke. */
export function IconCaretDown({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 9 6" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L4.5 4.5L1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * `vuesax/linear/notification`, 24px — the top bar's bell, node 647:17444 in
 * the live header (647:17439), exported from the file. The file strokes it
 * #DCDCDC; `currentColor` here so the button can carry that and a hover.
 */
export function IconTopBell({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.02 2.91016C8.71003 2.91016 6.02003 5.60016 6.02003 8.91016V11.8002C6.02003 12.4102 5.76003 13.3402 5.45003 13.8602L4.30003 15.7702C3.59003 16.9502 4.08003 18.2602 5.38003 18.7002C9.69003 20.1402 14.34 20.1402 18.65 18.7002C19.86 18.3002 20.39 16.8702 19.73 15.7702L18.58 13.8602C18.28 13.3402 18.02 12.4102 18.02 11.8002V8.91016C18.02 5.61016 15.32 2.91016 12.02 2.91016Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M13.87 3.20141C13.56 3.11141 13.24 3.04141 12.91 3.00141C11.95 2.88141 11.03 2.95141 10.17 3.20141C10.46 2.46141 11.18 1.94141 12.02 1.94141C12.86 1.94141 13.58 2.46141 13.87 3.20141Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.02 19.0586C15.02 20.7086 13.67 22.0586 12.02 22.0586C11.2 22.0586 10.44 21.7186 9.90002 21.1786C9.36002 20.6386 9.02002 19.8786 9.02002 19.0586" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10"/>
    </svg>
  );
}

/**
 * The account pill's caret, node 747:14031, exported from the file: an 8 x 4
 * chevron at a 2.29 stroke with round caps, which exports as an 11 x 7 box
 * because the stroke is centred on the path. Lay it out as the 8 x 4 the file
 * sizes and let this overflow it.
 */
export function IconTopCaret({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 11 7" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.77777 1.22393L5.66939 5.33231C5.57584 5.42586 5.42416 5.42586 5.33061 5.33231L1.22223 1.22393" stroke="currentColor" strokeWidth="2.44444" strokeLinecap="round"/>
    </svg>
  );
}
