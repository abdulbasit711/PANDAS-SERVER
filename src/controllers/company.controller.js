import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Company } from "../models/company.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";
import { AccountSubCategory } from "../models/accounts/accountSubCategory.model.js";

import { TransactionManager } from "../utils/TransactionManager.js";

const registerCompany = asyncHandler(async (req, res) => {
    const { companyName, mobileNo, phoneNo, companyDiscount, faxNo, email, companyRegion } = req.body;

    if (!companyName) {
        throw new ApiError(400, "Required fields missing!");
    }

    const user = req.user;
    if (!user || !user.BusinessId) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;
    const accountSubCategoryName = "Current Liability";

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
                individualAccountName: companyName,
                accountBalance: 0,
                parentAccount: accountSubCategory._id
            });

            transaction.addOperation(
                async () => await individualAccount.save(),
                async () => await IndividualAccount.findByIdAndDelete(individualAccount._id)
            );

            // Create Company
            const company = await Company.create({
                BusinessId,
                ledgerId: individualAccount._id,
                companyName,
                mobileNo,
                phoneNo,
                companyDiscount,
                faxNo,
                email,
                companyRegion
            });

            transaction.addOperation(
                async () => await company.save(),
                async () => await Company.findByIdAndDelete(company._id)
            );

            // Link company to individual account
            individualAccount.companyId = company._id;
            await individualAccount.save();

            const createdCompany = await Company.findById(company._id).populate('ledgerId', 'individualAccountName accountBalance');

            return res.status(201).json(
                new ApiResponse(200, createdCompany, "Company added successfully")
            );
        });
    } catch (error) {
        throw new ApiError(500, `Transaction failed: ${error.message}`);
    }
});


const updateCompanyDetails = asyncHandler(async (req, res) => {
  const { companyId, ...updatedDetails } = req.body;

  if (!companyId) {
    throw new ApiError(400, "Company ID is required for updating details!");
  }

  const user = req.user;
  if (!user || !user.BusinessId) {
    throw new ApiError(401, "Authorization failed!");
  }

  const transactionManager = new TransactionManager();

  try {
    await transactionManager.run(async (transaction) => {
      // Find company by ID
      const company = await Company.findOne({
        _id: companyId,
        BusinessId: user.BusinessId,
      });

      if (!company) {
        throw new ApiError(404, "Company not found!");
      }

      // Update individual account name if company name is changing
      if (updatedDetails.companyName && updatedDetails.companyName !== company.companyName) {
        const individualAccount = await IndividualAccount.findOne({ _id: company.ledgerId });

        if (individualAccount) {
          transaction.addOperation(
            async () => {
              individualAccount.individualAccountName = updatedDetails.companyName;
              await individualAccount.save();
            },
            async () => {
              individualAccount.individualAccountName = company.companyName;
              await individualAccount.save();
            }
          );
        }
      }

      // Update company details
      Object.keys(updatedDetails).forEach((key) => {
        if (updatedDetails[key] !== undefined) {
          company[key] = updatedDetails[key];
        }
      });

      transaction.addOperation(
        async () => await company.save(),
        async () => await Company.findByIdAndUpdate(companyId, company.toObject())
      );

      return res.status(200).json(
        new ApiResponse(200, company, "Company details updated successfully")
      );
    });
  } catch (error) {
    throw new ApiError(500, `Transaction failed: ${error.message}`);
  }
});


const getAllCompanies = asyncHandler( async (req, res) => {
  try {
    const { BusinessId } = req.user;



    if (!BusinessId) {
      return res.status(400).json({
        success: false,
        message: 'BusinessId is missing in the request.',
      });
    }

    const companies = await Company.find({ BusinessId });

    return res.status(200).json({
      success: true,
      message: 'Company retrieved successfully.',
      data: companies,
    });
  } catch (error) {
    console.error('Error fetching Companies:', error);

    // Return an error response
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve Companies.',
      error: error.message,
    });
  }
})


export {
    registerCompany,
    getAllCompanies,
    updateCompanyDetails
}