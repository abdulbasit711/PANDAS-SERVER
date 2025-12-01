// routes/whatsapp.routes.js
import express from "express";
import {
    initializeWhatsapp,
    fetchQrCode,
    sendMessage,
    checkStatus,
} from "../controllers/whatsapp.controller.js";

const router = express.Router();

router.get("/init", initializeWhatsapp);
router.get("/qr", fetchQrCode);
router.get("/status", checkStatus);
router.post("/send-message", sendMessage);

export { router as whatsappRoutes };
