export const files = {
    "engine.py": {
        type: "python",
        content: `import time
import requests
import psycopg2
import os
from typing import List, Dict

# SEC Rate Limit: 10 requests per second
# LLM Rate Limit: Managed via exponential backoff

COMPANIES = [
    {"ticker": "GOOGL", "cik": "0001652044", "name": "Alphabet Inc."},
    {"ticker": "MSFT", "cik": "0000789019", "name": "Microsoft Corp."},
    {"ticker": "CRM", "cik": "0001108524", "name": "Salesforce, Inc."},
    {"ticker": "ORCL", "cik": "0001341439", "name": "Oracle Corp."},
    {"ticker": "PLTR", "cik": "0001601668", "name": "Palantir Technologies Inc."},
    # ... List truncated to 50 for deployment
]

class ValueVerseEngine:
    def __init__(self, db_config: Dict):
        self.db_conn = psycopg2.connect(**db_config)
        self.headers = {"User-Agent": "ValueVerse Analysis Engine (research@valueverse.ai)"}
        self.llm_api_key = os.getenv("LLM_API_KEY")

    def _sec_request(self, url: str):
        time.sleep(0.1) # Strict SEC Rate Limit
        return requests.get(url, headers=self.headers)

    def extract_value_tree(self, text: str):
        """
        Analysis Pattern: Sales Cloud Strategic Model
        Focus: Growth Engine, Monetizationskus, Retention Durability
        """
        prompt = "Analyze 10-K text. Categorize drivers into Growth, Monetization, Durability."
        # Call OpenRouter API with DeepSeek model
        payload = {
            "model": "deepseek/deepseek-chat",
            "messages": [{"role": "user", "content": f"{prompt}\\n\\n{text[:10000]}"}]
        }
        res = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                            headers={"Authorization": f"Bearer {self.llm_api_key}"},
                            json=payload)
        return res.json()["choices"][0]["message"]["content"]

    def process_all(self):
        for company in COMPANIES:
            print(f"Processing {company['ticker']}...")
            # 1. Fetch Filing
            # 2. Extract Data
            # 3. Store in Postgres
            time.sleep(5) # Cooldown per LLM request

if __name__ == "__main__":
    config = {"dbname": "valueverse", "user": "analyst", "host": "db"}
    engine = ValueVerseEngine(config)
    engine.process_all()`
    },
    "init.sql": {
        type: "sql",
        content: `-- Core Repository Schema
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    cik VARCHAR(10) UNIQUE NOT NULL,
    market_cap_usd NUMERIC(20, 2),
    industry VARCHAR(100) DEFAULT 'Enterprise Software'
);

CREATE TABLE IF NOT EXISTS filings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    filing_type VARCHAR(10) NOT NULL, -- '10-K', '10-Q'
    filing_date DATE NOT NULL,
    accession_number VARCHAR(50) UNIQUE,
    raw_content TEXT
);

CREATE TABLE IF NOT EXISTS value_nodes (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER REFERENCES filings(id),
    parent_node_id INTEGER REFERENCES value_nodes(id),
    node_type VARCHAR(50) CHECK (node_type IN ('Growth', 'Monetization', 'Durability', 'Efficiency')),
    title VARCHAR(255) NOT NULL,
    impact_score INTEGER, -- 0 to 100
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_company_ticker ON companies(ticker);
CREATE INDEX idx_value_parent ON value_nodes(parent_node_id);`
    },
    "Dockerfile": {
        type: "docker",
        content: `# Multi-stage Build for Engine
FROM python:3.11-slim as builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .

ENV PATH=/root/.local/bin:$PATH
ENV LLM_API_KEY=""

CMD ["python", "engine.py"]`
    },
    "docker-compose.yml": {
        type: "docker",
        content: `version: '3.8'

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
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  engine:
    build: .
    container_name: valueverse_engine
    depends_on:
      - db
    environment:
      - DB_URL=postgresql://analyst:secure_password_123@db:5432/valueverse
    restart: on-failure

volumes:
  postgres_data:`
    },
    "requirements.txt": {
        type: "text",
        content: `requests==2.31.0
psycopg2-binary==2.9.9
pandas==2.1.4
openai==1.6.1
anthropic==0.15.0
sqlalchemy==2.0.25
sec-edgar-downloader==5.0.2`
    }
};
