"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Link that wraps client navigation in a View Transition when the browser
// supports it (feature-detected; plain navigation otherwise). Used for
// thumbnail → stream-room morphs and profile navigation.
export function TransitionLink({
  href,
  children,
  className,
  style,
  ...rest
}: React.ComponentProps<typeof Link>) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={(event) => {
        // Let modified clicks (new tab etc.) behave natively.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = typeof href === "string" ? href : href.pathname ?? "";
        if (!target.startsWith("/")) return;
        if (!document.startViewTransition) return;
        event.preventDefault();
        document.startViewTransition(() => {
          router.push(target);
        });
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
