/**
 * Netacad Learning Logic Module
 * Handles: netacad.com learning/course pages (newer format)
 */

class NetacadLearningLogic extends BaseExamLogic {
    constructor(questionsData) {
        super(questionsData);
        this.name = 'netacad-learning';
    }

    /**
     * Check if this module can handle the current page
     */
    canHandle() {
        const url = window.location.href;
        // Check for learning platform indicators
        return url.includes('netacad.com') ||
            document.querySelector('.mcq__body') !== null ||
            document.querySelector('.component__body-inner') !== null;
    }

    /**
     * Get the active question element
     */
    getActiveQuestion() {
        // Priority 1: NetAcadExtension logic (Container)
        // div[class="question"]
        const netAcadContainer = document.querySelector('div.question');
        if (netAcadContainer) {
            console.log('[NetacadLearning] Found question container using NetAcadExtension selector (div.question)');
            return netAcadContainer;
        }

        // MCQ body container
        const mcqBody = document.querySelector('.component__body-inner.mcq__body-inner');
        if (mcqBody) return mcqBody;

        // Generic component
        const component = document.querySelector('.component__content');
        if (component) return component;

        // MCQ container
        const mcq = document.querySelector('.mcq__body');
        if (mcq) return mcq;

        // Try to find container based on inputs (most reliable)
        const inputContainer = this.findQuestionContainerFromInputs();
        if (inputContainer) return inputContainer;

        console.log('[NetacadLearning] No active question container found (no inputs/classes detected)');
        return null;
    }

    /**
     * Find question container by looking up from answer inputs
     */
    findQuestionContainerFromInputs() {
        console.log('[NetacadLearning] active looking for inputs...');
        // Find first input of interest, excluding known cookie/settings inputs
        // "ot-" likely stands for OneTrust (cookie consent manager)
        const inputs = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
        let input = null;

        for (const el of inputs) {
            const id = (el.id || '').toLowerCase();
            const name = (el.name || '').toLowerCase();
            const className = (el.className || '').toLowerCase();

            // Skip OneTrust/Cookie related inputs AND Select-All/Header inputs
            if (id.includes('ot-group') || name.includes('ot-group') ||
                className.includes('category-switch') || id.includes('cookie') ||
                name.includes('consent') ||
                id.includes('select-all') || className.includes('header') ||
                id.includes('handler')) {
                continue;
            }

            input = el;
            break;
        }

        if (!input) {
            console.log('[NetacadLearning] No valid answer inputs found (ignored cookie settings)');
            return null;
        }

        console.log('[NetacadLearning] Found input:', input);

        // Walk up to find a container that likely holds the question too
        // Usually 3-5 levels up in modern frameworks
        let parent = input.parentElement;
        for (let i = 0; i < 6; i++) {
            if (!parent) break;

            // Look for a significant text block in this container that isn't the input label
            const textContent = parent.textContent || '';
            const isLabel = parent.tagName === 'LABEL';

            console.log(`[NetacadLearning] Level ${i} parent:`, parent.tagName, 'Length:', textContent.length);

            if (textContent.length > 50 && !isLabel) {
                console.log('[NetacadLearning] Found candidate container:', parent);
                return parent;
            }
            parent = parent.parentElement;
        }
        console.log('[NetacadLearning] No suitable container found from inputs');
        return null;
    }

    /**
     * Detect question type
     */
    getQuestionType(questionEl) {
        if (!questionEl) return 'unknown';

        const checkboxes = questionEl.querySelectorAll('input[type="checkbox"]');
        const radios = questionEl.querySelectorAll('input[type="radio"]');

        if (checkboxes.length > 0) return 'multiple-choice';
        if (radios.length > 0) return 'single-choice';

        return 'mcq';
    }

    /**
     * Extract question text
     */
    extractQuestionText(questionEl) {
        if (!questionEl) return null;

        // Priority 1: NetAcadExtension logic
        // div[class="question"] span[class="questionText"]
        // We look broadly in the document because 'questionEl' might be just a container we found
        const netAcadSelector = document.querySelector('div.question span.questionText');
        if (netAcadSelector) {
            console.log('[NetacadLearning] Found question using NetAcadExtension selector');
            return netAcadSelector.innerText.trim();
        }

        // Priority 2: Standard Paragraph Scanning (Fallback)
        // Fallback: get first significant text block that isn't cookie/legal text
        const paragraphs = questionEl.querySelectorAll('p, div, span');
        const ignoreKeywords = [
            'cookie', 'privacy', 'policy', 'confidentialité',
            'vie privée', 'site web', 'navigation', 'consent',
            'performances', 'indicateurs', 'fonctionnalités'
        ];

        console.log(`[NetacadLearning] Scanning ${paragraphs.length} paragraphs for question text...`);

        for (const p of paragraphs) {
            const text = p.textContent.trim();
            const lowerText = text.toLowerCase();

            // Skip short text and button text
            if (text.length < 5 || text.includes('Get Answer')) continue;

            // Skip cookie banners
            const foundKeyword = ignoreKeywords.find(kw => lowerText.includes(kw));
            if (foundKeyword) {
                console.log('[NetacadLearning] Ignored text (keyword match: ' + foundKeyword + '):', text.substring(0, 50) + '...');
                continue;
            }

            console.log('[NetacadLearning] Found potential question:', text.substring(0, 50) + '...');
            // Return first valid text
            return text;
        }

        return null;
    }



}

// Register module
if (typeof window !== 'undefined') {
    window.NetacadLearningLogic = NetacadLearningLogic;
}
