import mongoose, { Schema } from "mongoose";

const AccountSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    accountName: {
        type: String,
        required: true,
    }
}, {
    timestamps: true
})


export const Account = mongoose.model("Account", AccountSchema);