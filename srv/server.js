const cds = require('@sap/cds');
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

cds.on('bootstrap', (app) => {
    app.post('/api/uploadPdf', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).send('No file uploaded.');

            const data = await pdfParse(req.file.buffer);
            const text = data.text;

            // Optional: specify api key manually if process.env isn't loaded globally in server
            const embeddings = new GoogleGenerativeAIEmbeddings({
                modelName: "text-embedding-004"
            });

            const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
            const docs = await textSplitter.createDocuments([text]);

            // Save to global MemoryVectorStore
            let vectorStore = global.myVectorStore;
            if (!vectorStore) {
                vectorStore = new MemoryVectorStore(embeddings);
                global.myVectorStore = vectorStore;
            }
            await vectorStore.addDocuments(docs);

            res.json({ message: 'Document ingested successfully.', chunks: docs.length });
        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).send(error.message);
        }
    });
});

module.exports = cds.server;
