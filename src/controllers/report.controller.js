// reportController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import { Bill } from "../models/bills/bill.model.js";
import { Product } from "../models/product/product.model.js";
import { Type } from "../models/product/type.model.js"
import { SalePrice } from "../models/product/salePrices.model.js";
import mongoose, { Types } from "mongoose";

const getReports = asyncHandler(async (req, res) => {
    const { reportType, productId, categoryId, typeId, startDate, endDate } = req.query;
    const user = req.user;

    if (!user) throw new ApiError(401, "Unauthorized");

    const BusinessId = user.BusinessId;
    const dateFilter = {};

    if (startDate && endDate) {
        dateFilter.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }

    let result;

    switch (reportType) {
        // Total sales & revenue of specific product
        case "productSales":
            if (!productId) throw new ApiError(400, "ProductId required!");

            const product = await Product.findOne({ _id: productId, BusinessId }).populate('salePricesId');

            if (!product) throw new ApiError(404, "Product not found");

            const bills = await Bill.aggregate([
                { $match: { BusinessId, ...dateFilter } },
                { $unwind: "$billItems" },
                { $match: { "billItems.productId": product._id } },
                {
                    $group: {
                        _id: "$billItems.productId",
                        totalQuantity: { $sum: "$billItems.quantity" },
                        totalRevenue: { $sum: { $multiply: ["$billItems.quantity", "$billItems.salePrice"] } }
                    }
                }
            ]);



            let revenue = (product?.salePricesId?.salePrice1 - product?.productPurchasePrice) * bills[0]?.totalQuantity

            result = bills.length > 0 ? {
                productName: product.productName,
                totalQuantity: bills[0].totalQuantity,
                totalRevenue: revenue,
            } : {
                productName: product.productName,
                totalQuantity: 0,
                totalRevenue: 0,
            };
            break;

        case "salesByCategory":
            if (!categoryId) throw new ApiError(400, "categoryId required!");

            // fetch all products of this category
            const products = await Product.find({ BusinessId, categoryId })
                .populate("salePricesId");

            if (!products.length) throw new ApiError(404, "No products found in this category");

            // aggregate sales for only products in this category
            const productIds = products.map(p => p._id);

            const sales = await Bill.aggregate([
                { $match: { BusinessId, ...dateFilter } },
                { $unwind: "$billItems" },
                { $match: { "billItems.productId": { $in: productIds } } },
                {
                    $group: {
                        _id: "$billItems.productId",
                        totalQuantity: { $sum: "$billItems.quantity" }
                    }
                }
            ]);

            // map productId → total quantity
            const salesMap = new Map(sales.map(s => [s._id.toString(), s.totalQuantity]));

            // console.log('sales', sales)

            // console.log('salesMap', salesMap)
            // console.log('products', products)

            let totalQuantity = 0;
            let totalRevenue = 0;

            for (const product of products) {
                const qtySold = salesMap.get(product._id.toString()) || 0;
                // console.log('qtySold', qtySold)
                const profitPerUnit =
                    (product.salePricesId?.salePrice1 || 0) - (product.productPurchasePrice || 0);
                // console.log('profitPerUnit', profitPerUnit)
                const revenue = qtySold * profitPerUnit;
                // console.log('revenue', revenue)
                totalQuantity += qtySold;
                totalRevenue += revenue;
            }

            result = {
                categoryId,
                categoryName: products[0].categoryName || "Unknown",
                totalQuantity,
                totalRevenue
            };
            break;


        case "salesByType":
            if (!typeId) throw new ApiError(400, "typeId required!");

            // fetch all products of this type
            const productsByType = await Product.find({ BusinessId, typeId })
                .populate("salePricesId");

            if (!productsByType.length) throw new ApiError(404, "No products found for this type");

            const productIdsByType = productsByType.map(p => p._id);

            // get sales from bills for only these products
            const salesByType = await Bill.aggregate([
                { $match: { BusinessId, ...dateFilter } },
                { $unwind: "$billItems" },
                { $match: { "billItems.productId": { $in: productIdsByType } } },
                {
                    $group: {
                        _id: "$billItems.productId",
                        totalQuantity: { $sum: "$billItems.quantity" }
                    }
                }
            ]);

            const salesMapType = new Map(
                salesByType.map(s => [s._id.toString(), s.totalQuantity])
            );

            let totalQuantityType = 0;
            let totalRevenueType = 0;

            for (const product of productsByType) {
                const qtySold = salesMapType.get(product._id.toString()) || 0;
                const profitPerUnit =
                    (product.salePricesId?.salePrice1 || 0) - (product.productPurchasePrice || 0);
                const revenue = qtySold * profitPerUnit;

                totalQuantityType += qtySold;
                totalRevenueType += revenue;
            }
            // console.log('productsByType', productsByType)
            const typeName = await Type.findById(typeId)
            // console.log('typeName', typeName)

            result = {
                typeId,
                typeName: typeName?.typeName || "Unknown",
                totalQuantity: totalQuantityType,
                totalRevenue: totalRevenueType
            };
            break;

        default:
            throw new ApiError(400, "Invalid report type!");
    }

    return res.status(200).json(new ApiResponse(200, result, "Report generated successfully"));
});

export { getReports };
