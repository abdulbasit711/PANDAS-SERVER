import mongoose, { Schema } from "mongoose";

const SalePriceSchema = new Schema({
    salePrice1: {
        type: Number,
        required: true,
    },
    salePrice2: {
        type: Number,
        default: 0
    },
    salePrice3: {
        type: Number,
        default: 0
    },
    salePrice4: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
})


export const SalePrice = mongoose.model("SalePrice", SalePriceSchema);