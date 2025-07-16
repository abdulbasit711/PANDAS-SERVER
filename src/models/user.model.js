import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt";

// Define the User Schema
const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    firstname: {
        type: String,
        required: true,
        trim: true,
    },
    lastname: {
        type: String,
        trim: true,
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    mobileno: {
        type: [String],
        default: []    
    },
    password: {
        type: String,
        required: [true, "password is required"]
    },
    role: {
        type: String,
        enum: ['admin', 'user', 'owner'],
        default: "owner"
    },
    cnic: {
        type: String,
    },
    BusinessId: {
        type: Schema.Types.ObjectId,
        ref: "Business"
    },
    businessRole: [
        {
            type: Schema.Types.ObjectId,
            ref: "BusinessRole"
        }
    ],
    refreshToken: {
        type: String
    }
}, {
    timestamps: true
})

UserSchema.pre(  //hook
    "save",
    async function (next) {
        if (this.isModified('mobileno')) {
            if (!Array.isArray(this.mobileno)) {
                 this.mobileno = [this.mobileno].filter(Boolean); // Convert to array, remove empty/null entries
            }
             this.mobileno = this.mobileno.filter(num => typeof num === 'string' && num.trim() !== ''); // Clean up array
        }
        
        if (!this.isModified("password")) return next();

        this.password = await bcrypt.hash(this.password, 10);
        next();
    }
)

// Custom methods

UserSchema.methods.isPasswordCorrect = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
}

UserSchema.methods.generateAccessToken = function (BusinessId = {}) {
    return jwt.sign({
        _id: this._id,
        username: this.username,
        role: this.role,
        firstname: this.firstname,
        lastname: this.lastname,
        email: this.email,
        mobileno: this.mobileno,
        cnic: this.cnic,
        BusinessId: BusinessId,
        businessRole: this.businessRole
    },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
}


UserSchema.methods.generateRefreshToken = function () {
    return jwt.sign({
        _id: this._id
    },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
}



export const User = mongoose.model("User", UserSchema);