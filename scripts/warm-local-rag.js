require('dotenv').config();
const db = require('../config/database');
const { buildRealSystemDocuments } = require('../utils/ragEngine');
const { EmbeddingStore } = require('../utils/embeddingStore');

(async () => {
  try {
    const docs = buildRealSystemDocuments({ user: null, selectedPet: null, database: db });
    const store = new EmbeddingStore();
    console.log(`[RAG WARM] Preparing ${docs.length} system documents...`);
    const count = await store.warmDocuments(docs);
    console.log(`[RAG WARM] Cached ${count} new local document vectors.`);
    console.log('[RAG WARM] Done. Future semantic RAG requests will skip document embedding.');
  } catch (err) {
    console.error('[RAG WARM] Failed:', err.message);
    process.exitCode = 1;
  }
})();
