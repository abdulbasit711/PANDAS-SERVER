// reportController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import { Bill } from "../models/bills/bill.model.js";
import { Product } from "../models/product/product.model.js";
import { Type } from "../models/product/type.model.js"
import { SalePrice } from "../models/product/salePrices.model.js";
import mongoose, { Types } from "mongoose";


import { Purchase } from "../models/purchase/purchaseItem.model.js";
import { SaleReturn } from "../models/sales/saleReturn.model.js";
import { GeneralLedger } from "../models/accounts/generalLedger.model.js";
import { Customer } from "../models/customer.model.js";
import { Supplier } from "../models/supplier.model.js";
import { Company } from "../models/company.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";
import { AccountReceivable } from "../models/accounts/accountsReceivables.model.js";
import { AccountSubCategory } from "../models/accounts/accountSubCategory.model.js";


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


const buildDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return {};
    const start = new Date(new Date(startDate).setHours(0, 0, 0, 0));
    const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    return { $gte: start, $lte: end };
};

const getDailyReports = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        if (!user) throw new ApiError(401, "Unauthorized request.");

        const { BusinessId } = user;
        if (!BusinessId) throw new ApiError(400, "BusinessId is missing.");

        const { startDate, endDate } = req.query;
        console.log('req.query', req.query)

        // Default to today if no dates provided
        const start = startDate
            ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
            : new Date(new Date().setHours(0, 0, 0, 0));

        const end = endDate
            ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
            : new Date(new Date().setHours(23, 59, 59, 999));

        const dateFilter = { $gte: start, $lte: end };

        // ============ SALES DETAILS ============
        const salesDetails = await Bill.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    mergedInto: null
                }
            },
            {
                $lookup: {
                    from: "customers",
                    localField: "customer",
                    foreignField: "_id",
                    as: "customerDetails"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "salesPerson",
                    foreignField: "_id",
                    as: "salesPersonDetails"
                }
            },
            {
                $addFields: {
                    customerDetails: { $first: "$customerDetails" },
                    salesPersonDetails: { $first: "$salesPersonDetails" }
                }
            },
            {
                $unwind: { path: "$billItems", preserveNullAndEmptyArrays: true }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "billItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $addFields: {
                    "billItems.productDetails": { $first: "$productDetails" }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    billNo: { $first: "$billNo" },
                    billType: { $first: "$billType" },
                    billStatus: { $first: "$billStatus" },
                    totalAmount: { $first: "$totalAmount" },
                    paidAmount: { $first: "$paidAmount" },
                    flatDiscount: { $first: "$flatDiscount" },
                    billRevenue: { $first: "$billRevenue" },
                    customerDetails: { $first: "$customerDetails" },
                    salesPersonDetails: { $first: "$salesPersonDetails" },
                    billItems: { $push: "$billItems" },
                    createdAt: { $first: "$createdAt" }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // Calculate sales by price category
        const salesByPriceCategory = await Bill.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    mergedInto: null
                }
            },

            // Lookup customer
            {
                $lookup: {
                    from: "customers",
                    localField: "customer",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            {
                $addFields: {
                    customer: { $first: "$customer" }
                }
            },

            // Calculate bill-level total
            {
                $addFields: {
                    billNetTotal: {
                        $subtract: [
                            "$totalAmount",
                            { $ifNull: ["$flatDiscount", 0] }
                        ]
                    }
                }
            },

            // Assign price category based on rules
            {
                $addFields: {
                    priceCategory: {
                        $cond: [
                            { $eq: ["$customer", null] },  // If walk-in / no customer
                            "salePrice1",
                            {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$customer.customerFlag", "red"] }, then: "salePrice1" },
                                        { case: { $eq: ["$customer.customerFlag", "green"] }, then: "salePrice2" },
                                        { case: { $eq: ["$customer.customerFlag", "yellow"] }, then: "salePrice3" },
                                        { case: { $eq: ["$customer.customerFlag", "white"] }, then: "salePrice4" }
                                    ],
                                    default: "salePrice1"
                                }
                            }
                        ]
                    }
                }
            },

            // Group final totals
            {
                $group: {
                    _id: "$priceCategory",
                    totalSales: { $sum: "$billNetTotal" },
                    billCount: { $sum: 1 }
                }
            }
        ]);
        // console.log('salesByPriceCategory', salesByPriceCategory)


        // ============ PURCHASE DETAILS ============
        const purchaseDetails = await Purchase.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter
                }
            },
            {
                $lookup: {
                    from: "suppliers",
                    localField: "vendorSupplierId",
                    foreignField: "_id",
                    as: "supplierDetails"
                }
            },
            {
                $lookup: {
                    from: "companies",
                    localField: "vendorCompanyId",
                    foreignField: "_id",
                    as: "companyDetails"
                }
            },
            {
                $addFields: {
                    supplierDetails: { $first: "$supplierDetails" },
                    companyDetails: { $first: "$companyDetails" }
                }
            },
            {
                $unwind: { path: "$purchaseItems", preserveNullAndEmptyArrays: true }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "purchaseItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $addFields: {
                    "purchaseItems.productDetails": { $first: "$productDetails" }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    purchaseBillNo: { $first: "$purchaseBillNo" },
                    totalAmount: { $first: "$totalAmount" },
                    flatDiscount: { $first: "$flatDiscount" },
                    supplierDetails: { $first: "$supplierDetails" },
                    companyDetails: { $first: "$companyDetails" },
                    purchaseItems: { $push: "$purchaseItems" },
                    purchaseDate: { $first: "$purchaseDate" },
                    createdAt: { $first: "$createdAt" }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // ============ CASH FLOW DETAILS ============

        // 1) CASH IN: Paid amounts from bills with NO customer (walk-in cash sales)
        const cashInFromBills = await Bill.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    customer: null,                     // No customer linked → cash sale
                    paidAmount: { $gt: 0 }              // Only include paid bills
                }
            },
            {
                $group: {
                    _id: null,
                    totalCashInBills: { $sum: "$paidAmount" }
                }
            }
        ]);

        const totalCashInBills =
            cashInFromBills.length ? cashInFromBills[0].totalCashInBills : 0;


        // 2) CASH IN: Credits of CUSTOMER accounts (cash received)
        const cashInCustomerLedger = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    details: { $regex: /payment|cash received/i },
                    credit: { $gt: 0 }
                }
            },
            {
                $lookup: {
                    from: "individualaccounts",
                    localField: "individualAccountId",
                    foreignField: "_id",
                    as: "acc"
                }
            },
            { $unwind: "$acc" },
            {
                $match: {
                    "acc.customerId": { $exists: true, $ne: null }   // customer accounts only
                }
            },
            {
                $group: {
                    _id: null,
                    totalCredit: { $sum: "$credit" }
                }
            }
        ]);

        const totalCustomerLedgerCredit =
            cashInCustomerLedger.length ? cashInCustomerLedger[0].totalCredit : 0;


        // ========== FINAL TOTAL CASH-IN ==========
        const cashInTotal = totalCashInBills + totalCustomerLedgerCredit;


        // 3) CASH OUT: Vendor or Company debit transactions (cash given/payment)
        const cashOutVendor = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    details: { $regex: /payment|cash given/i },
                    debit: { $gt: 0 }
                }
            },
            {
                $lookup: {
                    from: "individualaccounts",
                    localField: "individualAccountId",
                    foreignField: "_id",
                    as: "acc"
                }
            },
            { $unwind: "$acc" },
            {
                $match: {
                    $or: [
                        { "acc.supplierId": { $exists: true, $ne: null } },
                        { "acc.companyId": { $exists: true, $ne: null } }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    totalDebit: { $sum: "$debit" }
                }
            }
        ]);

        const totalVendorDebit =
            cashOutVendor.length ? cashOutVendor[0].totalDebit : 0;


        // 4) CASH OUT: Expense Entries (all expenses)
        const cashOutExpenses = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    details: "Expense Entry",
                    debit: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalExpenseDebit: { $sum: "$debit" }
                }
            }
        ]);

        const totalExpenseDebit =
            cashOutExpenses.length ? cashOutExpenses[0].totalExpenseDebit : 0;


        // ========== FINAL TOTAL CASH-OUT ==========
        const cashOutTotal = totalVendorDebit + totalExpenseDebit;


        // ========== NET CASH FLOW ==========
        const netCashFlow = cashInTotal - cashOutTotal;

        // ============ EXPENSE DETAILS ============
        const expenseDetails = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    details: "Expense Entry"
                }
            },
            {
                $lookup: {
                    from: "individualaccounts",
                    localField: "individualAccountId",
                    foreignField: "_id",
                    as: "expenseAccount"
                }
            },
            {
                $addFields: {
                    expenseAccount: { $first: "$expenseAccount" }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // ============ SALE RETURN DETAILS ============
        const saleReturnDetails = await SaleReturn.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    returnDate: dateFilter
                }
            },
            {
                $lookup: {
                    from: "customers",
                    localField: "customer",
                    foreignField: "_id",
                    as: "customerDetails"
                }
            },
            {
                $lookup: {
                    from: "bills",
                    localField: "billId",
                    foreignField: "_id",
                    as: "billDetails"
                }
            },
            {
                $addFields: {
                    customerDetails: { $first: "$customerDetails" },
                    billDetails: { $first: "$billDetails" }
                }
            },
            {
                $unwind: { path: "$returnItems", preserveNullAndEmptyArrays: true }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "returnItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $addFields: {
                    "returnItems.productDetails": { $first: "$productDetails" }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    returnType: { $first: "$returnType" },
                    totalReturnAmount: { $first: "$totalReturnAmount" },
                    returnReason: { $first: "$returnReason" },
                    customerDetails: { $first: "$customerDetails" },
                    billDetails: { $first: "$billDetails" },
                    returnItems: { $push: "$returnItems" },
                    returnDate: { $first: "$returnDate" }
                }
            },
            { $sort: { returnDate: -1 } }
        ]);

        // ============ MERGED BILLS ============
        const mergedBills = await Bill.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    mergedInto: { $ne: null }
                }
            },
            {
                $lookup: {
                    from: "bills",
                    localField: "mergedInto",
                    foreignField: "_id",
                    as: "parentBill"
                }
            },
            {
                $addFields: {
                    parentBill: { $first: "$parentBill" }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // ============ ADDED CUSTOMERS ============
        const addedCustomers = await Customer.find({
            BusinessId,
            createdAt: dateFilter
        }).sort({ createdAt: -1 });

        // ============ ADDED SUPPLIERS & COMPANIES ============
        const addedSuppliers = await Supplier.find({
            BusinessId,
            createdAt: dateFilter
        }).sort({ createdAt: -1 });

        const addedCompanies = await Company.find({
            BusinessId,
            createdAt: dateFilter
        }).sort({ createdAt: -1 });

        // ============ ACCOUNT RECEIVABLES ============
        const accountReceivables = await IndividualAccount.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    customerId: { $exists: true, $ne: null }
                }
            },
            {
                $lookup: {
                    from: "customers",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            {
                $addFields: {
                    customer: { $first: "$customer" }
                }
            },
            {
                $match: {
                    accountBalance: { $gt: 0 }
                }
            }
        ]);

        // ============ OPENING & CLOSING BALANCES ============
        const openingBalances = await GeneralLedger.find({
            BusinessId,
            createdAt: dateFilter,
            details: "Opening Balance"
        }).populate("individualAccountId", "individualAccountName accountBalance");

        const closingBalances = await GeneralLedger.find({
            BusinessId,
            createdAt: dateFilter,
            details: "Closing Balance"
        }).populate("individualAccountId", "individualAccountName accountBalance");

        // ============ MERGED ACCOUNTS ============
        const mergedAccounts = await IndividualAccount.find({
            BusinessId,
            createdAt: dateFilter,
            mergedInto: { $ne: null }
        }).populate("mergedInto", "individualAccountName");

        // ============ VENDOR JOURNAL ENTRIES ============
        const vendorJournalEntries = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    details: { $regex: /cash given|payment/i }
                }
            },
            {
                $lookup: {
                    from: "individualaccounts",
                    localField: "individualAccountId",
                    foreignField: "_id",
                    as: "vendorAccount"
                }
            },
            {
                $addFields: {
                    vendorAccount: { $first: "$vendorAccount" }
                }
            },
            {
                $match: {
                    $or: [
                        { "vendorAccount.supplierId": { $exists: true, $ne: null } },
                        { "vendorAccount.companyId": { $exists: true, $ne: null } }
                    ]
                }
            },
            {
                $lookup: {
                    from: "suppliers",
                    localField: "vendorAccount.supplierId",
                    foreignField: "_id",
                    as: "supplier"
                }
            },
            {
                $lookup: {
                    from: "companies",
                    localField: "vendorAccount.companyId",
                    foreignField: "_id",
                    as: "company"
                }
            },
            {
                $addFields: {
                    supplier: { $first: "$supplier" },
                    company: { $first: "$company" }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // ============ CUSTOMER JOURNAL ENTRIES ============
        const customerJournalEntries = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    createdAt: dateFilter,
                    details: { $regex: /cash received/i }
                }
            },
            {
                $lookup: {
                    from: "individualaccounts",
                    localField: "individualAccountId",
                    foreignField: "_id",
                    as: "customerAccount"
                }
            },
            {
                $addFields: {
                    customerAccount: { $first: "$customerAccount" }
                }
            },
            {
                $match: {
                    "customerAccount.customerId": { $exists: true, $ne: null }
                }
            },
            {
                $lookup: {
                    from: "customers",
                    localField: "customerAccount.customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            {
                $addFields: {
                    customer: { $first: "$customer" }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // ============ SUMMARY CALCULATIONS ============
        const totalSales = salesDetails.reduce((sum, bill) => sum + (bill.totalAmount - bill.flatDiscount), 0);
        const totalRevenue = salesDetails.reduce((sum, bill) => sum + (bill.billRevenue || 0), 0);
        const totalPurchases = purchaseDetails.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
        const totalExpenses = expenseDetails.reduce((sum, expense) => sum + (expense.debit || 0), 0);
        const totalSaleReturns = saleReturnDetails.reduce((sum, ret) => sum + ret.totalReturnAmount, 0);
        const totalReceivables = accountReceivables.reduce((sum, acc) => sum + acc.accountBalance, 0);

        const cashFlowDetails = {
            cashInFromBills: totalCashInBills,
            cashInCustomerLedger: totalCustomerLedgerCredit,
            cashOutVendor: totalVendorDebit,
            cashOutExpenses: totalExpenseDebit,
            cashInTotal,
            cashOutTotal,
            netCashFlow
        };


        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    summary: {
                        totalSales,
                        totalRevenue,
                        totalPurchases,
                        totalExpenses,
                        totalSaleReturns,
                        totalReceivables,
                        netCashFlow,
                        cashInTotal,
                        cashOutTotal
                    },
                    salesDetails: {
                        bills: salesDetails,
                        byPriceCategory: salesByPriceCategory
                    },
                    purchaseDetails,
                    cashFlowDetails,
                    expenseDetails,
                    saleReturnDetails,
                    mergedBills,
                    addedCustomers,
                    addedSuppliers,
                    addedCompanies,
                    accountReceivables,
                    openingBalances,
                    closingBalances,
                    mergedAccounts,
                    vendorJournalEntries,
                    customerJournalEntries,
                    dateRange: {
                        startDate: start,
                        endDate: end
                    }
                },
                "Daily reports fetched successfully"
            )
        );
    } catch (error) {
        console.error("Error fetching daily reports:", error);
        throw new ApiError(500, error.message);
    }
});

export {
    getReports,
    getDailyReports
};

