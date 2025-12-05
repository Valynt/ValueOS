/**
 * MCP Financial Ground Truth Server - Basic Usage Examples
 * 
 * This file demonstrates common usage patterns for the MCP server.
 */

import { createMCPServer, createDevServer } from '../index';

/**
 * Example 1: Get authoritative financials for a public company
 */
async function example1_AuthoritativeFinancials() {
  console.log('\n=== Example 1: Authoritative Financials ===\n');

  const server = await createDevServer();

  // Get Apple's financial data
  const result = await server.executeTool('get_authoritative_financials', {
    entity_id: '0000320193', // Apple Inc. CIK
    metrics: ['revenue_total', 'gross_profit', 'net_income'],
    period: 'FY2024',
  });

  console.log('Apple Inc. Financials (FY2024):');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Example 2: Estimate private company financials
 */
async function example2_PrivateCompanyEstimates() {
  console.log('\n=== Example 2: Private Company Estimates ===\n');

  const server = await createDevServer();

  // Estimate OpenAI's revenue
  const result = await server.executeTool('get_private_entity_estimates', {
    domain: 'openai.com',
    proxy_metric: 'headcount_linkedin',
    industry_code: '541511', // Custom Computer Programming Services
  });

  console.log('OpenAI Revenue Estimate:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Example 3: Verify a financial claim
 */
async function example3_VerifyClaim() {
  console.log('\n=== Example 3: Verify Financial Claim ===\n');

  const server = await createDevServer();

  // Verify a claim about Apple's revenue
  const result = await server.executeTool('verify_claim_aletheia', {
    claim_text: 'Apple generated $383 billion in revenue in fiscal year 2024',
    context_entity: '0000320193',
    strict_mode: true,
  });

  console.log('Claim Verification Result:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Example 4: Populate value driver tree
 */
async function example4_ValueDriverTree() {
  console.log('\n=== Example 4: Value Driver Tree Population ===\n');

  const server = await createDevServer();

  // Calculate productivity delta for a target company
  const result = await server.executeTool('populate_value_driver_tree', {
    target_cik: '0000320193',
    benchmark_naics: '541511',
    driver_node_id: 'productivity_delta',
    simulation_period: '2025-2027',
  });

  console.log('Value Driver Tree Node:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Example 5: Health check
 */
async function example5_HealthCheck() {
  console.log('\n=== Example 5: Health Check ===\n');

  const server = await createDevServer();

  const health = await server.healthCheck();

  console.log('Server Health:');
  console.log(JSON.stringify(health, null, 2));
}

/**
 * Example 6: Custom configuration
 */
async function example6_CustomConfiguration() {
  console.log('\n=== Example 6: Custom Configuration ===\n');

  const server = await createMCPServer({
    edgar: {
      userAgent: 'MyCompany contact@mycompany.com',
      rateLimit: 5, // Slower rate limit
    },
    marketData: {
      provider: 'alphavantage',
      apiKey: process.env.ALPHA_VANTAGE_API_KEY || 'demo',
      rateLimit: 5,
    },
    truthLayer: {
      enableFallback: true,
      strictMode: true,
      maxResolutionTime: 10000, // 10 second timeout
      parallelQuery: false,
    },
  });

  console.log('Server initialized with custom configuration');

  // Get available tools
  const tools = server.getTools();
  console.log(`\nAvailable tools: ${tools.length}`);
  tools.forEach(tool => {
    console.log(`- ${tool.name}: ${tool.description}`);
  });
}

/**
 * Example 7: Error handling
 */
async function example7_ErrorHandling() {
  console.log('\n=== Example 7: Error Handling ===\n');

  const server = await createDevServer();

  try {
    // Try to get data for non-existent company
    const result = await server.executeTool('get_authoritative_financials', {
      entity_id: '9999999999', // Invalid CIK
      metrics: ['revenue_total'],
    });

    console.log('Result:', result);
  } catch (error) {
    console.log('Error caught:', error);
  }

  // The server returns errors in the result object
  const result = await server.executeTool('get_authoritative_financials', {
    entity_id: '9999999999',
    metrics: ['revenue_total'],
  });

  if (result.isError) {
    console.log('Error in result:', result.content[0].text);
  }
}

/**
 * Example 8: Batch queries
 */
async function example8_BatchQueries() {
  console.log('\n=== Example 8: Batch Queries ===\n');

  const server = await createDevServer();

  // Get multiple metrics for multiple companies
  const companies = [
    { cik: '0000320193', name: 'Apple' },
    { cik: '0001018724', name: 'Amazon' },
    { cik: '0001652044', name: 'Alphabet' },
  ];

  console.log('Fetching revenue data for multiple companies...\n');

  for (const company of companies) {
    const result = await server.executeTool('get_authoritative_financials', {
      entity_id: company.cik,
      metrics: ['revenue_total'],
      period: 'FY2024',
    });

    console.log(`${company.name}:`, result.content[0].text);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_AuthoritativeFinancials();
    await example2_PrivateCompanyEstimates();
    await example3_VerifyClaim();
    await example4_ValueDriverTree();
    await example5_HealthCheck();
    await example6_CustomConfiguration();
    await example7_ErrorHandling();
    await example8_BatchQueries();

    console.log('\n=== All examples completed successfully ===\n');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_AuthoritativeFinancials,
  example2_PrivateCompanyEstimates,
  example3_VerifyClaim,
  example4_ValueDriverTree,
  example5_HealthCheck,
  example6_CustomConfiguration,
  example7_ErrorHandling,
  example8_BatchQueries,
};
