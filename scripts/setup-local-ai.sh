#!/bin/bash
set -e
echo "[1/2] Checking Ollama..."
curl -fsS http://localhost:11434/api/tags >/dev/null
echo "[2/2] Pulling multilingual embedding model bge-m3..."
ollama pull bge-m3
echo "Done. Qwen and BGE-M3 are ready."
