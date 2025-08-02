// src/processDocuments.ts
import 'dotenv/config';
import { processBerkshireDocuments } from './mastra/workflows/documentProcessor';
import { setupVectorDatabase } from './mastra/db/vectorStore';

async function main() {
  try {
    console.log(' Starting Berkshire Hathaway document processing...');
    
    // Process documents
    const documents = await processBerkshireDocuments();
    
    if (documents.length === 0) {
      console.log(' No documents processed. Check if PDF files exist in the Data folder.');
      return;
    }
    
    console.log(` Successfully processed ${documents.length} document chunks`);
    
    // Initialize vector database
    console.log(' Initializing vector database...');
    const vectorStore = await setupVectorDatabase();
    
    // Store documents in vector database
    console.log(' Storing documents in vector database...');
    await vectorStore.storeDocuments(documents);
    
    console.log(' Document processing and storage complete!');
    
    // Get stats
    const stats = await vectorStore.getStats();
    console.log(' Database Statistics:', stats);
    
    // Close database connection
    await vectorStore.close();
    
  } catch (error) {
    console.error(' Error during document processing:', error);
  }
}

// Run the main function
main(); 