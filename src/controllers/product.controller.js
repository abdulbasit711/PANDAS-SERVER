import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/product/product.model.js";
import { SalePrice } from "../models/product/salePrices.model.js";
import { StatusOfPrice } from "../models/product/statusOfPrice.model.js";
import { Category } from "../models/product/category.model.js";
import { Type } from "../models/product/type.model.js";
import { Company } from "../models/company.model.js";
import { IndividualAccount } from "../models/accounts/individualAccount.model.js";
import { TransactionManager } from "../utils/TransactionManager.js";
import { generateBarcodeImage, generateBarcodePDF } from '../utils/barcodeService.js';

const registerCategory = asyncHandler(async (req, res) => {

    const { categoryName, categoryDescription } = req.body

    console.log(categoryName, categoryDescription);


    if (!categoryName) {
        throw new ApiError(400, "Required fields missing!");
    }

    const user = req.user;
    const BusinessId = req.user.BusinessId;
    // console.log(user.BusinessId._id)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const categoryExists = await Category.findOne({
        $and: [{ BusinessId }, { categoryName }]
    })

    if (categoryExists) {
        throw new ApiError(409, "Category already exists!")
    }

    const category = await Category.create({
        BusinessId,
        categoryName,
        categoryDescription
    })

    const createdCategory = await Category.findById(category._id)

    if (!createdCategory) {
        throw new ApiError(500, "Failed to create Category! something went wrong")
    }

    return res.status(201).json(
        new ApiResponse(200, createdCategory, "Category created successfully")
    )
})

const getCategories = asyncHandler(async (req, res) => {
    const user = req.user;
    const BusinessId = req.user.BusinessId;
    // console.log(user.BusinessId._id)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const categories = await Category.find({ BusinessId })

    if (!categories) {
        throw new ApiError(500, "Failed to fetch Categories! something went wrong")
    }

    return res.status(200).json(
        new ApiResponse(200, categories, "Categories fetched successfully")
    )
})

const updateCategory = asyncHandler(async (req, res) => {
    const { categoryId, categoryName, categoryDescription } = req.body

    const user = req.user;
    const BusinessId = req.user.BusinessId;
    // console.log(user.BusinessId._id, categoryId, categoryName, categoryDescription)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }


    if (!categoryId) {
        throw new ApiError(400, "Category Id Required!");
    }

    const updatedCategory = await Category.findByIdAndUpdate(categoryId, {
        $set: {
            categoryName: categoryName,
            categoryDescription: categoryDescription
        }
    }, { new: true })

    // console.log(updatedCategory)

    if (!updatedCategory) {
        throw new ApiError(500, "Failed to update Category! something went wrong")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedCategory, "Category updated successfully")
    )
})

const registerType = asyncHandler(async (req, res) => {

    const { typeName, typeDescription } = req.body

    // console.log(typeName, typeDescription );


    if (!typeName) {
        throw new ApiError(400, "Required fields missing!");
    }

    const user = req.user;
    const BusinessId = req.user.BusinessId;
    // console.log(user.BusinessId._id)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const typeExists = await Type.findOne({
        $and: [{ BusinessId }, { typeName }]
    })

    if (typeExists) {
        throw new ApiError(409, "Type already exists!")
    }

    const type = await Type.create({
        BusinessId,
        typeName,
        typeDescription
    })

    const createdType = await Type.findById(type._id)

    if (!createdType) {
        throw new ApiError(500, "Failed to create Type! something went wrong")
    }

    return res.status(201).json(
        new ApiResponse(200, createdType, "Type created successfully")
    )
})

const getTypes = asyncHandler(async (req, res) => {
    const user = req.user;
    const BusinessId = req.user.BusinessId;
    // console.log(user.BusinessId._id)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const types = await Type.find({ BusinessId })

    if (!types) {
        throw new ApiError(500, "Failed to fetch Types! something went wrong")
    }

    return res.status(200).json(
        new ApiResponse(200, types, "Types fetched successfully")
    )
})

const updateType = asyncHandler(async (req, res) => {
    const { typeId, typeName, typeDescription } = req.body

    const user = req.user;
    const BusinessId = req.user.BusinessId;
    // console.log(user.BusinessId._id)

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }


    const updatedType = await Type.findByIdAndUpdate(typeId, {
        $set: {
            typeName: typeName,
            typeDescription: typeDescription
        }
    }, { new: true })

    if (!updatedType) {
        throw new ApiError(500, "Failed to update Type! something went wrong")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedType, "Type updated successfully")
    )
})


