import { msApi } from "@/lib/api/service";
import { DiscoverySchema } from "@/features/discovery/lib/types";

export async function searchMarket(query: string, type?: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (type && type !== "all") params.set("type", type);
  return DiscoverySchema.parse(await msApi.get(`/search?${params.toString()}`));
}
