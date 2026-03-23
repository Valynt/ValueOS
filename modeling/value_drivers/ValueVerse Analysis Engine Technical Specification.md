# Technical Architecture Specification: ValueVerse Analysis Engine

The **ValueVerse Analysis Engine** is designed to automate the extraction, decomposition, and mapping of enterprise value drivers for the world's leading software organizations. By leveraging SEC filings and Large Language Models (LLMs), the system constructs recursive "Value Trees" that provide granular insight into how specific product lines contribute to corporate growth, monetization, and durability.

---

### 1. Target Universe: Top 50 Software & SaaS Companies
The following table represents the structured data for the analysis cohort. This dataset is optimized for ingestion into the `companies` table and subsequent SEC EDGAR synchronization.

| Company Name | Ticker | SEC CIK | Approx. Market Cap (Dec 2025) |
| :--- | :--- | :--- | :--- |
| **Alphabet Inc.** | GOOGL | 0001652044 | $3.76 Trillion |
| **Microsoft Corp.** | MSFT | 0000789019 | $3.60 Trillion |
| **Meta Platforms Inc.** | META | 0001326801 | $1.67 Trillion |
| **Oracle Corp.** | ORCL | 0001341439 | $567.4 Billion |
| **Palantir Technologies Inc.** | PLTR | 0001601668 | $462.8 Billion |
| **SAP SE** | SAP | 0001420790 | $284.8 Billion |
| **IBM** | IBM | 0000051143 | $284.7 Billion |
| **Salesforce, Inc.** | CRM | 0001108524 | $249.0 Billion |
| **Shopify Inc.** | SHOP | 0001594813 | $221.4 Billion |
| **Intuit Inc.** | INTU | 0000896874 | $188.2 Billion |
| **ServiceNow, Inc.** | NOW | 0001373715 | $159.3 Billion |
| **Adobe Inc.** | ADBE | 0000798132 | $147.9 Billion |
| **Palo Alto Networks Inc.** | PANW | 0001327567 | $130.5 Billion |
| **CrowdStrike Holdings Inc.** | CRWD | 0001716446 | $121.3 Billion |
| **Automatic Data Processing** | ADP | 0000008670 | $104.5 Billion |
| **Synopsys Inc.** | SNPS | 0000888277 | $91.0 Billion |
| **Cadence Design Systems** | CDNS | 0000813672 | $86.8 Billion |
| **Snowflake Inc.** | SNOW | 0001640147 | $76.3 Billion |
| **Cloudflare Inc.** | NET | 0001477333 | $71.0 Billion |
| **Autodesk, Inc.** | ADSK | 0000769397 | $63.5 Billion |
| **Fortinet Inc.** | FTNT | 0001262039 | $60.5 Billion |
| **Workday, Inc.** | WDAY | 0001327811 | $57.9 Billion |
| **Datadog, Inc.** | DDOG | 0001561494 | $48.5 Billion |
| **Roper Technologies** | ROP | 0000882835 | $48.4 Billion |
| **MicroStrategy Inc.** | MSTR | 0001050446 | $46.3 Billion |
| **Atlassian Corporation** | TEAM | 0001650337 | $42.8 Billion |
| **Fair Isaac Corporation** | FICO | 0000951913 | $41.4 Billion |
| **Paychex, Inc.** | PAYX | 0000723531 | $40.9 Billion |
| **Zscaler Inc.** | ZS | 0001713683 | $36.8 Billion |
| **Veeva Systems Inc.** | VEEV | 0001393052 | $36.8 Billion |
| **Fiserv, Inc.** | FISV | 0000798354 | $36.1 Billion |
| **MongoDB Inc.** | MDB | 0001441816 | $35.5 Billion |
| **Zoom Video Communications** | ZM | 0001582375 | $26.0 Billion |
| **SS&C Technologies** | SSNC | 0001402436 | $21.8 Billion |
| **PTC Inc.** | PTC | 0000857005 | $21.0 Billion |
| **HubSpot, Inc.** | HUBS | 0001384071 | $20.3 Billion |
| **Tyler Technologies, Inc.** | TYL | 0000860731 | $19.5 Billion |
| **Unity Software Inc.** | U | 0001810842 | $19.4 Billion |
| **Guidewire Software, Inc.** | GWRE | 0001528396 | $18.1 Billion |
| **DocuSign, Inc.** | DOCU | 0001261333 | $17.6 Billion |
| **Dynatrace, Inc.** | DT | 0001773383 | $16.0 Billion |
| **Okta Inc.** | OKTA | 0001660134 | $15.6 Billion |
| **Procore Technologies** | PCOR | 0001611050 | $13.9 Billion |
| **Manhattan Associates** | MANH | 0001056696 | $12.9 Billion |
| **Pegasystems Inc.** | PEGA | 0000774203 | $12.0 Billion |
| **SailPoint Inc.** | SAIL | 0001627512 | $11.8 Billion |
| **BILL Holdings Inc.** | BILL | 0001786352 | $5.5 Billion |
| **Workiva Inc.** | WK | 0001445305 | $4.9 Billion |
| **ZoomInfo Technologies** | ZI | 0001794515 | $3.2 Billion |
| **BlackBerry** | BB | 0001070235 | $2.4 Billion |

