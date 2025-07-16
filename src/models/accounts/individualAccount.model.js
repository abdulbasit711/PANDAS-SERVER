import mongoose, { Schema } from "mongoose";

const IndividualAccountSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    individualAccountName: {
        type: String,
        required: true,
    },
    accountBalance: {
        type: Number,
        default: 0

    },
    parentAccount: {
        type: Schema.Types.ObjectId,
        ref: 'AccountSubCategory',
        required: true
    },
    customerId: {
        type: Schema.Types.ObjectId,
        ref: 'Customer'
    },
    supplierId: {
        type: Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    mergedInto: {
        type: Schema.Types.ObjectId,
        ref: "IndividualAccount",
        default: null,
    },
}, {
    timestamps: true
})


export const IndividualAccount = mongoose.model("IndividualAccount", IndividualAccountSchema);