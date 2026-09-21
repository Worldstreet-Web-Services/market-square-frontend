"use client";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export interface StackPerson {
  id: string;
  name: string;
  /** What the generated artwork is seeded with — the USER id, never a connection id. */
  seed?: string;
  avatarUrl?: string | null;
}

/**
 * A face pile — overlapping avatars that show WHO is somewhere at a glance,
 * the way a call or a group thread shows its members. Each face carries a ring
 * in the surface colour behind it so the overlap reads as separate people
 * rather than one smudged shape.
 *
 * Presentation only: the caller decides who is in the pile and in what order
 * (a room leads with its speakers), and supplies the count beside it.
 */
export function AvatarStack({
  people,
  max = 4,
  size = 20,
  ringClassName = "ring-chrome",
  className,
}: {
  people: StackPerson[];
  /** How many faces to draw before the count takes over. */
  max?: number;
  /** Face diameter in px. */
  size?: number;
  /** The ring colour — match the surface the pile sits on. */
  ringClassName?: string;
  className?: string;
}) {
  const shown = people.slice(0, max);
  if (shown.length === 0) return null;

  return (
    <span aria-hidden className={cn("flex shrink-0 items-center", className)}>
      {shown.map((person, index) => (
        <span
          key={person.id}
          className={cn("overflow-hidden rounded-full ring-2", ringClassName)}
          style={{
            width: size,
            height: size,
            // Overlap by ~40% of the face, first one flush.
            marginLeft: index === 0 ? 0 : Math.round(size * -0.4),
          }}
        >
          <Avatar
            name={person.name}
            seed={person.seed ?? person.id}
            src={person.avatarUrl}
            size={size}
            sizeClassName="h-full w-full"
          />
        </span>
      ))}
    </span>
  );
}
