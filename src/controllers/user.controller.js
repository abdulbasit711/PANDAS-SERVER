import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Business } from "../models/business.model.js";
import { uploadOnCloudinary } from "../utils/coudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken'
import { response } from "express";
import { BusinessRole } from "../models/businessRole.model.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const businessDetails = await Business.findById(user.BusinessId)

        const accessToken = user.generateAccessToken(businessDetails);
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return {
            accessToken,
            refreshToken
        }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {

    const { username, firstname, lastname, email, mobileno, password, cnic } = req.body;
    // After updating schema, mobileno is expected as an array or undefined from the frontend

    // --- MODIFIED VALIDATION ---
    // Check for required fields, including that mobileno is an array with at least one non-empty string
    if (
        !username ||
        !firstname ||
        !password ||
        !Array.isArray(mobileno) ||  // Check if mobileno is an array
        mobileno.length === 0 ||    // Check if the array is not empty
        mobileno.every(num => typeof num !== 'string' || num.trim() === '') // Check if all elements are empty strings or not strings
    ) {
        throw new ApiError(400, "Required fields missing or invalid mobile number format!");
    }
    // Optional: Add specific format validation for each mobile number if needed

    // Clean up the mobileno array before attempting to find/create user
    const cleanedMobileNos = mobileno.map(num => String(num || '').trim()).filter(num => num !== '');

    // Re-validate after cleaning in case the array contained only empty strings
    if (cleanedMobileNos.length === 0) {
        throw new ApiError(400, "At least one valid mobile number is required.");
    }
    // ---------------------------


    const userExists = await User.findOne({
        $or: [{ username }, { email }] // Keep existing unique check for username/email
    });

    if (userExists) {
        throw new ApiError(409, "Username or Email already exists!");
    }

    // --- MODIFIED User.create call ---
    // Pass the cleaned array of mobile numbers to User.create
    const user = await User.create({
        username: username?.toLowerCase(),
        firstname,
        lastname,
        email,
        mobileno: cleanedMobileNos, // Use the cleaned array
        password,
        cnic
    });
    // ---------------------------------

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Failed to create user! something went wrong");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully")
    );
});

// export { registerUser }; // Assuming you already have this export

const updateUserDetails = asyncHandler(async (req, res) => {
    // Get the authenticated user from the request object
    // This assumes your authentication middleware populates req.user
    const authenticatedUser = req.user;

    if (!authenticatedUser) {
        throw new ApiError(401, "Unauthorized request. User not authenticated.");
    }

    // Extract potential update fields from request body
    // Exclude password from here - password updates need a separate secure route
    const { username, firstname, lastname, email, mobileno, cnic } = req.body;

    // Prepare the update object
    const updateFields = {};

    // Add fields to updateFields only if they are provided in the request body
    // Using undefined check allows sending empty strings or null if needed to clear a field
    if (username !== undefined) updateFields.username = username?.toLowerCase(); // Assuming you want usernames lowercase
    if (firstname !== undefined) updateFields.firstname = firstname;
    if (lastname !== undefined) updateFields.lastname = lastname;
    if (email !== undefined) updateFields.email = email;
    if (mobileno !== undefined) {
        if (!Array.isArray(mobileno)) {
            // If it's provided but not an array, treat it as a bad request
            throw new ApiError(400, "Mobile number field must be an array.");
        }
        // Optionally, clean up the array (remove empty strings, trim whitespace)
        updateFields.mobileno = mobileno.map(num => String(num || '').trim()).filter(num => num !== '');
    }
    if (cnic !== undefined) updateFields.cnic = cnic;


    // IMPORTANT: Check for unique constraints if username or email are being updated
    if (updateFields.username && updateFields.username !== authenticatedUser.username?.toLowerCase()) {
        const userExists = await User.findOne({
            username: updateFields.username,
            _id: { $ne: authenticatedUser._id } // Exclude the current user
        });

        if (userExists) {
            throw new ApiError(409, "Username already exists!");
        }
    }

    if (updateFields.email && updateFields.email !== authenticatedUser.email) {
        const emailExists = await User.findOne({
            email: updateFields.email,
            _id: { $ne: authenticatedUser._id } // Exclude the current user
        });

        if (emailExists) {
            throw new ApiError(409, "Email already exists!");
        }
    }

    // Check if there's anything to update
    if (Object.keys(updateFields).length === 0) {
        throw new ApiError(400, "No update fields provided.");
    }

    // Find the user by ID and update their details
    // We use findByIdAndUpdate on the _id from the authenticated user to ensure
    // the correct user is being updated.
    const updatedUser = await User.findByIdAndUpdate(
        authenticatedUser._id,
        {
            $set: updateFields // Use $set to update only the specified fields
        },
        {
            new: true,           // Return the updated document
            runValidators: true  // Run Mongoose schema validators on the updated fields
        }
    ).select("-password -refreshToken"); // Exclude sensitive fields from the response

    // This check is a safeguard; findByIdAndUpdate with a valid ID should return a doc
    if (!updatedUser) {
        // This case is highly unlikely if authenticatedUser._id is valid
        throw new ApiError(500, "Failed to update user details. User not found or update failed.");
    }

    // Return a success response with the updated user details (excluding sensitive fields)
    return res.status(200).json(
        new ApiResponse(
            200,
            updatedUser,
            "User details updated successfully"
        )
    );
});


