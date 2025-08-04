import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler( async (req, _, next) => {
    // console.log("req.cookies: ", req.cookies);
    // console.log("req.Header: ", req.Header);
    // console.log("req.header: ", req.header);
    // console.log("req.headers: ", req.headers);
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        // console.log("verifying jwt token", token);
        

        if (!token){
            throw new ApiError(401, "Unauthorized access")
        }
        
        // console.log("decoding token");
        
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        // console.log("token decoded");

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if(!user) {
            throw new ApiError(401, "Invalid access token")
        }

        // console.log("user found");
        
        req.user = user // adding user to response
        next()

    } catch (error) {
        throw new ApiError(401, "token verification failed")
    }
})