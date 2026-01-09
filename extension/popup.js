/**
 * Popup script - displays lookup results
 * Fixed version with better error handling
 */

console.log('[CCNA] Popup opened');

async function loadResults() {
    const resultsDiv = document.getElementById('results');
    const noResultDiv = document.getElementById('no-result');
    const searchTextDiv = document.getElementById('search-text');

    try {
        // Get stored result
        const storage = await chrome.storage.local.get('lastResult');
        const result = storage.lastResult;

        console.log('[CCNA] Loaded result:', result ? result.matches?.length + ' matches' : 'none');

        if (!result || !result.matches || result.matches.length === 0) {
            noResultDiv.style.display = 'block';
            resultsDiv.innerHTML = '';
            if (result?.searchText) {
                searchTextDiv.innerHTML = `<strong>Searched:</strong> "${result.searchText.substring(0, 80)}..."`;
            } else {
                searchTextDiv.textContent = 'Select text on a CCNA exam page, then open this popup.';
            }
            return;
        }

        noResultDiv.style.display = 'none';
        searchTextDiv.innerHTML = `<strong>Searched:</strong> "${result.searchText.substring(0, 80)}..."`;

        // Render matches
        let html = '';
        for (let i = 0; i < result.matches.length; i++) {
            const match = result.matches[i];
            const q = match.question;
            const scorePercent = Math.round(match.score * 100);
            const isTop = i === 0;

            // Answers
            let answersHtml = '';
            if (q.answer && q.answer.length > 0) {
                answersHtml = q.answer.map(a => `<div class="answer-text">✓ ${a}</div>`).join('');
            } else {
                answersHtml = '<div class="answer-text" style="color:#888;">No answer found</div>';
            }

            // All choices
            let choicesHtml = '';
            if (q.choices && q.choices.length > 0) {
                choicesHtml = '<div class="all-choices">';
                for (const c of q.choices) {
                    const isCorrect = q.answer && q.answer.includes(c);
                    choicesHtml += `<div class="choice ${isCorrect ? 'correct' : ''}">${isCorrect ? '✓' : '○'} ${c}</div>`;
                }
                choicesHtml += '</div>';
            }

            // Images
            let imagesHtml = '';
            if (q.images && q.images.length > 0) {
                imagesHtml = '<div class="images-section">';
                for (const img of q.images) {
                    const imgUrl = chrome.runtime.getURL('data/' + img);
                    imagesHtml += `<img src="${imgUrl}" alt="Question image" class="ccna-img">`;
                }
                imagesHtml += '</div>';
            }

            // Explanation
            const explanationHtml = q.explanation
                ? `<div class="explanation">${q.explanation.substring(0, 300)}${q.explanation.length > 300 ? '...' : ''}</div>`
                : '';

            html += `
        <div class="match-card ${isTop ? 'top-match' : ''}">
          <span class="match-score ${scorePercent >= 80 ? '' : 'low'}">${scorePercent}% match</span>
          <div class="question-text">${q.text}</div>
          <div class="answer-section">
            <div class="answer-label">✓ CORRECT ANSWER</div>
            ${answersHtml}
          </div>
          ${choicesHtml}
          ${imagesHtml}
          ${explanationHtml}
        </div>
      `;
        }

        resultsDiv.innerHTML = html;

    } catch (error) {
        console.error('[CCNA] Error loading results:', error);
        noResultDiv.style.display = 'block';
        noResultDiv.innerHTML = '<p>Error loading results. Check console.</p>';
        resultsDiv.innerHTML = '';
    }
}

// Load on popup open
document.addEventListener('DOMContentLoaded', loadResults);