const loginUser = asyncHandler(async (req, res) => {
    // request body -> data
    // username or email 
    // find user
    // password check
    // access refresh token
    //send cookies

    try {
        const { username, password } = req.body
        // console.log({username, password});


        if (!username || !password) {  // check logic
            throw new ApiError(400, "Credentials missing username or password")
        }

        const user = await User.findOne({ username });

        if (!user) {
            throw new ApiError(404, "User does not exist")
        }

        const isPasswordValid = await user.isPasswordCorrect(password);

        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid Credentials")
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken").populate('BusinessId', 'businessName businessRegion businessLogo subscription gst isActive exemptedParagraph').populate('businessRole');


        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        user: loggedInUser,
                        accessToken,
                        refreshToken
                    },
                    "Logged in successfully"
                )
            )
    } catch (error) {
        throw new ApiError(400, error)
    }
})

const logoutUser = asyncHandler(async (req, res) => {
    // console.log('logging out user');

    // User.findByIdAndUpdate(
    //     req.user._id,
    //     {
    //         $set: {
    //             refreshToken: undefined
    //         }
    //     },
    //     {
    //         new: true
    //     }
    // )
    // console.log('token cleared');

    const options = {
        httpOnly: true,
        secure: true
    }

    // console.log('sending logout response');
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    // console.log('incoming refresh token:', incomingRefreshToken);

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id) //refresh token -> new refresh token

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options) //refresh token: new refresh token
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken
                    },
                    "Access Token refreshed"
                )
            )

    } catch (error) {
        new ApiError(401, "Failed to refresh Access Token")
    }
})


const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { username, cnic, newPassword } = req.body;

    if (!username || !cnic || !newPassword) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findOne({ username, cnic });

    if (!user) {
        throw new ApiError(404, "User not found or CNIC does not match");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});



