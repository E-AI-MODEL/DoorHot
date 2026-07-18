#!/usr/bin/env bash
# Installs Ollama and pulls the small demo model from Hugging Face so
# the one-click demo can answer with a real (local, free) LLM. Safe to
# re-run; every step is idempotent. The demo works without this too:
# the coach then answers extractively from the knowledge base.
set -euo pipefail

MODEL="${DEMO_LLM_MODEL:-hf.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama installeren..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama-server starten..."
  (ollama serve >/tmp/ollama-setup.log 2>&1 &)
  for _ in $(seq 1 30); do
    if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

echo "Demo-model ophalen van Hugging Face: $MODEL"
ollama pull "$MODEL"
echo "Demo-LLM klaar: $MODEL"
