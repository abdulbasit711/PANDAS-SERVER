import mongoose, { Schema } from "mongoose";

const AccountReceivableSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer'
    },
    details: {
        type: Schema.Types.ObjectId,
        ref: 'Bill'
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true
})


export const AccountReceivable = mongoose.model("AccountReceivable", AccountReceivableSchema);