import { semanticMemory } from './packages/backend/src/services/SemanticMemory.js';

async function testChunking() {
  console.log('Testing Semantic Chunking...');
  
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
  
  const chunks = semanticMemory.chunkText(text, 50, 10);
  console.log(`Generated ${chunks.length} chunks:`);
  chunks.forEach((c, i) => {
    console.log(`--- Chunk ${i} ---`);
    console.log(c);
  });
}

testChunking();
