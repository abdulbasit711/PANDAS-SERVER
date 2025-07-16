import mongoose from 'mongoose';
import { DB_NAME } from '../constants.js';

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`);
        console.log(`\n MONGODB connected !!! \n DB host: ${connectionInstance.connection.host}`)
        
    } catch (error) {
        console.log("Mongodb connection Failed: ", error)
        process.exit(1) // read about it
    }
}

export default connectDB