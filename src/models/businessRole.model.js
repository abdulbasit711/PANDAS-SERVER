import mongoose, { Schema } from "mongoose";

const businessRoleSchema = new Schema({
    businessRoleName: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        required: true,
        default: true
    }
},{
    timestamps: true
})

export const BusinessRole = mongoose.model("BusinessRole", businessRoleSchema);