"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSearch } from "@/components/ui/icons";
import { LiveNowRail, TicketsRail } from "@/features/streams";
import { CitizenSpotlightRail } from "@/features/profile";
import { ExploreCategoriesRail, TrendingDiscussions } from "@/features/discovery";

function RailSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        router.push(query.trim() ? `/discover?q=${encodeURIComponent(query.trim())}` : "/discover");
      }}
      role="search"
      className="flex h-[38px] items-center gap-2 rounded-full border border-white/40 px-2"
    >
      <IconSearch className="h-4 w-4 shrink-0 text-[#6D6D6D]" />
      <label className="sr-only" htmlFor="rail-search">
        Search Market Square
      </label>
      <input
        id="rail-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
        className="min-w-0 flex-1 bg-transparent text-[15px] tracking-[-0.01em] text-heading outline-none placeholder:text-grey-500"
      />
    </form>
  );
}

// Rail order follows the design: search, the featured citizen, then the
// category index. Live and tickets keep their modules underneath — they are
// the two things on the square that expire, and the design's category list
// links to them rather than replacing them.
export function RightRail() {
  return (
    <aside className="hidden w-[371px] shrink-0 pl-4 pr-6 lg:block">
      <div className="sticky top-0 flex max-h-dvh flex-col gap-4 overflow-y-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <RailSearch />
        <CitizenSpotlightRail />
        {/* Above the curated categories on purpose: a category is a shelf
            somebody arranged, a discussion is what the room is doing now. */}
        <TrendingDiscussions limit={5} />
        <ExploreCategoriesRail />
        <LiveNowRail />
        <TicketsRail />

        <p className="px-2 text-[11px] leading-[17.9px] text-white/40">
          © {new Date().getFullYear()} WorldStreet Ecosystem • Market Square v1.0
          <br />
          Non-custodial • Self-sovereign • Powered by Tsion
        </p>
      </div>
    </aside>
  );
}
