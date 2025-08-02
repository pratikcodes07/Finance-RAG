// src/testEmbeddings.ts
import 'dotenv/config';
import { Pool } from 'pg';
import { OpenAI } from 'openai';

async function testEmbeddings() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔗 Connecting to database...');
    const client = await pool.connect();
    
    // Create a simple table to store embeddings as JSON
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_embeddings (
        id SERIAL PRIMARY KEY,
        text_content TEXT NOT NULL,
        embedding JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Table created successfully');

    // Generate embeddings for some sample text
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const sampleTexts = [
      "Warren Buffett's investment philosophy focuses on value investing.",
      "Berkshire Hathaway is a multinational conglomerate holding company.",
      "The annual shareholder letter discusses company performance and strategy."
    ];

    console.log('🧠 Generating embeddings...');
    
    for (const text of sampleTexts) {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const embedding = embeddingResponse.data[0].embedding;
      
      // Store in database
      await client.query(
        'INSERT INTO test_embeddings (text_content, embedding) VALUES ($1, $2)',
        [text, JSON.stringify(embedding)]
      );
      
      console.log(`✅ Stored embedding for: "${text.substring(0, 50)}..."`);
    }

    // Show stored embeddings
    console.log('\n📊 Stored Embeddings:');
    const result = await client.query('SELECT * FROM test_embeddings');
    
    result.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Text: "${row.text_content}"`);
      console.log(`   Embedding: [${row.embedding.slice(0, 5).join(', ')}, ...] (${row.embedding.length} dimensions)`);
    });

    // Test similarity search
    console.log('\n🔍 Testing similarity search...');
    const queryText = "What is Warren Buffett's approach to investing?";
    
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });

    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
    
    // Calculate similarities manually
    const similarities = result.rows.map(row => {
      const storedEmbedding = row.embedding;
      const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding);
      
      return {
        text: row.text_content,
        similarity: similarity
      };
    });

    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`\nQuery: "${queryText}"`);
    console.log('\nSimilarity Results:');
    similarities.forEach((item, index) => {
      console.log(`${index + 1}. Similarity: ${(item.similarity * 100).toFixed(2)}% - "${item.text}"`);
    });

    client.release();
    console.log('\n✅ Embedding demonstration completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

// Calculate cosine similarity between two vectors
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
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

testEmbeddings(); 