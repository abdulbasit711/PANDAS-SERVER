import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Supplier } from "../models/supplier.model.js";
import { AccountSubCategory } from "../models/accounts/accountSubCategory.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";

const registerSupplier = asyncHandler(async (req, res) => {

    const { supplierName, mobileNo, phoneNo, faxNo, email, cnic, supplierRegion } = req.body

    // console.log(customerName, ntnNumber, mobileNo, phoneNo, faxNo, email, cnic, customerRegion, customerFlag);

    
    if (!supplierName) {
        throw new ApiError(400, "Required fields missing!");
    }
    
    const user = req.user;
    const BusinessId = user.BusinessId;
    // console.log(user.BusinessId._id)
    
    if( !user ) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const accountSubCategoryName = 'Current Liability'

    const accountSubCategory = await AccountSubCategory.findOne({
      $and: [{BusinessId}, {accountSubCategoryName}]
    })

    if (!accountSubCategory) {
        throw new ApiError(404, "Account Sub-Category not found!");
    }

    const individualAccount = await IndividualAccount.create({
      BusinessId: user?.BusinessId,
      individualAccountName: supplierName,
      accountBalance: 0,
      parentAccount: accountSubCategory._id
    })
    
    const createdIndividualAccount = await IndividualAccount.findById(individualAccount._id)

    if(!createdIndividualAccount) {
        throw new ApiError(500, "Failed to create Individual Account! something went wrong")
    }
    
    const supplier = await Supplier.create({
        BusinessId: user?.BusinessId,
        ledgerId: createdIndividualAccount._id,
        supplierName,
        mobileNo,
        phoneNo,
        faxNo,
        email,
        cnic,
        supplierRegion
    })

    const createdSupplier = await Supplier.findById(supplier._id).populate('ledgerId', 'individualAccountName accountBalance')

    createdIndividualAccount.supplierId = createdSupplier._id

    await createdIndividualAccount.save()

    if(!createdSupplier) {
        throw new ApiError(500, "Failed to create Supplier! something went wrong")
    }

    return res.status(201).json(
        new ApiResponse(200, createdSupplier, "Supplier created successfully")
    )
})

const updateSupplierDetails = asyncHandler(async (req, res) => {
  const { supplierId, ...updatedDetails } = req.body;

  if (!supplierId) {
    throw new ApiError(400, "Supplier ID is required for updating details!");
  }

  const user = req.user;

  if (!user || !user.BusinessId) {
    throw new ApiError(401, "Authorization failed!");
  }

  const supplier = await Supplier.findOne({
    _id: supplierId,
    BusinessId: user.BusinessId,
  });

  if (!supplier) {
    throw new ApiError(404, "Supplier not found!");
  }

  Object.keys(updatedDetails).forEach((key) => {
    if (updatedDetails[key] !== undefined) {
        supplier[key] = updatedDetails[key];
    }
  });

  await supplier.save();

  return res
    .status(200)
    .json(new ApiResponse(200, supplier, "Supplier details updated successfully"));
});


const getAllSuppliers = asyncHandler( async (req, res) => {
  try {
    const { BusinessId } = req.user;



    if (!BusinessId) {
      return res.status(400).json({
        success: false,
        message: 'BusinessId is missing in the request.',
      });
    }

    const suppliers = await Supplier.find({ BusinessId });

    return res.status(200).json({
      success: true,
      message: 'Suppliers retrieved successfully.',
      data: suppliers,
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);

    // Return an error response
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve suppliers.',
      error: error.message,
    });
  }
})


export {
    registerSupplier,
    getAllSuppliers,
    updateSupplierDetails
}