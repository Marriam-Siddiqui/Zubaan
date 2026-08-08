import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eligibilityRouter from "./eligibility";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eligibilityRouter);

export default router;
