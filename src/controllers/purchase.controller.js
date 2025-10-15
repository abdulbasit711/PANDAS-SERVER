import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Purchase } from "../models/purchase/purchaseItem.model.js";
import { Product } from "../models/product/product.model.js";
import { Business } from "../models/business.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";
import { GeneralLedger } from "../models/accounts/generalLedger.model.js";
import { StatusOfPrice } from "../models/product/statusOfPrice.model.js";

import { TransactionManager } from "../utils/TransactionManager.js";

const registerPurchase = asyncHandler(async (req, res) => {
    const {
        billNo,
        vendorSupplierId,
        vendorCompanyId,
        purchaseItems,
        flatDiscount = 0,
        purchaseDate,
        paidAmount = 0,
    } = req.body;

    if (!purchaseItems || !purchaseItems.length) {
        throw new ApiError(400, "Purchase items are required!");
    }

    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const business = await Business.findById(BusinessId).select("businessName");
            if (!business || !business.businessName) {
                throw new ApiError(404, "Business not found or business name is missing!");
            }

            let totalPurchaseCost = 0;
            let purchaseItemList = [];
            let productCount = 0;
            let productName = "";

            for (const item of purchaseItems) {
                const product = await Product.findById(item.productId);
                if (!product) {
                    throw new ApiError(404, `Product not found: Product ${productCount + 1}`);
                }

                productName = product.productName;

                productCount += 1;
                const productTotalQuantity = item.quantity * item.productPack;
                const isPriceChanged = item.pricePerUnit !== product.productPurchasePrice;

                const recentStatusOfPrice = await StatusOfPrice.findOne(
                    { productId: product._id },
                    {},
                    { sort: { createdAt: -1 } }
                );

                if (isPriceChanged) {
                    if (recentStatusOfPrice) {
                        if (recentStatusOfPrice.remainingQuantity >= 0) {
                            // ✅ No negative stock → just create a fresh entry
                            await StatusOfPrice.create({
                                productId: product._id,
                                oldPrice: product.productPurchasePrice,
                                newPrice: item.pricePerUnit,
                                remainingQuantity: productTotalQuantity,
                                changedBy: user._id,
                            });
                        } else {
                            // ✅ Negative stock → offset with this purchase
                            let carryQuantity = productTotalQuantity;
                            recentStatusOfPrice.remainingQuantity += carryQuantity;

                            if (recentStatusOfPrice.newPrice == 0) {
                                recentStatusOfPrice.newPrice = product.productPurchasePrice
                            }

                            if (recentStatusOfPrice.remainingQuantity <= 0) {
                                // All this purchase went to settle negative stock → update and done
                                await recentStatusOfPrice.save();
                            } else {
                                // Part of this purchase settled the negative, rest becomes new batch
                                const remainingAfterFix = recentStatusOfPrice.remainingQuantity;
                                recentStatusOfPrice.remainingQuantity = 0;
                                await recentStatusOfPrice.save();

                                const leftoverQuantity = carryQuantity - remainingAfterFix;

                                if (leftoverQuantity > 0) {
                                    await StatusOfPrice.create({
                                        productId: product._id,
                                        oldPrice: product.productPurchasePrice,
                                        newPrice: item.pricePerUnit,
                                        remainingQuantity: leftoverQuantity,
                                        changedBy: user._id,
                                    });
                                }
                            }
                        }
                    } else {
                        // First time purchase for this product
                        await StatusOfPrice.create({
                            productId: product._id,
                            oldPrice: product.productPurchasePrice,
                            newPrice: item.pricePerUnit,
                            remainingQuantity: productTotalQuantity,
                            changedBy: user._id,
                        });
                    }
                } else {
                    // Price not changed → extend recent status or create new one
                    if (recentStatusOfPrice) {
                        const originalQuantity = recentStatusOfPrice.remainingQuantity;
                        recentStatusOfPrice.remainingQuantity += productTotalQuantity;

                        transaction.addOperation(
                            async () => await recentStatusOfPrice.save(),
                            async () => {
                                recentStatusOfPrice.remainingQuantity = originalQuantity;
                                await recentStatusOfPrice.save();
                            }
                        );
                    } else {
                        await StatusOfPrice.create({
                            productId: product._id,
                            oldPrice: item.pricePerUnit,
                            newPrice: item.pricePerUnit,
                            remainingQuantity: productTotalQuantity,
                            changedBy: user._id,
                        });
                    }
                }


                const originalProductTotalQuantity = product.productTotalQuantity;
                product.productTotalQuantity += productTotalQuantity;
                if (isPriceChanged) {
                    product.productPurchasePrice = item.pricePerUnit;
                }

                transaction.addOperation(
                    async () => await product.save(),
                    async () => {
                        product.productTotalQuantity = originalProductTotalQuantity;
                        await product.save();
                    }
                );

                const itemTotal = item.pricePerUnit * item.quantity;
                totalPurchaseCost += itemTotal;

                purchaseItemList.push({
                    productId: product._id,
                    quantity: item.quantity,
                    pricePerUnit: item.pricePerUnit,
                    discount: item.discount || 0,
                    productPack: item.productPack || 1,
                });
            }

            let vendorIndividualAccount;
            if (vendorCompanyId && !vendorSupplierId) {
                vendorIndividualAccount = await IndividualAccount.findOne({ companyId: vendorCompanyId });
            } else if (!vendorCompanyId && vendorSupplierId) {
                vendorIndividualAccount = await IndividualAccount.findOne({ supplierId: vendorSupplierId });
            }

            if (!vendorIndividualAccount) {
                throw new ApiError(400, "Vendor company or supplier account not found!");
            }

            const inventoryAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Inventory",
            });

            if (!inventoryAccount) {
                throw new ApiError(400, "Inventory account not found!");
            }

            const cashAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Cash",
            });

            if (!cashAccount) {
                throw new ApiError(400, "Cash account not found!");
            }

            const accountPayableAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Account Payables",
            });

            if (!accountPayableAccount) {
                throw new ApiError(400, "Account Payables account not found!");
            }

            const originalInventoryBalance = inventoryAccount.accountBalance;
            inventoryAccount.accountBalance += totalPurchaseCost;

            transaction.addOperation(
                async () => await inventoryAccount.save(),
                async () => {
                    inventoryAccount.accountBalance = originalInventoryBalance;
                    await inventoryAccount.save();
                }
            );

            const totalAmount = totalPurchaseCost - flatDiscount - paidAmount;

            if (paidAmount > 0) {
                const originalCashBalance = cashAccount.accountBalance;
                cashAccount.accountBalance -= paidAmount;

                transaction.addOperation(
                    async () => await cashAccount.save(),
                    async () => {
                        cashAccount.accountBalance = originalCashBalance;
                        await cashAccount.save();
                    }
                );
            }

            if (totalAmount > 0) {
                const originalAccountPayableBalance = accountPayableAccount.accountBalance;
                accountPayableAccount.accountBalance += totalAmount;

                transaction.addOperation(
                    async () => await accountPayableAccount.save(),
                    async () => {
                        accountPayableAccount.accountBalance = originalAccountPayableBalance;
                        await accountPayableAccount.save();
                    }
                );
            }

            const originalVendorBalance = vendorIndividualAccount.accountBalance;
            vendorIndividualAccount.accountBalance += totalAmount;

            if (vendorIndividualAccount.mergedInto !== null) {
                const mergedIndividualAccount = await IndividualAccount.findById(
                    vendorIndividualAccount.mergedInto
                );
                mergedIndividualAccount.accountBalance += totalAmount;
                await mergedIndividualAccount.save();
            }

            transaction.addOperation(
                async () => await vendorIndividualAccount.save(),
                async () => {
                    vendorIndividualAccount.accountBalance = originalVendorBalance;
                    await vendorIndividualAccount.save();
                }
            );

            const purchase = await Purchase.create({
                BusinessId,
                purchaseBillNo: billNo,
                vendorSupplierId,
                vendorCompanyId,
                purchaseItems: purchaseItemList,
                totalAmount,
                flatDiscount,
                purchaseDate,
            });

            transaction.addOperation(
                async () => await purchase.save(),
                async () => await Purchase.deleteOne({ _id: purchase._id })
            );

            const generalLedgerEntries = [
                {
                    BusinessId,
                    individualAccountId: vendorIndividualAccount.mergedInto !== null ? vendorIndividualAccount.mergedInto : vendorIndividualAccount._id,
                    details: purchaseItems.length === 1 ? ` ${productName}` : `Purchase Invoice ${billNo}`,
                    credit: totalPurchaseCost,
                    reference: vendorIndividualAccount.mergedInto !== null ? vendorIndividualAccount.mergedInto : vendorIndividualAccount._id,
                },
            ];

            if (paidAmount > 0) {
                generalLedgerEntries.push({
                    BusinessId,
                    individualAccountId: vendorIndividualAccount.mergedInto !== null ? vendorIndividualAccount.mergedInto : vendorIndividualAccount._id,
                    details: `Payment of ${billNo}`,
                    debit: paidAmount,
                    reference: vendorIndividualAccount.mergedInto !== null ? vendorIndividualAccount.mergedInto : vendorIndividualAccount._id,
                });
            }

            await GeneralLedger.create(generalLedgerEntries);

            res.status(201).json(new ApiResponse(201, { purchase, totalPurchaseCost }, "Purchase recorded successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `Transaction failed: ${error.message}`);
    }
});

