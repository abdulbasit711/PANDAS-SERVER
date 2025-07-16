import mongoose, { Schema } from "mongoose";

const businessSchema = new Schema({
    businessName: {
        type: String,
        required: true,
    },
    businessRegion: {
        type: String,
        required: true,
    },
    businessLogo: {
        type: String
    },
    subscription: {
        type: Number,
        required: true,
        default: 1
    },
    gst: {
        type: Number,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    exemptedParagraph: {
        type: String,
        default: ""

    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }
},{
    timestamps: true
})

export const Business = mongoose.model("Business", businessSchema);