import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Account } from "../models/accounts/account.model.js";
import { AccountSubCategory } from "../models/accounts/accountSubCategory.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";
import { AccountReceivable } from "../models/accounts/accountsReceivables.model.js";
import { GeneralLedger } from "../models/accounts/generalLedger.model.js";
import { TransactionManager } from "../utils/TransactionManager.js";
import { Product } from "../models/product/product.model.js"
import { Bill } from "../models/bills/bill.model.js";

const registerAccount = asyncHandler(async (req, res) => {

    const { accountName } = req.body

    // console.log(customerName, ntnNumber, mobileNo, phoneNo, faxNo, email, cnic, customerRegion, customerFlag);


    if (!accountName) {
        throw new ApiError(400, "Required fields missing!");
    }

    const user = req.user;
    const BusinessId = user.BusinessId
    // console.log(user.BusinessId._id)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const accountExists = await Account.findOne({
        $and: [{ BusinessId }, { accountName }]
    })

    if (accountExists) {
        throw new ApiError(409, "Account already exists!")
    }

    const account = await Account.create({
        BusinessId: user?.BusinessId,
        accountName
    })

    const createdAccount = await Account.findById(account._id)

    if (!createdAccount) {
        throw new ApiError(500, "Failed to create Account! something went wrong")
    }

    return res.status(201).json(
        new ApiResponse(200, createdAccount, "Account created successfully")
    )
})

const updateAccount = asyncHandler(async (req, res) => {
    const { accountId, accountName } = req.body;

    if (!accountId) {
        throw new ApiError(400, "Account ID is required for updating details!");
    }

    if (!accountName) {
        throw new ApiError(400, "Account Name is required for updating details!");
    }

    const user = req.user;

    if (!user || !user.BusinessId) {
        throw new ApiError(401, "Authorization failed!");
    }

    const account = await Account.findById({ _id: accountId });

    if (!account) {
        throw new ApiError(404, "Account not found or does not belong to your business!");
    }

    account.accountName = accountName;

    await account.save();

    return res
        .status(200)
        .json(new ApiResponse(200, account, "Account details updated successfully"));
});

const getAccounts = asyncHandler(async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            throw new ApiError(401, "Unauthorized request.");
        }

        const { BusinessId } = user;

        if (!BusinessId) {
            throw new ApiError(400, "BusinessId is missing in the request.");
        }

        console.log(`BusinessId: ${BusinessId}`)
        // Aggregation pipeline
        const accounts = await Account.aggregate([
            // Match Accounts by BusinessId
            { $match: { BusinessId: new mongoose.Types.ObjectId(BusinessId) } },

            // Lookup AccountSubCategories for each Account
            {
                $lookup: {
                    from: "accountsubcategories", // Collection for AccountSubCategory
                    localField: "_id",
                    foreignField: "parentAccount",
                    as: "subCategories",
                },
            },

            // Unwind subCategories array to process each subCategory individually
            { $unwind: { path: "$subCategories", preserveNullAndEmptyArrays: true } },

            // Lookup individualAccounts for each AccountSubCategory
            {
                $lookup: {
                    from: "individualaccounts", // Collection for individualAccount
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

            // Group back to include all subCategories for each account
            {
                $group: {
                    _id: "$_id",
                    accountName: { $first: "$accountName" },
                    BusinessId: { $first: "$BusinessId" },
                    subCategories: { $push: "$subCategories" },
                },
            },

            // Exclude null or empty subCategories array (optional)
            {
                $project: {
                    _id: 1,
                    accountName: 1,
                    BusinessId: 1,
                    subCategories: {
                        $filter: {
                            input: "$subCategories",
                            as: "subCategory",
                            cond: { $ne: ["$$subCategory", null] },
                        },
                    },
                },
            },
        ]);

        return res
            .status(200)
            .json(new ApiResponse(200, accounts, "Accounts fetched successfully"));
    } catch (error) {
        console.error("Error fetching accounts:", error);
        throw new ApiError(500, `Failed to retrieve accounts. ${error.message}`)
    }
});


const registerSubAccount = asyncHandler(async (req, res) => {

    const { accountSubCategoryName, parentAccount } = req.body

    // console.log(customerName, ntnNumber, mobileNo, phoneNo, faxNo, email, cnic, customerRegion, customerFlag);


    if (!accountSubCategoryName || !parentAccount) {
        throw new ApiError(400, "Required fields missing!");
    }

    const user = req.user;
    const BusinessId = user.BusinessId
    // console.log(user.BusinessId._id)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const subAccountExists = await AccountSubCategory.findOne({
        $and: [{ BusinessId }, { accountSubCategoryName }]
    })

    if (subAccountExists) {
        throw new ApiError(409, "Account already exists!")
    }

    const accountSubCategory = await AccountSubCategory.create({
        BusinessId: user?.BusinessId,
        accountSubCategoryName,
        parentAccount
    })

    const createdAccount = await AccountSubCategory.findById(accountSubCategory._id)

    if (!createdAccount) {
        throw new ApiError(500, "Failed to create sub Account! something went wrong")
    }

    return res.status(201).json(
        new ApiResponse(200, createdAccount, "Sub Account created successfully")
    )
})

