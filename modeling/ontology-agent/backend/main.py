"""
FastAPI application entry point.
Provides REST API and WebSocket for real-time progress updates.
"""

import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from core.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisResult,
    ProgressUpdate,
    JobStatus,
    KnowledgeGraph,
)
from core.database import init_db, async_session, AnalysisJob
from agents.orchestrator import OntologyOrchestrator


# In-memory job tracking (would use Redis in production)
active_jobs: Dict[str, dict] = {}
job_connections: Dict[str, list[WebSocket]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    # Startup
    print("🚀 Starting Ontology Discovery Agent...")
    await init_db()
    yield
    # Shutdown
    print("👋 Shutting down...")


app = FastAPI(
    title="Ontology Discovery Agent",
    description="Transform any website URL into a knowledge graph with competitive insights",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REST API Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ontology-agent"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def start_analysis(request: AnalyzeRequest):
    """
    Start a new ontology discovery analysis.
    Returns a job ID to track progress via WebSocket.
    """
    job_id = str(uuid.uuid4())
    
    # Initialize job tracking
    active_jobs[job_id] = {
        "status": JobStatus.QUEUED,
        "progress": 0.0,
        "url": str(request.url),
        "created_at": datetime.utcnow(),
        "entities_found": 0,
        "relationships_found": 0,
    }
    
    # Start async processing
    asyncio.create_task(run_analysis(job_id, request))
    
    return AnalyzeResponse(
        job_id=job_id,
        status="queued",
        message=f"Analysis started for {request.url}"
    )


@app.get("/api/status/{job_id}")
async def get_job_status(job_id: str):
    """Get the current status of an analysis job."""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return active_jobs[job_id]


@app.get("/api/results/{job_id}", response_model=AnalysisResult)
async def get_results(job_id: str):
    """Get the complete results of a finished analysis."""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = active_jobs[job_id]
    
    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400, 
            detail=f"Job not completed. Current status: {job['status']}"
        )
    
    return job.get("result")


# =============================================================================
# WebSocket for Real-time Progress
# =============================================================================

@app.websocket("/api/ws/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    """WebSocket endpoint for real-time progress updates."""
    await websocket.accept()
    
    if job_id not in job_connections:
        job_connections[job_id] = []
    job_connections[job_id].append(websocket)
    
    try:
        # Send current status immediately
        if job_id in active_jobs:
            await websocket.send_json(active_jobs[job_id])
        
        # Keep connection alive until job completes or client disconnects
        while True:
            try:
                # Wait for client messages (ping/pong or close)
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})
            
            # Check if job is complete
            if job_id in active_jobs:
                status = active_jobs[job_id].get("status")
                if status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                    break
                    
    except WebSocketDisconnect:
        pass
    finally:
        if job_id in job_connections:
            job_connections[job_id].remove(websocket)


async def broadcast_progress(job_id: str, update: dict):
    """Broadcast progress update to all connected WebSocket clients."""
    if job_id in job_connections:
        for ws in job_connections[job_id]:
            try:
                await ws.send_json(update)
            except:
                pass


# =============================================================================
# Background Processing
# =============================================================================

async def run_analysis(job_id: str, request: AnalyzeRequest):
    """Run the full ontology discovery pipeline."""
    start_time = datetime.utcnow()
    
    try:
        # Update status to crawling
        await update_job_status(job_id, JobStatus.CRAWLING, 0.1, "Starting website crawl...")
        
        # Initialize orchestrator
        orchestrator = OntologyOrchestrator()
        
        # Run the discovery pipeline with progress callbacks
        async def progress_callback(status: JobStatus, progress: float, message: str, **kwargs):
            await update_job_status(job_id, status, progress, message, **kwargs)
        
        result = await orchestrator.discover(
            url=str(request.url),
            competitor_urls=[str(u) for u in request.competitor_urls],
            industry_hints=request.industry_hints,
            progress_callback=progress_callback
        )
        
        # Calculate processing time
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        # Store final result
        final_result = AnalysisResult(
            job_id=job_id,
            url=str(request.url),
            completed_at=end_time,
            processing_time_seconds=processing_time,
            graph=result["graph"],
            insights=result["insights"],
            sources_crawled=result.get("sources_crawled", 0),
            warnings=result.get("warnings", [])
        )
        
        active_jobs[job_id]["result"] = final_result.model_dump()
        await update_job_status(
            job_id, 
            JobStatus.COMPLETED, 
            1.0, 
            f"Analysis complete in {processing_time:.1f}s",
            entities_found=final_result.graph.entity_count,
            relationships_found=final_result.graph.relationship_count
        )
        
    except Exception as e:
        await update_job_status(
            job_id, 
            JobStatus.FAILED, 
            0.0, 
            f"Analysis failed: {str(e)}"
        )
        active_jobs[job_id]["error"] = str(e)


async def update_job_status(
    job_id: str, 
    status: JobStatus, 
    progress: float, 
    message: str,
    **kwargs
):
    """Update job status and broadcast to WebSocket clients."""
    if job_id not in active_jobs:
        return
    
    update = {
        "status": status,
        "progress": progress,
        "message": message,
        **kwargs
    }
    
    active_jobs[job_id].update(update)
    await broadcast_progress(job_id, update)


# =============================================================================
# Run with: uvicorn main:app --reload
# =============================================================================
