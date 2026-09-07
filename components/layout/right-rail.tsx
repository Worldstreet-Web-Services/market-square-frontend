"use client";

import { EcosystemPartnersRail } from "@/components/layout/ecosystem-partners-rail";
import { TrendingDiscussions } from "@/features/discovery";
import { CitizenSpotlightRail } from "@/features/profile";


export function RightRail() {
  return (
    <aside className="hidden w-[371px] shrink-0 pl-4 pr-6 lg:block">
      <div className="sticky top-0 flex max-h-dvh flex-col gap-4 overflow-y-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/*
          THREE blocks, not seven.

          The rail was drawn for a product with fourteen nav rows and a reels
          lane. It carried a search field, a spotlight, partners, discussions,
          categories, live-now and tickets — seven pieces of furniture beside a
          page whose product does three things. "Don't put a lot of things in
          there" was said about exactly this.

          What went, and why each one rather than "it was crowded":

          RailSearch — Explore is a nav row and a whole page. A second search
          box beside it teaches a reader there are two searches.

          ExploreCategoriesRail — a shelf somebody arranged, pointing at the
          page it was arranged for. Explore browses categories better than a
          rail summarising them.

          LiveNowRail — the hallway at the top of Home is this, with more room
          and the host's face. Two lists of the same rooms is how a reader
          learns to distrust both.

          TicketsRail — "my stuff", and it moved to More with the rest of it.

          What stayed earns its place: a discussion is what the square is doing
          right now, which is the whole thesis; the spotlight is who is doing
          it, which is the other half of the same answer; and the partners are
          a commitment to somebody outside this codebase.

          The spotlight was cut once, on the argument that status is only worth
          seeing when there is a room to be seen in. There is one now, and it
          is asked for. It sits between the two because the order is what the
          square is doing, then who is doing it, then who we are doing it with
          — and because it costs NOTHING when there is nobody to show: the
          board renders null on an empty list rather than holding a panel open.
        */}
        <TrendingDiscussions limit={5} />
        <CitizenSpotlightRail />
        <EcosystemPartnersRail />
      </div>
    </aside>
  );
}

