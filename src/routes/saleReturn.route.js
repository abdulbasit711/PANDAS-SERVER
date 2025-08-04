import { Router } from "express";
import { registerSaleReturn, } from "../controllers/saleReturn.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();


//secure routes
router.route("/add-saleReturn").post(verifyJWT, registerSaleReturn)
// router.route("/get-accounts").get(verifyJWT, getAccounts)
// router.route("/update-account").patch(verifyJWT, updateAccount)

// router.route("/add-subCategory").post(verifyJWT, registerSubAccount)
// router.route("/update-subCategory").patch(verifyJWT, updateSubAccount)

// router.route("/add-individualAccount").post(verifyJWT, registerIndividualAccount)
// router.route("/update-individualAccount").patch(verifyJWT, updateIndividualAccount)

// router.route("/get-accountReceivables").get(verifyJWT, getAccountReceivables)




export  { router as saleReturnRoutes};