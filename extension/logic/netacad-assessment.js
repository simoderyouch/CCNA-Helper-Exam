/**
 * Netacad Assessment Logic Module
 * Handles: assessment.netacad.net exam pages
 * Based on: logic/ccna-extension and logic/CCNA_Autofill-main
 */

class NetacadAssessmentLogic extends BaseExamLogic {
    constructor(questionsData) {
        super(questionsData);
        this.name = 'netacad-assessment';
    }

    /**
     * Check if this module can handle the current page
     */
    canHandle() {
        const url = window.location.href;
        return url.includes('assessment.netacad.net') ||
            url.includes('www.assessment.netacad.net') ||
            document.querySelector('.question') !== null;
    }

    /**
     * Get the active (visible) question element
     */
    getActiveQuestion() {
        // Hidden questions have the .hidden class
        const activeQuestion = document.querySelector('.question:not(.hidden)');
        if (activeQuestion) return activeQuestion;

        // Fallback: any question element
        const qEl = document.querySelector('.question');
        if (qEl) return qEl;

        // Ultimate fallback: body (let extractors find the text)
        return document.body;
    }

    /**
     * Detect question type
     */
    getQuestionType(questionEl) {
        if (!questionEl) return 'unknown';

        const inputs = questionEl.querySelectorAll('input');
        if (inputs.length === 0) return 'unknown';

        const firstInput = inputs[0];
        if (firstInput.type === 'checkbox') return 'multiple-choice';
        if (firstInput.type === 'radio') return 'single-choice';
        if (firstInput.type === 'text') return 'fill-in';

        return 'mcq';
    }

    /**
     * Extract question text from the question element
     */
    extractQuestionText(questionEl) {
        if (!questionEl) return null;

        // Primary selector from reference code
        const questionTextDom = questionEl.querySelector('.questionText .mattext');
        if (questionTextDom) {
            return questionTextDom.textContent.trim();
        }

        // Fallback selectors
        const fallbacks = [
            '.questionText',
            '.question-text',
            '.stem',
            'p.question'
        ];

        for (const sel of fallbacks) {
            const el = questionEl.querySelector(sel);
            if (el && el.textContent.trim().length > 10) {
                return el.textContent.trim();
            }
        }

        return null;
    }

    /**
     * Extract answer elements from the question
     */
    extractAnswerElements(questionEl) {
        if (!questionEl) return [];

        // Primary selector from reference code
        const answersDom = questionEl.querySelector('ul.coreContent');
        if (answersDom) {
            return Array.from(answersDom.children);
        }

        // Fallback: any list items with inputs
        const listItems = questionEl.querySelectorAll('li');
        if (listItems.length > 0) {
            return Array.from(listItems).filter(li => li.querySelector('input'));
        }

        return [];
    }

    /**
     * Get text content of an answer element
     */
    getAnswerText(answerEl) {
        // Try to get just the label text, not input values
        const label = answerEl.querySelector('label');
        if (label) return label.textContent.trim();

        const span = answerEl.querySelector('span');
        if (span) return span.textContent.trim();

        // Clone and remove input to get clean text
        const clone = answerEl.cloneNode(true);
        const inputs = clone.querySelectorAll('input');
        inputs.forEach(input => input.remove());

        return clone.textContent.trim();
    }

    /**
     * Get the input element for an answer
     */
    getAnswerInput(answerEl) {
        return answerEl.querySelector('input');
    }

    /**
     * Click the next button
     */
    clickNext() {
        const nextBtn = document.getElementById('next');
        if (nextBtn) {
            nextBtn.click();
            return true;
        }
        return false;
    }

    /**
     * Click submit/finish button
     */
    clickSubmit() {
        const submitBtn = document.getElementById('submit') ||
            document.querySelector('[type="submit"]') ||
            document.querySelector('.submit');
        if (submitBtn) {
            submitBtn.click();
            return true;
        }
        return false;
    }
}

// Register module
if (typeof window !== 'undefined') {
    window.NetacadAssessmentLogic = NetacadAssessmentLogic;
}