const getCurrentUser = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(401, "Unauthorized request. User not found.");
    }

    const loggedInUser = await User.aggregate([
        { $match: { _id: user._id } },
        {
            $lookup: {
                from: 'businesses',
                localField: 'BusinessId',
                foreignField: '_id',
                as: 'BusinessId',
                pipeline: [
                    {
                        $project: {
                            businessName: 1,
                            businessRegion: 1,
                            businessLogo: 1,
                            subscription: 1,
                            gst: 1,
                            isActive: 1,
                            exemptedParagraph: 1
                        }
                    }
                ]
            }
        },
        { $unwind: '$BusinessId' },
        {
            $lookup: {
                from: 'users',
                let: { businessId: '$BusinessId._id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$BusinessId', '$$businessId'] } } },
                    { $count: 'count' }
                ],
                as: 'userCount'
            }
        },
        // New lookup to populate businessRole with businessRoleName
        {
            $lookup: {
                from: 'businessroles',
                localField: 'businessRole',
                foreignField: '_id',
                as: 'businessRole',
                pipeline: [
                    {
                        $project: {
                            businessRoleName: 1,
                            isActive: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                'BusinessId.userCount': { $ifNull: [{ $arrayElemAt: ['$userCount.count', 0] }, 0] }
            }
        },
        // First exclude fields you don't want
        { $project: { password: 0, refreshToken: 0, userCount: 0 } },
        // Then add a second $project to explicitly include only the fields you want
        {
            $project: {
                username: 1,
                firstname: 1,
                lastname: 1,
                email: 1,
                mobileno: 1,
                role: 1,
                cnic: 1,
                BusinessId: 1,
                businessRole: {
                    businessRoleName: 1,
                    isActive: 1
                },
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]);

    const result = loggedInUser.length > 0 ? loggedInUser[0] : null;


    return res
        .status(200)
        .json(new ApiResponse(
            200,
            result,
            "User fetched successfully"
        ))
})

const registerBusiness = asyncHandler(async (req, res) => {
    const { businessName, businessRegion, subscription, exemptedParagraph, gst } = req.body;

    if (!businessName || !businessRegion || !subscription) {
        throw new ApiError(400, "Required fields are missing");
    }

    const owner = req.user;
    if (!owner) {
        throw new ApiError(401, "Unauthorized request. User not found.");
    }

    const user = await User.findById(owner._id)

    if (user.BusinessId) {
        throw new ApiError(400, "User already has a business registered");
    }

    let logoUrl = "";

    if (req.file?.path) {
        try {
            const logo = await uploadOnCloudinary(req.file.path);
            if (!logo?.url) {
                throw new Error("Upload failed");
            }
            logoUrl = logo.url;
        } catch (error) {
            console.error("Error uploading logo:", error.message);
            throw new ApiError(500, "Error while uploading the logo");
        }
    }


    const business = await Business.create({
        businessName,
        businessRegion,
        subscription,
        businessLogo: logoUrl,
        exemptedParagraph: exemptedParagraph || "",
        gst: gst || "",
        isActive: true,
        owner: owner._id,
    });

    await User.findByIdAndUpdate(
        owner?._id,
        {
            $set: {
                BusinessId: business._id
            }
        }
    )
    // console.log(user)

    if (!business) {
        throw new ApiError(500, "Failed to register business. Something went wrong.");
    }

    const registeredBusiness = await Business.findById(business._id).populate('owner', 'username email');

    return res.status(201).json(
        new ApiResponse(
            201,
            registeredBusiness,
            "Business registered successfully"
        )
    );
});

const updateBusinessDetails = asyncHandler(async (req, res) => {
    // Extract potential update fields from request body
    const { businessName, businessRegion, subscription, exemptedParagraph, gst } = req.body;

    console.log('req.body', req.body)
    console.log('businessName, businessRegion, subscription, exemptedParagraph, gst ', businessName, businessRegion, subscription, exemptedParagraph, gst)
    // Get the authenticated user from the request object
    const owner = req.user;
    if (!owner) {
        throw new ApiError(401, "Unauthorized request. User not found.");
    }

    // Find the user to get their BusinessId
    const user = await User.findById(owner._id);
    if (!user) {
        // This case should ideally not happen if req.user is populated correctly
        throw new ApiError(404, "User not found in database.");
    }

    // Check if the user has a business registered
    if (!user.BusinessId) {
        throw new ApiError(404, "No business found for this user to update.");
    }

    // Find the existing business document using the BusinessId from the user
    const business = await Business.findById(user.BusinessId);
    if (!business) {
        // This case might happen if the BusinessId exists on the user but the business document is missing
        throw new ApiError(404, "Business document not found.");
    }

    let logoUrl = business.businessLogo; // Start with the existing logo URL

    // Handle potential logo file upload
    if (req.file?.path) {
        try {
            // Upload the new logo to Cloudinary
            const newLogo = await uploadOnCloudinary(req.file.path);
            if (!newLogo?.url) {
                throw new Error("Upload failed");
            }
            // If upload is successful, update the logoUrl
            logoUrl = newLogo.url;

            // Optional: You might want to delete the old logo from Cloudinary here
            // await deleteFromCloudinary(business.businessLogo); // You'd need a delete utility

        } catch (error) {
            console.error("Error uploading new logo:", error.message);
            // Decide whether to stop the update or proceed without updating the logo
            // For now, we throw an error
            throw new ApiError(500, "Error while uploading the new logo");
        }
    }

    // Prepare the update object with fields that were provided in the request body
    const updateFields = {};
    if (businessName !== undefined) updateFields.businessName = businessName;
    if (businessRegion !== undefined) updateFields.businessRegion = businessRegion;
    if (subscription !== undefined) updateFields.subscription = subscription;
    // Allow clearing or updating exemptedParagraph and gst
    if (exemptedParagraph !== undefined) updateFields.exemptedParagraph = exemptedParagraph;
    if (gst !== undefined) updateFields.gst = gst;

    console.log('updateFields', updateFields)

    // Add the potentially updated logo URL
    updateFields.businessLogo = logoUrl;

    // Check if there's anything to update
    if (Object.keys(updateFields).length === 0) {
        // Consider if only a file upload without other fields is valid
        // If a file was uploaded, updateFields will contain businessLogo, so this check works.
        throw new ApiError(400, "No update fields provided.");
    }


    // Update the business document
    const updatedBusiness = await Business.findByIdAndUpdate(
        business._id,
        {
            $set: updateFields // Use $set to update only specified fields
        },
        {
            new: true // Return the updated document
        }
    ).populate('owner', 'username email'); // Populate owner details for the response

    if (!updatedBusiness) {
        // This check is a safeguard, findByIdAndUpdate should return null if doc not found
        throw new ApiError(500, "Failed to update business details. Something went wrong.");
    }

    // Return a success response with the updated business details
    return res.status(200).json(
        new ApiResponse(
            200,
            updatedBusiness,
            "Business details updated successfully"
        )
    );
});

const getBusinessDetails = asyncHandler(async (req, res) => {
    // Get the authenticated user from the request object
    const owner = req.user;
    if (!owner) {
        // This check is primarily if middleware fails, but good practice
        throw new ApiError(401, "Unauthorized request. User not authenticated.");
    }

    // Find the user document to get the BusinessId
    // We fetch the full user just in case req.user only contained partial data
    const user = await User.findById(owner._id);

    if (!user) {
        // This is an edge case, implies user exists in auth but not DB
        throw new ApiError(404, "User profile not found.");
    }

    // Check if the user has a BusinessId linked
    if (!user.BusinessId) {
        throw new ApiError(404, "No business registered for this user.");
    }

    // Find the business document using the BusinessId from the user
    const business = await Business.findById(user.BusinessId).populate('owner', 'username email');
    // Populate owner details as done in the registerBusiness controller

    // Check if the business document was found
    if (!business) {
        // This could happen if the BusinessId on the user is stale
        // Consider unlinking the BusinessId from the user here if this happens often
        throw new ApiError(404, "Business document not found for the linked ID.");
    }

    // Return a success response with the business details
    return res.status(200).json(
        new ApiResponse(
            200,
            business,
            "Business details fetched successfully"
        )
    );
});

const registerRole = asyncHandler(async (req, res) => {
    const { businessRoleName } = req.body;

    if (!businessRoleName) {
        throw new ApiError(400, "Business role name is required");
    }

    const businessRoleExist = await BusinessRole.findOne({ businessRoleName })

    if (businessRoleExist) {
        throw new ApiError(400, "Business role already exists");
    }

    const businessRole = await BusinessRole.create({
        businessRoleName
    });

    if (!businessRole) {
        throw new ApiError(500, "Failed to register role. Something went wrong.");
    }

    const registeredRole = await BusinessRole.findById(businessRole._id)

    return res.status(200).json(
        new ApiResponse(
            200,
            registeredRole,
            "Business role registered successfully"
        )
    );

})

// get roles

const getRoles = asyncHandler(async (req, res) => {
    const roles = await BusinessRole.find({});

    if (!roles) {
        throw new ApiError(404, "No business roles found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            roles,
            "Business roles fetched successfully"
        )
    );
})


//admin added users


const registerUserByAdmin = asyncHandler(async (req, res) => {
    const { username, firstname, lastname, mobileno, password } = req.body;
    const adminBusinessId = req.user.BusinessId; // Assuming admin is logged in and BusinessId is in token


    // Validate required fields
    if (
        !username ||
        !firstname ||
        !password ||
        !Array.isArray(mobileno) ||
        mobileno.length === 0 ||
        mobileno.every(num => typeof num !== 'string' || num.trim() === '')
    ) {
        throw new ApiError(400, "Required fields missing or invalid mobile number format!");
    }

    // Clean mobile numbers
    const cleanedMobileNos = mobileno.map(num => String(num || '').trim()).filter(num => num !== '');

    if (cleanedMobileNos.length === 0) {
        throw new ApiError(400, "At least one valid mobile number is required.");
    }

    // Check subscription limits
    const business = await Business.findById(adminBusinessId);
    if (!business) {
        throw new ApiError(404, "Business not found");
    }

    // Get current user count for this business
    const currentUserCount = await User.countDocuments({ BusinessId: adminBusinessId });

    if (currentUserCount >= business.subscription) {
        throw new ApiError(403, "User limit reached according to your subscription plan");
    }

    // Check if username already exists
    const userExists = await User.findOne({ username });
    if (userExists) {
        throw new ApiError(409, "Username already exists!");
    }

    // Create user with 'user' role by default
    const user = await User.create({
        username: username.toLowerCase(),
        firstname,
        lastname,
        mobileno: cleanedMobileNos,
        password,
        role: "user", // Default role for admin-created users
        BusinessId: adminBusinessId
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Failed to create user! something went wrong");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully by admin")
    );
});

const assignUserRights = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { businessRoleIds } = req.body; // Array of BusinessRole IDs
    const adminBusinessId = req.user?.BusinessId;

    console.log('first', userId, businessRoleIds, adminBusinessId)

    // Validate input
    if (!businessRoleIds || !Array.isArray(businessRoleIds)) {
        throw new ApiError(400, "businessRoleIds must be an array");
    }

    // Check if user exists and belongs to the same business
    const user = await User.findOne({
        _id: userId,
        BusinessId: adminBusinessId
    });

    if (!user) {
        throw new ApiError(404, "User not found or doesn't belong to your business");
    }

    // Update user's business roles
    user.businessRole = businessRoleIds;
    await user.save();

    const updatedUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .populate("businessRole");

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "User rights updated successfully")
    );
});

