/**
 * CCNA Extension - Content Script (Floating UI)
 * Select text -> Get Answer -> Show Result Bubble
 */

console.log('[CCNA] Content script loading (Floating UI)...');

// ============================================
// STATE
// ============================================
let questionsData = null;
let currentSelection = '';
let selectedImage = null; // For image-based search
let floatingBtn = null;
let aiBtn = null; // AI Button
let resultBubble = null;

// OpenRouter API Config
const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'mistralai/mistral-7b-instruct:free';

// ============================================
// INITIALIZATION
function init() {
    if (!document.body) {
        setTimeout(init, 100);
        return;
    }

    // Check context
    const isTopFrame = (window.self === window.top);
    const hasActiveLogic = window.examLogic && window.examLogic.getActiveModule();

    console.log('[CCNA] Init - isTopFrame:', isTopFrame, 'hasActiveLogic:', hasActiveLogic);

    // Always run in iframes to detect images - don't skip!

    // Load data
    loadQuestionsData();

    // Inject Styles
    injectStyles();

    // Create hidden UI elements
    createFloatingUI();

    // Setup Listeners
    setupSelectionListener();

    // Allow text selection everywhere (force override)
    document.addEventListener('mousedown', (e) => {
        // DON'T block interactions with our own UI!
        if (e.target.id === 'ccna-float-btn' ||
            e.target.id === 'ccna-ai-btn' ||
            e.target.closest('#ccna-result-bubble') ||
            e.target.closest('#ccna-float-btn') ||
            e.target.closest('#ccna-ai-btn')) {
            return;
        }
        e.stopPropagation();
    }, true);

    console.log('[CCNA] Content script ready');
}

function loadQuestionsData() {
    chrome.runtime.sendMessage({ type: 'GET_QUESTIONS_DATA' }, (response) => {
        if (response && response.questions) {
            questionsData = response;
            console.log('[CCNA DEBUG] Questions data loaded from background. Total:', questionsData.total_questions);

            if (window.examLogic) {
                window.examLogic.setQuestionsData(questionsData);
                const active = window.examLogic.detectAndLoad();
                console.log('[CCNA DEBUG] Logic module initialization result:', active ? active.name : 'NONE');
            } else {
                console.error('[CCNA DEBUG] window.examLogic is missing!');
            }
        } else {
            console.error('[CCNA DEBUG] Failed to load questions data from background:', response);
        }
    });
}

// ============================================
// UI ELEMENTS
// ============================================
function createFloatingUI() {
    // 1. Floating Action Button (Database)
    floatingBtn = document.createElement('button');
    floatingBtn.id = 'ccna-float-btn';
    floatingBtn.textContent = 'DB';
    document.body.appendChild(floatingBtn);

    // 2. AI Button (OpenRouter)
    aiBtn = document.createElement('button');
    aiBtn.id = 'ccna-ai-btn';
    aiBtn.textContent = 'AI';
    document.body.appendChild(aiBtn);

    // 3. Result Bubble
    resultBubble = document.createElement('div');
    resultBubble.id = 'ccna-result-bubble';
    document.body.appendChild(resultBubble);

    // Event Listeners
    floatingBtn.addEventListener('mousedown', (e) => {
        console.log('[CCNA DEBUG] DB button MOUSE DOWN detected');
        e.preventDefault();
        handleGetAnswer();
    });

    aiBtn.addEventListener('mousedown', (e) => {
        console.log('[CCNA DEBUG] AI button MOUSE DOWN detected');
        e.preventDefault();
        handleAIAnswer();
    });

    // Close bubble on click outside
    document.addEventListener('mousedown', (e) => {
        if (resultBubble.style.display === 'block') {
            if (!resultBubble.contains(e.target) && e.target !== floatingBtn && e.target !== aiBtn) {
                hideResult();
            }
        }
    });

    // Image click detection - show DB button when image is clicked
    setupImageClickListener();
}

