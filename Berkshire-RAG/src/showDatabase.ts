// src/showDatabase.ts
import 'dotenv/config';
import { Pool } from 'pg';
import { setupVectorDatabase } from './mastra/db/vectorStore';

async function showDatabaseContents() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('📊 Database Contents:');
    console.log('=====================');

    // Show total documents
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM berkshire_documents');
    console.log(`Total documents stored: ${totalResult.rows[0].total}`);

    // Show documents by year
    const yearResult = await pool.query(`
      SELECT year, COUNT(*) as count 
      FROM berkshire_documents 
      GROUP BY year 
      ORDER BY year DESC
    `);
    
    console.log('\n📈 Documents by Year:');
    yearResult.rows.forEach(row => {
      console.log(`  ${row.year}: ${row.count} chunks`);
    });

    // Show sample documents
    console.log('\n📄 Sample Documents:');
    const sampleResult = await pool.query(`
      SELECT 
        id,
        SUBSTRING(content, 1, 150) as content_preview,
        filename,
        year,
        chunk_index,
        jsonb_array_length(embedding) as embedding_dimensions
      FROM berkshire_documents 
      ORDER BY chunk_index 
      LIMIT 3
    `);

    sampleResult.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Document: ${row.id}`);
      console.log(`   Content: "${row.content_preview}..."`);
      console.log(`   File: ${row.filename} (Year: ${row.year}, Chunk: ${row.chunk_index})`);
      console.log(`   Embedding: ${row.embedding_dimensions} dimensions`);
    });

    // Test similarity search
    console.log('\n🔍 Testing Similarity Search:');
    const vectorStore = await setupVectorDatabase();
    
    const searchResults = await vectorStore.searchByText(
      "What is Warren Buffett's investment philosophy?",
      3
    );

    console.log('\nQuery: "What is Warren Buffett\'s investment philosophy?"');
    searchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. Similarity: ${(result.similarity * 100).toFixed(2)}%`);
      console.log(`   Content: "${result.content.substring(0, 150)}..."`);
      console.log(`   Source: ${result.filename} (${result.year})`);
    });

    await vectorStore.close();
    console.log('\n✅ Database demonstration completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

showDatabaseContents(); 