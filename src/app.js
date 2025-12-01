import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"})) // extended for objects in object
app.use(express.static("public")) //for storing files
app.use(cookieParser())

// Import routes

import { userRoutes } from "./routes/user.route.js";
import { storeRoutes } from "./routes/store.route.js";
import { productRoutes } from "./routes/product.route.js";
import { accountRoutes } from "./routes/account.route.js";
import { billRoutes } from "./routes/bill.route.js";
import { saleReturnRoutes } from "./routes/saleReturn.route.js";
import { purchaseRoutes } from "./routes/purchase.route.js";
import { dashboardRoutes } from "./routes/dashboard.route.js";
import { whatsappRoutes } from "./routes/whatsapp.route.js";
import { reportRoutes } from "./routes/report.route.js";


// Apply routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/store", storeRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/account", accountRoutes); 
app.use("/api/v1/bill", billRoutes); 
app.use("/api/v1/saleReturn", saleReturnRoutes); 
app.use("/api/v1/purchase", purchaseRoutes); 
app.use("/api/v1/dashboard", dashboardRoutes); 
app.use("/api/v1/whatsapp", whatsappRoutes);
app.use("/api/v1/reports", reportRoutes);
export { app }