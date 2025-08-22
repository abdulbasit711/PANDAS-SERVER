import mongoose, { Schema } from "mongoose";

const BillProductsSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number
    },
    billItemDiscount: {
        type: Number
    },
    billItemPrice: {
        type: Number
    },
    billItemPack: {
        type: Number
    },
    billItemUnit: {
        type: Number
    },
}, {
    timestamps: true
})

const ExtraItemSchema = new Schema({
    itemName: {
        type: String,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        default: 1
    }
}, {
    _id: false // Prevents Mongoose from adding an _id to each subdocument if you don't need it
});

const BillSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer'
    },
    salesPerson: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    billNo: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    billType: {
        type: String,
        enum: ['A4', 'thermal'],
        default: 'thermal'
    },
    billPaymentType: {
        type: String,
        enum: ['cash', 'credit']
    },
    billItems: [BillProductsSchema],
    extraItems: [ExtraItemSchema],
    flatDiscount: {
        type: Number,
        default: 0
    },
    billStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'partiallypaid']
    },
    totalAmount: {
        type: Number
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    dueDate: { // date for the payment of the invoice
        type: Date
    },
    isPosted: {
        type: Boolean,
        default: false
    },
    totalPurchaseAmount: {
        type: Number
    },
    billRevenue: {
        type: Number
    },
    mergedInto: {
        type: Schema.Types.ObjectId,
        ref: 'Bill',
        default: null
    }
}, {
    timestamps: true
})


export const Bill = mongoose.model("Bill", BillSchema);