# MCP Financial Ground Truth Server - Test Plan

**Version:** 1.0  
**Date:** November 27, 2025  
**Status:** In Progress

---

## Test Architecture Overview

This test plan validates the MCP Financial Ground Truth Server integration with ValueCanvas platform, covering three phases:

1. **Phase 1:** Analyst/Developer Feature Set (Data Connectivity & SQL)
2. **Phase 2:** AI Query Generation and Self-Service (NLQ & Visualization)
3. **Phase 3:** Integration and Governance (Security & Embedding)

### ValueCanvas + MCP Ground Truth Mapping

| Test Phase | ValueCanvas Component | MCP Ground Truth Role |
|------------|----------------------|----------------------|
| Phase 1 | SQL Editor, Data Sources | Authoritative data retrieval |
| Phase 2 | AI Agents, NLQ | Zero-hallucination fact checking |
| Phase 3 | Security, APIs | Provenance & audit logging |

---

## Phase 1: Analyst/Developer Feature Set

### QA-FE-001: Native SQL Editor with Ground Truth Data

**Objective:** Verify SQL editor can query authoritative financial data from MCP server

**Prerequisites:**
- MCP Ground Truth Server initialized
- Connection to SEC EDGAR data source
- SQL editor interface available

**Test Steps:**
1. Access native SQL editor in ValueCanvas
2. Write query to join MCP Ground Truth data with internal data:
   ```sql
   SELECT 
     c.company_name,
     c.ticker,
     gt.revenue_total,
     gt.net_income,
     c.internal_score
   FROM companies c
   LEFT JOIN mcp_ground_truth.financials gt 
     ON c.cik = gt.entity_id
   WHERE gt.period = 'FY2024'
     AND gt.source_tier = 1
   GROUP BY c.company_name, c.ticker
   ```
3. Execute query and monitor execution time
4. Verify provenance metadata is included

**Expected Result:**
- Query executes successfully in <500ms
- Results include Tier 1 data with confidence scores
- Monitoring shows MCP server latency separately
- Provenance metadata (filing type, accession number) displayed

**Validation:**
```typescript
// Test assertion
expect(result.rows.length).toBeGreaterThan(0);
expect(result.metadata.mcp_tier).toBe('tier1');
expect(result.metadata.confidence).toBeGreaterThan(0.9);
expect(result.execution_time_ms).toBeLessThan(500);
```

---

### QA-FE-002: Interactive Notebooks with Financial Modeling

**Objective:** Verify notebooks can use MCP Ground Truth data for financial analysis

**Prerequisites:**
- Python environment with MCP client library
- Jupyter/notebook interface
- MCP server connection

**Test Steps:**
1. Open interactive notebook
2. Import MCP client and fetch financial data:
   ```python
   from mcp_ground_truth import createDevServer
   import pandas as pd
   import matplotlib.pyplot as plt
   
   # Initialize MCP server
   server = await createDevServer()
   
   # Fetch Apple financials
   result = await server.executeTool('get_authoritative_financials', {
       'entity_id': '0000320193',
       'metrics': ['revenue_total', 'net_income', 'gross_profit'],
       'period': 'FY2024'
   })
   
   # Parse and analyze
   data = json.loads(result.content[0].text)
   df = pd.DataFrame(data['data'])
   
   # Calculate margins
   df['gross_margin'] = (df['gross_profit'] / df['revenue_total']) * 100
   df['net_margin'] = (df['net_income'] / df['revenue_total']) * 100
   
   # Visualize
   df[['gross_margin', 'net_margin']].plot(kind='bar')
   plt.title('Apple Inc. Profit Margins (FY2024)')
   plt.ylabel('Margin %')
   plt.show()
   ```
3. Execute all cells
4. Verify visualizations render correctly

**Expected Result:**
- All cells execute without error
- Financial data retrieved with Tier 1 confidence
- Calculations are accurate
- Visualizations display correctly
- Provenance information preserved in dataframe

