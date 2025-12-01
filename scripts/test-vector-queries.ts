#!/usr/bin/env ts-node
/**
 * Vector Store Query Test Script
 * 
 * Interactive script to test pgvector queries on real data
 * 
 * Usage:
 *   npx ts-node scripts/test-vector-queries.ts
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
if (!openaiKey) {
  console.error('❌ Missing OPENAI_API_KEY or VITE_OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiKey });

// ============================================================================
// Helper Functions
// ============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  console.log('🔄 Generating embedding...');
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
  });
  console.log('✅ Embedding generated');
  return response.data[0].embedding;
}

function formatResult(result: any, index: number) {
  const content = typeof result.content === 'string' 
    ? result.content.slice(0, 200)
    : JSON.stringify(result.content).slice(0, 200);
    
  return `
${index + 1}. Similarity: ${result.similarity.toFixed(3)}
   Type: ${result.type}
   Created: ${new Date(result.created_at).toLocaleDateString()}
   Industry: ${result.metadata?.industry || 'N/A'}
   Content: ${content}...
   ID: ${result.id}
  `;
}

// ============================================================================
// Test Functions
// ============================================================================

async function testBasicSearch() {
  console.log('\n🔍 Test 1: Basic Similarity Search');
  console.log('=====================================\n');

  const query = 'reduce cloud infrastructure costs';
  console.log(`Query: "${query}"\n`);

  const embedding = await generateEmbedding(query);

  // Direct SQL approach
  console.log('📊 Running vector search...\n');
  const { data, error } = await supabase.rpc('search_semantic_memory', {
    query_embedding: embedding,
    match_threshold: 0.60,
    match_count: 5,
    filter_clause: ''
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No results found. Try:');
    console.log('   1. Lowering threshold');
    console.log('   2. Adding test data with: npm run seed:memories');
    return;
  }

  console.log(`✅ Found ${data.length} similar memories:\n`);
  data.forEach((result: any, i: number) => {
    console.log(formatResult(result, i));
  });
}

async function testFilteredSearch() {
  console.log('\n🎯 Test 2: Filtered Search by Type');
  console.log('=====================================\n');

  const query = 'opportunity to improve sales process';
  console.log(`Query: "${query}"`);
  console.log(`Filter: type = 'opportunity'\n`);

  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('search_semantic_memory', {
    query_embedding: embedding,
    match_threshold: 0.65,
    match_count: 5,
    filter_clause: "WHERE type = 'opportunity'"
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} opportunities:\n`);
  data?.forEach((result: any, i: number) => {
    console.log(formatResult(result, i));
  });
}

async function testIndustryFilter() {
  console.log('\n🏢 Test 3: Industry-Specific Search');
  console.log('=====================================\n');

  const query = 'value proposition for enterprise customers';
  console.log(`Query: "${query}"`);
  console.log(`Filter: industry = 'SaaS'\n`);

  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('search_semantic_memory', {
    query_embedding: embedding,
    match_threshold: 0.60,
    match_count: 5,
    filter_clause: "WHERE type = 'value_proposition' AND metadata->>'industry' = 'SaaS'"
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} SaaS value propositions:\n`);
  data?.forEach((result: any, i: number) => {
    console.log(formatResult(result, i));
  });
}

async function testThresholdComparison() {
  console.log('\n📈 Test 4: Threshold Comparison');
  console.log('=====================================\n');

  const query = 'cost optimization strategies';
  console.log(`Query: "${query}"\n`);

  const embedding = await generateEmbedding(query);
  const thresholds = [0.50, 0.60, 0.70, 0.80, 0.85];

  for (const threshold of thresholds) {
    const { data } = await supabase.rpc('search_semantic_memory', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: 20
    });

    console.log(`Threshold ${threshold.toFixed(2)}: ${data?.length || 0} results`);
  }

  console.log('\n💡 Recommendation:');
  console.log('   - Use 0.70-0.75 for balanced results');
  console.log('   - Use 0.80+ for high precision');
  console.log('   - Use 0.60-0.65 for broad discovery');
}

async function testPerformance() {
  console.log('\n⚡ Test 5: Performance Benchmark');
  console.log('=====================================\n');

  const query = 'improve customer retention';
  console.log(`Query: "${query}"\n`);

  const embedding = await generateEmbedding(query);

  // Warmup
  await supabase.rpc('search_semantic_memory', {
    query_embedding: embedding,
    match_threshold: 0.70,
    match_count: 10
  });

  // Benchmark
  const runs = 5;
  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    
    await supabase.rpc('search_semantic_memory', {
      query_embedding: embedding,
      match_threshold: 0.70,
      match_count: 10
    });
    
    const duration = Date.now() - start;
    times.push(duration);
    console.log(`Run ${i + 1}: ${duration}ms`);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`\n📊 Results:`);
  console.log(`   Average: ${avg.toFixed(0)}ms`);
  console.log(`   Min: ${min}ms`);
  console.log(`   Max: ${max}ms`);
  console.log(`\n${avg < 100 ? '✅ Excellent' : avg < 500 ? '⚠️  Acceptable' : '❌ Slow'} performance`);
}

async function testSimilarityDistribution() {
  console.log('\n📊 Test 6: Similarity Distribution Analysis');
  console.log('=====================================\n');

  const query = 'business value analysis';
  console.log(`Query: "${query}"\n`);

  const embedding = await generateEmbedding(query);

  // Get all results (no threshold)
  const { data } = await supabase.rpc('search_semantic_memory', {
    query_embedding: embedding,
    match_threshold: 0.0,
    match_count: 100
  });

  if (!data || data.length === 0) {
    console.log('⚠️  No data to analyze');
    return;
  }

  const similarities = data.map((r: any) => r.similarity);
  const avg = similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length;
  const sorted = similarities.sort((a: number, b: number) => b - a);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Calculate std dev
  const variance = similarities.reduce(
    (sum: number, val: number) => sum + Math.pow(val - avg, 2),
    0
  ) / similarities.length;
  const stdDev = Math.sqrt(variance);

  const distribution = {
    veryHigh: similarities.filter((s: number) => s >= 0.90).length,
    high: similarities.filter((s: number) => s >= 0.80 && s < 0.90).length,
    medium: similarities.filter((s: number) => s >= 0.70 && s < 0.80).length,
    low: similarities.filter((s: number) => s >= 0.60 && s < 0.70).length,
    veryLow: similarities.filter((s: number) => s < 0.60).length
  };

  console.log(`Sample Size: ${data.length} memories\n`);
  console.log(`Statistics:`);
  console.log(`  Average: ${avg.toFixed(3)}`);
  console.log(`  Median: ${median.toFixed(3)}`);
  console.log(`  Std Dev: ${stdDev.toFixed(3)}`);
  console.log(`  Min: ${sorted[sorted.length - 1].toFixed(3)}`);
  console.log(`  Max: ${sorted[0].toFixed(3)}`);

  console.log(`\nDistribution:`);
  console.log(`  Very High (≥0.90): ${distribution.veryHigh} (${(distribution.veryHigh/data.length*100).toFixed(1)}%)`);
  console.log(`  High (0.80-0.90): ${distribution.high} (${(distribution.high/data.length*100).toFixed(1)}%)`);
  console.log(`  Medium (0.70-0.80): ${distribution.medium} (${(distribution.medium/data.length*100).toFixed(1)}%)`);
  console.log(`  Low (0.60-0.70): ${distribution.low} (${(distribution.low/data.length*100).toFixed(1)}%)`);
  console.log(`  Very Low (<0.60): ${distribution.veryLow} (${(distribution.veryLow/data.length*100).toFixed(1)}%)`);

  const recommendedThreshold = Math.max(0.50, avg - stdDev);
  console.log(`\n💡 Recommended Threshold: ${recommendedThreshold.toFixed(3)}`);
  console.log(`   (Filters out results >1 std dev below average)`);
}

async function testMemoryStats() {
  console.log('\n📈 Memory Store Statistics');
  console.log('=====================================\n');

  // Count by type
  const { data: typeCounts } = await supabase
    .from('semantic_memory')
    .select('type')
    .then(res => {
      if (res.error) return { data: null };
      const counts: Record<string, number> = {};
      res.data.forEach((row: any) => {
        counts[row.type] = (counts[row.type] || 0) + 1;
      });
      return { data: counts };
    });

  console.log('Memories by Type:');
  if (typeCounts) {
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  // Recent memories
  const { data: recentCount } = await supabase
    .from('semantic_memory')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  console.log(`\nRecent (last 7 days): ${recentCount || 0} memories`);

  // Total count
  const { count: totalCount } = await supabase
    .from('semantic_memory')
    .select('id', { count: 'exact', head: true });

  console.log(`Total memories: ${totalCount || 0}`);
}

// ============================================================================
// Main Runner
// ============================================================================

async function runAllTests() {
  console.log('🚀 Vector Store Query Test Suite');
  console.log('==================================\n');

  try {
    await testMemoryStats();
    await testBasicSearch();
    await testFilteredSearch();
    await testIndustryFilter();
    await testThresholdComparison();
    await testPerformance();
    await testSimilarityDistribution();

    console.log('\n✅ All tests complete!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllTests().then(() => process.exit(0));
}

export {
  generateEmbedding,
  testBasicSearch,
  testFilteredSearch,
  testIndustryFilter,
  testThresholdComparison,
  testPerformance,
  testSimilarityDistribution
};
