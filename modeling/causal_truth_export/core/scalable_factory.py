import os
import requests
import json
import time
from miner import EconomicLogicEngine, PDFIngestor
from schema import SourceTier, CausalRelationship
from typing import List, Dict

class ScalableExtractionFactory:
    def __init__(self, db_path: str = "causal_truth_db.json"):
        self.engine = EconomicLogicEngine(db_path=db_path)
        self.ingestor = PDFIngestor()
        
    def get_filenames(self, url: str) -> str:
        filename = url.split("/")[-1].split("?")[0]
        if not filename.endswith(".pdf"):
            filename += ".pdf"
        return filename

    def process_url(self, url: str, dry_run: bool = False) -> List[CausalRelationship]:
        filename = self.get_filenames(url)
        local_path = os.path.join("ingest", filename)
        
        # 1. Download if not exists
        if not os.path.exists(local_path):
            print(f"📥 Downloading: {url}")
            try:
                response = requests.get(url, timeout=20)
                if response.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(response.content)
                else:
                    # Fallback to archive if possible
                    archive_url = f"https://web.archive.org/web/{url}"
                    print(f"⚠️ Direct link failed ({response.status_code}). Trying archive: {archive_url}")
                    response = requests.get(archive_url, timeout=30)
                    if response.status_code == 200:
                        with open(local_path, "wb") as f:
                            f.write(response.content)
                    else:
                        print(f"❌ Both direct and archive links failed for {url}")
                        return []
            except Exception as e:
                print(f"❌ Download error for {url}: {e}")
                return []

        # 2. Extract Text
        text = self.ingestor.extract_text(local_path)
        if len(text) < 1000:
            print(f"⚠️ Signal density too low ({len(text)} chars) for {filename}. Might be a landing page or OCR required.")
            return []

        if dry_run:
            print(f"🔍 Dry Run: Successfully parsed {len(text)} chars from {filename}. Ready for LLM.")
            return []

        # 3. LLM Extraction
        print(f"🤖 Mining Causal Truth from {filename}...")
        source_meta = {"name": filename, "url": url}
        # Use first 15k chars (usually covers the meat of a TEI report)
        new_rels = self.engine.extract_from_text(text[:15000], SourceTier.TIER_2, source_meta)
        return new_rels

    def run_batch(self, url_list: List[str], limit: int = 10, dry_run: bool = False):
        print(f"🚀 Starting Scalable Factory Batch (Limit: {limit}, Dry Run: {dry_run})")
        count = 0
        total_found = 0
        
        for url in url_list:
            if count >= limit: break
            
            rels = self.process_url(url, dry_run=dry_run)
            if rels:
                self.engine.relationships.extend(rels)
                total_found += len(rels)
                # Atomic save
                self.engine.save_to_db()
                print(f"✅ Added {len(rels)} relationships from {url}")
            
            count += 1
            if not dry_run:
                time.sleep(2) # Rate limit protection

if __name__ == "__main__":
    factory = ScalableExtractionFactory()
    with open("forrester_unique_urls.txt", "r") as f:
        unique_urls = [line.strip() for line in f if line.strip()]
    
    # Run a batch of 10
    factory.run_batch(unique_urls, limit=10, dry_run=not bool(os.getenv("OPENAI_API_KEY")))
