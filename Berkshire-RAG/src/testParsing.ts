// src/testParsing.ts
import 'dotenv/config';
import { DocumentProcessor } from './mastra/workflows/documentProcessor';
import * as fs from 'fs';
import * as path from 'path';

async function testDocumentParsing() {
  try {
    console.log('🧪 Testing document parsing...');
    
    // Check if Data folder exists
    const dataPath = path.join(process.cwd(), 'Data');
    if (!fs.existsSync(dataPath)) {
      console.log('❌ Data folder not found. Creating it...');
      fs.mkdirSync(dataPath, { recursive: true });
      console.log('📁 Created Data folder. Please add PDF files to it.');
      return;
    }
    
    // List PDF files
    const files = fs.readdirSync(dataPath).filter(file => file.endsWith('.pdf'));
    console.log(`📄 Found ${files.length} PDF files in Data folder:`);
    files.forEach(file => console.log(`   - ${file}`));
    
    if (files.length === 0) {
      console.log('❌ No PDF files found in Data folder.');
      console.log('💡 Please add Berkshire Hathaway PDF files to the Data folder.');
      return;
    }
    
    // Test parsing
    const processor = new DocumentProcessor();
    
    console.log('\n🔍 Testing PDF parsing...');
    const rawDocuments = await processor.parsePDFs();
    
    console.log(`✅ Successfully parsed ${rawDocuments.length} documents`);
    
    // Show sample content from first document
    if (rawDocuments.length > 0) {
      const firstDoc = rawDocuments[0];
      console.log(`\n📋 Sample from ${firstDoc.filename} (${firstDoc.year}):`);
      console.log(`Content length: ${firstDoc.content.length} characters`);
      console.log(`First 200 characters: "${firstDoc.content.substring(0, 200)}..."`);
    }
    
    // Test chunking
    console.log('\n✂️ Testing document chunking...');
    const chunks = await processor.createDocumentChunks(rawDocuments);
    console.log(`✅ Created ${chunks.length} chunks from ${rawDocuments.length} documents`);
    
    // Show sample chunk
    if (chunks.length > 0) {
      const firstChunk = chunks[0];
      console.log(`\n📄 Sample chunk from ${firstChunk.metadata.filename}:`);
      console.log(`Chunk ID: ${firstChunk.id}`);
      console.log(`Chunk size: ${firstChunk.content.length} characters`);
      console.log(`First 150 characters: "${firstChunk.content.substring(0, 150)}..."`);
    }
    
    console.log('\n🎉 Document parsing test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during parsing test:', error);
  }
}

// Run the test
testDocumentParsing(); 