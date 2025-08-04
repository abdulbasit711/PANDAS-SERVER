// require('dotenv').config({path: './env'})
import dotenv from 'dotenv'
import connectDB from './db/index.js'
import express from 'express'
import { app } from './app.js'

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
        }
    )
})
.catch((error) => {
    console.log("DB connection error: " + error)
})