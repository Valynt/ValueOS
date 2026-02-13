import { SemanticMemoryService } from './packages/backend/src/services/SemanticMemory.js';

// Subclass to avoid constructor side effects (Supabase init)
class TestSemanticMemoryService extends SemanticMemoryService {
  constructor() {
    // Skip real constructor
    super();
  }
}

async function testChunking() {
  console.log('Testing Semantic Chunking Logic...');
  
  const service = new SemanticMemoryService();
  // We just want to test chunkText which doesn't use Supabase
  
  const text = `
# Header 1
This is a section about something important.
It has multiple lines.

## Subheader 1.1
This is more specific detail.
We want to see how it splits.

## Subheader 1.2
Another subheader to test splitting.
  `;
  
  const chunks = service.chunkText(text, 100, 20);
  console.log(`Generated ${chunks.length} chunks:`);
  chunks.forEach((c, i) => {
    console.log(`--- Chunk ${i} (Length: ${c.length}) ---`);
    console.log(`[${c}]`);
  });
}

// Mock process.env to avoid error in constructor before we can even extend it
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'mock';

testChunking();