const registerProduct = asyncHandler(async (req, res) => {
    const {
        productCode,
        productName,
        categoryId,
        typeId,
        companyId,
        productExpiryDate,
        salePrice1,
        salePrice2,
        salePrice3,
        salePrice4,
        vendorSupplierId,
        vendorCompanyId,
        productDiscountPercentage,
        productPack,
        productUnit,
        quantityUnit,
        packUnit,
        productPurchasePrice,
        status,
        productTotalQuantity
    } = req.body;

    if (!productName || !salePrice1 || !productPurchasePrice) {
        throw new ApiError(400, "Required fields missing!");
    }

    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const productExists = await Product.findOne({
                $and: [
                    { productName },
                    { BusinessId },
                    { productPurchasePrice },
                    { categoryId },
                    { typeId },
                    { companyId },
                    { productCode }
                ]
            });

            if (productExists) {
                throw new ApiError(409, "Product already exists!");
            }

            const company = await Company.findById(vendorCompanyId);
            let purchasePrice = productPurchasePrice;

            if (company?.companyDiscount) {
                const discount = (productPurchasePrice * company.companyDiscount) / 100;
                purchasePrice -= discount;
            }

            const salePrices = await SalePrice.create({
                salePrice1,
                salePrice2,
                salePrice3,
                salePrice4
            });

            if (!salePrices) {
                throw new ApiError(500, "Something went wrong while adding sale price!");
            }

            const productNameCapitalized = productName.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            let finalProductCode = productCode;

            if (!productCode) {
                let isUnique = false;
                let generatedCode;

                while (!isUnique) {
                    generatedCode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();

                    const existing = await Product.findOne({ productCode: generatedCode, BusinessId });
                    if (!existing) {
                        isUnique = true;
                    }
                }

                finalProductCode = generatedCode;
            }

            // console.log('finalProductCode', finalProductCode)

            const product = await Product.create({
                BusinessId,
                productCode: finalProductCode,
                productName: productNameCapitalized,
                categoryId,
                typeId,
                companyId,
                productExpiryDate,
                salePricesId: salePrices._id,
                vendorSupplierId,
                vendorCompanyId,
                productDiscountPercentage,
                productPack,
                quantityUnit,
                productUnit,
                packUnit,
                productPurchasePrice: purchasePrice,
                status,
                productTotalQuantity: productTotalQuantity * productPack
            });

            transaction.addOperation(
                async () => await product.save(),
                async () => await Product.deleteOne({ _id: product._id })
            );

            const statusOfPrice = await StatusOfPrice.create({
                productId: product._id,
                oldPrice: purchasePrice,
                newPrice: purchasePrice,
                remainingQuantity: product.productTotalQuantity,
                changedBy: user._id
            });

            if (!statusOfPrice) {
                throw new ApiError(500, "Something went wrong while creating status of price!");
            }

            const inventoryAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Inventory",
            });

            if (!inventoryAccount) {
                throw new ApiError(400, "Inventory account not found!");
            }

            const originalInventoryBalance = inventoryAccount.accountBalance;

            inventoryAccount.accountBalance += Number(purchasePrice);

            transaction.addOperation(
                async () => await inventoryAccount.save(),
                async () => {
                    inventoryAccount.accountBalance = originalInventoryBalance;
                    await inventoryAccount.save();
                }
            );

            const createdProduct = await Product.findById(product._id)
                .populate('salePricesId', 'salePrice1 salePrice2 salePrice3 salePrice4');

            if (!createdProduct) {
                throw new ApiError(500, "Something went wrong while creating product!");
            }

            const createdStatusOfPrice = await StatusOfPrice.findById(statusOfPrice._id);

            return res.status(200).json(
                new ApiResponse(200, { createdProduct, createdStatusOfPrice }, "Product created successfully!")
            );
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});

const deleteProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        throw new ApiError(400, "Product ID is required!");
    }

    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const BusinessId = user.BusinessId;
    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const product = await Product.findOne({ _id: productId, BusinessId });

            if (!product) {
                throw new ApiError(404, "Product not found!");
            }

            const salePrices = await SalePrice.findById(product.salePricesId);
            const statusOfPrices = await StatusOfPrice.find({ productId });

            // Save original inventory account balance for rollback
            const inventoryAccount = await IndividualAccount.findOne({
                BusinessId,
                individualAccountName: "Inventory",
            });

            if (!inventoryAccount) {
                throw new ApiError(400, "Inventory account not found!");
            }

            const originalInventoryBalance = inventoryAccount.accountBalance;
            inventoryAccount.accountBalance -= Number(product.productPurchasePrice) * Number(product.productTotalQuantity / product.productPack);
            transaction.addOperation(
                async () => await inventoryAccount.save(),
                async () => {
                    inventoryAccount.accountBalance = originalInventoryBalance;
                    await inventoryAccount.save();
                }
            );

            // Delete related data
            transaction.addOperation(
                async () => await SalePrice.deleteOne({ _id: product.salePricesId }),
                async () => salePrices && await salePrices.save()
            );

            for (const status of statusOfPrices) {
                transaction.addOperation(
                    async () => await StatusOfPrice.deleteOne({ _id: status._id }),
                    async () => await status.save()
                );
            }

            // Delete the product itself
            transaction.addOperation(
                async () => await Product.deleteOne({ _id: product._id }),
                async () => await product.save()
            );

            return res.status(200).json(
                new ApiResponse(200, {}, "Product deleted successfully!")
            );
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});


const updateProduct = asyncHandler(async (req, res) => {
    const {
        productId, productCode, productName, categoryId, typeId, companyId,
        productExpiryDate, productDiscountPercentage, productPack, quantityUnit, packUnit,
        salePrice1, salePrice2, salePrice3, salePrice4,
        productPurchasePrice, productTotalQuantity
    } = req.body;

    const user = req.user;
    const BusinessId = user.BusinessId;
    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const transactionManager = new TransactionManager();

    try {
        await transactionManager.run(async (transaction) => {
            const oldProduct = await Product.findById(productId);
            if (!oldProduct) {
                throw new ApiError(404, "Product not found!");
            }

            // Update Sale Prices only if salePricesId exists and values have changed
            if (oldProduct.salePricesId) {
                const existingSalePrice = await SalePrice.findById(oldProduct.salePricesId);
                const updatedSalePrices = {};

                if (salePrice1 !== undefined && salePrice1 !== existingSalePrice.salePrice1) updatedSalePrices.salePrice1 = salePrice1;
                if (salePrice2 !== undefined && salePrice2 !== existingSalePrice.salePrice2) updatedSalePrices.salePrice2 = salePrice2;
                if (salePrice3 !== undefined && salePrice3 !== existingSalePrice.salePrice3) updatedSalePrices.salePrice3 = salePrice3;
                if (salePrice4 !== undefined && salePrice4 !== existingSalePrice.salePrice4) updatedSalePrices.salePrice4 = salePrice4;

                if (Object.keys(updatedSalePrices).length > 0) {
                    transaction.addOperation(
                        async () => await SalePrice.findByIdAndUpdate(oldProduct.salePricesId, { $set: updatedSalePrices }, { new: true }),
                        async () => await SalePrice.findByIdAndUpdate(oldProduct.salePricesId, existingSalePrice, { new: true })
                    );
                }
            }

            // Fetch latest StatusOfPrice record
            const lastStatusOfPrice = await StatusOfPrice.findOne({ productId }).sort({ createdAt: -1 });

            if (!lastStatusOfPrice) {
                throw new ApiError(404, "No status of price record found!");
            }

            // Update inventory individual account only if productPurchasePrice changes
            if (productPurchasePrice !== undefined && productPurchasePrice !== oldProduct.productPurchasePrice) {
                const originalStatusPrice = lastStatusOfPrice.newPrice;
                lastStatusOfPrice.newPrice = productPurchasePrice;

                const originalPurchasePrice = oldProduct.productPurchasePrice;
                oldProduct.productPurchasePrice = productPurchasePrice;

                transaction.addOperation(
                    async () => await oldProduct.save(),
                    async () => {
                        oldProduct.productPurchasePrice = originalPurchasePrice;
                        await oldProduct.save();
                    }
                );

            }

            // Update product total quantity and status of price remaining quantity if productPack or productTotalQuantity changes
            if (
                (productTotalQuantity !== undefined && productTotalQuantity !== oldProduct.productTotalQuantity) ||
                (productPack !== undefined && productPack !== oldProduct.productPack)
            ) {
                const newRemainingQuantity = Number(productTotalQuantity || (oldProduct.productTotalQuantity / oldProduct.productPack)) *
                    Number(productPack || oldProduct.productPack);

                const updatedQuantity = newRemainingQuantity - (oldProduct.productTotalQuantity - lastStatusOfPrice.remainingQuantity)
                const originalRemainingQuantity = lastStatusOfPrice.remainingQuantity;
                lastStatusOfPrice.remainingQuantity = updatedQuantity;

                transaction.addOperation(
                    async () => await lastStatusOfPrice.save(),
                    async () => {
                        lastStatusOfPrice.remainingQuantity = originalRemainingQuantity;
                        await lastStatusOfPrice.save();
                    }
                );

                const originalProductQuantity = oldProduct.productTotalQuantity;
                oldProduct.productTotalQuantity = newRemainingQuantity;

                transaction.addOperation(
                    async () => await oldProduct.save(),
                    async () => {
                        oldProduct.productTotalQuantity = originalProductQuantity;
                        await oldProduct.save();
                    }
                );
            }

            // Update other product details only if values are different
            const updatedFields = {};
            if (productCode && productCode !== oldProduct.productCode) updatedFields.productCode = productCode;
            if (productName && productName !== oldProduct.productName) updatedFields.productName = productName;
            if (categoryId && categoryId !== oldProduct.categoryId) updatedFields.categoryId = categoryId;
            if (typeId && typeId !== oldProduct.typeId) updatedFields.typeId = typeId;
            if (companyId && companyId !== oldProduct.companyId) updatedFields.companyId = companyId;
            if (productExpiryDate && productExpiryDate !== oldProduct.productExpiryDate) updatedFields.productExpiryDate = productExpiryDate;
            if (productDiscountPercentage !== undefined && productDiscountPercentage !== oldProduct.productDiscountPercentage) updatedFields.productDiscountPercentage = productDiscountPercentage;
            if (productPack !== undefined && productPack !== oldProduct.productPack) updatedFields.productPack = productPack;
            if (quantityUnit !== undefined && quantityUnit !== oldProduct.quantityUnit) updatedFields.quantityUnit = quantityUnit;
            if (packUnit !== undefined && packUnit !== oldProduct.packUnit) updatedFields.packUnit = packUnit;

            if (Object.keys(updatedFields).length > 0) {
                Object.assign(oldProduct, updatedFields);

                transaction.addOperation(
                    async () => await oldProduct.save(),
                    async () => await Product.findByIdAndUpdate(productId, oldProduct)
                );
            }

            return res.status(200).json(new ApiResponse(200, oldProduct, "Product updated successfully"));
        });
    } catch (error) {
        throw new ApiError(500, `${error.message}`);
    }
});




