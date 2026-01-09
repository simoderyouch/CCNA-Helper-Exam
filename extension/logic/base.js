/**
 * Base Logic Module - Abstract interface for exam handlers
 * All exam-specific logic modules must implement these methods
 */

class BaseExamLogic {
    constructor(questionsData) {
        this.questionsData = questionsData;
        this.autoModeEnabled = false;
        // User requested NO stop words filtering
    }

    // ========== DETECTION ==========

    /**
     * Check if this logic module can handle the current page
     * @returns {boolean}
     */
    canHandle() {
        throw new Error('canHandle() must be implemented');
    }

    /**
     * Get the active question container element
     * @returns {HTMLElement|null}
     */
    getActiveQuestion() {
        throw new Error('getActiveQuestion() must be implemented');
    }

    /**
     * Detect question type (mcq, truefalse, fillin, dragdrop, etc)
     * @param {HTMLElement} questionEl
     * @returns {string}
     */
    getQuestionType(questionEl) {
        return 'mcq'; // Default
    }

    // ========== EXTRACTION ==========

    /**
     * Extract question text from element
     * @param {HTMLElement} questionEl
     * @returns {string|null}
     */
    extractQuestionText(questionEl) {
        throw new Error('extractQuestionText() must be implemented');
    }

    /**
     * Extract available answer elements
     * @param {HTMLElement} questionEl
     * @returns {HTMLElement[]}
     */
    extractAnswerElements(questionEl) {
        throw new Error('extractAnswerElements() must be implemented');
    }

    /**
     * Get text content of an answer element
     * @param {HTMLElement} answerEl
     * @returns {string}
     */
    getAnswerText(answerEl) {
        return answerEl.textContent.trim();
    }

    // ========== MATCHING ==========

    /**
     * Normalize text for comparison
     * @param {string} text
     * @returns {string}
     */
    normalizeText(text) {
        if (!text) return '';
        // 1. Lowercase
        let normalized = text.toLowerCase();

        // 2. Remove leading specific numbers (e.g. "1. ", "25. ")
        normalized = normalized.replace(/^\s*\d+[\.\)]\s+/, '');

        return normalized
            .normalize('NFD') // Decompose
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            // Allow alphanumeric AND international characters (\p{L} matches any unicode letter, \p{N} any number)
            .replace(/[^\p{L}\p{N}\s]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Check if two texts match
     * @param {string} textA
     * @param {string} textB
     * @returns {boolean}
     */
    matchText(textA, textB) {
        return this.normalizeText(textA) === this.normalizeText(textB);
    }

    /**
     * Calculate fuzzy match score between texts
     * @param {string} searchText
     * @param {string} targetText
     * @returns {number} 0-1 score
     */
    fuzzyMatch(searchText, targetText) {
        const normSearch = this.normalizeText(searchText);
        const normTarget = this.normalizeText(targetText);

        if (normSearch === normTarget) return 1.0;
        if (normTarget.includes(normSearch) || normSearch.includes(normTarget)) return 0.9;

        const searchWords = (normSearch.match(/\w{3,}/g) || []);
        const targetWords = new Set(normTarget.match(/\w{3,}/g) || []);

        if (searchWords.length === 0) return 0;

        let matches = 0;
        searchWords.forEach(word => { if (targetWords.has(word)) matches++; });

        return (matches / searchWords.length) * 0.8;
    }

    /**
     * Find matching question in data
     * @param {string} questionText
     * @returns {{question: object, score: number}|null}
     */
    findMatchingQuestion(questionText) {
        if (!this.questionsData || !this.questionsData.questions) {
            console.error('[BaseExamLogic] No questions data available to search');
            return null;
        }

        const normSearch = this.normalizeText(questionText);
        console.log(`[BaseExamLogic] Searching for (normalized): "${normSearch.substring(0, 50)}..."`);

        let bestMatch = null;
        let bestScore = 0;

        for (const question of this.questionsData.questions) {
            const qText = question.text || question.text_normalized || '';
            const normQText = this.normalizeText(qText);

            // SIMPLIFIED LOGIC: Does the text containing the selection?
            // "Select the question from json" -> We check if our selection is part of the question text

            // 1. Perfect containment (Selection is inside Question)
            if (normQText.includes(normSearch)) {
                // Return immediately if match found - no fuzzy logic needed
                return { question, score: 1.0 };
            }

            // 2. Reverse containment (Question is inside Selection - unlikely but possible)
            if (normSearch.includes(normQText)) {
                return { question, score: 1.0 };
            }
        }

        // FALLBACK: Token overlap if no exact match found
        console.log(`[BaseExamLogic] No exact match, trying token overlap...`);
        const searchTokens = normSearch.match(/[\p{L}\p{N}]{3,}/gu) || [];
        if (searchTokens.length === 0) {
            console.log(`[BaseExamLogic] No tokens to search`);
            return null;
        }

        for (const question of this.questionsData.questions) {
            const qText = question.text || question.text_normalized || '';
            const normQText = this.normalizeText(qText);
            const targetTokens = new Set(normQText.match(/[\p{L}\p{N}]{3,}/gu) || []);

            if (targetTokens.size === 0) continue;

            let matches = 0;
            searchTokens.forEach(token => {
                if (targetTokens.has(token)) matches++;
            });

            const score = matches / searchTokens.length;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { question, score };
            }
        }

        console.log(`[BaseExamLogic] Best fuzzy score: ${bestScore}`);
        return bestMatch;
    }