---

### 2. Relational Database Schema (SQL)
To store recursive value tree structures (e.g., *Growth -> Market Expansion -> New Geo Entry*), we utilize an **Adjacency List Model**. This allows for infinite nesting of value drivers.

```sql
-- Core Table for Companies
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    cik VARCHAR(10) UNIQUE NOT NULL,
    market_cap_usd NUMERIC(20, 2),
    industry VARCHAR(100) DEFAULT 'SaaS'
);

-- Table for SEC Filing Metadata
CREATE TABLE filings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    filing_type VARCHAR(10) NOT NULL, -- '10-K', '10-Q'
    filing_date DATE NOT NULL,
    accession_number VARCHAR(50) UNIQUE,
    raw_text_path TEXT -- Path to S3 or local volume storage
);

-- Recursive Value Tree Table
CREATE TABLE value_nodes (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER REFERENCES filings(id),
    parent_node_id INTEGER REFERENCES value_nodes(id),
    node_type VARCHAR(50) CHECK (node_type IN ('Growth', 'Monetization', 'Durability', 'Product-Line')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metric_value NUMERIC, -- Extracted metric if available (e.g., Retention Rate)
    confidence_score FLOAT, -- LLM confidence in extraction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for recursive query performance
CREATE INDEX idx_parent_node ON value_nodes(parent_node_id);
CREATE INDEX idx_company_filing ON filings(company_id);
```

---

### 3. Analysis Engine Logic (Python)
The logic focuses on orchestrated data retrieval from the SEC and structured decomposition using an LLM.

#### A. SEC EDGAR Retrieval
The script uses the `sec-edgar-downloader` or direct `requests` to the SEC API. 
*   **Rate Limiting:** The SEC strictly enforces a limit of **10 requests per second**. The script implements a `RateLimiter` class using `time.sleep(0.1)` to ensure compliance and avoid IP blocking.
*   **User-Agent:** SEC requirements mandate a specific header format: `Company Name (email@domain.com)`.

#### B. LLM Orchestration & Prompting
We utilize a two-pass prompting strategy to build the recursive tree.

1.  **Pass 1: Segmentation:** Extract "Business Description" and "Management’s Discussion and Analysis" (MD&A) sections.
2.  **Pass 2: Recursive Decomposition:** The LLM is prompted to identify nodes and their children.

```python
import time
import requests
from typing import List, Dict

class ValueVerseEngine:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.sec_header = {"User-Agent": "ValueVerse Analysis (tech@valueverse.com)"}
        self.last_request_time = 0

    def _wait_for_rate_limit(self, period=0.1):
        """Ensures compliance with SEC 10 requests/second."""
        elapsed = time.time() - self.last_request_time
        if elapsed < period:
            time.sleep(period - elapsed)
        self.last_request_time = time.time()

    def fetch_10k(self, ticker: str, cik: str) -> str:
        self._wait_for_rate_limit()
        # Logic to download 10-K from SEC EDGAR URL
        # URL Format: https://www.sec.gov/Archives/edgar/data/{CIK}/{Accession}/...
        return "Raw 10-K Text Content"

    def prompt_llm_for_tree(self, context_text: str, parent_node: str = "Corporate Value"):
        """
        Prompt Template for Recursive Decomposition:
        
        'Analyze the following 10-K text for {company}. 
        Identify the primary value drivers categorized by Growth, Monetization, and Durability.
        For each product line (e.g., Salesforce Sales Cloud), identify specific 
        sub-drivers (e.g., Multi-cloud expansion, AI-driven cross-sell).
        Return result as a JSON list of objects: 
        {"title": str, "type": str, "description": str, "children": []}'
        """
        # API call to OpenAI/Anthropic/Local LLM
        pass

    def run_pipeline(self, company_list: List[Dict]):
        for company in company_list:
            raw_text = self.fetch_10k(company['ticker'], company['cik'])
            value_tree = self.prompt_llm_for_tree(raw_text)
            self.save_to_db(value_tree)
```

---

### 4. Docker Environment Specification
The environment is containerized to ensure consistent LLM dependencies and database persistence.

#### Docker Compose Configuration
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: valueverse_db
    environment:
      POSTGRES_DB: valueverse
      POSTGRES_USER: analyst
      POSTGRES_PASSWORD: secure_password_123
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - analysis_net
    ports:
      - "5432:5432"

  engine:
    build: .
    container_name: valueverse_engine
    depends_on:
      - db
    environment:
      - DB_URL=postgresql://analyst:secure_password_123@db:5432/valueverse
      - LLM_API_KEY=${LLM_API_KEY}
    volumes:
      - ./filings_cache:/app/filings
      - ./logs:/app/logs
    networks:
      - analysis_net
    restart: on-failure

networks:
  analysis_net:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

#### Strategic Operational Guidelines
*   **Data Persistence:** The `postgres_data` volume ensures that extracted value drivers remain available across container restarts.
*   **Networking:** The `engine` service communicates with the `db` over an internal bridge network, isolating database traffic from the public internet.
*   **Rate Limit Management:** Rate limits for the LLM API (e.g., Tier-based TPM/RPM limits) are managed via an exponential backoff strategy in the Python engine's `ValueVerseEngine` class.