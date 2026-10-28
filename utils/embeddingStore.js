/**
 * SEN CHĂM BOSS - FAST LOCAL RAG EMBEDDING STORE
 *
 * Fast path: reuse cached local vectors and avoid embedding the entire
 * knowledge base on every request. Gemini embedding is kept only as an
 * optional compatibility fallback when explicitly enabled.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'bge-m3';
const USE_LOCAL_EMBEDDINGS = process.env.USE_LOCAL_EMBEDDINGS !== 'false';
const GEMINI_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const CACHE_FILE = path.join(__dirname, '..', 'data', 'rag_embeddings.json');
const CACHE_PREFIX = `local:${OLLAMA_EMBED_MODEL}:`;

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) || {};
  } catch (err) {
    console.warn('[RAG EMBEDDING] Cache read failed:', err.message);
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const tmp = `${CACHE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8');
    fs.renameSync(tmp, CACHE_FILE);
  } catch (err) {
    console.warn('[RAG EMBEDDING] Cache write failed:', err.message);
  }
}

async function ollamaEmbed(input) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input, keep_alive: '30m' })
  });
  if (!response.ok) throw new Error(`Ollama embedding HTTP ${response.status}`);
  const data = await response.json();
  const vectors = Array.isArray(data?.embeddings) ? data.embeddings : (data?.embedding ? [data.embedding] : []);
  if (!vectors.length || !vectors.every(v => Array.isArray(v) && v.length)) {
    throw new Error('Ollama returned no embedding vector');
  }
  return Array.isArray(input) ? vectors : vectors[0];
}

class EmbeddingStore {
  constructor() {
    this.cache = loadCache();
    this.ai = null;
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (apiKey) this.ai = new GoogleGenAI({ apiKey });
  }

  isAvailable() { return USE_LOCAL_EMBEDDINGS || Boolean(this.ai); }

  cacheKey(kind, id, content) {
    return `${CACHE_PREFIX}${kind}:${id}:${sha256(content)}`;
  }

  async embed(text, taskType) {
    if (USE_LOCAL_EMBEDDINGS) {
      try { return await ollamaEmbed(text); }
      catch (err) {
        if (process.env.LOCAL_EMBED_FALLBACK_GEMINI === 'true' && this.ai) {
          console.warn('[RAG EMBEDDING] Local embedding unavailable; using Gemini fallback:', err.message);
          const result = await this.ai.models.embedContent({
            model: GEMINI_MODEL, contents: text, config: { taskType }
          });
          const values = result?.embeddings?.[0]?.values;
          if (Array.isArray(values) && values.length) return values;
        }
        throw err;
      }
    }
    if (!this.ai) throw new Error('No embedding provider configured');
    const result = await this.ai.models.embedContent({
      model: GEMINI_MODEL, contents: text, config: { taskType }
    });
    const values = result?.embeddings?.[0]?.values;
    if (!Array.isArray(values) || !values.length) throw new Error('Gemini returned no vector');
    return values;
  }

  async search(query, documents, topK = 2, minScore = 0.25) {
    if (!query || !documents?.length || !this.isAvailable()) return [];

    // Only query embedding is calculated here. Cached document vectors are reused.
    const queryVector = await this.embed(query, 'RETRIEVAL_QUERY');
    const scored = [];
    const uncached = [];

    for (const doc of documents) {
      const content = `${doc.title || ''}\n${doc.category || ''}\n${doc.type || ''}\n${doc.content || ''}`.trim();
      const key = this.cacheKey('doc', doc.id, content);
      if (this.cache[key]?.vector?.length) {
        scored.push({ ...doc, similarityScore: cosineSimilarity(queryVector, this.cache[key].vector) });
      } else {
        uncached.push({ doc, key, content });
      }
    }

    // Avoid a slow first user request: do not embed dozens of documents here.
    // New vectors are created only by the explicit cache-warming endpoint/script.
    if (uncached.length > 0) {
      console.warn(`[RAG EMBEDDING] ${uncached.length} local document vectors are not cached; using cached vectors only.`);
    }

    saveCache(this.cache);
    return scored
      .filter(x => x.similarityScore >= minScore)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, topK);
  }

  async warmDocuments(documents) {
    if (!USE_LOCAL_EMBEDDINGS || !Array.isArray(documents) || !documents.length) return 0;
    const uncached = [];
    for (const doc of documents) {
      const content = `${doc.title || ''}\n${doc.category || ''}\n${doc.type || ''}\n${doc.content || ''}`.trim();
      const key = this.cacheKey('doc', doc.id, content);
      if (!this.cache[key]?.vector?.length) uncached.push({ doc, key, content });
    }
    if (!uncached.length) return 0;
    const vectors = await ollamaEmbed(uncached.map(x => x.content));
    let count = 0;
    uncached.forEach((item, i) => {
      const vector = vectors[i];
      if (!vector?.length) return;
      this.cache[item.key] = {
        id: item.doc.id, hash: sha256(item.content), vector,
        provider: 'ollama', model: OLLAMA_EMBED_MODEL,
        updatedAt: new Date().toISOString()
      };
      count++;
    });
    saveCache(this.cache);
    return count;
  }

  invalidateDocCache(pattern = '') {
    this.cache = loadCache();
    let count = 0;
    const patLower = (pattern || '').toLowerCase();
    for (const key of Object.keys(this.cache)) {
      if (key.startsWith(CACHE_PREFIX) && (!pattern || key.toLowerCase().includes(patLower) || (this.cache[key]?.id && this.cache[key].id.toLowerCase().includes(patLower)))) {
        delete this.cache[key]; count++;
      }
    }
    saveCache(this.cache); return count;
  }

  clearCache() { this.cache = {}; saveCache(this.cache); }
}

function invalidateEmbeddingCache(pattern = '') {
  try { return new EmbeddingStore().invalidateDocCache(pattern); }
  catch (err) { console.warn('[RAG EMBEDDING] Invalidate cache failed:', err.message); return 0; }
}

module.exports = {
  EmbeddingStore, cosineSimilarity, invalidateEmbeddingCache,
  MODEL: OLLAMA_EMBED_MODEL, CACHE_FILE
};