// ============================================
// SELECTION HANDLING
// ============================================
function setupSelectionListener() {
    document.addEventListener('mouseup', (e) => {
        // If result bubble is open, don't trigger new selection UI immediately
        if (resultBubble && resultBubble.style.display === 'block') return;

        // Delay slightly to let selection finalize
        setTimeout(() => {
            const selection = window.getSelection().toString().trim();

            // Ignore if clicking the button itself
            if (e.target.id === 'ccna-float-btn') return;

            if (selection.length > 5) {
                hideResult(); // Hide previous result
                currentSelection = selection;
                selectedImage = null; // Clear image selection
                showFloatingButton(e.pageX, e.pageY);
                console.log('[CCNA] Selected text:', selection.substring(0, 30) + '...');
            } else {
                hideFloatingButton();
            }
        }, 10);
    });
}

function setupImageClickListener() {
    // Add hover effect to all images
    const addImageHighlight = () => {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Skip tiny images and already-processed ones
            if (img.width < 50 || img.height < 50) return;
            if (img.dataset.ccnaProcessed) return;

            img.dataset.ccnaProcessed = 'true';
            img.style.cursor = 'pointer';

            // Add hover effect (only if not selected)
            img.addEventListener('mouseenter', () => {
                if (!img.dataset.ccnaSelected) {
                    img.style.outline = '3px solid #2563eb';
                    img.style.outlineOffset = '2px';
                }
            });
            img.addEventListener('mouseleave', () => {
                if (!img.dataset.ccnaSelected) {
                    img.style.outline = 'none';
                }
            });
        });
    };

    // Run initially and on DOM changes
    addImageHighlight();
    const observer = new MutationObserver(() => addImageHighlight());
    observer.observe(document.body, { childList: true, subtree: true });

    // Listen for clicks on images
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            const img = e.target;
            const src = img.src || img.getAttribute('src') || '';

            // Skip tiny images (likely icons)
            if (img.width < 50 || img.height < 50) return;

            console.log('[CCNA] Image clicked:', src);

            e.preventDefault();
            e.stopPropagation();

            // Clear previous selection
            hideResult(); // Hide previous result bubble
            document.querySelectorAll('img[data-ccna-selected]').forEach(prevImg => {
                prevImg.removeAttribute('data-ccna-selected');
                prevImg.style.outline = 'none';
            });

            // Mark this image as selected with green border
            img.dataset.ccnaSelected = 'true';
            img.style.outline = '4px solid #10b981';
            img.style.outlineOffset = '2px';

            // Extract filename from source
            const filename = src.split('/').pop().split('?')[0];

            selectedImage = filename;
            currentSelection = ''; // Clear text selection

            // Show button near the image
            const rect = img.getBoundingClientRect();
            showFloatingButton(rect.right + window.scrollX, rect.top + window.scrollY);

            console.log('[CCNA] Image selected:', filename);
        }
    }, true); // Use capture phase
}

function findQuestionsByImage(imageName) {
    if (!questionsData || !questionsData.questions) return [];

    const results = [];
    const searchName = imageName.toLowerCase();

    for (const question of questionsData.questions) {
        if (question.images && Array.isArray(question.images)) {
            for (const imgPath of question.images) {
                // Check if the image filename matches
                const qImgName = imgPath.split('/').pop().toLowerCase();
                if (qImgName.includes(searchName) || searchName.includes(qImgName)) {
                    results.push(question);
                    break;
                }
            }
        }
    }

    console.log('[CCNA] Found', results.length, 'questions with image:', imageName);
    return results.slice(0, 3); // Return max 3 questions
}

function showImageSearchResults(questions) {
    if (!resultBubble) return;

    let html = `
        <div class="header">
            <span class="badge-high">Found ${questions.length} Question(s)</span>
            <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">×</button>
        </div>
    `;

    for (const q of questions) {
        const answersHtml = (q.answer || []).map(a =>
            `<div class="answer-item">✓ ${escapeHtml(a)}</div>`
        ).join('');

        html += `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
                <div class="question-preview">${escapeHtml(q.text || '')}</div>
                <div class="answers-list">${answersHtml}</div>
            </div>
        `;
    }

    resultBubble.innerHTML = html;
    resultBubble.style.display = 'block';
}

