/**
 * Logic Loader - Automatically detects and loads the appropriate logic module
 * This file orchestrates all exam logic modules
 */

class LogicLoader {
    constructor() {
        this.modules = [];
        this.activeModule = null;
        this.questionsData = null;
    }

    /**
     * Register a logic module class
     * @param {class} ModuleClass - Class extending BaseExamLogic
     */
    registerModule(ModuleClass) {
        this.modules.push(ModuleClass);
        console.log('[LogicLoader] Registered module:', ModuleClass.name);
    }

    /**
     * Set questions data for all modules
     * @param {object} data
     */
    setQuestionsData(data) {
        this.questionsData = data;
        if (this.activeModule) {
            this.activeModule.questionsData = data;
        }
    }

    /**
     * Detect and activate the appropriate logic module for current page
     * @returns {BaseExamLogic|null}
     */
    detectAndLoad() {
        if (!this.questionsData) {
            // It's normal for this to be null during initial page load check
            // console.warn('[LogicLoader] No questions data loaded');
        }

        for (const ModuleClass of this.modules) {
            try {
                const instance = new ModuleClass(this.questionsData);
                if (instance.canHandle()) {
                    this.activeModule = instance;
                    console.log('[LogicLoader] Activated module:', instance.name);
                    return instance;
                }
            } catch (e) {
                console.error('[LogicLoader] Error checking module:', ModuleClass.name, e);
            }
        }

        console.log('[LogicLoader] No suitable module found for this page');
        return null;
    }

    /**
     * Get the currently active module
     * @returns {BaseExamLogic|null}
     */
    getActiveModule() {
        if (!this.activeModule) {
            return this.detectAndLoad();
        }
        return this.activeModule;
    }

    /**
     * Force re-detection of the appropriate module
     * @returns {BaseExamLogic|null}
     */
    reload() {
        this.activeModule = null;
        return this.detectAndLoad();
    }

    // ========== PROXY METHODS ==========
    // These delegate to the active module

    /**
     * Get answer without selecting (manual mode)
     */
    getAnswer(queryText = null) {
        console.log('[LogicLoader DEBUG] getAnswer called with:', queryText);
        const module = this.getActiveModule();
        if (!module) {
            console.error('[LogicLoader DEBUG] No active module found in getAnswer');
            return { error: 'No logic module available for this page' };
        }
        console.log('[LogicLoader DEBUG] Delegating to active module:', module.name);
        return module.getAnswer(queryText);
    }



    /**
     * Get active question element
     */
    getActiveQuestion() {
        const module = this.getActiveModule();
        return module ? module.getActiveQuestion() : null;
    }

    /**
     * Extract question text
     */
    extractQuestionText(questionEl) {
        const module = this.getActiveModule();
        return module ? module.extractQuestionText(questionEl) : null;
    }

    /**
     * Get question type
     */
    getQuestionType(questionEl) {
        const module = this.getActiveModule();
        return module ? module.getQuestionType(questionEl) : 'unknown';
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.LogicLoader = LogicLoader;
    window.examLogic = new LogicLoader();

    // Auto-register available modules after all scripts load
    // Auto-register available modules immediately
    if (window.NetacadAssessmentLogic) {
        window.examLogic.registerModule(window.NetacadAssessmentLogic);
    }
    if (window.NetacadLearningLogic) {
        window.examLogic.registerModule(window.NetacadLearningLogic);
    }
}
