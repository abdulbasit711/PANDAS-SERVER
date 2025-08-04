import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Generate barcode image
export const generateBarcodeImage = async (text, options = {}) => {
  try {
    const { scale = 3, height = 10, width = 10 } = options;
    const png = await bwipjs.toBuffer({
      bcid: 'code128',       // Barcode type
      text: text,            // Text to encode
      scale: scale,          // Scaling factor
      height: height,        // Bar height, in millimeters
      width: width,          // Bar width, in millimeters
      includetext: true,     // Show human-readable text
      textxalign: 'center',  // Text alignment
    });
    return png;
  } catch (error) {
    throw new Error(`Barcode generation failed: ${error.message}`);
  }
};

// Generate PDF with multiple barcodes
export const generateBarcodePDF = async (products) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 20 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let x = 50;
      let y = 50;
      const maxPerRow = 4;
      const barcodeWidth = 100;
      const barcodeHeight = 50;
      const padding = 20;

      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        const png = await bwipjs.toBuffer({
          bcid: 'code128',
          text: product.productCode || product._id.toString(),
          scale: 2,
          height: 10,
          includetext: true,
          textxalign: 'center',
        });

        doc.image(png, x, y, {
          width: barcodeWidth,
          height: barcodeHeight,
          align: 'center',
          valign: 'center'
        });

        doc.fontSize(10)
          .text(product.productName.substring(0, 20), x, y + barcodeHeight + 5, {
            width: barcodeWidth,
            align: 'center'
          });

        if ((i + 1) % maxPerRow === 0) {
          x = 50;
          y += barcodeHeight + 40;
        } else {
          x += barcodeWidth + padding;
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
