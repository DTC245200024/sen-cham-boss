# RAG thật với Gemini Embeddings

Trợ lý AI đã được chuyển từ TF-IDF/BM25 sang semantic retrieval bằng Gemini Embeddings.

## Luồng

1. `data/knowledge/sen_cham_boss_knowledge.txt` là Knowledge Base lấy từ `SEN CHĂM BOSS.docx`.
2. `utils/ragEngine.js` tạo các document/chunk có kiểm soát quyền truy cập.
3. `utils/embeddingStore.js` tạo embedding cho document bằng `gemini-embedding-001` với `RETRIEVAL_DOCUMENT`.
4. Câu hỏi của người dùng được embedding với `RETRIEVAL_QUERY`.
5. Cosine similarity lấy các chunk phù hợp nhất.
6. Các chunk được đưa vào `generateGeminiChatResponse()` làm context.
7. Gemini sinh câu trả lời chỉ dựa trên context đã truy xuất.

Google khuyến nghị dùng `RETRIEVAL_DOCUMENT` cho tài liệu và `RETRIEVAL_QUERY` cho truy vấn khi dùng `gemini-embedding-001` cho retrieval.

## Cấu hình

Trong `.env`:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Không commit API key thật vào Git.

## Chạy

```bash
npm install
npm start
```

Lần đầu hỏi AI, hệ thống sẽ tạo embedding cho các chunk và lưu cache tại:

`data/rag_embeddings.json`

Nếu sửa Knowledge Base hoặc muốn tạo lại embedding:

```bash
npm run rag:clear-cache
```

Sau đó chạy lại server và đặt câu hỏi.
