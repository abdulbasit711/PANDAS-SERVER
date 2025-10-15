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
    quantityUnit: {
        type: String,
        enum: ['pcs', 'cotton', 'box', 'pack', 'kg', 'ton','meter', 'yard','ft'],
        default: 'pcs'
    },
    packUnit: {
        type: String,
        enum: ['pcs', 'kg', 'grams', 'ft', 'inches', 'cm'],
        default: 'pcs'
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

ProductSchema.statics.allocatePurchasePrice = async function (productId, requiredQuantity, billItemPack, itemUnits, transaction) {
    const StatusOfPrice = mongoose.model('StatusOfPrice');

    const statusRecords = await StatusOfPrice.find({
        productId: productId,
    }).sort({ createdAt: 1 });

    // console.log('itemUnits', itemUnits)
    
    const quantityWithUnits = requiredQuantity * billItemPack + itemUnits;
    let remainingRequiredQuantity = quantityWithUnits;
    let totalCost = 0;
    
    const product = await this.findById(productId, 'productPack');
    // console.log('productPack', product.productPack)

    for (const record of statusRecords) {
        if (remainingRequiredQuantity <= 0) break;

        const usedQuantity = record.remainingQuantity <= 0 ? 0 : Math.min(record.remainingQuantity, remainingRequiredQuantity);
        // console.log('usedQuantity', usedQuantity)
        // console.log('statusRecords', statusRecords)
        
        totalCost += usedQuantity * parseFloat(record.newPrice) / parseFloat(product.productPack);
        remainingRequiredQuantity -= usedQuantity;
        
        const originalRemainingQuantity = record.remainingQuantity;
        record.remainingQuantity -= usedQuantity;
        
        transaction.addOperation(
            async () => await record.save(),
            async () => {
                record.remainingQuantity = originalRemainingQuantity;
                await record.save();
            }
        );
        // console.log('totalCost', totalCost)
    }

    // Handle negative stock by creating a virtual negative entry
    if (remainingRequiredQuantity > 0) {
        const latestPrice = parseFloat(statusRecords[statusRecords.length - 1].newPrice)
        // console.log('latestPrice', latestPrice)

        const negativeCost = remainingRequiredQuantity * latestPrice / parseFloat(product.productPack);
        totalCost += negativeCost;

        // console.log('negativeCost', negativeCost)
        // console.log('statusRecords[statusRecords.length - 1]', statusRecords[statusRecords.length - 1])

        const originalRemainingQuantity = statusRecords[statusRecords.length - 1].remainingQuantity;
        statusRecords[statusRecords.length - 1].remainingQuantity -= remainingRequiredQuantity

        transaction.addOperation(
            async () => await statusRecords[statusRecords.length - 1].save(),
            async () => {
                statusRecords[statusRecords.length - 1].remainingQuantity = originalRemainingQuantity;
                await statusRecords[statusRecords.length - 1].save();
            }
        );
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

    // console.log('returnedQuantity', returnedQuantity)

    // Increment the remaining quantity of the first record
    statusRecord.remainingQuantity += Number(returnedQuantity);

    // Save the updated record
    await statusRecord.save();

    const product = await this.findById(productId, 'productPack');

    // Calculate the total purchase price for the returned quantity
    const totalCost = returnedQuantity * (parseFloat(statusRecord.newPrice)/parseFloat(product?.productPack));

    return Number(totalCost); // Return the total cost for the returned quantity
};


export const Product = mongoose.model("Product", ProductSchema);