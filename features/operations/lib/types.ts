import { z } from "zod";

const MetricSchema = z.object({ label: z.string(), value: z.string(), detail: z.string() });
const AlertSchema = z.object({ id: z.string(), severity: z.enum(["info", "warning", "critical"]), title: z.string(), detail: z.string(), createdAt: z.string() });
const CaseSchema = z.object({ id: z.string(), target: z.string(), reason: z.string(), status: z.enum(["open", "resolved", "dismissed"]), reporter: z.string(), createdAt: z.string() });
const AuditSchema = z.object({ id: z.string(), actor: z.string(), action: z.string(), target: z.string(), occurredAt: z.string() });

export const OperationsSchema = z.object({
  metrics: z.array(MetricSchema),
  alerts: z.array(AlertSchema),
  cases: z.array(CaseSchema),
  audits: z.array(AuditSchema),
});

export const EntitlementSchema = z.object({
  reference: z.string(),
  type: z.enum(["ticket", "order"]),
  status: z.string(),
  owner: z.string(),
  item: z.string(),
  createdAt: z.string(),
  supportReference: z.string(),
});

export type ModerationCase = z.infer<typeof CaseSchema>;
