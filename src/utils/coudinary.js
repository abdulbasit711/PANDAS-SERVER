import { v2 as coudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary

coudinary.config({
  cloud_name: process.env.COUDINARY_CLOUD_NAME, 
  api_key: process.env.COUDINARY_API_KEY, 
  api_secret: process.env.COUDINARY_API_SECRET, 
});

// Upload file to Cloudinary

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const response = await coudinary.uploader.upload(localFilePath, {
            resource_type: 'auto',
        });
        fs.unlinkSync(localFilePath)
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath) //remove temporary file path
    }
}

export { uploadOnCloudinary }