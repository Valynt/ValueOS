import time
import requests
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from tenacity import retry, stop_after_attempt, wait_exponential

from config import DB_URL, LLM_API_KEY, SEC_USER_AGENT

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ValueVerseEngine:
    def __init__(self):
        self.api_key = LLM_API_KEY
        self.headers = {"User-Agent": SEC_USER_AGENT}
        self.last_request_time = 0
        self.conn = None
        
        try:
            self.conn = psycopg2.connect(DB_URL)
            self.conn.autocommit = True
            logger.info("Connected to Database.")
        except Exception as e:
            logger.error(f"Failed to connect to DB: {e}")
            raise

    def _wait_for_rate_limit(self, period=0.1):
        """Ensures compliance with SEC 10 requests/second."""
        elapsed = time.time() - self.last_request_time
        if elapsed < period:
            time.sleep(period - elapsed)
        self.last_request_time = time.time()

    def fetch_10k_filing_url(self, cik: str) -> str:
        """Fetches the latest 10-K URL for a given CIK."""
        self._wait_for_rate_limit()
        # SEC Submissions API
        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        
        try:
            resp = requests.get(url, headers=self.headers)
            resp.raise_for_status()
            data = resp.json()
            
            # Find latest 10-K
            recent_filings = data.get("filings", {}).get("recent", {})
            forms = recent_filings.get("form", [])
            accession_numbers = recent_filings.get("accessionNumber", [])
            primary_documents = recent_filings.get("primaryDocument", [])
            dates = recent_filings.get("filingDate", [])

            for i, form in enumerate(forms):
                if form == "10-K":
                    acc_num = accession_numbers[i]
                    doc_name = primary_documents[i]
                    # URL construction: https://www.sec.gov/Archives/edgar/data/{cik}/{no-dash-acc-num}/{doc_name}
                    cik_stripped = str(int(cik)) # Remove leading zeros
                    acc_num_stripped = acc_num.replace("-", "")
                    
                    filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik_stripped}/{acc_num_stripped}/{doc_name}"
                    
                    return {
                        "url": filing_url,
                        "date": dates[i],
                        "accession": acc_num
                    }
            
            logger.warning(f"No 10-K found for CIK {cik}")
            return None

        except Exception as e:
            logger.error(f"Error fetching filing metadata for {cik}: {e}")
            return None

    def fetch_text_content(self, url: str) -> str:
        """Downloads the full text of the filing."""
        self._wait_for_rate_limit()
        try:
            resp = requests.get(url, headers=self.headers)
            resp.raise_for_status()
            # Simple text extraction for now - could be enhanced with BS4
            return resp.text[:100000] # Truncate for demo/LLM limits
        except Exception as e:
            logger.error(f"Error downloading text from {url}: {e}")
            return ""

    # Mock LLM call for now if API key is not set, otherwise use OpenAI
    def prompt_llm_for_tree(self, company_name: str, context_text: str) -> list:
        if not self.api_key:
            logger.warning("No LLM_API_KEY found. Returning mock data.")
            return self._mock_data(company_name)

        # Real LLM Call Implementation
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)

            prompt = f"""
            Analyze the following 10-K text for {company_name}. 
            Identify the primary value drivers categorized by Growth, Monetization, and Durability.
            For each product line (e.g., Salesforce Sales Cloud), identify specific 
            sub-drivers (e.g., Multi-cloud expansion, AI-driven cross-sell).
            
            Return ONLY a valid JSON list of objects with the following structure: 
            [{{"title": "string", "type": "Growth|Monetization|Durability|Product-Line", "description": "string", "children": []}}]
            
            Text content (truncated):
            {context_text[:20000]}
            """

            response = client.chat.completions.create(
                model="gpt-4-turbo-preview", # Or gpt-3.5-turbo
                messages=[
                    {"role": "system", "content": "You are a financial analyst engine."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            # Handle potential wrapping in a key like "value_drivers": ...
            data = json.loads(content)
            if isinstance(data, dict):
                # Try to find a list 
                for key, val in data.items():
                    if isinstance(val, list):
                        return val
                # If just a dict, maybe the dict IS the node? No, we expect a list of root nodes/drivers
                return [] 
            return data

        except Exception as e:
            logger.error(f"LLM Error: {e}")
            return []

    def _mock_data(self, company_name):
        return [
            {
                "title": f"Growth for {company_name}",
                "type": "Growth",
                "description": "Driven by AI adoption",
                "children": [
                    {"title": "AI Product Suite", "type": "Product-Line", "description": "New AI features driving sales", "children": []}
                ]
            },
            {
                "title": f"Monetization for {company_name}",
                "type": "Monetization",
                "description": "Efficiency gains",
                "children": []
            }
        ]

    def save_to_db(self, company_id: int, filing_data: dict, value_tree: list):
        """Persists the filing and the recursive value tree."""
        with self.conn.cursor() as cur:
            # 1. Insert Filing
            cur.execute("""
                INSERT INTO filings (company_id, filing_type, filing_date, accession_number, raw_text_path)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
            """, (company_id, '10-K', filing_data['date'], filing_data['accession'], filing_data['url']))
            filing_id = cur.fetchone()[0]
            
            # 2. Recursive Insert
            self._insert_nodes(cur, filing_id, None, value_tree)
            
        logger.info(f"Saved value tree for company_id {company_id}")

    def _insert_nodes(self, cur, filing_id, parent_id, nodes):
        for node in nodes:
            cur.execute("""
                INSERT INTO value_nodes (filing_id, parent_node_id, node_type, title, description, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                RETURNING id;
            """, (filing_id, parent_id, node.get('type', 'Unknown'), node.get('title'), node.get('description')))
            
            node_id = cur.fetchone()[0]
            
            if 'children' in node and node['children']:
                self._insert_nodes(cur, filing_id, node_id, node['children'])

    def close(self):
        if self.conn:
            self.conn.close()
