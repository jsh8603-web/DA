#!/usr/bin/env python3
"""
~/.claude/scripts/da-vector/embed_service.py
DA Vector Store — BGE-M3 embedding service (FastAPI :8787)

Setup (before first run):
    pip install flagembedding fastapi uvicorn[standard]
    # BGE-M3 model (~2.3GB) will be downloaded on first startup.
    # Run: python embed_service.py

Endpoints:
    POST /embed  { "texts": ["..."] }  → { "vectors": [[...]] }
    GET  /health                        → { "status": "ok", "model": "BAAI/bge-m3" }
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from FlagEmbedding import BGEM3FlagModel
import uvicorn
from pydantic import BaseModel

model = None  # initialized on startup


class EmbedRequest(BaseModel):
    texts: list[str]


app = FastAPI(title="DA Embed Service", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    global model
    model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=False)  # CPU mode


@app.post("/embed")
async def embed(req: EmbedRequest):
    vecs = model.encode(req.texts, batch_size=4, max_length=1024)["dense_vecs"]
    return {"vectors": [v.tolist() for v in vecs]}


@app.get("/health")
async def health():
    return {"status": "ok", "model": "BAAI/bge-m3", "dim": 1024}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8787, log_level="info")

# Run: python C:/Users/jsh86/.claude/scripts/da-vector/embed_service.py
# Latency target: BGE-M3 60-80ms + LanceDB 10-20ms = 70-100ms total
