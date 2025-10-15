import mongoose, { Schema } from "mongoose";

// Schema for individual items in a sale return
const SaleReturnItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product', // Reference to the Product model
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0 // Ensure quantity is at least 1
    },
    returnPrice: {
        type: Number,
        required: true,
        min: 0 // Ensure price is non-negative
    },
    returnUnits: {
        type: Number,
        min: 0 
    },
    returnReason: {
        type: String,
        trim: true // Remove unnecessary whitespace
    }
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});

// Main schema for sale returns
const SaleReturnSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business', // Reference to the Business model
        required: true
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer', // Reference to the Customer model (optional)
        default: null
    },
    billId: {
        type: Schema.Types.ObjectId,
        ref: 'Bill', // Reference to the Bill model (optional, for returns against a bill)
        default: null
    },
    returnType: {
        type: String,
        enum: ['direct', 'againstBill'], // Only allow these two types
        required: true
    },
    returnItems: [SaleReturnItemSchema], // Array of returned items
    totalReturnAmount: {
        type: Number,
        required: true,
        min: 0 // Ensure amount is non-negative
    },
    returnDate: {
        type: Date,
        default: Date.now // Default to the current date
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'], // Only allow these statuses
        default: 'pending'
    }
}, {
    timestamps: true, // Automatically add createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Include virtual fields in JSON output
    toObject: { virtuals: true } // Include virtual fields in object output
});

// Virtual field: Total Items Returned
SaleReturnSchema.virtual('totalItemsReturned').get(function () {
    return this.returnItems.reduce((total, item) => total + item.quantity, 0);
});

// Virtual field: Is Fully Processed (approved or rejected)
SaleReturnSchema.virtual('isFullyProcessed').get(function () {
    return this.status === 'approved' || this.status === 'rejected';
});

// Export the SaleReturn model
export const SaleReturn = mongoose.model("SaleReturn", SaleReturnSchema);