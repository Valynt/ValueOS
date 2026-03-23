# ValueVerse // Analysis Engine Implementation Manual

The **ValueVerse Analysis Engine** is a high-performance computational framework designed to ingest, decompose, and map enterprise value drivers from SEC 10-K filings. This manual provides developers with the technical specifications, deployment instructions, and structural logic required to maintain and scale the engine’s "Growth, Monetization, Durability" (GMD) mapping capabilities.

---

### 1. Framework: The GMD Value Logic
The engine is architected to replicate the strategic decomposition seen in the **Salesforce Sales Cloud FY2024-2025 Analysis**. It utilizes a recursive "Value Tree" structure to categorize unstructured textual data into three primary buckets:

| Category | Definition | Engine Extraction Focus | Salesforce Example |
| :--- | :--- | :--- | :--- |
| **Growth** | Net-new revenue & expansion catalysts | New product segments, ICP alignment, GTM motion | Data Cloud adoption, AI-driven SDRs |
| **Monetization** | Efficiency of value capture | SKU migration, pricing tiers, ARPU levers | Einstein 1 Sales migration, Revenue Cloud |
| **Durability** | Retention & competitive moat | Integration depth, multi-cloud stickiness, NRR | 86k multi-cloud deals, "Customer Zero" |

The engine treats **Product Lines** as the primary branch, under which GMD nodes are recursively mapped.

---

### 2. System Architecture & Requirements
The system is containerized via Docker and orchestrated with Python. It relies on a PostgreSQL backend utilizing an **Adjacency List Model** for infinite nesting of value drivers.

#### Prerequisites
- **Docker & Docker Compose:** Version 20.10+
- **Python 3.11+** (for local development)
- **SEC CIK Database:** Integrated into the `init.sql` schema.
- **LLM API Access:** Valid API Key for OpenRouter (DeepSeek) or OpenAI.

#### Core Components
1. **`engine.py`**: The orchestration logic (SEC retrieval + LLM prompting).
2. **`init.sql`**: Schema definition including recursive indexing.
3. **`Dockerfile`**: Multi-stage build for the Python environment.

---

### 3. Quick Start Deployment

Follow these commands to initialize the analysis environment:

```bash
# 1. Clone the repository and navigate to the root
cd valueverse-engine

# 2. Configure Environment Variables
# Create a .env file with your API credentials
echo "LLM_API_KEY=your_api_key_here" > .env
echo "DB_URL=postgresql://analyst:secure_password_123@db:5432/valueverse" >> .env

# 3. Build and Launch the Stack
docker-compose up --build -d

# 4. Monitor Initialization Logs
docker-compose logs -f engine
```

---

### 4. Technical Deep Dive: 10-K Mapping Logic

The engine performs a two-pass analysis to transform raw SEC text into the GMD framework:

#### Pass 1: Semantic Segmentation
The engine identifies the `Business Description` and `Management’s Discussion and Analysis (MD&A)` sections. These are filtered for keywords associated with the target product line (e.g., "Sales Cloud," "Einstein," "Data Cloud").

#### Pass 2: Recursive Decomposition
The LLM is prompted with a strategic template. It is instructed to look for **Value Drivers** (catalysts) and **Efficiency Levers** (margins).

**Example Internal Prompt Logic:**
```python
def extract_value_tree(self, text: str):
    prompt = """
    Analyze the 10-K for {company}.
    1. Identify key Product Lines.
    2. For each, categorize sub-drivers into:
       - GROWTH (e.g., new customer acquisition, market share)
       - MONETIZATION (e.g., upsell, SKU pricing, AI premiums)
       - DURABILITY (e.g., retention, multi-product integration)
    3. Extract specific metrics (e.g., YoY growth %, margin points).
    """
    # Logic continues in engine.py...
```

---

### 5. Database Schema: Recursive Value Trees

The engine uses the following schema to handle the hierarchical nature of corporate value. The `parent_node_id` allows the engine to link a specific metric (e.g., "25% productivity gain") to a sub-driver (e.g., "Agentforce"), which is linked to a driver ("Einstein AI"), which is linked to a pillar ("Growth").

```sql
CREATE TABLE value_nodes (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER REFERENCES filings(id),
    parent_node_id INTEGER REFERENCES value_nodes(id), -- Self-referencing link
    node_type VARCHAR(50) CHECK (node_type IN ('Growth', 'Monetization', 'Durability', 'Efficiency')),
    title VARCHAR(255) NOT NULL,
    impact_score INTEGER, -- 0-100 normalized score
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crucial for performance on deep trees
CREATE INDEX idx_value_parent ON value_nodes(parent_node_id);
```

---

### 6. Operational & Strategic Considerations

- **SEC Rate Limiting:** The SEC EDGAR API allows 10 requests per second. The `ValueVerseEngine` implements a strict `time.sleep(0.1)` in its `_sec_request` method. Exceeding this will result in a 10-minute IP block.
- **Context Window Management:** 10-K filings are massive. The engine uses a "Sliding Window" extraction or summarizes segments before the final GMD mapping to avoid exceeding LLM token limits (e.g., DeepSeek's 32k or 128k limits).
- **Impact Scoring:** The `impact_score` is a weighted calculation performed by the engine based on the frequency of management mentions and the presence of hard financial metrics in the text.

---

### 7. Troubleshooting

| Issue | Potential Cause | Resolution |
| :--- | :--- | :--- |
| **403 Forbidden on SEC Fetch** | Incorrect User-Agent header. | Ensure `self.headers` in `engine.py` follows the `Name (email)` format. |
| **Database Connection Refused** | Engine starting before DB is ready. | The `docker-compose` includes `restart: on-failure`; wait 30 seconds for Postgres to init. |
| **Empty Value Trees** | LLM failing to parse text. | Check `filings` table for `raw_content`. If content is present, increase LLM temperature to 0.3. |
| **Memory Limit Exceeded** | Large 10-K processing in-memory. | Increase Docker memory limit to 4GB or implement chunked streaming in `engine.py`. |

---

### 8. Maintenance & Scaling
To add new companies to the cohort:
1. Update the `COMPANIES` list in `engine.py` with the correct **Ticker** and **CIK**.
2. Run `docker-compose restart engine`.
3. The engine will automatically detect missing filings for the new CIKs and begin the GMD mapping process.

> **Developer Note:** For mission-critical analysis, compare the engine's `impact_score` against the `confidence_score` generated during Pass 2 to identify nodes that may require human audit.