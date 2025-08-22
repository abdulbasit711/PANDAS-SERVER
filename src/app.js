import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"

const app = express();
app.use(cors({
    // origin: 'https://pandas-frontend-new.vercel.app',
    origin: 'http://localhost:5173',
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


// Apply routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/store", storeRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/account", accountRoutes); 
app.use("/api/v1/bill", billRoutes); 
app.use("/api/v1/saleReturn", saleReturnRoutes); 
app.use("/api/v1/purchase", purchaseRoutes); 
app.use("/api/v1/dashboard", dashboardRoutes); 

import { ApiError } from "./utils/ApiError.js"; // adjust path if needed

app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:", err.message);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});
export { app }