const getProducts = asyncHandler(async (req, res) => {
    const user = req.user;

    if (!user) {
        throw new ApiError(401, "Authorization Failed!");
    }

    const products = await Product.aggregate([
        {
            $match: { BusinessId: new mongoose.Types.ObjectId(user.BusinessId) },
        },
        {
            $lookup: {
                from: "categories",
                localField: "categoryId",
                foreignField: "_id",
                as: "categoryDetails",
            },
        },
        {
            $lookup: {
                from: "types",
                localField: "typeId",
                foreignField: "_id",
                as: "typeDetails",
            },
        },
        {
            $lookup: {
                from: "companies",
                localField: "companyId",
                foreignField: "_id",
                as: "companyDetails",
            },
        },
        {
            $lookup: {
                from: "saleprices",
                localField: "salePricesId",
                foreignField: "_id",
                as: "salePriceDetails",
            },
        },
        {
            $lookup: {
                from: "suppliers",
                localField: "vendorSupplierId",
                foreignField: "_id",
                as: "vendorSupplierDetails",
            },
        },
        {
            $lookup: {
                from: "companies",
                localField: "vendorCompanyId",
                foreignField: "_id",
                as: "vendorCompanyDetails",
            },
        },
        {
            $lookup: {
                from: "statusofprices",
                localField: "_id",
                foreignField: "productId",
                as: "statusOfPriceDetails",
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "statusOfPriceDetails.changedBy",
                foreignField: "_id",
                as: "usersDetails",
            },
        },
        {
            $addFields: {
                statusOfPriceDetails: {
                    $map: {
                        input: "$statusOfPriceDetails",
                        as: "status",
                        in: {
                            oldPrice: "$$status.oldPrice",
                            newPrice: "$$status.newPrice",
                            remainingQuantity: "$$status.remainingQuantity",
                            createdAt: "$$status.createdAt",
                            changedByDetails: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: "$usersDetails",
                                            as: "user",
                                            cond: { $eq: ["$$user._id", "$$status.changedBy"] },
                                        },
                                    },
                                    0,
                                ],
                            },
                        },
                    },
                },
            },
        },
        {
            $project: {
                productCode: 1,
                productName: 1,
                productExpiryDate: 1,
                productDiscountPercentage: 1,
                productPack: 1,
                quantityUnit: 1,
                packUnit: 1,
                productPurchasePrice: 1,
                status: 1,
                productTotalQuantity: 1,
                createdAt: 1,
                categoryDetails: { categoryName: 1, categoryDescription: 1 },
                typeDetails: { typeName: 1, typeDescription: 1 },
                companyDetails: { companyName: 1, email: 1, companyRegion: 1 },
                salePriceDetails: { salePrice1: 1, salePrice2: 1, salePrice3: 1, salePrice4: 1 },
                vendorSupplierDetails: { _id: 1, supplierName: 1 },
                vendorCompanyDetails: { _id: 1, companyName: 1 },
                statusOfPriceDetails: 1,
            },
        },
    ]);

    if (!products) {
        throw new ApiError(500, "Failed to fetch Products! Something went wrong");
    }

    return res.status(200).json(
        new ApiResponse(200, products, "Products fetched successfully")
    );
});


