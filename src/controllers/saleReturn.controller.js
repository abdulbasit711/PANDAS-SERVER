
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SaleReturn } from "../models/sales/saleReturn.model.js";
import { Product } from "../models/product/product.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";
import { GeneralLedger } from "../models/accounts/generalLedger.model.js";
import { TransactionManager } from "../utils/TransactionManager.js";
import { Bill } from "../models/bills/bill.model.js";

const registerSaleReturn = asyncHandler(async (req, res) => {
    const { customer, billId, returnType, returnItems, totalReturnAmount, returnReason } = req.body;
    const user = req.user;

    // console.log(returnType, returnItems, returnItems.length, totalReturnAmount)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            // Validate return type and items
            if (!returnType || !returnItems || !returnItems.length || !totalReturnAmount) {
                throw new ApiError(400, "Required fields are missing!");
            }

            if (returnType === 'againstBill' && !billId) {
                throw new ApiError(400, "Bill ID is required for return against bill!");
            }

            // Calculate total purchase price for returned items and update inventory
            let totalPurchasePrice = 0;
            const processedReturnItems = [];
            for (const item of returnItems) {
                const { productId, quantity, billItemUnit } = item;
                const product = await Product.findById(productId);
                if (!product) {
                    throw new ApiError(404, `Product not found for ID: ${productId}`);
                }
                // console.log('quantity', quantity)
                // console.log('billItemUnit', billItemUnit)
                const totalQuantity = (Number(quantity) * Number(product?.productPack)) + Number(billItemUnit)

                // Calculate purchase price for returned items
                const purchasePrice = await Product.calculatePurchasePriceForReturn(productId, totalQuantity);
                totalPurchasePrice += purchasePrice;

                // Update product quantity in inventory

                const originalProductQuantity = product.productTotalQuantity;
                product.productTotalQuantity += quantity;

                transaction.addOperation(
                    async () => await product.save(),
                    async () => {
                        product.productTotalQuantity = originalProductQuantity;
                        await product.save();
                    }
                );

                const returnPrice = product.salePriceDetails && product.salePriceDetails.length > 0
                    ? product.salePriceDetails[0].salePrice1
                    : 0;

                // Add returnPrice to the item
                processedReturnItems.push({
                    productId,
                    quantity,
                    returnPrice: returnPrice, // Or calculate the return price
                    returnUnits: billItemUnit
                });
            }


            // Find the bill document if return is against bill
            let billDoc = null;
            if (returnType === 'againstBill') {
                billDoc = await Bill.findOne({ BusinessId: BusinessId, billNo: billId });
                if (!billDoc) {
                    throw new ApiError(404, `Bill not found for billNo: ${billId}`);
                }

                // For each returned item, reduce the quantity in billItems
                for (const returnItem of returnItems) {
                    const { productId, quantity, billItemUnit } = returnItem;

                    const product = await Product.findById(productId);

                    const totalQuantity = (Number(quantity) * Number(product?.productPack)) + Number(billItemUnit);

                    // console.log('item: ', billId)
                    // console.log('productId: ', productId)

                    const billItem = billDoc.billItems.find(
                        (item) => item.productId.toString() === productId.toString()
                    );

                    if (!billItem) {
                        throw new ApiError(404, `Product ${product?.productName} not found in bill items`);
                    }

                    // decrease quantity
                    const originalQuantity = billItem.quantity;
                    billItem.quantity -= Number(quantity);
                    const originalUnits = billItem.billItemUnit;
                    billItem.billItemUnit -= Number(billItemUnit)

                    // Add rollback
                    transaction.addOperation(
                        async () => await billDoc.save(),
                        async () => {
                            billItem.quantity = originalQuantity;
                            billItem.billItemUnit = originalUnits
                            await billDoc.save();
                        }
                    );
                }
            }


            // const newBillId = await Bill.findOne({ billNo: billId })

            // Create the sale return record
            const saleReturn = await SaleReturn.create({
                BusinessId,
                customer,
                billId: returnType === 'againstBill' ? billDoc?._id : null,
                returnType,
                returnItems: processedReturnItems,
                totalReturnAmount,
                returnReason,
            });

            // Update inventory account
            const inventoryAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Inventory",
            });

            if (!inventoryAccount) {
                throw new ApiError(404, "Inventory account not found!");
            }

            const originalInventoryBalance = inventoryAccount.accountBalance;
            inventoryAccount.accountBalance += totalPurchasePrice;

            transaction.addOperation(
                async () => await inventoryAccount.save(),
                async () => {
                    inventoryAccount.accountBalance = originalInventoryBalance;
                    await inventoryAccount.save();
                }
            );

            // Update cash and sales revenue accounts
            const cashAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Cash",
            });

            const salesRevenueAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Sales Revenue",
            });

            const customerIndividualAccount = await IndividualAccount.findOne({
                BusinessId,
                customerId: customer,
            });

            if (!cashAccount || !salesRevenueAccount) {
                throw new ApiError(404, "Cash or Sale Revenue accounts not found!");
            }

            const originalCashBalance = cashAccount.accountBalance;
            cashAccount.accountBalance -= totalReturnAmount;

            transaction.addOperation(
                async () => await cashAccount.save(),
                async () => {
                    cashAccount.accountBalance = originalCashBalance;
                    await cashAccount.save();
                }
            );

            const saleRevenueReturn = Number(totalReturnAmount - totalPurchasePrice);

            const originalSalesRevenueBalance = salesRevenueAccount.accountBalance;
            salesRevenueAccount.accountBalance -= saleRevenueReturn;

            transaction.addOperation(
                async () => await salesRevenueAccount.save(),
                async () => {
                    salesRevenueAccount.accountBalance = originalSalesRevenueBalance;
                    await salesRevenueAccount.save();
                }
            );

            // console.log('totalPurchasePrice', totalPurchasePrice)
            // console.log('totalReturnAmount', totalReturnAmount)
            // console.log('saleRevenueReturn', saleRevenueReturn)
            // console.log('billDoc.bollRevenue', billDoc.billRevenue)

            if (returnType === 'againstBill') {

                const originalBillRevenue = billDoc.billRevenue
                billDoc.billRevenue -= Number(saleRevenueReturn)
                const originalBillAmount = billDoc.totalAmount
                billDoc.totalAmount -= Number(totalReturnAmount)

                // Handle paidAmount depending on bill status
                const originalPaidAmount = billDoc.paidAmount;

                if (billDoc.billStatus === 'paid') {
                    // Fully paid → decrease paidAmount same as return
                    billDoc.paidAmount = Math.max(0, billDoc.paidAmount - Number(totalReturnAmount));

                    // If paid drops below total, mark as partially paid
                    if (billDoc.paidAmount < billDoc.totalAmount) {
                        billDoc.billStatus = 'partiallypaid';
                    }

                } else if (billDoc.billStatus === 'partiallypaid') {
                    // Cap paidAmount so it doesn't exceed new totalAmount
                    if (billDoc.paidAmount > billDoc.totalAmount) {
                        billDoc.paidAmount = billDoc.totalAmount;
                    }

                    // If paid == total, mark as fully paid
                    if (billDoc.paidAmount === billDoc.totalAmount) {
                        billDoc.billStatus = 'paid';
                    }

                } else if (billDoc.billStatus === 'unpaid') {
                    // Just ensure no overpayment by mistake
                    billDoc.paidAmount = 0;
                }

                transaction.addOperation(
                    async () => await billDoc.save(),
                    async () => {
                        billDoc.billRevenue = originalBillRevenue;
                        billDoc.totalAmount = originalBillAmount;
                        billDoc.paidAmount = originalPaidAmount;
                        await billDoc.save();
                    }
                );

            }

            //Update customer account
            const originalCustomerBalance = customerIndividualAccount.accountBalance;
            customerIndividualAccount.accountBalance -= totalReturnAmount;

            if (customerIndividualAccount.mergedInto !== null) {
                const mergedIntoAccount = await IndividualAccount.findById(customerIndividualAccount.mergedInto);
                mergedIntoAccount.accountBalance -= totalReturnAmount
                await mergedIntoAccount.save();
            }

            transaction.addOperation(
                async () => await customerIndividualAccount.save(),
                async () => {
                    customerIndividualAccount.accountBalance = originalCustomerBalance;
                    await customerIndividualAccount.save();
                }
            )

            // Record the transaction in the general ledger
            if (customer) {
                await GeneralLedger.create({
                    BusinessId,
                    individualAccountId: customerIndividualAccount.mergedInto !== null ? customerIndividualAccount.mergedInto : customerIndividualAccount._id,
                    details: `Sale Return for ${returnType === 'againstBill' ? `Bill ${billId}` : 'Direct Return'}`,
                    credit: totalReturnAmount,
                    reference: customerIndividualAccount.mergedInto !== null ? customerIndividualAccount.mergedInto : customerIndividualAccount._id,
                });
            }
            res.status(201).json(new ApiResponse(201, saleReturn, "Sale return created successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `Transaction failed: ${error.message}`);
    }
});

const getSaleReturns = asyncHandler(async (req, res) => {
    const { returnType, customer, startDate, endDate } = req.query;

    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;

    // Build the filter query
    const query = { BusinessId };

    if (returnType) query.returnType = returnType;
    if (customer) query.customer = customer;
    if (startDate && endDate) {
        query.returnDate = {
            $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
        };
    }

    const saleReturns = await SaleReturn.find(query)
        .populate('customer', 'customerName')
        .populate('billId', 'billNo')
        .sort({ returnDate: -1 })
        .lean();

    res.status(200).json(new ApiResponse(200, saleReturns, "Sale returns retrieved successfully!"));
});

export {
    registerSaleReturn,
    getSaleReturns
};