# Sen Chăm Boss - Local AI nhanh

1. Cài/chạy Ollama.
2. Đảm bảo Qwen đã có:
   `ollama pull qwen2.5:3b`
3. Cài embedding local đa ngôn ngữ:
   `ollama pull bge-m3`
4. Chạy server:
   `npm start`

Cấu hình mặc định:
- LLM: qwen2.5:3b
- Embedding: bge-m3
- Ollama: http://localhost:11434

RAG vẫn dùng `data/rag_embeddings.json` + cosine similarity. Vector Gemini cũ không được trộn với vector BGE-M3; cache local có prefix riêng và sẽ tự tạo lại khi cần.

Lưu ý: lần chạy đầu có thể chậm hơn vì phải tạo vector cục bộ cho tài liệu chưa có cache. Các lần sau nhanh hơn nhờ cache.