const createBarcode = asyncHandler(async (req, res) => {

    try {
        const user = req.user;
        const BusinessId = req.user.BusinessId;
        // console.log(user.BusinessId._id)

        if (!user) {
            throw new ApiError(401, "Authorization Failed!");
        }

        const product = await Product.findById(req.params?.productId);
        if (!product) {
            throw new ApiError(404, "Product not found");
        }

        const barcodeText = product.productCode || product._id.toString();
        const barcodeImage = await generateBarcodeImage(barcodeText);

        res.set('Content-Type', 'image/png');
        res.send(barcodeImage);
    } catch (error) {
        throw new ApiError(500, error.message || "Something went wrong!")
    }

})

const barcodePDF = asyncHandler(async (req, res) => {

    try {
        const { productIds } = req.body;
        const user = req.user;
        const BusinessId = req.user.BusinessId;
        // console.log(user.BusinessId._id)

        if (!user) {
            throw new ApiError(401, "Authorization Failed!");
        }

        const products = await Product.find({
            _id: { $in: productIds },
            $or: [
                { productCode: { $exists: false } },
                { productCode: null },
                { productCode: '' }
            ]
        });

        if (!products) {
            throw new ApiError(404, "No products without barcodes found");
        }

        const pdf = await generateBarcodePDF(products);
        // console.log("PDF Size:", pdf.length);


        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename=barcodes.pdf'
        });
        res.send(pdf);
    } catch (error) {
        throw new ApiError(500, error.message || "Something went wrong!")
    }

})

const allProductsWithoutBarcode = asyncHandler(async (req, res) => {

    try {
        const { barcodeExists, search } = req.query;
        let query = {};
        const user = req.user;
        const BusinessId = req.user.BusinessId;
        // console.log(user.BusinessId._id)

        if (!user) {
            throw new ApiError(401, "Authorization Failed!");
        }

        if (barcodeExists === 'false') {
            query.$or = [
                { productCode: { $exists: false } },
                { productCode: null },
                { productCode: '' }
            ];
        }

        if (search) {
            query.productName = { $regex: search, $options: 'i' };
        }

        const products = await Product.find(query).limit(50);
        res.json(products);
    } catch (error) {
        throw new ApiError(500, error.message || "Something went wrong!")
    }

})


const getExpiryReport = asyncHandler(async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            throw new ApiError(401, "Authorization Failed!");
        }

        const BusinessId = user.BusinessId;

        // Optional: allow filtering by days until expiry
        const days = parseInt(req.query.days || "30", 10);
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        // Find all products that have an expiry date within the next X days
        const expiringProducts = await Product.find({
            BusinessId,
            productExpiryDate: {
                $gte: today,
                $lte: futureDate,
            }
        })
        .populate("typeId", "typeName")
        .populate("companyId", "companyName")
        .sort({ productExpiryDate: 1 })
        .lean();

        return res.status(200).json(
            new ApiResponse(200, expiringProducts, `Expiry report generated for next ${days} days`)
        );
    } catch (error) {
        console.error("Expiry Report Error:", error);
        throw new ApiError(500, error.message);
    }
});




export {
    registerCategory,
    getCategories,
    updateCategory,
    registerType,
    getTypes,
    updateType,
    registerProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    createBarcode,
    barcodePDF,
    allProductsWithoutBarcode,
    getExpiryReport
}