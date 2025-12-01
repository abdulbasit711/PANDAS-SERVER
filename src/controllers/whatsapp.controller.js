// controllers/whatsapp.controller.js
import { Account } from "../models/accounts/account.model.js";
import { GeneralLedger } from "../models/accounts/generalLedger.model.js";
import { Customer } from "../models/customer.model.js";
import mongoose from "mongoose";
import {
    initWhatsapp,
    getQrCode,
    sendWhatsappMessage,
    checkWhatsappStatus,
} from "../services/whatsapp.service.js";

export const initializeWhatsapp = async (req, res) => {
    try {
        await initWhatsapp();
        res.status(200).json({ message: "WhatsApp initialized successfully." });
    } catch (error) {
        console.error("Error initializing WhatsApp:", error);
        res.status(500).json({ error: "Failed to initialize WhatsApp" });
    }
};

export const fetchQrCode = async (req, res) => {
    try {
        const qr = await getQrCode();
        res.status(200).json(qr);
    } catch (error) {
        console.error("Error fetching QR:", error);
        res.status(500).json({ error: "Failed to fetch QR" });
    }
};

export const checkStatus = async (req, res) => {
    try {
        const status = await checkWhatsappStatus();
        res.status(200).json(status);
    } catch (error) {
        console.error("Error checking status:", error);
        res.status(500).json({ error: "Failed to check status" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { number, message } = req.body;
        const result = await sendWhatsappMessage(number, message);
        res.status(200).json(result);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Failed to send WhatsApp message" });
    }
};


export const getCustomerReceivables = async (user) => {
    try {
        // Step 1: Fetch all accounts with subcategories and individual accounts
        const accounts = await Account.aggregate([
            {
                $lookup: {
                    from: "accountsubcategories",
                    localField: "_id",
                    foreignField: "parentAccount",
                    as: "subCategories",
                },
            },
            {
                $unwind: { path: "$subCategories", preserveNullAndEmptyArrays: true },
            },
            {
                $lookup: {
                    from: "individualaccounts",
                    let: { subCategoryId: "$subCategories._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$parentAccount", "$$subCategoryId"] },
                            },
                        },
                    ],
                    as: "subCategories.individualAccounts",
                },
            },
            {
                $group: {
                    _id: "$_id",
                    accountName: { $first: "$accountName" },
                    BusinessId: { $first: "$BusinessId" },
                    subCategories: { $push: "$subCategories" },
                },
            },
        ]);

        // Step 2: Find "Asset" account
        const assetAccount = accounts.find((acc) => acc.accountName === "Asset");
        if (!assetAccount) return { message: "No Asset account found." };

        // Step 3: Find "Current Asset" subcategory
        const currentAssetSubCategory = assetAccount.subCategories.find(
            (sub) => sub.accountSubCategoryName === "Current Asset"
        );
        if (!currentAssetSubCategory)
            return { message: "No Current Asset subcategory found." };

        // Step 4: Filter only customer accounts (customerId != null)
        const customerAccounts = (currentAssetSubCategory.individualAccounts || []).filter(
            (acc) => acc.customerId !== null
        );

        if (customerAccounts.length === 0)
            return { message: "No customer receivable accounts found." };

        // Step 5: Get general ledgers for the business
        const generalLedgers = await GeneralLedger.find().populate("individualAccountId");

        // Step 6: Calculate balances
        const receivables = [];

        for (const account of customerAccounts) {
            const accountLedgers = generalLedgers.filter(
                (entry) =>
                    entry.reference?.toString() === account._id.toString() &&
                    entry.individualAccountId?.individualAccountName !== "Sales Revenue"
            );

            const totalDebit = accountLedgers.reduce(
                (sum, entry) => sum + (entry.debit || 0),
                0
            );
            const totalCredit = accountLedgers.reduce(
                (sum, entry) => sum + (entry.credit || 0),
                0
            );
            const balance = totalDebit - totalCredit;

            if (balance > 100) {
                // Step 7: Fetch customer details using customerId
                const customer = await Customer.findById(account.customerId).lean();

                receivables.push({
                    accountId: account._id,
                    accountName: account.individualAccountName,
                    customerId: account.customerId,
                    totalDebit,
                    totalCredit,
                    balance,
                    customerName: customer?.customerName || "Unknown",
                    mobileNo: customer?.mobileNo || null
                });
            }
        }

        return receivables;
    } catch (error) {
        console.error("❌ Error fetching customer receivables:", error);
        return { message: "Error calculating customer receivables." };
    }
};