import { pgTable, uuid, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const eligibilityChecksTable = pgTable("eligibility_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessionsTable.id),
  householdIncomePkr: integer("household_income_pkr"),
  familySize: integer("family_size"),
  province: text("province"),
  hasDisability: boolean("has_disability").default(false),
  isLikelyEligible: boolean("is_likely_eligible"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEligibilityCheckSchema = createInsertSchema(eligibilityChecksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEligibilityCheck = z.infer<typeof insertEligibilityCheckSchema>;
export type EligibilityCheck = typeof eligibilityChecksTable.$inferSelect;
