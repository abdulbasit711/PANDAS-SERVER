// // server/src/services/whatsapp.service.js
// import pkg from 'whatsapp-web.js';
// import qrcode from 'qrcode';
// import { EventEmitter } from 'events';
// import puppeteer from 'puppeteer'
// import path from 'path';
// import fs from 'fs';

// const { Client, LocalAuth } = pkg;

// let client;
// let clientReady = false;
// let currentQr = null;
// let messageQueue = [];
// let reconnecting = false;

// export const whatsappEmitter = new EventEmitter(); // used to emit QR updates to frontend

// // ✅ Fixed: create a stable puppeteer profile path
// const chromePath = "C:/Users/DIBB ComputerS/.cache/puppeteer/chrome/win64-141.0.7390.78/chrome-win64/chrome.exe";
// const userDataDir = path.join(process.cwd(), "puppeteer_data");
// if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir);

// // ✅ Fixed: give LocalAuth a persistent directory
// const authDir = path.join(process.cwd(), "whatsapp_auth");
// if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);

// let browser;

// export const initWhatsapp = async () => {
//     try {

//         if (client && clientReady) {
//             console.log("⚙️ WhatsApp already initialized.");
//             return;
//         }

//         if (!browser) {
//             browser = await puppeteer.launch({
//                 // executablePath: chromePath,
//                 executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
//                 headless: true,
//                 userDataDir,
//                 args: [
//                     "--no-sandbox",
//                     "--disable-setuid-sandbox",
//                     "--disable-gpu",
//                     "--disable-dev-shm-usage",
//                     "--remote-debugging-port=9222",
//                 ],
//             });

//             console.log("✅ Puppeteer launched successfully!");
//         }

//         client = new Client({
//             authStrategy: new LocalAuth({
//                 clientId: "pandas-session", // you can name it anything
//                 dataPath: authDir, // store session data here
//             }),
//             puppeteer: {
//                 browserWSEndpoint: (await browser.wsEndpoint()), // connect to launched browser
//             },
//         });

//         // Generate QR code event
//         client.on("qr", async (qr) => {
//             currentQr = await qrcode.toDataURL(qr);
//             whatsappEmitter.emit("qr", currentQr);
//             console.log("📱 WhatsApp QR generated!");
//         });

//         // When client is ready
//         client.on("ready", () => {
//             clientReady = true;
//             reconnecting = false;
//             console.log("✅ WhatsApp Client Ready!");

//             // Send queued messages (if any)
//             if (messageQueue.length > 0) {
//                 console.log(`📤 Sending ${messageQueue.length} queued messages...`);
//                 messageQueue.forEach(async ({ number, message }) => {
//                     await sendWhatsappMessage(number, message);
//                 });
//                 messageQueue = [];
//             }
//         });

//         // When disconnected
//         client.on("disconnected", (reason) => {
//             clientReady = false;
//             console.log("⚠️ WhatsApp disconnected:", reason);

//             if (!reconnecting) {
//                 reconnecting = true;
//                 console.log("🔄 Attempting to reconnect in 5 seconds...");
//                 setTimeout(async () => {
//                     try {
//                         await initWhatsapp();
//                         console.log("✅ Reconnected successfully!");
//                     } catch (err) {
//                         console.error("❌ Reconnection failed:", err);
//                     } finally {
//                         reconnecting = false;
//                     }
//                 }, 5000);
//             }
//         });

//         // Log any incoming messages (optional)
//         client.on("message", (msg) => {
//             console.log(`📩 New message from ${msg.from}: ${msg.body}`);
//         });

//         // Initialize client
//         await client.initialize();
//     } catch (error) {
//         console.error("❌ Error initializing WhatsApp:", error);
//         throw error;
//     }
// };

// // Get QR Code
// export const getQrCode = async () => {
//     if (currentQr) {
//         return { qr: currentQr };
//     } else {
//         return { message: "QR not yet generated, please wait..." };
//     }
// };

// // Check WhatsApp connection status
// export const checkWhatsappStatus = async () => {
//     return { ready: clientReady };
// };

// // Send WhatsApp Message
// export const sendWhatsappMessage = async (number, message) => {
//     try {
//         const chatId = number?.includes("@c.us") ? number : `${number}@c.us`;

//         if (!clientReady) {
//             console.log(`⏳ Client not ready, queuing message to ${number}`);
//             messageQueue.push({ number: chatId, message });
//             return { status: "queued", number };
//         }

//         await client.sendMessage(chatId, message);
//         console.log(`📤 Message sent to ${number}: ${message}`);
//         return { status: "sent", number, message };
//     } catch (error) {
//         console.error("❌ WhatsApp send error:", error);
//         throw error;
//     }
// };


// // 🧹 Graceful shutdown
// process.on("SIGINT", async () => {
//     console.log("🧹 Closing WhatsApp and Puppeteer...");
//     if (client) await client.destroy().catch(() => { });
//     if (browser) await browser.close().catch(() => { });
//     process.exit(0);
// });


// process.once("SIGUSR2", async () => {
//     console.log("🔁 Restarting server, closing Puppeteer...");
//     if (client) await client.destroy().catch(() => { });
//     if (browser) await browser.close().catch(() => { });
//     process.kill(process.pid, "SIGUSR2");
// });
