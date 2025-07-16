import mongoose, { Schema } from "mongoose";

const CategorySchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    categoryName: {
        type: String,
        required: true,
    },
    categoryDescription: {
        type: String
    }
}, {
    timestamps: true
})


export const Category = mongoose.model("Category", CategorySchema);