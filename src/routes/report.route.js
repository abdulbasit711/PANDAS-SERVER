import { Router } from "express";
import { getDailyReports } from "../controllers/report.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/daily-reports").get(verifyJWT, getDailyReports)





export  { router as reportRoutes};