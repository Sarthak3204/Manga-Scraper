import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

const baseUrl = "https://example.com/manga/chapter-";
const chapterStart = 1;
const chapterEnd = 100;
const outputPdf = `Chapter ${chapterStart}-${chapterEnd}.pdf`;

async function getImagesFromChapter(chapterUrl) {
    const { data } = await axios.get(chapterUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const $ = cheerio.load(data);
    const imageUrls = [];

    $("img").each((_, img) => {
        const src = $(img).attr("src");
        if (src) imageUrls.push(src);
    });

    return imageUrls;
}

function isJpeg(buffer) {
    return buffer[0] === 0xFF && buffer[1] === 0xD8;
}

function isPng(buffer) {
    return buffer[0] === 0x89 && buffer[1] === 0x50;
}

async function addImagesToPdf(pdfDoc, imageUrls) {
    for (const url of imageUrls) {
        try {
            const imgResp = await axios.get(url, { responseType: "arraybuffer" });
            const data = imgResp.data;

            let img;
            if (isPng(data)) {
                img = await pdfDoc.embedPng(data);
            } else if (isJpeg(data)) {
                img = await pdfDoc.embedJpg(data);
            } else {
                console.warn(`Skipping ${url} — not a valid PNG or JPEG`);
                continue;
            }

            const page = pdfDoc.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } catch (err) {
            console.error(`Failed to process image: ${url}`, err.message);
        }
    }
}

async function main() {
    const pdfDoc = await PDFDocument.create();

    for (let ch = chapterStart; ch <= chapterEnd; ch++) {
        const url = `${baseUrl}${ch}/`;
        console.log(`Fetching Chapter ${ch}...`);
        const images = await getImagesFromChapter(url);
        console.log(`Saving Chapter ${ch}...`);
        await addImagesToPdf(pdfDoc, images);
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPdf, pdfBytes);
    console.log(`Saved PDF: ${outputPdf}`);
}

main().catch(console.error);