function showFloatingButton(x, y) {
    if (!floatingBtn || !aiBtn) return;
    if (resultBubble && resultBubble.style.display === 'block') return;

    const btnHeight = 35;
    const btnWidth = 60;
    const gap = 5;

    let top = y - btnHeight - 10;
    let left = x - btnWidth - (gap / 2);

    // Bound checks
    if (top < 0) top = y + 10;
    if (left < 0) left = 10;

    // DB Button
    floatingBtn.style.top = top + 'px';
    floatingBtn.style.left = left + 'px';
    floatingBtn.style.display = 'inline-block';

    // AI Button (next to DB button)
    aiBtn.style.top = top + 'px';
    aiBtn.style.left = (left + btnWidth + gap) + 'px';
    aiBtn.style.display = 'inline-block';

    // Pop animation
    floatingBtn.classList.remove('pop-in');
    aiBtn.classList.remove('pop-in');
    void floatingBtn.offsetWidth;
    floatingBtn.classList.add('pop-in');
    aiBtn.classList.add('pop-in');
}

function hideFloatingButton() {
    if (floatingBtn) floatingBtn.style.display = 'none';
    if (aiBtn) aiBtn.style.display = 'none';
}

// ============================================
// LOGIC
// ============================================
function handleGetAnswer() {
    console.log('[CCNA DEBUG] handleGetAnswer called.');
    console.log('[CCNA DEBUG] currentSelection:', currentSelection);
    console.log('[CCNA DEBUG] selectedImage:', selectedImage);
    hideFloatingButton();
    showResultLoading();

    if (!questionsData) {
        console.warn('[CCNA DEBUG] questionsData is NULL. Attempting reload...');
        loadQuestionsData();
        setTimeout(handleGetAnswer, 500);
        return;
    }

    // If we have a selected image, search by image
    if (selectedImage) {
        console.log('[CCNA DEBUG] Searching by image:', selectedImage);
        const imageResults = findQuestionsByImage(selectedImage);
        if (imageResults.length > 0) {
            showImageSearchResults(imageResults);
        } else {
            showResultError('No questions found with this image');
        }
        return;
    }

    // Otherwise, search by text selection
    if (!currentSelection) {
        showResultError('No text or image selected');
        return;
    }

    if (!window.examLogic) {
        console.error('[CCNA DEBUG] window.examLogic is undefined');
        showResultError('Logic module not loaded');
        return;
    }

    const activeModule = window.examLogic.getActiveModule();
    if (!activeModule) {
        window.examLogic.detectAndLoad();
    }

    console.log('[CCNA DEBUG] Calling examLogic.getAnswer...');
    const result = window.examLogic.getAnswer(currentSelection);
    console.log('[CCNA DEBUG] examLogic.getAnswer returned:', result);

    if (result.error) {
        showResultError(result.error);
    } else {
        showResultSuccess(result);
    }
}

// ============================================
// AI ANSWER (OpenRouter)
// ============================================
async function handleAIAnswer() {
    console.log('[CCNA AI DEBUG] handleAIAnswer called');
    console.log('[CCNA AI DEBUG] currentSelection:', currentSelection);
    console.log('[CCNA AI DEBUG] API Key exists:', !!OPENROUTER_API_KEY);
    console.log('[CCNA AI DEBUG] API Key length:', OPENROUTER_API_KEY ? OPENROUTER_API_KEY.length : 0);

    hideFloatingButton();
    showResultLoading('Asking AI...');

    if (!OPENROUTER_API_KEY) {
        console.error('[CCNA AI DEBUG] No API key!');
        showResultError('No OpenRouter API Key configured.');
        return;
    }

    console.log('[CCNA AI DEBUG] Sending message to background...');

    // Send to background script (bypasses page CSP)
    chrome.runtime.sendMessage(
        {
            type: 'AI_QUERY',
            text: currentSelection,
            apiKey: OPENROUTER_API_KEY,
            model: OPENROUTER_MODEL
        },
        (response) => {
            console.log('[CCNA AI DEBUG] Got response from background:', response);

            if (chrome.runtime.lastError) {
                console.error('[CCNA AI DEBUG] Runtime error:', chrome.runtime.lastError);
                showResultError('Extension error: ' + chrome.runtime.lastError.message);
                return;
            }

            if (!response) {
                console.error('[CCNA AI DEBUG] Response is null/undefined');
                showResultError('No response from background script');
                return;
            }

            if (response.error) {
                console.error('[CCNA AI DEBUG] Error in response:', response.error);
                showResultError('AI Error: ' + response.error);
            } else if (response.answer) {
                console.log('[CCNA AI DEBUG] Success! Answer:', response.answer.substring(0, 100) + '...');
                showAIResult(response.answer);
            } else {
                console.error('[CCNA AI DEBUG] Unexpected response format:', response);
                showResultError('Unexpected response format');
            }
        }
    );
}

