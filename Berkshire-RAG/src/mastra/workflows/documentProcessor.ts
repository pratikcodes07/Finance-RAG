// src/mastra/workflows/documentProcessor.ts
import 'dotenv/config';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import PDFParser from 'pdf2json';

export interface ProcessedDocument {
  id: string;
  content: string;
  metadata: {
    filename: string;
    year: string;
    pageNumber?: number;
    chunkIndex: number;
  };
  embedding?: number[];
}

export class DocumentProcessor {
  private openai: OpenAI;
  private dataPath: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.dataPath = path.join(process.cwd(), 'Data'); // Note: Capital D for Data folder
  }

  // Parse PDF files
  async parsePDFs(): Promise<{ filename: string; content: string; year: string }[]> {
    const files = fs.readdirSync(this.dataPath).filter(file => file.endsWith('.pdf'));
    const documents: { filename: string; content: string; year: string }[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.dataPath, file);
        const year = this.extractYearFromFilename(file);
        const content = await this.extractTextFromPDF(filePath);
        
        documents.push({
          filename: file,
          content,
          year
        });

        console.log(` Processed ${file} (${year}) - ${content.length} characters`);
      } catch (error) {
        console.error(` Error processing ${file}:`, error);
      }
    }

    return documents;
  }

  // Create document chunks
  async createDocumentChunks(documents: { filename: string; content: string; year: string }[]): Promise<ProcessedDocument[]> {
    const processedDocs: ProcessedDocument[] = [];

    for (const doc of documents) {
      // Chunk the document content
      const chunks = this.chunkDocument(doc.content, 1000, 200); // 1000 chars with 200 overlap
      
      for (let i = 0; i < chunks.length; i++) {
        const processedDoc: ProcessedDocument = {
          id: `${doc.filename}_chunk_${i}`,
          content: chunks[i],
          metadata: {
            filename: doc.filename,
            year: doc.year,
            chunkIndex: i,
          }
        };

        processedDocs.push(processedDoc);
      }
    }

    console.log(` Created ${processedDocs.length} document chunks from ${documents.length} letters`);
    return processedDocs;
  }

  // Generate embeddings
  async generateEmbeddings(processedDocs: ProcessedDocument[]): Promise<ProcessedDocument[]> {
    const docsWithEmbeddings: ProcessedDocument[] = [];

    for (const doc of processedDocs) {
      try {
        const embedding = await this.createEmbedding(doc.content);
        
        docsWithEmbeddings.push({
          ...doc,
          embedding
        });

        console.log(` Generated embedding for ${doc.id}`);
      } catch (error) {
        console.error(` Error generating embedding for ${doc.id}:`, error);
      }
    }

    return docsWithEmbeddings;
  }

  // Main processing function
  async processDocuments(): Promise<ProcessedDocument[]> {
    console.log(' Starting document processing...');
    
    // Step 1: Parse PDFs
    const rawDocuments = await this.parsePDFs();
    
    // Step 2: Create document chunks
    const processedDocuments = await this.createDocumentChunks(rawDocuments);
    
    // Step 3: Generate embeddings
    const documentsWithEmbeddings = await this.generateEmbeddings(processedDocuments);
    
    console.log(` Processing complete! ${documentsWithEmbeddings.length} chunks ready for vector storage`);
    
    return documentsWithEmbeddings;
  }

  // Helper: Extract text from PDF
  private extractTextFromPDF(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', reject);
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let text = '';
          pdfData.Pages.forEach((page: any) => {
            page.Texts.forEach((textItem: any) => {
              textItem.R.forEach((textRun: any) => {
                text += decodeURIComponent(textRun.T) + ' ';
              });
            });
          });
          resolve(text.trim());
        } catch (error) {
          reject(error);
        }
      });
      
      pdfParser.loadPDF(filePath);
    });
  }

  // Helper: Extract year from filename
  private extractYearFromFilename(filename: string): string {
    const yearMatch = filename.match(/(\d{4})/);
    return yearMatch ? yearMatch[1] : 'unknown';
  }

  // Helper: Chunk document content
  private chunkDocument(content: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      let chunk = content.slice(start, end);

      // Try to end at a sentence boundary
      if (end < content.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const boundary = Math.max(lastPeriod, lastNewline);
        
        if (boundary > start + chunkSize * 0.7) {//00+700
          chunk = content.slice(start, boundary + 1);//(0,801)
          start = boundary + 1 - overlap;//600
        } else {
          start = end - overlap;//1000-200=>800
        }
      } else {
        start = end;
      }

      if (chunk.trim().length > 50) { // Only add substantial chunks
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  // Helper: Create embedding using OpenAI
  private async createEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Truncate if too long
    });

    return response.data[0].embedding;
  }
}

// Export a simple function to process documents
export async function processBerkshireDocuments(): Promise<ProcessedDocument[]> {
  const processor = new DocumentProcessor();
  return await processor.processDocuments();
}