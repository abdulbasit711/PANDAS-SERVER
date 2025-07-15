import mongoose, { Schema } from "mongoose";

const SupplierSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    ledgerId: {
        type: Schema.Types.ObjectId,
        ref: 'IndividualAccount'
    },
    supplierName: {
        type: String,
        required: true
    },
    mobileNo: {
        type: String,
        default: ''
    },
    phoneNo: {
        type: String,
        default: ''
    },
    faxNo: {
        type: String,
    },
    email: {
        type: String,
        default: ''
    },
    cnic: {
        type: String,
        default: ''
    },
    supplierRegion: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
})


export const Supplier = mongoose.model("Supplier", SupplierSchema);