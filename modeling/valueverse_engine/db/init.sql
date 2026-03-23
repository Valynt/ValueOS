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
    filing_date DATE, -- Made nullable as it might not be immediately available
    accession_number VARCHAR(50) UNIQUE,
    raw_text_path TEXT -- Path to S3 or local volume storage
);

-- Recursive Value Tree Table
CREATE TABLE value_nodes (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER REFERENCES filings(id),
    parent_node_id INTEGER REFERENCES value_nodes(id),
    node_type VARCHAR(50), -- Removed CHECK constraint to allow flexibility, or keep: CHECK (node_type IN ('Growth', 'Monetization', 'Durability', 'Product-Line', 'Efficiency'))
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metric_value NUMERIC, -- Extracted metric if available (e.g., Retention Rate)
    confidence_score FLOAT, -- LLM confidence in extraction
    impact_score INTEGER, -- 0-100 normalized score
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for recursive query performance
CREATE INDEX idx_parent_node ON value_nodes(parent_node_id);
CREATE INDEX idx_company_filing ON filings(company_id);
