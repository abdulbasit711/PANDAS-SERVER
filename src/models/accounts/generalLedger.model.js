import mongoose, { Schema } from "mongoose";

const GeneralLedgerSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    individualAccountId: {
        type: Schema.Types.ObjectId,
        ref: 'IndividualAccount',
        required: true
    },
    details: {
        type: String
    },
    debit: {
        type: Number
    },
    credit: {
        type: Number
    },
    description: {
        type: String
    },
    reference: {
        type: Schema.Types.ObjectId,
        ref: 'IndividualAccount',
        required: true
    }
}, {
    timestamps: true
})


export const GeneralLedger = mongoose.model("GeneralLedger", GeneralLedgerSchema);