import mongoose, { Schema } from "mongoose";

const StatusOfPriceSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    oldPrice: {
        type: String
    },
    newPrice: {
        type: String
    },
    remainingQuantity: {
        type: Number
    },
    changedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
})


export const StatusOfPrice = mongoose.model("StatusOfPrice", StatusOfPriceSchema);