const registerPurchaseReturn = asyncHandler(async (req, res) => {
    const { vendorSupplierId, vendorCompanyId, returnItems, returnReason } = req.body;
    const user = req.user;

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            // Validate input
            if (!returnItems || !returnItems.length) {
                throw new ApiError(400, "Return Items Required!");
            }

            // Validate vendor
            let vendorIndividualAccount;
            if (vendorCompanyId && !vendorSupplierId) {
                vendorIndividualAccount = await IndividualAccount.findOne({ companyId: vendorCompanyId });
            } else if (!vendorCompanyId && vendorSupplierId) {
                vendorIndividualAccount = await IndividualAccount.findOne({ supplierId: vendorSupplierId });
            }

            if (!vendorIndividualAccount) {
                throw new ApiError(404, "Vendor account not found!");
            }

            // Process return items
            let processedReturnItems = [];
            let totalPurchasePrice = 0;
            let productName;

            for (const item of returnItems) {
                const { productId, quantity } = item;

                const product = await Product.findById(productId);
                if (!product) {
                    throw new ApiError(404, `Product not found for ID: ${productId}`);
                }

                productName = product.productName;

                // Calculate purchase price for returned items
                const purchasePrice = Number(product.productPurchasePrice) * Number(quantity);
                totalPurchasePrice += purchasePrice;

                // Deduct from inventory
                const originalProductQuantity = product.productTotalQuantity;
                product.productTotalQuantity -= (Number(quantity) * product.productPack);
                if (product.productTotalQuantity < 0) {
                    throw new ApiError(400, `Invalid return quantity for product ID: ${productId}`);
                }

                transaction.addOperation(
                    async () => await product.save(),
                    async () => {
                        product.productTotalQuantity = originalProductQuantity;
                        await product.save();
                    }
                );

                processedReturnItems.push({
                    productId,
                    quantity,
                    returnPrice: product.productPurchasePrice,
                });
            }

            // Update vendor account
            const originalVendorBalance = vendorIndividualAccount.accountBalance;
            vendorIndividualAccount.accountBalance -= totalPurchasePrice;

            if (vendorIndividualAccount.mergedInto !== null) {
                const mergedIndividualAccount = await IndividualAccount.findById(
                    vendorIndividualAccount.mergedInto
                );
                mergedIndividualAccount.accountBalance -= totalPurchasePrice;
                await mergedIndividualAccount.save();
            }

            transaction.addOperation(
                async () => await vendorIndividualAccount.save(),
                async () => {
                    vendorIndividualAccount.accountBalance = originalVendorBalance;
                    await vendorIndividualAccount.save();
                }
            );

            // Update inventory account
            const inventoryAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Inventory",
            });

            if (!inventoryAccount) {
                throw new ApiError(404, "Inventory account not found!");
            }

            const originalInventoryBalance = inventoryAccount.accountBalance;
            inventoryAccount.accountBalance -= totalPurchasePrice;

            transaction.addOperation(
                async () => await inventoryAccount.save(),
                async () => {
                    inventoryAccount.accountBalance = originalInventoryBalance;
                    await inventoryAccount.save();
                }
            );

            // Update cash account if refund is made
            const accountPayableAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Account Payables",
            });

            if (!accountPayableAccount) {
                throw new ApiError(404, "Account Payables account not found!");
            }

            const originalAccountPayableBalance = accountPayableAccount.accountBalance;
            accountPayableAccount.accountBalance -= totalPurchasePrice;

            transaction.addOperation(
                async () => await accountPayableAccount.save(),
                async () => {
                    accountPayableAccount.accountBalance = originalAccountPayableBalance;
                    await accountPayableAccount.save();
                }
            );

            // Record transaction in General Ledger
            await GeneralLedger.create({
                BusinessId,
                individualAccountId: vendorIndividualAccount.mergedInto !== null ? vendorIndividualAccount.mergedInto : vendorIndividualAccount._id,
                details: returnItems.length === 1 ? `Purchase Return of ${productName}` : `Purchase Return of ${returnItems.length} items`,
                debit: totalPurchasePrice,
                description: returnReason,
                reference: vendorIndividualAccount.mergedInto !== null ? vendorIndividualAccount.mergedInto : vendorIndividualAccount._id,
            });

            res.status(201).json(new ApiResponse(201, { processedReturnItems, returnReason }, "Purchase return recorded successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});


const getPurchases = asyncHandler(async (req, res) => {
    const { vendorSupplierId, vendorCompanyId, startDate, endDate, status } = req.query;

    const user = req.user;

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;

    // Build the filter query
    const query = { BusinessId };

    if (vendorSupplierId) query.vendorSupplierId = vendorSupplierId;
    if (vendorCompanyId) query.vendorCompanyId = vendorCompanyId;
    if (status) query.status = { $in: status.split(",") };
    if (startDate && endDate) {
        query.purchaseDate = {
            $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
    }

    // Fetch purchases with vendor details
    const purchases = await Purchase.find(query)
        .populate({
            path: "vendorSupplierId",
            select: "supplierName",
        })
        .populate({
            path: "vendorCompanyId",
            select: "companyName",
        })
        .populate({
            path: "purchaseItems.productId",
            select: "productName productCode",
        })
        .sort({ createdAt: -1 })
        .lean();

    // Calculate total quantity for each purchase
    const purchasesWithTotalQuantity = purchases.map((purchase) => {
        const totalQuantity = purchase.purchaseItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        return { ...purchase, totalQuantity };
    });

    return res.status(200).json(new ApiResponse(200, purchasesWithTotalQuantity, "Purchases retrieved successfully!"));
});

export {
    registerPurchase,
    registerPurchaseReturn,
    getPurchases,
};