const updateSubAccount = asyncHandler(async (req, res) => {
    const { subAccountId, accountSubCategoryName } = req.body;

    if (!subAccountId) {
        throw new ApiError(400, "Account ID is required for updating details!");
    }

    if (!accountSubCategoryName) {
        throw new ApiError(400, "Sub Account Name is required for updating details!");
    }

    const user = req.user;

    if (!user || !user.BusinessId) {
        throw new ApiError(401, "Authorization failed!");
    }

    const account = await AccountSubCategory.findById({ _id: subAccountId });

    if (!account) {
        throw new ApiError(404, "Account not found or does not belong to your business!");
    }

    account.accountSubCategoryName = accountSubCategoryName;

    await account.save();

    return res
        .status(200)
        .json(new ApiResponse(200, account, "Sub Account details updated successfully"));
});



const registerIndividualAccount = asyncHandler(async (req, res) => {
    const {
        individualAccountName,
        parentSubCategory,
        customerId,
        supplierId,
        companyId,
        accountBalance
    } = req.body;

    // Check for required fields
    try {
        if (!individualAccountName || !parentSubCategory) {
            throw new ApiError(400, "Required fields missing!");
        }

        if (
            (customerId && supplierId)
            || (customerId && companyId)
            || (supplierId && companyId)
            || (customerId && supplierId && companyId)
        ) {
            throw new ApiError(400, "Only one of customerId, supplierId or companyId should be provided!");
        }

        const user = req.user;

        if (!user) {
            throw new ApiError(401, "Authorization Failed!");
        }

        const BusinessId = user.BusinessId;

        const accountExists = await IndividualAccount.findOne({
            BusinessId,
            individualAccountName
        });

        if (accountExists) {
            throw new ApiError(409, "Account already exists!");
        }

        const individualAccount = await IndividualAccount.create({
            BusinessId,
            individualAccountName,
            accountBalance: accountBalance || 0,
            parentAccount: parentSubCategory,
            customerId: customerId || null,
            supplierId: supplierId || null,
            companyId: companyId || null,
            mergedInto: null
        });

        if (!individualAccount) {
            throw new ApiError(500, "Failed to create Individual Account! Something went wrong.");
        }

        const createdAccount = await IndividualAccount.findById(individualAccount._id)
            .populate('BusinessId', 'businessName')
            .populate('parentAccount', 'accountName')
            .populate('customerId', 'customerName')
            .populate('supplierId', 'supplierName')
            .populate('companyId', 'companyName');

        return res.status(201).json(
            new ApiResponse(201, createdAccount, "Individual Account created successfully")
        );
    } catch (error) {
        throw new ApiError(500, error.message)
    }
});


const updateIndividualAccount = asyncHandler(async (req, res) => {
    const {
        individualAccountId,
        individualAccountName,
        parentSubCategory,
        customerId,
        supplierId,
        companyId,
        accountBalance
    } = req.body;

    const user = req.user;

    try {
        if (!user) {
            throw new ApiError(401, "Authorization Failed!");
        }

        const BusinessId = user.BusinessId;

        if (
            (customerId && supplierId)
            || (customerId && companyId)
            || (supplierId && companyId)
            || (customerId && supplierId && companyId)
        ) {
            throw new ApiError(400, "Only one of customer, supplier or company should be provided!");
        }


        // Validate the account ID
        const account = await IndividualAccount.findOne({ _id: individualAccountId, BusinessId });

        if (!account) {
            throw new ApiError(404, "Account not found or you don't have permission to update this account.");
        }

        // Check if the new name is already taken (if updating name)
        if (individualAccountName && individualAccountName !== account.individualAccountName) {
            const duplicateAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName
            });

            if (duplicateAccount) {
                throw new ApiError(409, "An account with this name already exists!");
            }
        }

        // Update fields if provided in the request body
        account.individualAccountName = individualAccountName || account.individualAccountName;
        account.parentAccount = parentSubCategory || account.parentAccount;
        account.customerId = customerId || account.customerId;
        account.supplierId = supplierId || account.supplierId;
        account.companyId = companyId || account.companyId;
        account.accountBalance = accountBalance !== undefined ? accountBalance : account.accountBalance;

        // Save the updated account
        const updatedAccount = await account.save();

        // Fetch the updated account with populated details
        const populatedAccount = await IndividualAccount.findById(updatedAccount._id)
            .populate('BusinessId', 'businessName')
            .populate('parentAccount', 'accountName')
            .populate('customerId', 'customerName')
            .populate('supplierId', 'supplierName')
            .populate('companyId', 'companyName');

        return res.status(200).json(
            new ApiResponse(200, populatedAccount, "Account updated successfully")
        );
    } catch (error) {
        throw new ApiError(500, error.message)
    }
});