    /**
     * Find correct answer elements based on question data
     * @param {HTMLElement} questionEl
     * @param {string[]} correctAnswers
     * @returns {HTMLElement[]}
     */
    findCorrectAnswerElements(questionEl, correctAnswers) {
        if (!correctAnswers || correctAnswers.length === 0) return [];

        const answerElements = this.extractAnswerElements(questionEl);
        const matches = [];

        for (const answerEl of answerElements) {
            const answerText = this.getAnswerText(answerEl);
            for (const correctAnswer of correctAnswers) {
                if (this.matchText(answerText, correctAnswer)) {
                    matches.push(answerEl);
                    break;
                }
            }
        }

        return matches;
    }

    // ========== ACTIONS ==========



    // ========== PUBLIC API ==========

    /**
     * Get answer for a specific query text (or auto-detect if null)
     * @param {string|null} queryText - Optional text to search for
     * @returns {{question: string, answers: string[], score: number, explanation: string}|{error: string}}
     */
    getAnswer(queryText = null) {
        let searchText = queryText;
        console.log('[BaseExamLogic DEBUG] getAnswer called. Initial searchText:', searchText);

        // If no text provided, try to extract from page (fallback)
        if (!searchText) {
            console.log('[BaseExamLogic DEBUG] No query text, attempting to extract from page...');
            const questionEl = this.getActiveQuestion();
            if (questionEl) {
                searchText = this.extractQuestionText(questionEl);
                console.log('[BaseExamLogic DEBUG] Extracted from page:', searchText);
            } else {
                console.log('[BaseExamLogic DEBUG] No active question element found');
            }
        }

        if (!searchText) {
            console.error('[BaseExamLogic DEBUG] FAILED: No text selected or detected');
            return { error: 'No text selected or detected' };
        }

        console.log('[BaseExamLogic DEBUG] Final searchText for matching:', searchText.substring(0, 50) + '...');

        const match = this.findMatchingQuestion(searchText);
        if (!match) {
            console.log('[BaseExamLogic DEBUG] findMatchingQuestion returned NULL');
            return { error: 'No answer found (no match)', question: searchText };
        }

        console.log('[BaseExamLogic DEBUG] Match result:', match.score);

        if (match.score < 0.2) {
            console.log('[BaseExamLogic DEBUG] Score too low (<0.4)');
            return { error: 'No answer found (low score)', question: searchText };
        }

        return {
            question: match.question.text, // Return the matched question text from DB
            answers: match.question.answer || [],
            score: match.score,
            explanation: match.question.explanation || '',
            choices: match.question.choices || []
        };
    }


}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.BaseExamLogic = BaseExamLogic;
}
