"use client";

import { useState } from "react";
import { HousePreviewSheet, type HousePreview } from "@/components/layout/house-preview-sheet";
import { HouseDirectoryCard } from "@/components/layout/house-directory-card";
import { SectionHeading } from "@/components/layout/section-heading";
import { useDiscoverHouses } from "@/features/messages/lib/discover-houses";
import { useJoinGroup } from "@/features/messages";
import { sq } from "@/lib/square-path";

/**
 * POPULAR HOUSES — node 1305:149179 in the 2026-09-12 Home.
 *
 * This REPLACES "Join a community" rather than joining it: same endpoint, same
 * card, same Join button, a new heading and a new size. Two sections against
 * one list would be the duplication ogazboiz warned about ("if we dont have
 * then do it to avoid duplicate"), and the backend confirmed the endpoint is
 * already the ranked directory this section wants.
 *
 * ─── WHY THE LIST IS ALREADY "POPULAR" ───────────────────────────────────────
 * `GET /conversations/discover` is ordered by MEMBER COUNT descending (ties by
 * id) and excludes houses the reader is already in — a Join House button on a
 * house you belong to is the bug that ordering was written to avoid. It is
 * public with optional auth, so this section works signed out. Nothing is
 * re-sorted here: sorting one loaded page is not sorting the list.
 *
 * ─── THE CARD ────────────────────────────────────────────────────────────────
 * 356 wide in a horizontal rail, radius 22, `rgba(16,16,18,0.62)` behind a 7
 * blur, ringed INSIDE at 1 in `rgba(255,255,255,0.18)`, cards 15.7 apart. Its
 * inside is a CENTRED flex row rather than the file's absolute placement — the
 * ragged, top-anchored fixed-120 layout read as unfinished — at legible sizes:
 * a 64×68 picture, then a text column (title 15 semibold, the face pile + member
 * count at 12, a two-line 13 description), then the Join House pill on the
 * 90deg `#9F65FD -> #5B05E6` ramp (`ws-btn-welcome`). Everything lines up and
 * the card grows to its content instead of clipping inside a fixed height.
 *
 * ─── EMPTY IS ABSENT ─────────────────────────────────────────────────────────
 * A 404 means the route is not deployed and an empty list means no public house
 * exists yet; both render NOTHING. A permanent empty shelf on Home would be an
 * apology for a feature nobody can use.
 */

export function PopularHouses() {
  const houses = useDiscoverHouses(8);
  const join = useJoinGroup();
  const [preview, setPreview] = useState<HousePreview | null>(null);

  const items = houses.data?.items ?? [];
  if (houses.unavailable || items.length === 0) return null;

  return (
    <section aria-labelledby="popular-houses" className="mb-10">
      <div className="mb-4">
        <SectionHeading
          id="popular-houses"
          lead="Popular"
          accent="Houses"
          action={{ label: "View more", href: sq("/houses") }}
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((house) => (
          // Node 1302:148763 — capped at 400 so a second card peeks, and never
          // more than 95% of the column so it fits a phone.
          <article key={house.id} className="w-100 max-w-[95%] shrink-0">
            <HouseDirectoryCard
              house={house}
              onOpen={() => setPreview(house)}
              onJoin={() => join.mutate(house.id)}
              joining={join.isPending}
            />
          </article>
        ))}
      </div>
      {preview && (
        <HousePreviewSheet house={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