const getAccountReceivables = asyncHandler(async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            throw new ApiError(401, 'Unauthorized request.');
        }

        const BusinessId = user.BusinessId;

        if (!BusinessId) {
            throw new ApiError(400, 'BusinessId is missing in the request.');
        }

        const customerAccounts = await IndividualAccount.find({
            BusinessId,
            customerId: { $exists: true, $ne: null }
        }).select("_id individualAccountName customerId");

        if (!customerAccounts.length)
            return res
                .status(404)
                .json(new ApiResponse(404, [], "No customer accounts found."));

        const customerAccountIds = customerAccounts.map(acc => acc._id);

        // Step 2: fetch all general ledger entries related to these accounts
        const ledgers = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    reference: { $in: customerAccountIds },
                },
            },
            {
                $lookup: {
                    from: "individualaccounts",
                    localField: "reference",
                    foreignField: "_id",
                    as: "account",
                    pipeline: [
                        {
                            $lookup: {
                                from: "customers",
                                localField: "customerId",
                                foreignField: "_id",
                                as: "customer",
                                pipeline: [
                                    {
                                        $project: {
                                            customerName: 1,
                                            mobileNo: 1,
                                            customerRegion: 1,
                                            customerFlag: 1,
                                        },
                                    },
                                ],
                            },
                        },
                        { $addFields: { customer: { $first: "$customer" } } },
                    ],
                },
            },
            { $addFields: { account: { $first: "$account" } } },
            {
                $sort: { createdAt: 1 } // earliest first to detect Opening Balance properly
            }
        ]);

        console.log('ledgers', ledgers.length)

        // Step 3: compute each account’s balance from Opening Balance onwards
        const accountBalances = {};
        for (const entry of ledgers) {
            const accId = entry.individualAccountId.toString();
            const debit = entry.debit || 0;
            const credit = entry.credit || 0;

            if (!accountBalances[accId]) {
                accountBalances[accId] = {
                    balance: 0,
                    customer: entry.account.customer,
                };
            }

            // If it's the opening balance, initialize it properly
            if (entry.details === "Opening Balance") {
                accountBalances[accId].balance = debit - credit;
            } else {
                // Continue calculating based on normal debit/credit
                accountBalances[accId].balance += debit - credit;
            }
        }
        

        // Step 4: calculate total receivables across all customer accounts
        let totalReceivables = 0;
        const perCustomerBalances = [];

        for (const accId in accountBalances) {
            const balance = accountBalances[accId].balance;
            const customer = accountBalances[accId].customer;
            totalReceivables += balance > 0 ? balance : 0; // only positive balances are receivables
            perCustomerBalances.push({
                customerName: customer?.customerName || "N/A",
                customerRegion: customer?.customerRegion || "N/A",
                receivableAmount: balance,
            });
        }

        const accountReceivables = await AccountReceivable.aggregate([
            {
                $match: {
                    BusinessId: new mongoose.Types.ObjectId(BusinessId),
                    status: 'active',
                },
            },
            {
                $lookup: {
                    from: 'customers', // Customer collection name
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                    pipeline: [
                        {
                            $project: {
                                customerName: 1,
                                mobileNo: 1,
                                customerRegion: 1,
                                customerFlag: 1
                            }
                        }
                    ]
                },
            },
            {
                $addFields: {
                    customer: {
                        $first: "$customer",
                    }
                }
            },
            {
                $lookup: {
                    from: 'bills', // Bill collection name
                    localField: 'details',
                    foreignField: '_id',
                    as: 'bill',
                    pipeline: [
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'salesPerson',
                                foreignField: '_id',
                                as: 'salesPerson',
                                pipeline: [
                                    {
                                        $project: {
                                            firstname: 1,
                                            lastname: 1,
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                salesPerson: {
                                    $first: "$salesPerson",
                                }
                            }
                        }
                    ]
                },
            },
            {
                $addFields: {
                    bill: {
                        $first: "$bill",
                    }
                }
            }
        ]).sort({ createdAt: -1 })


        if (!accountReceivables.length) {
            throw new ApiError(404, 'No active account receivables found.');
        }

        return res
            .status(200)
            .json(new ApiResponse(200, {
                accountReceivables,
                totalReceivables,
                perCustomerBalances,
            }, 'Active account receivables fetched successfully.'));
    } catch (error) {
        console.error('Error fetching active account receivables:', error);
        throw new ApiError(500, error.message);
    }
});