function showAIResult(answer) {
    if (!resultBubble) return;
    const cleanedAnswer = cleanAIResponse(answer);
    resultBubble.innerHTML = `
        <div class="header">
            <span class="ai-badge">AI Answer</span>
            <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">×</button>
        </div>
        <div class="ai-answer">${escapeHtml(cleanedAnswer)}</div>
    `;
}

function cleanAIResponse(text) {
    if (!text) return '';
    return text
        .replace(/\[OUTST\]/gi, '')
        .replace(/\[\/OUTST\]/gi, '')
        .replace(/\[INST\]/gi, '')
        .replace(/\[\/INST\]/gi, '')
        .replace(/<s>/gi, '')
        .replace(/<\/s>/gi, '')
        .replace(/^\s*[-•]\s*/gm, '• ')  // Clean up bullet points
        .trim();
}

// ============================================
// AUTO-AI (Grab page content automatically)
// ============================================
function handleAutoAI() {
    console.log('[CCNA Auto-AI] Starting...');
    showResultLoading('Analyzing page...');

    const pageContent = extractQuestionContent();

    if (!pageContent || pageContent.length < 20) {
        console.error('[CCNA Auto-AI] Could not extract question content');
        showResultError('Could not find question on page');
        return;
    }

    console.log('[CCNA Auto-AI] Extracted:', pageContent.substring(0, 200) + '...');

    chrome.runtime.sendMessage(
        { type: 'AI_QUERY', text: pageContent, apiKey: OPENROUTER_API_KEY, model: OPENROUTER_MODEL },
        (response) => {
            console.log('[CCNA Auto-AI] Response:', response);
            if (chrome.runtime.lastError) {
                showResultError('Extension error');
                return;
            }
            if (response && response.answer) {
                showAIResult(response.answer);
            } else if (response && response.error) {
                showResultError('AI Error: ' + response.error);
            } else {
                showResultError('No response');
            }
        }
    );
}

function extractQuestionContent() {
    // Try to find question container
    const selectors = ['div.question', '.questionText', '[class*="question"]', '.component__content'];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 30) {
            return el.textContent.replace(/\s+/g, ' ').trim().substring(0, 3000);
        }
    }
    // Fallback: find inputs and walk up
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (const input of inputs) {
        if ((input.id || '').toLowerCase().includes('ot-')) continue;
        let parent = input.parentElement;
        for (let i = 0; i < 8; i++) {
            if (!parent) break;
            const text = parent.textContent.trim();
            if (text.length > 100 && text.length < 5000) {
                return text.replace(/\s+/g, ' ').trim().substring(0, 3000);
            }
            parent = parent.parentElement;
        }
    }
    return null;
}

// ============================================
// RESULT DISPLAY
// ============================================
function showResultLoading(msg = 'Searching...') {
    if (!resultBubble) return;

    // Position in top-right corner of viewport
    resultBubble.style.position = 'fixed';
    resultBubble.style.top = '20px';
    resultBubble.style.right = '20px';
    resultBubble.style.left = 'auto';

    resultBubble.innerHTML = `<div class="spinner"></div> ${escapeHtml(msg)}`;
    resultBubble.className = '';
    resultBubble.style.display = 'block';
}

function showResultError(msg) {
    if (!resultBubble) return;
    resultBubble.innerHTML = `<div class="error">❌ ${msg}</div>`;
}

