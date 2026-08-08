import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eligibilityRouter from "./eligibility";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eligibilityRouter);
router.use(sessionsRouter);

export default router;
