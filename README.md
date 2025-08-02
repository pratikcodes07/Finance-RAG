# Berkshire Hathaway RAG Application

A Retrieval-Augmented Generation (RAG) system that processes Warren Buffett's annual shareholder letters and enables intelligent question-answering using vector embeddings and similarity search.

## 🎯 Project Overview

This application demonstrates a complete RAG pipeline:
- **Document Processing**: Extracts and chunks PDF documents
- **Vector Embeddings**: Generates embeddings using OpenAI's text-embedding-3-small
- **Vector Storage**: Stores embeddings in PostgreSQL with similarity search
- **Intelligent Retrieval**: Finds relevant content based on semantic similarity

## 🏗️ Architecture

```
Berkshire-RAG/
├── Data/                    # PDF documents to process
├── src/
│   ├── mastra/
│   │   ├── agents/         # AI agents for Q&A
│   │   ├── db/            # Vector database operations
│   │   ├── tools/         # RAG tools and utilities
│   │   └── workflows/     # Document processing pipeline
│   ├── processDocuments.ts # Main processing script
│   ├── testParsing.ts     # PDF parsing tests
│   ├── testEmbeddings.ts  # Embedding demonstration
│   └── showDatabase.ts    # Database contents viewer
├── package.json
└── README.md
```

## 🚀 Features

- **PDF Processing**: Extracts text from Berkshire Hathaway shareholder letters
- **Smart Chunking**: Splits documents into meaningful chunks for better retrieval
- **Vector Embeddings**: Generates 1536-dimensional embeddings using OpenAI
- **Similarity Search**: Finds most relevant content using cosine similarity
- **Database Storage**: PostgreSQL with automatic pgvector fallback
- **Interactive Demo**: Built-in scripts for testing and demonstration

## 📋 Prerequisites

- **Node.js** (>=20.9.0)
- **PostgreSQL** (with pgvector extension optional)
- **OpenAI API Key**

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Berkshire-RAG
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/your_database
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=development
   ```

4. **Set up database**
   - Create a PostgreSQL database
   - The application will automatically handle pgvector extension setup

## 📖 Usage

### 1. Process Documents
```bash
npm run process-docs
```
This will:
- Process PDF files in the `Data/` directory
- Generate embeddings for each chunk
- Store them in the database

### 2. View Database Contents
```bash
npm run show-db
```
Shows:
- Total documents stored
- Documents by year
- Sample document contents
- Similarity search demonstration

### 3. Test Embeddings
```bash
npm run test-embeddings
```
Demonstrates basic embedding storage and similarity search.

### 4. Test PDF Parsing
```bash
npm run test-parsing
```
Tests PDF text extraction and chunking.

## 🔧 Database Setup

### Option 1: Local PostgreSQL
1. Install PostgreSQL
2. Create a database
3. Update `.env` with your connection string

### Option 2: Cloud Database (Recommended)
- **Neon**: Free tier with pgvector pre-installed
- **Supabase**: Free tier with pgvector support

### pgvector Extension
The application automatically detects if pgvector is available:
- **With pgvector**: Uses native vector types and PostgreSQL similarity search
- **Without pgvector**: Uses JSONB storage with JavaScript similarity calculation

## 📊 Database Schema

```sql
CREATE TABLE berkshire_documents (
  id VARCHAR(255) PRIMARY KEY,
  content TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  year VARCHAR(4) NOT NULL,
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER,
  source VARCHAR(100) DEFAULT 'berkshire_hathaway_letters',
  embedding vector(1536) OR JSONB, -- Depends on pgvector availability
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🧠 How It Works

1. **Document Ingestion**: PDF files are processed and text is extracted
2. **Chunking**: Text is split into meaningful chunks (configurable size)
3. **Embedding Generation**: Each chunk gets a 1536-dimensional embedding
4. **Vector Storage**: Embeddings are stored in PostgreSQL
5. **Similarity Search**: Queries are embedded and matched against stored vectors
6. **Retrieval**: Most similar chunks are returned for context

## 🎯 Example Queries

The system can answer questions like:
- "What is Warren Buffett's investment philosophy?"
- "How does Berkshire Hathaway approach acquisitions?"
- "What are the key principles of value investing?"

## 🔍 Similarity Search

The application uses cosine similarity to find the most relevant content:
- **Query embedding**: Generated from user question
- **Document embeddings**: Stored in database
- **Similarity calculation**: Cosine similarity between vectors
- **Ranking**: Results sorted by similarity score

## 📈 Performance

- **Processing**: ~28 chunks per letter (configurable)
- **Embedding dimensions**: 1536 (OpenAI text-embedding-3-small)
- **Storage**: JSONB or native vector types
- **Search speed**: Optimized with database indexes

## 🛡️ Error Handling

- **pgvector fallback**: Automatic detection and JSONB storage
- **Database connection**: Graceful error handling
- **API limits**: Rate limiting and retry logic
- **Validation**: Input validation and error messages

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run process-docs` | Process PDF documents and store embeddings |
| `npm run show-db` | Display database contents and demo RAG |
| `npm run test-embeddings` | Test embedding storage and similarity |
| `npm run test-parsing` | Test PDF parsing functionality |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- **OpenAI** for embedding models
- **PostgreSQL** for database storage
- **pgvector** for vector operations
- **Mastra** framework for AI agents

## 📞 Support

For questions or issues, please open an issue on GitHub.

---

**Built with ❤️ for demonstrating RAG capabilities with Warren Buffett's wisdom**
