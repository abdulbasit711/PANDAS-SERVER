import mongoose, { Schema } from "mongoose";

const AccountSubCategorySchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    accountSubCategoryName: {
        type: String,
        required: true,
    },
    parentAccount: {
        type: Schema.Types.ObjectId,
        ref: 'Account',
        required: true
    }
}, {
    timestamps: true
})


export const AccountSubCategory = mongoose.model("AccountSubCategory", AccountSubCategorySchema);