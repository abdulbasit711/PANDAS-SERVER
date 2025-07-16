import mongoose, { Schema } from "mongoose";

const CompanySchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    ledgerId: {
        type: Schema.Types.ObjectId,
        ref: 'IndividualAccount'
    },
    companyName: {
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
    companyDiscount: {
        type: Number,
        default: 0
    },
    faxNo: {
        type: String,
    },
    email: {
        type: String,
        default: ''
    },
    companyRegion: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
})


export const Company = mongoose.model("Company", CompanySchema);