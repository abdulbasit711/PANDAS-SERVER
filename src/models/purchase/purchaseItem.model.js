import mongoose, { Schema } from "mongoose";


const PurchaseItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    pricePerUnit: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    productPack: {
        type: Number
    }
}, {
    timestamps: true
});


const PurchaseSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    vendorSupplierId: {
        type: Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    vendorCompanyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    purchaseBillNo: {
        type: String,
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    totalAmount: {
        type: Number,
        required: true
    },
    flatDiscount: {
        type: Number,
        default: 0
    },
    purchaseItems: [PurchaseItemSchema],
    
}, {
    timestamps: true
});

export const Purchase = mongoose.model("Purchase", PurchaseSchema);
