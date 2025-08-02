// src/mastra/tools/ragTools.ts
import { VectorStore } from '../db/vectorStore';

// Simple function for vector search (can be called directly)
export async function vectorSearch(query: string, limit: number = 5, year?: string, minSimilarity: number = 0.7) {
  try {
    const vectorStore = new VectorStore();
    
    const results = await vectorStore.searchByText(query, limit, {
      year,
      minSimilarity
    });

    const formattedResults = results.map((result, index) => ({
      rank: index + 1,
      content: result.content,
      source: {
        filename: result.filename,
        year: result.year,
        chunkIndex: result.metadata.chunkIndex
      },
      similarity: Math.round(result.similarity * 100) / 100,
      relevanceScore: result.similarity > 0.8 ? 'high' : result.similarity > 0.7 ? 'medium' : 'low'
    }));
    
    return {
      success: true,
      query,
      totalResults: results.length,
      results: formattedResults,
      searchMetadata: {
        filters: { year, minSimilarity },
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Vector search failed: ${error instanceof Error ? error.message : String(error)}`,
      query,
      results: []
    };
  }
}

// Simple function for document filtering
export async function filterDocuments(year?: string, filename?: string, searchTerm?: string, limit: number = 10) {
  try {
    const vectorStore = new VectorStore();
    
    if (searchTerm) {
      // Use semantic search if search term provided
      const results = await vectorStore.searchByText(searchTerm, limit, {
        year,
        filename,
        minSimilarity: 0.5 // Lower threshold for filtering
      });

      return {
        success: true,
        filterCriteria: { year, filename, searchTerm },
        totalResults: results.length,
        documents: results.map(result => ({
          id: result.id,
          content: result.content.substring(0, 500) + '...', // Truncate for readability
          source: {
            filename: result.filename,
            year: result.year,
            chunkIndex: result.metadata.chunkIndex
          },
          similarity: Math.round(result.similarity * 100) / 100
        }))
      };
    } else {
      // Use direct database query for metadata filtering
      // This would require additional implementation in VectorStore
      return {
        success: false,
        error: 'Metadata-only filtering not yet implemented. Please provide a searchTerm.',
        filterCriteria: { year, filename }
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Document filtering failed: ${error instanceof Error ? error.message : String(error)}`,
      filterCriteria: { year, filename, searchTerm }
    };
  }
}

// Simple function for getting document statistics
export async function getDocumentStats() {
  try {
    const vectorStore = new VectorStore();
    const stats = await vectorStore.getStats();

    return {
      success: true,
      statistics: {
        totalDocuments: stats.totalDocuments,
        availableYears: stats.documentsByYear.map(item => item.year),
        yearBreakdown: stats.documentsByYear,
        fileBreakdown: stats.documentsByFile,
        dataSource: 'Berkshire Hathaway Annual Shareholder Letters',
        lastUpdated: new Date().toISOString()
      },
      summary: `Database contains ${stats.totalDocuments} document chunks from ${stats.documentsByYear.length} years (${stats.documentsByYear.map(y => y.year).join(', ')})`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to retrieve document statistics: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Simple function for document retrieval
export async function retrieveDocument(documentId?: string, filename?: string, contextWindow: number = 2) {
  try {
    // This would require additional implementation in VectorStore
    // For now, return a placeholder response
    return {
      success: false,
      error: 'Direct document retrieval not yet implemented. Use vector-search instead.',
      requestedId: documentId,
      requestedFilename: filename
    };
  } catch (error) {
    return {
      success: false,
      error: `Document retrieval failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Export the functions for direct use
export const ragFunctions = {
  vectorSearch,
  filterDocuments,
  getDocumentStats,
  retrieveDocument
};