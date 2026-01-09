/**
 * Background service worker - handles question lookup
 * Enhanced with better fuzzy matching algorithm
 */

let questionsData = null;
let lastResult = null;

// Default OpenRouter config (can be overridden by message)
const DEFAULT_OPENROUTER_MODEL = 'mistralai/mistral-7b-instruct:free';
const DEFAULT_OPENROUTER_API_KEY = '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';

console.log('[CCNA Background] Service worker starting...');

// Load questions on startup
async function loadQuestions() {
    try {
        const url = chrome.runtime.getURL('data/questions.json');
        console.log('[CCNA Background] Loading from:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch: ' + response.status);
        }

        questionsData = await response.json();
        console.log('[CCNA Background] ✓ Loaded', questionsData.total_questions, 'questions');
    } catch (error) {
        console.error('[CCNA Background] ✗ Failed to load questions:', error);
    }
}

// Normalize text for comparison
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ')
        .trim();
}

// Get words from text (minimum 3 chars)
function getWords(text) {
    return normalizeText(text)
        .split(' ')
        .filter(w => w.length >= 3);
}

// Calculate word overlap score using Jaccard similarity
function calculateScore(searchText, questionText) {
    const searchWords = new Set(getWords(searchText));
    const questionWords = new Set(getWords(questionText));

    if (searchWords.size === 0 || questionWords.size === 0) {
        return 0;
    }

    // Count intersection
    let intersection = 0;
    for (const word of searchWords) {
        if (questionWords.has(word)) {
            intersection++;
        }
    }

    // Jaccard similarity
    const union = new Set([...searchWords, ...questionWords]).size;
    const jaccard = intersection / union;

    // Also check for substring containment
    const normSearch = normalizeText(searchText);
    const normQuestion = normalizeText(questionText);

    if (normQuestion.includes(normSearch) || normSearch.includes(normQuestion)) {
        return Math.max(jaccard, 0.9);
    }

    // Check if most search words are in question
    const coverage = intersection / searchWords.size;

    return Math.max(jaccard, coverage * 0.8);
}

// Find matching questions
function findMatches(searchText) {
    if (!questionsData || !questionsData.questions) {
        console.log('[CCNA Background] No data loaded!');
        return [];
    }

    console.log('[CCNA Background] Searching:', searchText.substring(0, 60) + '...');

    const matches = [];
    const threshold = 0.2; // Low threshold to catch more matches

    for (const question of questionsData.questions) {
        const score = calculateScore(searchText, question.text || '');

        if (score >= threshold) {
            matches.push({ question, score });
        }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    const topMatches = matches.slice(0, 5);
    console.log('[CCNA Background] Found', matches.length, 'matches, returning top', topMatches.length);

    if (topMatches.length > 0) {
        console.log('[CCNA Background] Best match:', topMatches[0].question.text.substring(0, 60) + '...', 'Score:', topMatches[0].score);
    }

    return topMatches;
}

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[CCNA Background] Message received:', message.type);

    // Return full questions data to content script
    if (message.type === 'GET_QUESTIONS_DATA') {
        if (questionsData) {
            sendResponse(questionsData);
        } else {
            // Try to load first
            loadQuestions().then(() => {
                sendResponse(questionsData);
            });
        }
        return true;
    }

    if (message.type === 'TEXT_SELECTED') {
        const matches = findMatches(message.text);

        lastResult = {
            searchText: message.text,
            matches: matches,
            timestamp: Date.now()
        };

        // Store for popup
        chrome.storage.local.set({ lastResult }, () => {
            if (chrome.runtime.lastError) {
                console.error('[CCNA Background] Storage error:', chrome.runtime.lastError);
            } else {
                console.log('[CCNA Background] Result saved to storage');
            }
        });

        // Update badge
        const badgeText = matches.length > 0 ? String(matches.length) : '0';
        const badgeColor = matches.length > 0 ? '#4CAF50' : '#FF5722';

        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: badgeColor });

        sendResponse({ matchCount: matches.length, success: true });
        return true;
    }

    if (message.type === 'GET_RESULT') {
        sendResponse(lastResult);
        return true;
    }

    // AI Query - Make API call to OpenRouter from background (bypasses page CSP)
    if (message.type === 'AI_QUERY') {
        console.log('[CCNA Background AI] ========== AI QUERY START ==========');
        console.log('[CCNA Background AI] Text:', message.text ? message.text.substring(0, 50) + '...' : 'MISSING');

        const apiKey = message.apiKey || DEFAULT_OPENROUTER_API_KEY;
        const model = message.model || DEFAULT_OPENROUTER_MODEL;

        console.log('[CCNA Background AI] Using API key:', apiKey ? `${apiKey.substring(0, 15)}...` : 'NONE');

        if (!message.text) {
            console.error('[CCNA Background AI] ERROR: No text provided!');
            sendResponse({ error: 'No text provided' });
            return true;
        }

        (async () => {
            try {
                console.log('[CCNA Background AI] Making fetch request to OpenRouter...');

                const requestBody = {
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: `INSTRUCTIONS: You are a CCNA/CCNP networking exam expert. Read the question below carefully. Return ONLY the correct answer(s) by copying the EXACT text from the options. Rules:
1. Copy the correct answer text EXACTLY as written
2. If multiple answers are correct, list each on a new line  
3. Do NOT explain or paraphrase
4. Do NOT add any extra text

QUESTION:
${message.text}`
                        }
                    ]
                };

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://netacad.com',
                        'X-Title': 'CCNA Answer Helper'
                    },
                    body: JSON.stringify(requestBody)
                });

                console.log('[CCNA Background AI] Response status:', response.status);

                if (!response.ok) {
                    const errText = await response.text();
                    console.error('[CCNA Background AI] API Error:', errText);
                    sendResponse({ error: `API Error: ${response.status}`, details: errText });
                    return;
                }

                const data = await response.json();
                const aiAnswer = data.choices?.[0]?.message?.content || 'No response from AI';
                console.log('[CCNA Background AI] Answer:', aiAnswer.substring(0, 100) + '...');
                console.log('[CCNA Background AI] ========== AI QUERY SUCCESS ==========');
                sendResponse({ answer: aiAnswer });
            } catch (err) {
                console.error('[CCNA Background AI] Fetch Error:', err);
                sendResponse({ error: err.message });
            }
        })();

        return true;
    }

    return true;
});

// Load questions immediately
loadQuestions();

console.log('[CCNA Background] Service worker initialized');
