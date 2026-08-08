import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { eligibilityChecksTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/log-check", async (req, res): Promise<void> => {
  const {
    session_id,
    household_income_pkr,
    family_size,
    province,
    has_disability,
    is_likely_eligible,
    reason,
  } = req.body as {
    session_id?: string;
    household_income_pkr?: number;
    family_size?: number;
    province?: string;
    has_disability?: boolean;
    is_likely_eligible?: boolean;
    reason?: string;
    [key: string]: unknown;
  };

  try {
    await db.insert(eligibilityChecksTable).values({
      sessionId: session_id ?? null,
      householdIncomePkr: household_income_pkr ?? null,
      familySize: family_size ?? null,
      province: province ?? null,
      hasDisability: has_disability ?? false,
      isLikelyEligible: is_likely_eligible ?? null,
      reason: reason ?? null,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to insert eligibility check");
    res.status(500).json({ error: "Failed to log check" });
  }
});

export default router;