const getIndividualAccounts = asyncHandler(async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            throw new ApiError(401, "Unauthorized request.");
        }

        const { BusinessId } = user;

        if (!BusinessId) {
            throw new ApiError(400, "BusinessId is missing in the request.");
        }

        console.log(`BusinessId: ${BusinessId}`)
        // Aggregation pipeline
        const accounts = await IndividualAccount.find({ BusinessId })

        return res
            .status(200)
            .json(new ApiResponse(200, accounts, "Accounts fetched successfully"));
    } catch (error) {
        console.error("Error fetching accounts:", error);
        throw new ApiError(500, `Failed to retrieve accounts. ${error.message}`)
    }
});

const postExpense = asyncHandler(async (req, res) => {
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const { accountId, amount, description } = req.body;

            if (!accountId || !amount) {
                throw new ApiError(400, "Invalid input! Expense Account and amount are required.");
            }

            const user = req.user;
            if (!user) {
                throw new ApiError(401, "Authorization failed!");
            }

            const BusinessId = user.BusinessId;

            // Validate Individual Account
            const account = await IndividualAccount.findOne({ _id: accountId, BusinessId });
            if (!account) {
                throw new ApiError(404, "Individual account not found!");
            }

            const originalBalance = account.accountBalance;
            account.accountBalance += parseInt(amount);

            transaction.addOperation(
                async () => await account.save(),
                async () => {
                    account.accountBalance = originalBalance;
                    await account.save();
                }
            );

            // Create General Ledger Entry
            const glEntry = await GeneralLedger.create([
                {
                    BusinessId,
                    individualAccountId: accountId,
                    details: "Expense Entry",
                    debit: amount,
                    description,
                    reference: accountId
                }
            ]);

            res.status(201).json(new ApiResponse(201, { glEntry }, "Expense posted successfully!"));
        });

    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const postVendorJournalEntry = asyncHandler(async (req, res) => {
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const { vendorAccountId, amount, description, details } = req.body;

            if (!mongoose.Types.ObjectId.isValid(vendorAccountId)) {
                throw new ApiError(400, "Invalid Vendor Account ID format!");
            }

            if (!amount || !vendorAccountId) {
                throw new ApiError(400, "Amount or Vendor Account is Required!");
            }

            const user = req.user;
            if (!user) {
                throw new ApiError(401, "Unauthorized request!");
            }

            const BusinessId = user.BusinessId;

            // Fetch Vendor Account
            const vendorAccount = await IndividualAccount.findOne({
                _id: vendorAccountId,
                BusinessId,
            });

            if (!vendorAccount) {
                throw new ApiError(404, "Vendor account not found!");
            }

            let parentAccount = null;
            if (vendorAccount.mergedInto) {
                parentAccount = await IndividualAccount.findById(vendorAccount.mergedInto)
            }

            // Fetch Cash Account
            const cashAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Cash",
            });

            if (!cashAccount) {
                throw new ApiError(404, "Cash account not found!");
            }

            // Fetch Account Payables Account
            const accountPayables = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Account Payables",
            });

            if (!accountPayables) {
                throw new ApiError(404, "Account Payables account not found!");
            }

            // Capture original balances for rollback
            const originalVendorBalance = vendorAccount.accountBalance;
            const originalCashBalance = cashAccount.accountBalance;
            const originalPayablesBalance = accountPayables.accountBalance;
            let originalParentBalance;
            if (parentAccount) {
                originalParentBalance = parentAccount?.accountBalance
            }

            // Update balances
            vendorAccount.accountBalance -= parseInt(amount);
            cashAccount.accountBalance -= parseInt(amount);
            accountPayables.accountBalance -= parseInt(amount);
            if (parentAccount) parentAccount.accountBalance -= parseInt(amount)

            transaction.addOperation(
                async () => {
                    await vendorAccount.save();
                    await cashAccount.save();
                    await accountPayables.save();
                    if (parentAccount) await parentAccount.save();
                },
                async () => {
                    vendorAccount.accountBalance = originalVendorBalance;
                    cashAccount.accountBalance = originalCashBalance;
                    accountPayables.accountBalance = originalPayablesBalance;
                    if (parentAccount) parentAccount.accountBalance = originalParentBalance
                    await vendorAccount.save();
                    await cashAccount.save();
                    await accountPayables.save();
                    if (parentAccount) await parentAccount.save();
                }
            );

            // Create General Ledger Entries
            await GeneralLedger.create([
                {
                    BusinessId,
                    individualAccountId: vendorAccount.mergedInto !== null ? vendorAccount.mergedInto : vendorAccount._id,
                    details: details || "Cash Given",
                    debit: amount,
                    reference: vendorAccount.mergedInto !== null ? vendorAccount.mergedInto : vendorAccount._id,
                    description
                }
            ]);

            res.status(201).json(new ApiResponse(201, null, "Vendor journal entry posted successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const postCustomerJournalEntry = asyncHandler(async (req, res) => {
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const { customerAccountId, amount, description, details } = req.body;

            console.log('customerAccountId', customerAccountId)
            if (!mongoose.Types.ObjectId.isValid(customerAccountId)) {
                throw new ApiError(400, "Invalid Customer Account ID format!");
            }

            if (!amount || !customerAccountId) {
                throw new ApiError(400, "Amount or Customer Account is Required!");
            }

            const user = req.user;
            if (!user) {
                throw new ApiError(401, "Unauthorized request!");
            }

            const BusinessId = user.BusinessId;

            // Fetch customer Account
            const customerAccount = await IndividualAccount.findOne({
                _id: customerAccountId,
                BusinessId,
            });

            if (!customerAccount) {
                throw new ApiError(404, "Customer account not found!");
            }

            let parentAccount = null;
            if (customerAccount.mergedInto) {
                parentAccount = await IndividualAccount.findById(customerAccount.mergedInto)
            }

            // Fetch Cash Account
            const cashAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Cash",
            });

            if (!cashAccount) {
                throw new ApiError(404, "Cash account not found!");
            }

            // Fetch Account Payables Account
            const accountReceivables = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Account Receivables",
            });

            if (!accountReceivables) {
                throw new ApiError(404, "Account Receivables account not found!");
            }

            // Capture original balances for rollback
            const originalCustomerBalance = customerAccount.accountBalance;
            const originalCashBalance = cashAccount.accountBalance;
            const originalReceivablesBalance = accountReceivables.accountBalance;
            let originalParentBalance;
            if (parentAccount) {
                originalParentBalance = parentAccount?.accountBalance
            }

            // Update balances
            customerAccount.accountBalance -= parseInt(amount);
            cashAccount.accountBalance -= parseInt(amount);
            accountReceivables.accountBalance -= parseInt(amount);
            if (parentAccount) parentAccount.accountBalance -= parseInt(amount)

            transaction.addOperation(
                async () => {
                    await customerAccount.save();
                    await cashAccount.save();
                    await accountReceivables.save();
                    if (parentAccount) await parentAccount.save();
                },
                async () => {
                    customerAccount.accountBalance = originalCustomerBalance;
                    cashAccount.accountBalance = originalCashBalance;
                    accountReceivables.accountBalance = originalReceivablesBalance;
                    if (parentAccount) parentAccount.accountBalance = originalParentBalance
                    await customerAccount.save();
                    await cashAccount.save();
                    await accountReceivables.save();
                    if (parentAccount) await parentAccount.save();
                }
            );

            // Create General Ledger Entries
            await GeneralLedger.create([
                {
                    BusinessId,
                    individualAccountId: customerAccount.mergedInto !== null ? customerAccount.mergedInto : customerAccount._id,
                    details: details || "Cash Received",
                    credit: amount,
                    reference: customerAccount.mergedInto !== null ? customerAccount.mergedInto : customerAccount._id,
                    description
                }
            ]);


            res.status(201).json(new ApiResponse(201, null, "Customer journal entry posted successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});



const getGeneralLedger = asyncHandler(async (req, res) => {
    const user = req.user;

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }


    const generalLedgers = await GeneralLedger.aggregate([
        {
            $match: { BusinessId: new mongoose.Types.ObjectId(user.BusinessId) },
        },
        {
            $lookup: {
                from: "individualaccounts",
                localField: "individualAccountId",
                foreignField: "_id",
                as: "individualAccountDetails",
            },
        },
        {
            $unwind: {
                path: "$individualAccountDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "individualaccounts",
                localField: "reference",
                foreignField: "_id",
                as: "referenceAccountDetails",
            },
        },
        {
            $unwind: {
                path: "$referenceAccountDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "accountsubcategories",
                localField: "individualAccountDetails.parentAccount",
                foreignField: "_id",
                as: "accountSubCategoryDetails",
            },
        },
        {
            $unwind: {
                path: "$accountSubCategoryDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "accounts",
                localField: "accountSubCategoryDetails.parentAccount",
                foreignField: "_id",
                as: "accountDetails",
            },
        },
        {
            $unwind: {
                path: "$accountDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                _id: 1,
                details: 1,
                debit: 1,
                credit: 1,
                description: 1,
                createdAt: 1,
                individualAccount: {
                    _id: "$individualAccountDetails._id",
                    name: "$individualAccountDetails.individualAccountName",
                    balance: "$individualAccountDetails.accountBalance",
                    supplierId: "$individualAccountDetails.supplierId",
                    companyId: "$individualAccountDetails.companyId",
                },
                referenceAccount: {
                    _id: "$referenceAccountDetails._id",
                    name: "$referenceAccountDetails.individualAccountName",
                },
                accountSubCategory: {
                    _id: "$accountSubCategoryDetails._id",
                    name: "$accountSubCategoryDetails.accountSubCategoryName",
                },
                account: {
                    _id: "$accountDetails._id",
                    name: "$accountDetails.accountName",
                },
            },
        },
    ]);

    if (!generalLedgers.length) {
        throw new ApiError(404, "No General Ledger entries found for this business.");
    }

    return res.status(200).json(
        new ApiResponse(200, generalLedgers, "General Ledger fetched successfully")
    );
});


const mergeAccounts = asyncHandler(async (req, res) => {
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const { parentAccountName, childAccountIds, existingParentAccountId } = req.body;

            if (!childAccountIds || !Array.isArray(childAccountIds)) {
                throw new ApiError(400, "Account Id's are required.");
            }

            const user = req.user;
            if (!user) {
                throw new ApiError(401, "Unauthorized request!");
            }

            const BusinessId = user.BusinessId;

            // Validate at least one merging option is provided
            if (!parentAccountName && !existingParentAccountId) {
                throw new ApiError(400, "Either new parent account name or existing parent account must be provided");
            }

            // Validate only one merging option is used
            if (parentAccountName && existingParentAccountId) {
                throw new ApiError(400, "Cannot provide both new parent account name and existing parent account");
            }

            const childAccount = await IndividualAccount.findById(childAccountIds[0]);
            if (!childAccount) {
                throw new ApiError(404, "Child account not found!");
            }

            // Calculate total balance
            let accountBalance = 0;
            for (let i = 0; i < childAccountIds.length; i++) {
                const account = await IndividualAccount.findById(childAccountIds[i]);
                accountBalance += account.accountBalance;
            }

            let parentAccount;
            if (existingParentAccountId) {
                // Case 1: Merge into existing parent account
                parentAccount = await IndividualAccount.findById(existingParentAccountId);
                if (!parentAccount) {
                    throw new ApiError(404, "Existing parent account not found!");
                }

                // Update parent account balance
                parentAccount.accountBalance += accountBalance;
                await parentAccount.save();
            } else {
                // Case 2: Create new parent account (original functionality)
                const subCategory = await AccountSubCategory.findById(childAccount.parentAccount);
                if (!subCategory) {
                    throw new ApiError(404, "Parent subcategory not found!");
                }

                parentAccount = await IndividualAccount.create({
                    BusinessId,
                    individualAccountName: parentAccountName,
                    accountBalance: accountBalance || 0,
                    parentAccount: subCategory._id,
                    companyId: childAccount.companyId,
                    supplierId: childAccount.supplierId,
                    customerId: childAccount.customerId,
                    mergedInto: null
                });
            }

            // Update all child accounts to point to the parent
            for (let i = 0; i < childAccountIds.length; i++) {
                const account = await IndividualAccount.findById(childAccountIds[i]);
                account.mergedInto = parentAccount._id;
                await account.save();
            }

            res.status(201).json(new ApiResponse(201, null, "Accounts merged successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const openAccountBalance = asyncHandler(async (req, res) => {
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const { accountId, amount } = req.body;

            if (!accountId || !amount) {
                throw new ApiError(400, "Invalid input! Account and amount are required.");
            }

            const user = req.user;
            if (!user) {
                throw new ApiError(401, "Authorization failed!");
            }

            const BusinessId = user.BusinessId;

            // Validate Individual Account
            const account = await IndividualAccount.findOne({ _id: accountId, BusinessId });
            if (!account) {
                throw new ApiError(404, "Individual account not found!");
            }

            const originalBalance = account.accountBalance;
            account.accountBalance += parseInt(amount);

            transaction.addOperation(
                async () => await account.save(),
                async () => {
                    account.accountBalance = originalBalance;
                    await account.save();
                }
            );

            let positiveAmount;
            let isNegative = false;
            if (amount < 0) {
                isNegative = true;
                positiveAmount = Math.abs(amount);
            }

            console.log('amount', amount)
            console.log('positiveAmount', positiveAmount)
            console.log('isNegative', isNegative)

            // Create General Ledger Entry
            const glEntry = await GeneralLedger.create([
                {
                    BusinessId,
                    individualAccountId: accountId,
                    details: "Opening Balance",
                    debit: isNegative ? null : parseInt(amount),
                    credit: isNegative ? positiveAmount : null,
                    description: "Opening Balance for the Account",
                    reference: accountId
                }
            ]);


            res.status(201).json(new ApiResponse(201, { glEntry }, "Account Balance Opened successfully!"));
        });

    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const closeAccountBalance = asyncHandler(async (req, res) => {
    const { accountId } = req.body;
    const user = req.user;

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    if (!accountId) {
        throw new ApiError(400, "Account ID is required.");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {

            const lastOpeningEntry = await GeneralLedger.findOne({
                BusinessId,
                individualAccountId: accountId,
                details: "Opening Balance"
            }).sort({ createdAt: -1 }); // Get the latest "Opening Balance" entry

            let ledgerEntries;

            if (!lastOpeningEntry) {
                ledgerEntries = await GeneralLedger.find({
                    BusinessId,
                    individualAccountId: accountId,
                }).sort({ createdAt: 1 });
            } else {
                ledgerEntries = await GeneralLedger.find({
                    BusinessId,
                    individualAccountId: accountId,
                    createdAt: { $gte: lastOpeningEntry.createdAt }
                }).sort({ createdAt: 1 }); // Sort from oldest to newest
            }
            console.log("ledgerEntries: ", ledgerEntries)

            let totalDebit = 0;
            let totalCredit = 0;

            ledgerEntries.forEach(entry => {
                if (entry.debit) {
                    totalDebit += entry.debit;
                }
                if (entry.credit) {
                    totalCredit += entry.credit;
                }
            });
            console.log("total debit: ", totalDebit)
            console.log("total credit: ", totalCredit)

            let closingBalance = totalDebit - totalCredit;

            console.log("Closing balance: ", closingBalance)
            let isDebit = closingBalance > 0;

            if (closingBalance < 0) {
                closingBalance = Math.abs(closingBalance);
            }



            const closingEntry = new GeneralLedger({
                BusinessId,
                individualAccountId: accountId,
                details: "Closing Balance",
                debit: isDebit ? null : closingBalance,
                credit: isDebit ? closingBalance : null,
                reference: accountId,
            });

            transaction.addOperation(
                async () => await closingEntry.save(),
                async () => await GeneralLedger.deleteOne({ _id: closingEntry._id })
            );

            // Get current month and year
            const now = new Date();
            const month = now.toLocaleString('default', { month: 'long' }); // e.g., "March"
            const year = now.getFullYear(); // e.g., "2025"

            const openingEntry = new GeneralLedger({
                BusinessId,
                individualAccountId: accountId,
                details: "Opening Balance",
                debit: isDebit ? closingBalance : null,
                credit: isDebit ? null : closingBalance,
                description: `Opening Balance for ${month} ${year}`,
                reference: accountId
            });

            transaction.addOperation(
                async () => await openingEntry.save(),
                async () => await GeneralLedger.deleteOne({ _id: openingEntry._id })
            );

            // const test = true;
            // if (test) {
            //     throw new ApiError(500, `test error`);
            // }
            res.status(200).json(new ApiResponse(200, { closingEntry, openingEntry }, "Account balance closed successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const adjustAccountBalance = asyncHandler(async (req, res) => {
    const { accountId, debit, credit, reason } = req.body;
    const user = req.user;

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    if (!accountId) {
        throw new ApiError(400, "Account is required.");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {

            const individualAccount = await IndividualAccount.findOne({
                _id: accountId,
                BusinessId,
            });

            if (!individualAccount) {
                throw new ApiError(404, "Individual account not found.");
            }


            const originalBalance = individualAccount.accountBalance;
            individualAccount.accountBalance += parseInt(debit) - parseInt(credit);

            transaction.addOperation(
                async () => await individualAccount.save(),
                async () => {
                    individualAccount.accountBalance = originalBalance;
                    await individualAccount.save();
                }
            );

            const adjustmentEntry = new GeneralLedger({
                BusinessId,
                individualAccountId: accountId,
                details: "Account Balance Adjustment",
                debit,
                credit,
                description: reason,
                reference: accountId,
            });

            transaction.addOperation(
                async () => await adjustmentEntry.save(),
                async () => await GeneralLedger.deleteOne({ _id: adjustmentEntry._id })
            );


            res.status(200).json(new ApiResponse(200, { adjustmentEntry }, "Account balance adjusted successfully!"));
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const getTotalInventory = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw new ApiError(401, "Authorization Failed!");

    const BusinessId = user.BusinessId;

    try {
        const products = await Product.find({ BusinessId });

        let totalInventoryValue = 0;

        products.forEach(product => {
            const { productName, productTotalQuantity, productPack, productPurchasePrice } = product;

            // avoid divide by zero
            const packs = productPack && productPack > 0
                ? productTotalQuantity / productPack
                : 0;

            const purchaseValue = packs * productPurchasePrice;

            console.log(`
        Product: ${productName}
        Total Quantity: ${productTotalQuantity}
        Pack Size: ${productPack}
        Purchase Price (per pack): ${productPurchasePrice}
        Packs: ${packs}
        Purchase Value: ${purchaseValue}
      `);

            totalInventoryValue += purchaseValue;
        });

        console.log("TOTAL INVENTORY VALUE:", totalInventoryValue);

        res.status(200).json(
            new ApiResponse(200, { totalInventoryValue }, "Inventory details fetched successfully!")
        );
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const getPreviousBalance = asyncHandler(async (req, res) => {
    const user = req.user;
    const { customerId } = req.query;

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    if (!customerId) {
        throw new ApiError(400, "Customer ID is required.");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            let individualAccount = await IndividualAccount.findOne({
                BusinessId,
                customerId,
            });

            if (!individualAccount) {
                throw new ApiError(404, "Individual account not found for this customer.");
            }

            // Handle mergedInto recursively
            while (individualAccount.mergedInto) {
                const mergedAccount = await IndividualAccount.findById(individualAccount.mergedInto);

                if (!mergedAccount) {
                    break;
                }

                individualAccount = mergedAccount;
            }

            res.status(200).json(
                new ApiResponse(200, {
                    accountBalance: individualAccount.accountBalance
                }, "Previous balance retrieved successfully!")
            );
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});


const getIncomeStatement = asyncHandler(async (req, res) => {
    try {
        const { startDate, endDate } = req.query; // user provides custom range
        const user = req.user;

        if (!user?.BusinessId) {
            throw new ApiError(401, "Unauthorized or missing BusinessId");
        }
        console.log('startDate, EndDate', startDate, endDate)
        console.log('Query: ', req.query)

        const BusinessId = new mongoose.Types.ObjectId(user.BusinessId);

        // Build date filter (optional)
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                $gt: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        // 1. Get Sales Revenue
        const salesAgg = await Bill.aggregate([
            {
                $match: {
                    BusinessId,
                    ...(startDate && endDate ? { createdAt: dateFilter } : {})
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$billRevenue" }
                }
            }
        ]);
        const totalRevenue = salesAgg[0]?.totalRevenue || 0;

        // 2. Get Expense Accounts (list)
        const expenseAccounts = await IndividualAccount.aggregate([
            {
                $lookup: {
                    from: "accountsubcategories",
                    localField: "parentAccount",
                    foreignField: "_id",
                    as: "subCategory"
                }
            },
            { $unwind: "$subCategory" },
            {
                $match: {
                    BusinessId,
                    "subCategory.accountSubCategoryName": "Expense"
                }
            },
            {
                $project: {
                    _id: 1,
                    accountName: "$individualAccountName"
                }
            }
        ]);

        const expenseAccountIds = expenseAccounts.map(acc => acc._id);

        // 3. Get Expenses grouped by each expense account
        const expenseAgg = await GeneralLedger.aggregate([
            {
                $match: {
                    BusinessId,
                    individualAccountId: { $in: expenseAccountIds },
                    ...(startDate && endDate ? { createdAt: dateFilter } : {})
                }
            },
            {
                $group: {
                    _id: "$individualAccountId",
                    totalExpense: { $sum: "$debit" }
                }
            }
        ]);

        // 4. Map back account names
        const expenseMap = expenseAccounts.reduce((acc, account) => {
            acc[account._id.toString()] = account.accountName;
            return acc;
        }, {});

        const expensesDetailed = expenseAgg.map(item => ({
            accountId: item._id,
            accountName: expenseMap[item._id.toString()] || "Unknown Account",
            totalExpense: item.totalExpense
        }));

        const totalExpenses = expensesDetailed.reduce((sum, e) => sum + e.totalExpense, 0);

        // 5. Net Profit
        const netProfit = totalRevenue - totalExpenses;

        return res.status(200).json(
            new ApiResponse(200, {
                revenue: totalRevenue,
                expenses: expensesDetailed,
                totalExpenses,
                netProfit
            }, "Income Statement generated successfully")
        );

    } catch (error) {
        console.error("Error generating income statement:", error);
        throw new ApiError(500, error.message);
    }
});




export {
    registerAccount,
    updateAccount,
    getAccounts,
    registerSubAccount,
    updateSubAccount,
    registerIndividualAccount,
    updateIndividualAccount,
    getAccountReceivables,
    getIndividualAccounts,
    postExpense,
    postVendorJournalEntry,
    getGeneralLedger,
    postCustomerJournalEntry,
    mergeAccounts,
    openAccountBalance,
    closeAccountBalance,
    adjustAccountBalance,
    getTotalInventory,
    getPreviousBalance,
    getIncomeStatement
}