const getBusinessUsers = asyncHandler(async (req, res) => {
    const adminBusinessId = req.user.BusinessId;

    const users = await User.find({ BusinessId: adminBusinessId })
        .select("-password -refreshToken")
        .populate("businessRole");

    return res.status(200).json(
        new ApiResponse(200, users, "Business users fetched successfully")
    );
});

const updateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { firstname, lastname, mobileno } = req.body;
    const adminBusinessId = req.user.BusinessId;

    // Validate input
    if (!firstname && !lastname && !mobileno) {
        throw new ApiError(400, "At least one field to update is required");
    }

    // Clean mobile numbers if provided
    let cleanedMobileNos;
    if (mobileno) {
        if (!Array.isArray(mobileno)) {
            throw new ApiError(400, "mobileno must be an array");
        }
        cleanedMobileNos = mobileno.map(num => String(num || '').trim()).filter(num => num !== '');
        if (cleanedMobileNos.length === 0) {
            throw new ApiError(400, "At least one valid mobile number is required.");
        }
    }

    // Find and update user
    const user = await User.findOneAndUpdate(
        { _id: userId, BusinessId: adminBusinessId },
        {
            $set: {
                ...(firstname && { firstname }),
                ...(lastname && { lastname }),
                ...(mobileno && { mobileno: cleanedMobileNos })
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found or doesn't belong to your business");
    }

    return res.status(200).json(
        new ApiResponse(200, user, "User updated successfully")
    );
});

const deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const adminBusinessId = req.user.BusinessId;

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot delete your own account");
    }

    const user = await User.findOneAndDelete({
        _id: userId,
        BusinessId: adminBusinessId
    });

    if (!user) {
        throw new ApiError(404, "User not found or doesn't belong to your business");
    }

    return res.status(200).json(
        new ApiResponse(200, null, "User deleted successfully")
    );
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    registerBusiness,
    registerRole,
    getRoles,
    updateBusinessDetails,
    getBusinessDetails,
    updateUserDetails,

    registerUserByAdmin,
    assignUserRights,
    getBusinessUsers,
    updateUser,
    deleteUser
}