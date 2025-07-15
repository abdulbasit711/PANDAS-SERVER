import mongoose, { Schema } from "mongoose";

const TypeSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    typeName: {
        type: String,
        required: true,
    },
    typeDescription: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
})


export const Type = mongoose.model("Type", TypeSchema);