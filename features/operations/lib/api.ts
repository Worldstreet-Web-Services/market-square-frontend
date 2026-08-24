import { msApi } from "@/lib/api/service";
import { EntitlementSchema, OperationsSchema } from "@/features/operations/lib/types";

export async function fetchOperations() {
  return OperationsSchema.parse(await msApi.get("/operations/summary"));
}

export async function resolveCase(id: string, resolution: "resolved" | "dismissed") {
  return msApi.patch<{ id: string; status: string }>(`/operations/cases/${id}`, { resolution });
}

export async function lookupEntitlement(reference: string) {
  return EntitlementSchema.parse(await msApi.get(`/operations/entitlements/${encodeURIComponent(reference)}`));
}
