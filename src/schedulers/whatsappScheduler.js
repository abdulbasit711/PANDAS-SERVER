// import { getCustomerReceivables } from "../controllers/whatsapp.controller.js";
// import { sendWhatsappMessage } from "../services/whatsapp.service.js";
// import { checkWhatsappStatus } from "../services/whatsapp.service.js";
// import cron from "node-cron";

// cron.schedule(
//     "0 10 * * 6", // Every saturday 10 am
//     async () => {
//         try {
//             const status = await checkWhatsappStatus();

//             if (!status.ready) {
//                 console.log("⚠️ WhatsApp client not ready, skipping message.");
//                 return;
//             }

//             const customers = await getCustomerReceivables();
//             //   console.log('res', customers)

//             if (!customers) return;


//             for (const customer of customers) {
//                 let mobileNo;

//                 if (customer && customer.mobileNo) {
//                     let raw = customer?.mobileNo;

//                     // Remove spaces, dashes, brackets, etc.
//                     raw = raw.replace(/[^0-9+]/g, "");

//                     // If it starts with "0", replace with "+92"
//                     if (raw.startsWith("0")) {
//                         mobileNo = "92" + raw.slice(1);
//                     }
//                     // If it already starts with "+92", keep as is
//                     else if (raw.startsWith("92")) {
//                         mobileNo = raw;
//                     }
//                     // If it starts with "92" but no "+", add it
//                     else if (raw.startsWith("92")) {
//                         mobileNo = "" + raw;
//                     }
//                     // Otherwise, just add "+92"
//                     else {
//                         mobileNo = "92" + raw;
//                     }
//                 }

//                 const message = `معزز کسٹمر، السلام علیکم! 🌸\n` +
//                     `آپ کے ذمہ پارکو الیکٹرک اینڈ الیکٹرانک اسٹور، تیمرگرہ کے کچھ بقایا جات موجود ہیں۔ 💰\n` +
//                     `براہِ کرم جلد از جلد ادائیگی فرما دیں تاکہ ہمارا کاروباری تعلق خوش اسلوبی سے جاری رہے۔ 🤝✨\n\n` +
//                     `آپ کے تعاون کا شکریہ! 🙏\n` +
//                     `پارکو الیکٹرک اینڈ الیکٹرانک اسٹور — جہاں اعتماد اور کوالٹی ہمیشہ ساتھ چلتے ہیں! ⚡`;

//                 // if (mobileNo?.length > 10) {
//                 //     await sendWhatsappMessage(mobileNo, message);
//                 // }

//                 // console.log(`✅ Message sent to ${customer.name}`);
//             }
//             console.log("✅ Message sent successfully!");
//         } catch (error) {
//             console.error("❌ Error sending scheduled messages:", error);
//         }
//     },
//     {
//         timezone: "Asia/Karachi",
//     }
// );
