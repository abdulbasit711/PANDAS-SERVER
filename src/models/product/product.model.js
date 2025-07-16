import mongoose, { Schema } from "mongoose";

const ProductSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    productCode: {
        type: String
    },
    productName: {
        type: String,
        required: true
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category'
    },
    typeId: {
        type: Schema.Types.ObjectId,
        ref: 'Type'
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    productExpiryDate: {
        type: Date
    },
    salePricesId: {
        type: Schema.Types.ObjectId,
        ref: 'SalePrice'
    },
    vendorSupplierId: {
        type: Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    vendorCompanyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    productDiscountPercentage: {
        type: Number,
        default: 0
    },
    productPack: {
        type: Number,
        default: 1
    },
    productUnit: {
        type: Number
    },
    productPurchasePrice: {
        type: Number,
        required: true
    },
    status: {
        type: Boolean
    },
    productTotalQuantity: {
        type: Number,
        required: true,
        default: 0
    }
}, {
    timestamps: true
})

ProductSchema.statics.allocatePurchasePrice = async function (productId, requiredQuantity, itemUnits, transaction) {
    const StatusOfPrice = mongoose.model('StatusOfPrice');

    const statusRecords = await StatusOfPrice.find({
        productId: productId,
        remainingQuantity: { $gt: 0 }
    }).sort({ createdAt: 1 });
    const quantityWithUnits = requiredQuantity * (itemUnits);

    let remainingRequiredQuantity = quantityWithUnits;
    let totalCost = 0;

    const product = await this.findById(productId, 'productPack');

    for (const record of statusRecords) {
        // console.log(`Product Pack: ${product.productPack}`);
        // console.log(`New Price: ${record.newPrice}`);
        // console.log(`Total Cost Before: ${totalCost}`);

        if (remainingRequiredQuantity <= 0) break;


        const usedQuantity = Math.min(record.remainingQuantity, remainingRequiredQuantity);
        // console.log(`Used Quantity: ${usedQuantity}`);
        totalCost += usedQuantity * parseFloat(record.newPrice) / parseFloat(product.productPack)
        remainingRequiredQuantity -= usedQuantity;

        // console.log(`Quantity with Units: ${quantityWithUnits}`);
        // console.log(`Remaining Required Quantity: ${remainingRequiredQuantity}`);
        // console.log(`Remaining Quantity in Record: ${record.remainingQuantity}`);

        const originalRemainingQuantity = record.remainingQuantity; // Capture original value
        record.remainingQuantity -= usedQuantity;

        transaction.addOperation(
            async () => {
                await record.save();
            },
            async () => {
                record.remainingQuantity = originalRemainingQuantity;
                await record.save();
            }
        );
    }

    if (remainingRequiredQuantity > 0) {
        const product = await this.findById(productId, 'productName');
        const productName = product ? product.productName : 'Unknown Product';
        throw new Error(`Insufficient stock for product ${productName}. Missing ${remainingRequiredQuantity} units.`);
    }

    return Number(totalCost);
};


ProductSchema.statics.calculatePurchasePriceForReturn = async function (productId, returnedQuantity) {
    const StatusOfPrice = mongoose.model('StatusOfPrice'); // Reference the StatusOfPrice model

    // Fetch the first relevant StatusOfPrice record with remainingQuantity > 0
    let statusRecord;
    statusRecord = await StatusOfPrice.findOne({
        productId: productId,
        remainingQuantity: { $gt: 0 }
    }).sort({ createdAt: 1 });

    if (!statusRecord) {
        statusRecord = await StatusOfPrice.findOne({
            productId: productId
        }).sort({ createdAt: -1 });
    }

    // Increment the remaining quantity of the first record
    statusRecord.remainingQuantity += returnedQuantity;

    // Save the updated record
    await statusRecord.save();

    // Calculate the total purchase price for the returned quantity
    const totalCost = returnedQuantity * parseFloat(statusRecord.newPrice);

    return Number(totalCost); // Return the total cost for the returned quantity
};


export const Product = mongoose.model("Product", ProductSchema);