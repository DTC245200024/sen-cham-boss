/**
 * =======================================================================
 * VECTOR EMBEDDING & SEMANTIC RETRIEVAL ENGINE FOR SEN CHĂM BOSS
 * =======================================================================
 * Implements Vector Space Model (VSM) with TF-IDF N-Gram Embeddings,
 * BM25 relevance scoring, and Cosine Similarity for natural language RAG.
 */

class VectorStore {
  constructor() {
    this.documents = [];
    this.vocabulary = new Map();
    this.idf = new Map();
    this.vectors = [];
    this.docLengths = [];
    this.avgDocLength = 0;
  }

  /**
   * Tokenize and normalize Vietnamese text into unigrams & bigrams
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,?!:;'"()\[\]{}_\-\/\\`~@#$%^&*+=<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = normalized.split(' ').filter(w => w.length > 0);
    const tokens = [...words];

    // Add bigrams for phrase awareness
    for (let i = 0; i < words.length - 1; i++) {
      tokens.push(`${words[i]}_${words[i + 1]}`);
    }

    return tokens;
  }

  /**
   * Build Index across all knowledge chunks
   */
  buildIndex(documents) {
    this.documents = documents || [];
    this.vocabulary.clear();
    this.idf.clear();
    this.vectors = [];
    this.docLengths = [];

    const numDocs = this.documents.length;
    if (numDocs === 0) return;

    const docFreq = new Map();
    const docTokensList = [];
    let totalLength = 0;

    // Step 1: Collect doc tokens and term frequencies
    this.documents.forEach((doc) => {
      const fullText = `${doc.title || ''} ${doc.category || ''} ${doc.type || ''} ${doc.content || ''}`;
      const tokens = this.tokenize(fullText);
      docTokensList.push(tokens);
      this.docLengths.push(tokens.length);
      totalLength += tokens.length;

      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(token => {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.vocabulary.size);
        }
      });
    });

    this.avgDocLength = totalLength / numDocs || 1;

    // Step 2: Compute IDF for each token (Smooth IDF)
    docFreq.forEach((freq, token) => {
      const idfValue = Math.log((numDocs - freq + 0.5) / (freq + 0.5) + 1) + 1;
      this.idf.set(token, idfValue);
    });

    // Step 3: Compute TF-IDF Vector for each document
    this.vectors = docTokensList.map((tokens) => {
      return this.computeVector(tokens);
    });
  }

  /**
   * Compute normalized TF-IDF vector from tokens
   */
  computeVector(tokens) {
    const termFreq = new Map();
    tokens.forEach(t => termFreq.set(t, (termFreq.get(t) || 0) + 1));

    const totalTokens = tokens.length || 1;
    const vector = new Map();
    let sumSq = 0;

    termFreq.forEach((count, token) => {
      if (this.idf.has(token)) {
        const tf = count / totalTokens;
        const idf = this.idf.get(token);
        const tfidf = tf * idf;
        vector.set(token, tfidf);
        sumSq += tfidf * tfidf;
      }
    });

    // L2 Normalize Vector
    const norm = Math.sqrt(sumSq) || 1;
    vector.forEach((val, token) => {
      vector.set(token, val / norm);
    });

    return vector;
  }

  /**
   * Compute Cosine Similarity between two sparse vectors
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    const [smaller, larger] = vecA.size <= vecB.size ? [vecA, vecB] : [vecB, vecA];

    smaller.forEach((valA, token) => {
      const valB = larger.get(token);
      if (valB) {
        dotProduct += valA * valB;
      }
    });

    return dotProduct;
  }

  /**
   * Compute BM25 Score for query tokens against a document
   */
  computeBM25(queryTokens, docIdx, k1 = 1.5, b = 0.75) {
    const doc = this.documents[docIdx];
    if (!doc) return 0;

    const fullText = `${doc.title || ''} ${doc.category || ''} ${doc.type || ''} ${doc.content || ''}`;
    const docTokens = this.tokenize(fullText);
    const docLen = docTokens.length || 1;

    const termFreq = new Map();
    docTokens.forEach(t => termFreq.set(t, (termFreq.get(t) || 0) + 1));

    let score = 0;
    queryTokens.forEach(token => {
      if (termFreq.has(token) && this.idf.has(token)) {
        const tf = termFreq.get(token);
        const idf = this.idf.get(token);
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLen / this.avgDocLength));
        score += idf * (numerator / denominator);
      }
    });

    return score;
  }

  /**
   * Search Top-K most similar documents for any natural language query
   */
  search(query, topK = 4, minScore = 0.05) {
    if (!query || this.documents.length === 0) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];
    const queryVector = this.computeVector(queryTokens);

    const scored = this.documents.map((doc, idx) => {
      const docVector = this.vectors[idx];
      const cosSim = this.cosineSimilarity(queryVector, docVector);
      const bm25 = this.computeBM25(queryTokens, idx);
      // Combined hybrid score
      const hybridScore = cosSim * 0.6 + (bm25 / (bm25 + 10)) * 0.4;
      return { doc, score: hybridScore, cosSim, bm25 };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter(item => item.score >= minScore)
      .slice(0, topK)
      .map(item => ({ ...item.doc, similarityScore: item.score }));
  }
}

module.exports = VectorStore;