**Validation:**
```python
# Test assertions
assert len(df) > 0, "No data retrieved"
assert df['gross_margin'].iloc[0] > 0, "Invalid margin calculation"
assert 'source_tier' in data['metadata'][0], "Missing provenance"
assert data['metadata'][0]['source_tier'] == 1, "Not Tier 1 data"
```

---

### QA-FE-003: Code-Centric Multi-Language Support

**Objective:** Verify MCP Ground Truth can be accessed from multiple languages

**Prerequisites:**
- Python, R, and JavaScript environments
- MCP client libraries for each language

**Test Steps:**
1. **Python Test:**
   ```python
   from mcp_ground_truth import createDevServer
   server = await createDevServer()
   result = await server.executeTool('get_authoritative_financials', {
       'entity_id': 'AAPL',
       'metrics': ['revenue_total']
   })
   print(f"Python: {result}")
   ```

2. **JavaScript/TypeScript Test:**
   ```typescript
   import { createDevServer } from './mcp-ground-truth';
   const server = await createDevServer();
   const result = await server.executeTool('get_authoritative_financials', {
     entity_id: 'AAPL',
     metrics: ['revenue_total']
   });
   console.log('TypeScript:', result);
   ```

3. **R Test (via reticulate):**
   ```r
   library(reticulate)
   mcp <- import("mcp_ground_truth")
   server <- mcp$createDevServer()
   result <- server$executeTool('get_authoritative_financials', 
                                 list(entity_id='AAPL', 
                                      metrics=list('revenue_total')))
   print(paste("R:", result))
   ```

**Expected Result:**
- All three languages successfully retrieve data
- Response format is consistent across languages
- Provenance metadata preserved in all cases

---

### QA-FE-004: Multi-Warehouse Data Connectivity

**Objective:** Verify cross-source joins between MCP Ground Truth and internal warehouses

**Prerequisites:**
- MCP Ground Truth Server (external source)
- Internal data warehouse connection
- Cross-source query capability

**Test Steps:**
1. Configure MCP Ground Truth as external data source
2. Write cross-source query:
   ```sql
   -- Join SEC data with internal CRM data
   SELECT 
     crm.account_name,
     crm.deal_size,
     mcp.revenue_total as company_revenue,
     mcp.net_income as company_profit,
     (crm.deal_size / mcp.revenue_total * 100) as deal_as_pct_revenue
   FROM internal_warehouse.crm_deals crm
   INNER JOIN mcp_ground_truth.public_companies mcp
     ON crm.company_cik = mcp.cik
   WHERE mcp.period = 'FY2024'
     AND mcp.source_tier = 1
     AND crm.deal_stage = 'Closed Won'
   ```
3. Execute query
4. Verify data from both sources

**Expected Result:**
- Query executes successfully
- Data correctly joined from both sources
- MCP data includes provenance metadata
- Performance acceptable (<2 seconds for 1000 rows)

---

### QA-FE-005: Data Caching Performance

**Objective:** Verify caching improves performance for repeated MCP queries

**Prerequisites:**
- MCP Ground Truth Server with caching enabled
- Performance monitoring tools

**Test Steps:**
1. **First Query (Cold Cache):**
   ```typescript
   const start1 = Date.now();
   const result1 = await server.executeTool('get_authoritative_financials', {
     entity_id: '0000320193',
     metrics: ['revenue_total', 'net_income']
   });
   const time1 = Date.now() - start1;
   console.log('Cold cache time:', time1);
   ```

2. **Second Query (Warm Cache):**
   ```typescript
   const start2 = Date.now();
   const result2 = await server.executeTool('get_authoritative_financials', {
     entity_id: '0000320193',
     metrics: ['revenue_total', 'net_income']
   });
   const time2 = Date.now() - start2;
   console.log('Warm cache time:', time2);
   ```

3. Compare execution times
4. Verify cache hit indicator

**Expected Result:**
- First query: ~250-300ms (fetches from SEC)
- Second query: <50ms (returns from cache)
- Cache hit indicator present in metadata
- Data consistency between cached and fresh results

**Validation:**
```typescript
expect(time2).toBeLessThan(time1 * 0.3); // 70% faster
expect(result2.cache_hit).toBe(true);
expect(result1.data).toEqual(result2.data); // Same data
```

