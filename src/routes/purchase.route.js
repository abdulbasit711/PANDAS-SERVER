import { Router } from "express";
import { registerPurchase, getPurchases, registerPurchaseReturn } from "../controllers/purchase.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();


//secure routes
router.route("/register-purchase").post(verifyJWT, registerPurchase)
router.route("/get-purchases").get(verifyJWT, getPurchases)
router.route("/register-purchaseReturn").post(verifyJWT, registerPurchaseReturn)
// router.route("/get-lastBillNo").get(verifyJWT, getLastBillNo)
// router.route("/update-bill").patch(verifyJWT, updateProduct)

// router.route("/get-single-bill/:billNo").get(verifyJWT, getSingleBill)
// router.route("/bill-payment").post(verifyJWT, billPayment)
// router.route("/update-category").patch(verifyJWT, updateCategory)

// router.route("/add-type").post(verifyJWT, registerType)
// router.route("/get-types").get(verifyJWT, getTypes)
// router.route("/update-type").patch(verifyJWT, updateType)





export  { router as purchaseRoutes};