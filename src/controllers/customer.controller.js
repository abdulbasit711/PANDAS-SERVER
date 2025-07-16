import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Customer } from "../models/customer.model.js";
import { AccountSubCategory } from "../models/accounts/accountSubCategory.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";

import { TransactionManager } from "../utils/TransactionManager.js";

const registerCustomer = asyncHandler(async (req, res) => {
    const { customerName, ntnNumber, mobileNo, phoneNo, faxNo, email, cnic, customerRegion, customerFlag } = req.body;

    if (!customerName) {
        throw new ApiError(400, "Required fields missing!");
    }

    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;
    const accountSubCategoryName = "Current Asset";

    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            // Find Account Sub-Category
            const accountSubCategory = await AccountSubCategory.findOne({ BusinessId, accountSubCategoryName });
            if (!accountSubCategory) {
                throw new ApiError(404, "Account Sub-Category not found!");
            }

            // Create Individual Account
            const individualAccount = await IndividualAccount.create({
                BusinessId,
                individualAccountName: customerName,
                accountBalance: 0,
                parentAccount: accountSubCategory._id
            });

            transaction.addOperation(
                async () => await individualAccount.save(),
                async () => await IndividualAccount.deleteOne({ _id: individualAccount._id })
            );

            // Create Customer
            const customer = await Customer.create({
                BusinessId,
                ledgerId: individualAccount._id,
                customerName,
                ntnNumber,
                mobileNo,
                phoneNo,
                faxNo,
                email,
                cnic,
                customerRegion,
                customerFlag
            });

            transaction.addOperation(
                async () => await customer.save(),
                async () => await Customer.deleteOne({ _id: customer._id })
            );

            // Link Customer ID to Individual Account
            individualAccount.customerId = customer._id;
            transaction.addOperation(
                async () => await individualAccount.save(),
                async () => {
                    individualAccount.customerId = null;
                    await individualAccount.save();
                }
            );

            const createdCustomer = await Customer.findById(customer._id).populate('ledgerId', 'individualAccountName accountBalance');

            return res.status(201).json(new ApiResponse(201, createdCustomer, "Customer created successfully"));
        });
    } catch (error) {
        throw new ApiError(500, `Transaction failed: ${error.message}`);
    }
});


const updateCustomerDetails = asyncHandler(async (req, res) => {
    const { customerId, ...updatedDetails } = req.body;

    if (!customerId) {
        throw new ApiError(400, "Customer ID is required for updating details!");
    }

    const user = req.user;
    if (!user || !user.BusinessId) {
        throw new ApiError(401, "Authorization failed!");
    }

    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            // Find the customer
            const customer = await Customer.findOne({ _id: customerId, BusinessId: user.BusinessId });
            if (!customer) {
                throw new ApiError(404, "Customer not found or does not belong to your business!");
            }

            // Store previous values for rollback
            const previousDetails = {};
            Object.keys(updatedDetails).forEach((key) => {
                if (updatedDetails[key] !== undefined) {
                    previousDetails[key] = customer[key];
                    customer[key] = updatedDetails[key];
                }
            });

            // Add update operation with rollback
            transaction.addOperation(
                async () => await customer.save(),
                async () => {
                    Object.assign(customer, previousDetails);
                    await customer.save();
                }
            );

            return res.status(200).json(new ApiResponse(200, customer, "Customer details updated successfully"));
        });
    } catch (error) {
        throw new ApiError(500, `Transaction failed: ${error.message}`);
    }
});



// Controller to get customers
const getAllCustomers = asyncHandler( async (req, res) => {
  try {
    const { BusinessId } = req.user;



    if (!BusinessId) {
      return res.status(400).json({
        success: false,
        message: 'BusinessId is missing in the request.',
      });
    }

    // Fetch customers for the specified BusinessId
    const customers = await Customer.find({ BusinessId });

    // Return the customers with a success message
    return res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully.',
      data: customers,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);

    // Return an error response
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve customers.',
      error: error.message,
    });
  }
})


export {
    registerCustomer,
    getAllCustomers,
    updateCustomerDetails
}