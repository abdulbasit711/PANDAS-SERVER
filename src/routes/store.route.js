import { Router } from "express";
import { registerSupplier, updateSupplierDetails, getAllSuppliers } from "../controllers/supplier.controller.js";
import { registerCustomer, getAllCustomers, updateCustomerDetails, deleteCustomer } from '../controllers/customer.controller.js'
import { registerCompany, getAllCompanies, updateCompanyDetails } from '../controllers/company.controller.js'
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();


//secure routes
router.route("/add-customer").post(verifyJWT, registerCustomer)
router.route("/get-customers").get(verifyJWT, getAllCustomers)
router.route("/update-customer").patch(verifyJWT, updateCustomerDetails)
router.route("/delete-customer/:customerId").delete(verifyJWT, deleteCustomer)

router.route("/add-supplier").post(verifyJWT, registerSupplier)
router.route("/get-suppliers").get(verifyJWT, getAllSuppliers)
router.route("/update-supplier").patch(verifyJWT, updateSupplierDetails)

router.route("/add-company").post(verifyJWT, registerCompany)
router.route("/get-companies").get(verifyJWT, getAllCompanies)
router.route("/update-company").patch(verifyJWT, updateCompanyDetails)





export  { router as storeRoutes};