// require('dotenv').config({path: './env'})
import dotenv from 'dotenv'
import connectDB from './db/index.js'
import express from 'express'
import { app } from './app.js'
import { initWhatsapp } from './services/whatsapp.service.js'
// import "./schedulers/whatsappScheduler.js";


dotenv.config({
    path: './.env'
})

// const app = express()

const port = process.env.PORT || 8000
connectDB()
.then(() => {
    app.listen(
        port, 
        () => {
            console.log(`server is running on ${port}`)
            // initWhatsapp();
        }
    )
})
.catch((error) => {
    console.log("DB connection error: " + error)
})