import { Router } from "express";
import { getDashboardData } from "../controllers/dashboard.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/get-dashboardData").get(verifyJWT, getDashboardData)




export  { router as dashboardRoutes};