---

## Phase 2: AI Query Generation and Self-Service

### QA-AI-001: AI-Assisted Query with Ground Truth Validation

**Objective:** Verify AI generates accurate queries and validates results against ground truth

**Prerequisites:**
- AI agent with MCP Ground Truth tool access
- Semantic model configured
- Natural language query interface

**Test Steps:**
1. User enters natural language prompt:
   ```
   "Show me Apple's Q4 2024 revenue and compare it to Microsoft's"
   ```

2. AI agent reasoning (internal):
   ```typescript
   // Agent decides to use MCP Ground Truth
   const appleData = await mcpServer.executeTool('get_authoritative_financials', {
     entity_id: '0000320193', // Apple
     metrics: ['revenue_total'],
     period: 'CQ4_2024'
   });
   
   const msftData = await mcpServer.executeTool('get_authoritative_financials', {
     entity_id: '0000789019', // Microsoft
     metrics: ['revenue_total'],
     period: 'CQ4_2024'
   });
   ```

3. AI generates response with citations:
   ```
   "Apple's Q4 2024 revenue was $94.9B [Source: SEC 10-Q, Tier 1, Confidence: 0.97]
   Microsoft's Q4 2024 revenue was $62.0B [Source: SEC 10-Q, Tier 1, Confidence: 0.97]
   Apple's revenue was 53% higher than Microsoft's in Q4 2024."
   ```

4. Verify claim with Aletheia:
   ```typescript
   const verification = await mcpServer.executeTool('verify_claim_aletheia', {
     claim_text: "Apple's Q4 2024 revenue was $94.9B",
     context_entity: '0000320193',
     strict_mode: true
   });
   ```

**Expected Result:**
- AI generates correct query without hallucination
- Response includes Tier 1 data with citations
- Verification confirms claim accuracy
- User sees confidence scores and sources

**Validation:**
```typescript
expect(verification.verified).toBe(true);
expect(verification.confidence).toBeGreaterThan(0.95);
expect(appleData.metadata.source_tier).toBe(1);
```

---

### QA-AI-002: Interactive Visualization with Follow-up Questions

**Objective:** Verify AI can answer follow-up questions using ground truth context

**Prerequisites:**
- Dynamic Liveboard loaded
- AI agent with conversation context
- MCP Ground Truth integration

**Test Steps:**
1. **Initial Question:**
   ```
   User: "Show me revenue trends for tech companies"
   ```
   
   AI Response:
   - Fetches data for AAPL, MSFT, GOOGL from MCP
   - Generates line chart
   - Includes provenance footnotes

2. **Follow-up Question:**
   ```
   User: "Which company had the highest growth rate?"
   ```
   
   AI Reasoning:
   ```typescript
   // AI uses cached MCP data from previous query
   // Calculates growth rates
   // Verifies calculation against industry benchmarks
   const benchmark = await mcpServer.executeTool('get_industry_benchmark', {
     identifier: '541511', // Software industry
     metric: 'revenue_growth_rate'
   });
   ```

3. **Second Follow-up:**
   ```
   User: "Is that growth rate above industry average?"
   ```
   
   AI Response:
   - Compares to Tier 3 benchmark data
   - Provides context with confidence scores

**Expected Result:**
- Follow-up questions answered without re-fetching data
- Context maintained across conversation
- All claims backed by ground truth
- Confidence scores adjust based on data tier

---

### QA-AI-003: Automated Python Workflows with Ground Truth

**Objective:** Verify scheduled automation can use MCP Ground Truth for monitoring

**Prerequisites:**
- Python automation environment
- Scheduler (cron/Airflow)
- MCP server access

