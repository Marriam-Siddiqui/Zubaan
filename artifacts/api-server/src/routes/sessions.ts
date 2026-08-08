import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/sessions", async (req, res): Promise<void> => {
  try {
    const [session] = await db.insert(sessionsTable).values({}).returning();
    res.status(201).json({ id: session!.id });
  } catch (err) {
    req.log.error({ err }, "Failed to create session");
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.post("/sessions/:id/end", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const updated = await db
      .update(sessionsTable)
      .set({ endedAt: new Date() })
      .where(eq(sessionsTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to end session");
    res.status(500).json({ error: "Failed to end session" });
  }
});

export default router;
