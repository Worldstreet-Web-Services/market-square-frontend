"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSearch } from "@/components/ui/icons";
import { LiveNowRail, TicketsRail, useStreamList } from "@/features/streams";
import { CitizenSpotlightRail } from "@/features/profile";
import { ExploreCategoriesRail } from "@/features/discovery";

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
      className="ws-field flex h-9 items-center gap-2 px-3"
    >
      <IconSearch className="h-4 w-4 shrink-0 text-meta" />
      <label className="sr-only" htmlFor="rail-search">
        Search Market Square
      </label>
      <input
        id="rail-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
        className="min-w-0 flex-1 bg-transparent text-[12px] text-heading outline-none"
      />
    </form>
  );
}

// Rail order follows the design: search, the featured citizen, then the
// category index. Live and tickets keep their modules underneath — they are
// the two things on the square that expire, and the design's category list
// links to them rather than replacing them.
export function RightRail() {
  const live = useStreamList("live");

  return (
    <aside className="hidden w-[320px] shrink-0 pl-4 pr-6 lg:block">
      <div className="sticky top-0 flex max-h-dvh flex-col gap-3 overflow-y-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <RailSearch />
        <CitizenSpotlightRail />
        <ExploreCategoriesRail liveCount={live.data?.items.length} />
        <LiveNowRail />
        <TicketsRail />

        <p className="px-1 text-[9px] leading-relaxed text-grey-600">
          © {new Date().getFullYear()} WorldStreet Holdings · Market Square v1.0
          <br />
          Ark Custodian · Self-Sovereign · Powered by Trust
        </p>
      </div>
    </aside>
  );
}