**Test Steps:**
1. Create automated anomaly detection script:
   ```python
   # daily_financial_monitor.py
   import asyncio
   from mcp_ground_truth import createDevServer
   from datetime import datetime
   
   async def monitor_financials():
       server = await createDevServer()
       
       # List of companies to monitor
       companies = [
           {'cik': '0000320193', 'name': 'Apple'},
           {'cik': '0000789019', 'name': 'Microsoft'},
           {'cik': '0001652044', 'name': 'Alphabet'}
       ]
       
       alerts = []
       
       for company in companies:
           # Fetch latest financials
           result = await server.executeTool('get_authoritative_financials', {
               'entity_id': company['cik'],
               'metrics': ['revenue_total', 'net_income'],
               'period': 'LTM'  # Last twelve months
           })
           
           data = json.loads(result.content[0].text)
           
           # Check confidence
           if data['metadata'][0]['extraction_confidence'] < 0.9:
               alerts.append(f"Low confidence data for {company['name']}")
           
           # Check for anomalies (simplified)
           revenue = data['data'][0]['value']
           if revenue < 0:
               alerts.append(f"Negative revenue detected for {company['name']}")
       
       # Send alerts if any
       if alerts:
           send_email(alerts)
       
       # Log execution
       log_execution(datetime.now(), len(companies), len(alerts))
   
   if __name__ == '__main__':
       asyncio.run(monitor_financials())
   ```

2. Schedule script to run daily at 6 AM:
   ```bash
   # crontab entry
   0 6 * * * /usr/bin/python3 /path/to/daily_financial_monitor.py
   ```

3. Verify execution logs
4. Check alert emails

**Expected Result:**
- Script executes successfully on schedule
- MCP Ground Truth data retrieved reliably
- Anomalies detected and reported
- Execution logged with timestamps

---

## Phase 3: Integration and Governance

### QA-INT-001: SaaS API Integration with Ground Truth

**Objective:** Verify MCP Ground Truth can integrate with external SaaS data

**Prerequisites:**
- Salesforce API connection
- MCP Ground Truth Server
- Data integration pipeline

**Test Steps:**
1. Configure integration to enrich Salesforce accounts:
   ```python
   # salesforce_enrichment.py
   from simple_salesforce import Salesforce
   from mcp_ground_truth import createDevServer
   
   async def enrich_accounts():
       # Connect to Salesforce
       sf = Salesforce(username='...', password='...', security_token='...')
       
       # Initialize MCP
       mcp = await createDevServer()
       
       # Get accounts needing enrichment
       accounts = sf.query("SELECT Id, Name, CIK__c FROM Account WHERE CIK__c != null")
       
       for account in accounts['records']:
           # Fetch ground truth data
           result = await mcp.executeTool('get_authoritative_financials', {
               'entity_id': account['CIK__c'],
               'metrics': ['revenue_total', 'net_income', 'total_assets']
           })
           
           if not result.isError:
               data = json.loads(result.content[0].text)
               
               # Update Salesforce with ground truth data
               sf.Account.update(account['Id'], {
                   'Annual_Revenue__c': data['data'][0]['value'],
                   'Data_Source__c': 'SEC EDGAR',
                   'Data_Confidence__c': data['metadata'][0]['extraction_confidence'],
                   'Last_Updated__c': datetime.now().isoformat()
               })
   ```

2. Execute enrichment process
3. Verify Salesforce records updated
4. Check data provenance preserved

**Expected Result:**
- Salesforce accounts enriched with Tier 1 financial data
- Provenance metadata stored in custom fields
- Confidence scores visible to sales team
- Update timestamps tracked

---

### QA-GOV-001: Role-Based Access with Ground Truth

**Objective:** Verify governance controls apply to MCP Ground Truth data

**Prerequisites:**
- Three user roles: Sales, Finance, Analyst
- MCP server with RBAC configured
- Test user accounts

**Test Steps:**
1. **Sales User Test:**
   ```typescript
   // Login as sales@company.com
   const result = await mcpServer.executeTool('get_authoritative_financials', {
     entity_id: '0000320193',
     metrics: ['revenue_total'] // Public data - allowed
   });
   
   const privateResult = await mcpServer.executeTool('get_private_entity_estimates', {
     domain: 'competitor.com' // Private estimates - restricted
   });
   ```

2. **Finance User Test:**
   ```typescript
   // Login as finance@company.com
   const result = await mcpServer.executeTool('get_authoritative_financials', {
     entity_id: '0000320193',
     metrics: ['revenue_total', 'net_income', 'total_debt'] // All allowed
   });
   ```

