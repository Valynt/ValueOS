import { mcpGroundTruthService } from './packages/backend/src/services/MCPGroundTruthService.js';

async function testSEC() {
  console.log('Testing SEC Ingestion...');
  
  try {
    const domain = 'microsoft.com';
    console.log(`Resolving ticker for ${domain}...`);
    
    const tickerResult = await mcpGroundTruthService.resolveTickerFromDomain({ domain });
    console.log('Ticker Result:', tickerResult);
    
    if (tickerResult?.ticker) {
      console.log(`Fetching 10-K sections for ${tickerResult.ticker}...`);
      const sections = await mcpGroundTruthService.getFilingSections({
        identifier: tickerResult.ticker,
        sections: ['business', 'risk_factors']
      });
      
      if (sections) {
        console.log('Sections retrieved successfully:');
        Object.keys(sections).forEach(s => {
          console.log(`- ${s}: ${sections[s].substring(0, 100)}...`);
        });
      } else {
        console.log('No sections retrieved.');
      }
    } else {
      console.log('Failed to resolve ticker.');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSEC();
