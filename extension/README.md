# CCNA Answer Lookup Chrome Extension

A Chrome extension that allows you to select question text on any CCNA exam page and instantly look up the correct answer from a locally stored dataset.

## Features

- **Text Selection Lookup**: Select any question text on a web page
- **Fuzzy Matching**: Finds matches even with minor text differences
- **Offline Support**: All data stored locally, no internet required
- **Image Support**: Displays associated question images
- **Dark Theme UI**: Modern, easy-to-read popup interface

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The extension icon should appear in your toolbar

## Usage

1. Navigate to any CCNA exam/quiz page
2. Select (highlight) a question text with your mouse
3. Click the extension icon in the toolbar
4. View the correct answer and explanations

## Updating the Dataset

After running a new crawl:

```bash
# 1. Run the crawler to download new exams
python3 crawl_ccna.py

# 2. Convert HTML to JSON
python3 convert_to_json.py

# 3. Reload the extension in Chrome
#    Go to chrome://extensions and click the refresh icon
```

## File Structure

```
extension/
├── manifest.json      # Extension configuration
├── background.js      # Query handler + fuzzy matching
├── content.js         # Text selection capture
├── popup.html         # Result display UI
├── popup.js           # Popup logic
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── data/
│   └── questions.json # Consolidated question database
└── images/            # Local copies of question images
    └── {slug}/
        └── *.jpg
```

## Dataset Info

- **Total Questions**: 289
- **Modules Covered**: 8 exam modules
- **Source**: CCNA 1 v7.02 (French)

## Troubleshooting

- **No match found**: Try selecting more text (the full question)
- **Extension not working**: Check `chrome://extensions` for errors
- **Images not loading**: Ensure images were copied to `extension/images/`
