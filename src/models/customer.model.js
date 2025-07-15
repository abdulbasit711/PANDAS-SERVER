import mongoose, { Schema } from "mongoose";

// Define the User Schema
const CustomerSchema = new Schema({
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    ledgerId: {
        type: Schema.Types.ObjectId,
        ref: 'IndividualAccount'
    },
    customerName: {
        type: String,
        required: true
    },
    ntnNumber: {
        type: String,
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
    customerRegion: {
        type: String,
        default: ''
    },
    customerFlag: {
        type: String,
        enum: ['white', 'yellow', 'green', 'red'],
        default: 'red'
    }
}, {
    timestamps: true
})


export const Customer = mongoose.model("Customer", CustomerSchema);