function showResultSuccess(data) {
    if (!resultBubble) return;

    const scorePct = Math.round(data.score * 100);
    const answersHtml = data.answers.map(a =>
        `<div class="answer-item">✓ ${escapeHtml(a)}</div>`
    ).join('');

    // Add explanation if available
    const explanationHtml = data.explanation ?
        `<div class="explanation">💡 ${escapeHtml(data.explanation)}</div>` : '';

    resultBubble.innerHTML = `
        <div class="header">
            <span class="score badge-${getScoreClass(data.score)}">${scorePct}% Match</span>
            <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">×</button>
        </div>
        <div class="question-preview">${escapeHtml(data.question)}</div>
        <div class="answers-list">${answersHtml}</div>
        ${explanationHtml}
    `;
}

function hideResult() {
    if (resultBubble) resultBubble.style.display = 'none';
}

function getScoreClass(score) {
    if (score >= 0.9) return 'high';
    if (score >= 0.7) return 'med';
    return 'low';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// STYLES
// ============================================
function injectStyles() {
    const css = `
    /* Floating Button */
    #ccna-float-btn {
        position: absolute; /* absolute to document, works inside iframe */
        display: none;
        z-index: 2147483647;
        background: #ffffff;
        color: #333333;
        border: 1px solid #e5e7eb;
        padding: 6px 14px;
        border-radius: 6px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        animation: ccna-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #ccna-float-btn:hover { background: #f9fafb; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transform: translateY(-1px); }
    #ccna-float-btn:active { transform: translateY(0); }

    /* AI Button */
    #ccna-ai-btn {
        position: absolute;
        display: none;
        z-index: 2147483647;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
        transition: all 0.2s ease;
        animation: ccna-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #ccna-ai-btn:hover { box-shadow: 0 4px 15px rgba(102, 126, 234, 0.5); transform: translateY(-1px); }
    #ccna-ai-btn:active { transform: translateY(0); }

    /* Result Bubble */
    #ccna-result-bubble {
        position: fixed;
        display: none;
        z-index: 2147483647;
        background: white;
        width: 350px;
        max-height: 400px;
        overflow-y: auto;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1);
        font-family: system-ui, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        color: #1f2937;
        border: 1px solid #e5e7eb;
        top: 20px;
        right: 20px;
    }

    /* Bubble Content */
    #ccna-result-bubble .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }
    
    #ccna-result-bubble .close-btn {
        background: none; border: none; font-size: 18px; color: #9ca3af; cursor: pointer; padding: 0;
    }
    #ccna-result-bubble .close-btn:hover { color: #4b5563; }

    #ccna-result-bubble .badge-high { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }
    #ccna-result-bubble .badge-med { background: #fef9c3; color: #854d0e; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }
    #ccna-result-bubble .badge-low { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }

    #ccna-result-bubble .question-preview {
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 12px;
        max-height: 60px;
        overflow-y: auto;
        border-bottom: 1px solid #f3f4f6;
        padding-bottom: 8px;
    }

    #ccna-result-bubble .answer-item {
        background: #eff6ff;
        color: #1e40af;
        padding: 8px;
        border-radius: 6px;
        margin-bottom: 6px;
        border-left: 3px solid #3b82f6;
        font-weight: 500;
    }

    #ccna-result-bubble .explanation {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
        font-size: 11px; /* Smaller font for explanation inside bubble */
        color: #4b5563;
        font-style: italic;
    }

    #ccna-result-bubble .error { color: #dc2626; font-weight: 600; }

    #ccna-result-bubble .ai-badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 3px 10px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 11px;
    }

    #ccna-result-bubble .ai-answer {
        white-space: pre-wrap;
        font-size: 13px;
        line-height: 1.6;
        color: #374151;
    }
    
    .spinner {
        width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: #2563eb; 
        border-radius: 50%; display: inline-block; animation: ccna-spin 1s linear infinite; margin-right: 8px; vertical-align: middle;
    }

    @keyframes ccna-pop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes ccna-spin { to { transform: rotate(360deg); } }
    
    /* Selection Override */
    .component__content, .question, .questionText, iframe {
        user-select: text !important;
        -webkit-user-select: text !important;
    }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

// Start
init();