3. **Analyst User Test:**
   ```typescript
   // Login as analyst@company.com
   const result = await mcpServer.executeTool('get_private_entity_estimates', {
     domain: 'competitor.com' // Full access
   });
   ```

**Expected Result:**
- Sales user: Can access Tier 1 public data only
- Finance user: Can access Tier 1 and Tier 2 data
- Analyst user: Full access to all tiers
- Unauthorized access returns 403 error
- All access attempts logged in audit trail

**Validation:**
```typescript
// Sales user
expect(result.success).toBe(true);
expect(privateResult.isError).toBe(true);
expect(privateResult.error.code).toBe('UNAUTHORIZED');

// Finance user
expect(result.success).toBe(true);

// Analyst user
expect(result.success).toBe(true);
```

---

### QA-GOV-002: Insight Embedding with Provenance

**Objective:** Verify embedded insights maintain ground truth provenance

**Prerequisites:**
- Target application (CRM/HR system)
- Embedding capability
- MCP Ground Truth integration

**Test Steps:**
1. Generate insight with ground truth data:
   ```typescript
   // Create value driver analysis
   const insight = await mcpServer.executeTool('populate_value_driver_tree', {
     target_cik: '0001234567',
     benchmark_naics: '541511',
     driver_node_id: 'productivity_delta',
     simulation_period: '2025-2027'
   });
   
   const data = JSON.parse(insight.content[0].text);
   ```

2. Create embeddable widget:
   ```html
   <!-- Embedded in CRM -->
   <div id="value-driver-widget">
     <h3>Productivity Gap Analysis</h3>
     <div class="metric">
       <span class="value">$${data.value.toLocaleString()}</span>
       <span class="label">Potential Value</span>
     </div>
     <div class="rationale">${data.rationale}</div>
     <div class="provenance">
       <small>
         Data Source: ${data.supporting_data[0].source} (Tier ${data.supporting_data[0].tier})
         <br>
         Confidence: ${(data.confidence * 100).toFixed(0)}%
         <br>
         Last Updated: ${data.audit.timestamp}
       </small>
     </div>
   </div>
   ```

3. Embed in target application
4. Verify interactivity and provenance display

**Expected Result:**
- Widget loads successfully in external app
- Data displays correctly with formatting
- Provenance information visible
- Confidence scores shown
- Widget remains interactive (drill-down works)
- Updates reflect in real-time

---

## Test Execution Summary

### Test Coverage Matrix

| Phase | Test Cases | Status | Priority |
|-------|-----------|--------|----------|
| Phase 1 | QA-FE-001 to QA-FE-005 | Pending | High |
| Phase 2 | QA-AI-001 to QA-AI-003 | Pending | High |
| Phase 3 | QA-INT-001 to QA-GOV-002 | Pending | Medium |

### Success Criteria

- **Phase 1:** All 5 tests pass with <500ms latency
- **Phase 2:** AI generates queries with >95% accuracy, zero hallucinations
- **Phase 3:** RBAC enforced, provenance maintained in embeddings

### Test Environment Requirements

1. **Infrastructure:**
   - MCP Ground Truth Server (development instance)
   - ValueCanvas platform (staging environment)
   - Test data warehouse
   - External SaaS sandbox (Salesforce)

2. **API Keys:**
   - Alpha Vantage (demo key acceptable)
   - SEC EDGAR (no key required)
   - Salesforce sandbox credentials

3. **Test Data:**
   - 10 public companies with CIKs
   - 5 private companies with domains
   - Sample internal CRM data
   - User accounts for each role

### Execution Timeline

- **Week 1:** Phase 1 tests (Data connectivity)
- **Week 2:** Phase 2 tests (AI integration)
- **Week 3:** Phase 3 tests (Governance)
- **Week 4:** Regression and performance testing

---

## Next Steps

1. Set up test environment
2. Create automated test scripts
3. Execute test cases
4. Document results
5. Address failures
6. Regression testing

**Test Plan Version:** 1.0  
**Last Updated:** November 27, 2025  
**Owner:** QA Team
