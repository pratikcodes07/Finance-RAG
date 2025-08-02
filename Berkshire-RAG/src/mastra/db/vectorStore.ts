// src/mastra/db/vectorStore.ts
import { Pool } from 'pg';
import  { ProcessedDocument } from '../workflows/documentProcessor';

export class VectorStore {
  private pool: Pool;
  private useVectorExtension: boolean = false;

  constructor() {
    // Use SQLite if DATABASE_URL is not set or if it's a SQLite URL
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl || databaseUrl.startsWith('sqlite://')) {
      console.log(' Using SQLite for vector storage (easier setup)');
      // For now, we'll use PostgreSQL but with better error handling
      this.pool = new Pool({
        connectionString: databaseUrl || 'postgresql://localhost:5432/berkshire_rag',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
    } else {
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
    }
  }

  // Initialize vector storage tables
  async initialize(): Promise<void> {
    try {
      // Test connection first
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      // Try to create vector extension
      try {
        await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
        this.useVectorExtension = true;
        console.log('✅ pgvector extension enabled');
      } catch (error) {
        console.log('⚠️ pgvector extension not available, using JSON storage');
        this.useVectorExtension = false;
      }
      
      if (this.useVectorExtension) {
        // Create documents table with vector column
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS berkshire_documents (
            id VARCHAR(255) PRIMARY KEY,
            content TEXT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            year VARCHAR(4) NOT NULL,
            chunk_index INTEGER NOT NULL,
            total_chunks INTEGER,
            source VARCHAR(100) DEFAULT 'berkshire_hathaway_letters',
            embedding vector(1536), -- OpenAI text-embedding-3-small dimension
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create index for vector similarity search
        await this.pool.query(`
          CREATE INDEX IF NOT EXISTS berkshire_documents_embedding_idx 
          ON berkshire_documents 
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
        `);
      } else {
        // Create documents table with JSON storage for embeddings
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS berkshire_documents (
            id VARCHAR(255) PRIMARY KEY,
            content TEXT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            year VARCHAR(4) NOT NULL,
            chunk_index INTEGER NOT NULL,
            total_chunks INTEGER,
            source VARCHAR(100) DEFAULT 'berkshire_hathaway_letters',
            embedding JSONB, -- Store embeddings as JSON
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create GIN index for JSONB embeddings
        await this.pool.query(`
          CREATE INDEX IF NOT EXISTS berkshire_documents_embedding_idx 
          ON berkshire_documents USING GIN (embedding)
        `);
      }

      // Create indexes for metadata filtering
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS berkshire_documents_year_idx 
        ON berkshire_documents (year)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS berkshire_documents_filename_idx 
        ON berkshire_documents (filename)
      `);

      console.log(' Vector database tables initialized successfully');
    } catch (error) {
      console.error(' Error initializing vector database:', error);
      console.log(' Database connection failed. Please check your DATABASE_URL in .env file');
      console.log(' Example DATABASE_URL: postgresql://username:password@localhost:5432/berkshire_rag');
      throw error;
    }
  }

  // Store documents with embeddings
  async storeDocuments(documents: ProcessedDocument[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const doc of documents) {
        if (this.useVectorExtension) {
          await client.query(`
            INSERT INTO berkshire_documents 
            (id, content, filename, year, chunk_index, total_chunks, embedding)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              updated_at = CURRENT_TIMESTAMP
          `, [
            doc.id,
            doc.content,
            doc.metadata.filename,
            doc.metadata.year,
            doc.metadata.chunkIndex,
            1, // Default total chunks to 1
            JSON.stringify(doc.embedding) // PostgreSQL vector format
          ]);
        } else {
          await client.query(`
            INSERT INTO berkshire_documents 
            (id, content, filename, year, chunk_index, total_chunks, embedding)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              updated_at = CURRENT_TIMESTAMP
          `, [
            doc.id,
            doc.content,
            doc.metadata.filename,
            doc.metadata.year,
            doc.metadata.chunkIndex,
            1, // Default total chunks to 1
            JSON.stringify(doc.embedding) // Store as JSON
          ]);
        }
      }
      
      await client.query('COMMIT');
      console.log(` Stored ${documents.length} documents in vector database`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(' Error storing documents:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Calculate cosine similarity between two vectors
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (norm1 * norm2);
  }

  // Vector similarity search
  async searchSimilar(
    queryEmbedding: number[], 
    limit: number = 5,
    filters?: {
      year?: string;
      filename?: string;
      minSimilarity?: number;
    }
  ): Promise<{
    id: string;
    content: string;
    filename: string;
    year: string;
    similarity: number;
    metadata: any;
  }[]> {
    try {
      if (this.useVectorExtension) {
        // Use pgvector for similarity search
        let query = `
          SELECT 
            id,
            content,
            filename,
            year,
            chunk_index,
            total_chunks,
            1 - (embedding <=> $1::vector) as similarity
          FROM berkshire_documents
          WHERE 1=1
        `;
        
        const params: any[] = [JSON.stringify(queryEmbedding)];
        let paramCount = 1;

        // Add filters
        if (filters?.year) {
          paramCount++;
          query += ` AND year = $${paramCount}`;
          params.push(filters.year);
        }

        if (filters?.filename) {
          paramCount++;
          query += ` AND filename = $${paramCount}`;
          params.push(filters.filename);
        }

        if (filters?.minSimilarity) {
          paramCount++;
          query += ` AND (1 - (embedding <=> $1::vector)) >= $${paramCount}`;
          params.push(filters.minSimilarity);
        }

        query += ` ORDER BY embedding <=> $1::vector LIMIT $${paramCount + 1}`;
        params.push(limit);

        const result = await this.pool.query(query, params);

        return result.rows.map(row => ({
          id: row.id,
          content: row.content,
          filename: row.filename,
          year: row.year,
          similarity: parseFloat(row.similarity),
          metadata: {
            chunkIndex: row.chunk_index,
            totalChunks: row.total_chunks
          }
        }));
      } else {
        // Use JavaScript for similarity search
        let query = `
          SELECT 
            id,
            content,
            filename,
            year,
            chunk_index,
            total_chunks,
            embedding
          FROM berkshire_documents
          WHERE 1=1
        `;
        
        const params: any[] = [];
        let paramCount = 0;

        // Add filters
        if (filters?.year) {
          paramCount++;
          query += ` AND year = $${paramCount}`;
          params.push(filters.year);
        }

        if (filters?.filename) {
          paramCount++;
          query += ` AND filename = $${paramCount}`;
          params.push(filters.filename);
        }

        const result = await this.pool.query(query, params);

        // Calculate similarities in JavaScript
        const similarities = result.rows.map(row => {
          const storedEmbedding = JSON.parse(row.embedding);
          const similarity = this.calculateCosineSimilarity(queryEmbedding, storedEmbedding);
          
          return {
            id: row.id,
            content: row.content,
            filename: row.filename,
            year: row.year,
            similarity: similarity,
            metadata: {
              chunkIndex: row.chunk_index,
              totalChunks: row.total_chunks
            }
          };
        });

        // Filter by minimum similarity if specified
        let filtered = similarities;
        if (filters?.minSimilarity) {
          filtered = similarities.filter(item => item.similarity >= filters.minSimilarity!);
        }

        // Sort by similarity and limit
        return filtered
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      }
    } catch (error) {
      console.error(' Error in vector search:', error);
      throw error;
    }
  }

  // Search by text query (generates embedding first)
  async searchByText(
    query: string,
    limit: number = 5,
    filters?: {
      year?: string;
      filename?: string;
      minSimilarity?: number;
    }
  ): Promise<{
    id: string;
    content: string;
    filename: string;
    year: string;
    similarity: number;
    metadata: any;
  }[]> {
    // Generate embedding for the query
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    return this.searchSimilar(queryEmbedding, limit, filters);
  }

  // Get document statistics
  async getStats(): Promise<{
    totalDocuments: number;
    documentsByYear: { year: string; count: number }[];
    documentsByFile: { filename: string; count: number }[];
  }> {
    try {
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as total FROM berkshire_documents'
      );

      const yearResult = await this.pool.query(`
        SELECT year, COUNT(*) as count 
        FROM berkshire_documents 
        GROUP BY year 
        ORDER BY year DESC
      `);

      const fileResult = await this.pool.query(`
        SELECT filename, COUNT(*) as count 
        FROM berkshire_documents 
        GROUP BY filename 
        ORDER BY count DESC
      `);

      return {
        totalDocuments: parseInt(totalResult.rows[0].total),
        documentsByYear: yearResult.rows.map(row => ({
          year: row.year,
          count: parseInt(row.count)
        })),
        documentsByFile: fileResult.rows.map(row => ({
          filename: row.filename,
          count: parseInt(row.count)
        }))
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      throw error;
    }
  }

  // Clean up resources
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Utility function to setup vector database
export async function setupVectorDatabase(): Promise<VectorStore> {
  const vectorStore = new VectorStore();
  await vectorStore.initialize();
  return vectorStore;
}