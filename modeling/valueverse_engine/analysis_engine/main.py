import time
import logging
from config import COMPANIES
from engine import ValueVerseEngine
import psycopg2

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def initialize_companies(engine):
    """Ensures companiess exist in the DB."""
    with engine.conn.cursor() as cur:
        for comp in COMPANIES:
            cur.execute("""
                INSERT INTO companies (name, ticker, cik)
                VALUES (%s, %s, %s)
                ON CONFLICT (ticker) DO NOTHING;
            """, (comp['name'], comp['ticker'], comp['cik']))
    logger.info("Initialized companies in DB.")

def main():
    logger.info("Starting ValueVerse Engine...")
    
    # Wait for DB to be ready
    engine = None
    retries = 5
    while retries > 0:
        try:
            engine = ValueVerseEngine()
            break
        except Exception:
            logger.info("Waiting for database...")
            time.sleep(5)
            retries -= 1
            
    if not engine:
        logger.error("Could not connect to database. Exiting.")
        return

    initialize_companies(engine)
    
    # Simple loop to process companies
    # In a real system, this would be a queue or cron job
    with engine.conn.cursor() as cur:
        # Get companies
        cur.execute("SELECT id, name, ticker, cik FROM companies")
        companies = cur.fetchall() # Tuple list
        
        for c_id, c_name, c_ticker, c_cik in companies:
            logger.info(f"Processing {c_name} ({c_ticker})...")
            
            # Check if we already have a filing for this year (simplified logic)
            # In a real app we'd check dates more carefully.
            cur.execute("SELECT id FROM filings WHERE company_id = %s", (c_id,))
            if cur.fetchone():
                logger.info(f"Skipping {c_ticker}, already processed.")
                continue

            filing_meta = engine.fetch_10k_filing_url(c_cik)
            if filing_meta:
                 logger.info(f"Found 10-K for {c_ticker} dated {filing_meta['date']}")
                 text_content = engine.fetch_text_content(filing_meta['url'])
                 
                 if text_content:
                     logger.info(f"Extracting Value Tree for {c_ticker}...")
                     tree = engine.prompt_llm_for_tree(c_name, text_content)
                     
                     if tree:
                         engine.save_to_db(c_id, filing_meta, tree)
                         logger.info(f"Successfully processed {c_ticker}")
                     else:
                         logger.warning(f"No tree extracted for {c_ticker}")
            else:
                logger.warning(f"No 10-K found for {c_ticker}")

            time.sleep(2) # Politeness delay between companies

    engine.close()
    logger.info("Processing run complete.")

if __name__ == "__main__":
    main()
