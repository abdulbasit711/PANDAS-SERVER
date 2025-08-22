import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import { Bill } from "../models/bills/bill.model.js";
import { Product } from "../models/product/product.model.js";
import { Category } from "../models/product/category.model.js"
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";
import { Purchase } from "../models/purchase/purchaseItem.model.js";


const getDashboardData = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, "Unauthorized request.");

    const { BusinessId } = user;
    if (!BusinessId) throw new ApiError(400, "BusinessId is missing in the request.");

    const { filter = "monthly" } = req.query;

    // Define date ranges based on filter
    const now = new Date();
    let startDate;

    switch (filter) {
      case "daily":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "weekly":
        startDate = new Date();
        startDate.setDate(now.getDate() - 7);
        break;
      case "monthly":
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "6months":
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "yearly":
        startDate = new Date();
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 1);
    }

    let groupFormat = "%Y-%m-%d"; // default: daily

    switch (filter) {
      case 'daily':
        groupFormat = "%Y-%m-%d %H:00";
        break;
      case 'weekly':
      case 'monthly':
        groupFormat = "%Y-%m-%d";
        break;
      case '6months':
        groupFormat = "%Y-%m";
        break;
      case 'yearly':
        groupFormat = "%Y";
        break;
    }

    // Sales + Revenue aggregation
    const salesData = await Bill.aggregate([
      {
        $match: {
          BusinessId: new mongoose.Types.ObjectId(BusinessId),
          createdAt: { $gt: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: "$createdAt" }
          },
          totalSales: {
            $sum: { $subtract: ["$totalAmount", "$flatDiscount"] }
          },
          totalRevenue: { $sum: "$billRevenue" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Purchases aggregation
    const purchaseData = await Purchase.aggregate([
      {
        $match: {
          BusinessId: new mongoose.Types.ObjectId(BusinessId),
          createdAt: { $gt: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
          totalPurchases: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          purchases: "$totalPurchases",
        },
      },
    ]);

    // Normalize & merge sales + purchases
    const salesMap = new Map(
      salesData.map(item => [
        item._id,
        {
          date: item._id,
          sales: item.totalSales,
          revenue: item.totalRevenue,
          purchases: 0
        }
      ])
    );

    purchaseData.forEach(p => {
      if (salesMap.has(p.date)) {
        salesMap.get(p.date).purchases = p.purchases;
      } else {
        salesMap.set(p.date, {
          date: p.date,
          sales: 0,
          revenue: 0,
          purchases: p.purchases
        });
      }
    });

    const finalSalesData = Array.from(salesMap.values()).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    // Category Bar Chart
    const categoryData = await Category.aggregate([
      { $match: { BusinessId: new mongoose.Types.ObjectId(BusinessId) } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "categoryId",
          as: "products",
        },
      },
      {
        $project: {
          _id: 0,
          category: "$categoryName",
          quantity: { $size: "$products" },
        },
      },
    ]);

    // Top & least sold products
    const soldProducts = await Bill.aggregate([
      {
        $match: {
          BusinessId: new mongoose.Types.ObjectId(BusinessId),
          createdAt: { $gte: startDate },
        },
      },
      { $unwind: "$billItems" },
      {
        $group: {
          _id: "$billItems.productId",
          totalQuantity: { $sum: "$billItems.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 0,
          productName: "$productDetails.productName",
          totalQuantity: 1,
        },
      },
    ]);

    const stockData = soldProducts.slice(0, 15);

    const topProduct = soldProducts[0] || "No data";
    const leastProduct = soldProducts[soldProducts.length - 1] || "No data";

    const outOfStockProducts = await Product.find({
      BusinessId,
      productTotalQuantity: { $lte: 0 },
    }).select("productName");

    // Totals
    const totalSales = finalSalesData.reduce((acc, item) => acc + (item.sales || 0), 0);
    const totalRevenue = finalSalesData.reduce((acc, item) => acc + (item.revenue || 0), 0);
    const avgSales = finalSalesData.length > 0 ? (totalSales / finalSalesData.length).toFixed(2) : "0.00";

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          salesData: finalSalesData,
          categoryData,
          totalSales,
          totalRevenue,
          avgSales,
          topProduct,
          stockData,
          leastProduct,
          outOfStock: outOfStockProducts,
        },
        "Dashboard data fetched successfully"
      )
    );
  } catch (error) {
    console.error("Dashboard Error:", error);
    throw new ApiError(500, "Failed to retrieve dashboard data.");
  }
});



export { getDashboardData };