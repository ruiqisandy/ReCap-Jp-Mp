# AI-ReCap

**Chrome extension built for the Google Chrome Built-in AI Challenge 2025**

Turn raw conversations from ChatGPT, Claude, and Gemini into a curated knowledge hub. AI-ReCap imports your chat history, stores it locally, and uses Chrome’s on-device Gemini Nano models to suggest thematic labels and power future visual tools such as mind maps and quizzes.

---

## Contents

- [What It Does](#what-it-does)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Setup & Installation](#setup--installation)
- [Using the Extension](#using-the-extension)
- [Data Model](#data-model)
- [Roadmap](#roadmap)
- [Team](#team)
- [License](#license)

---

## What It Does

- **Bulk import AI chats**  
  Parallel tab automation scrapes conversations from ChatGPT, Claude, and Gemini, normalizing them into a single schema.

- **On-device AI labeling**  
  Chrome’s Built-in AI (Gemini Nano) analyzes the imported chats and suggests topic labels with confidence scores.

- **Knowledge hub UI**  
  A three-screen popup guides users through onboarding, import progress, and a library view that lists chats, suggested labels, and confirmed labels.

- **Extensible AI tooling**  
  The AI wrapper already includes stubs for generating mind maps and quizzes so future modules can surface richer knowledge experiences.

---

## Architecture at a Glance

| Layer | Files | Responsibilities |
|-------|-------|------------------|
| **Popup UI** | `popup/popup.html`, `popup/popup.js`, `popup/popup.css`, `styles/global.css` | Renders welcome, import progress, and library screens. Manages user actions, orchestrates imports, and displays AI results. |
| **Background Service Worker** | `background/service-worker.js` | Central message broker. Coordinates storage updates, AI processing, and popup/content-script communication. |
| **Content Scripts** | `content-scripts/*.js` | Platform-specific scrapers that extract conversation metadata and transcripts from ChatGPT, Claude, and Gemini UIs. |
| **Storage Layer** | `lib/storage.js` | Wrapper around `chrome.storage.local` with schemas for chats, labels, suggested labels, and settings. |
| **AI Layer** | `lib/ai-service.js` | Wrapper around Chrome’s Built-in AI Prompt & Summarizer APIs. Provides availability checks, topic extraction, and future mind map/quiz generators. |
| **Manifest & Assets** | `manifest.json`, `icons/*`, `background/`, `popup/` | Chrome extension configuration, permissions, and bundled resources. |

**Message Flow**

1. Popup requests import → orchestrates platform batches via Chrome tabs API.
2. Scrapers return normalized conversations → popup sends `batchSaveChats` to background.
3. Background persists data using `StorageService` and updates extension settings.
4. Popup triggers AI analysis → background calls `AIService.extractTopics` and stores suggested labels.
5. Library screen fetches chats/labels from background to render curated knowledge hub.

---

## Setup & Installation

1. **Clone or download** this repository.
2. **Enable Developer Mode** in Chrome by visiting `chrome://extensions`.
3. Click **“Load unpacked”** and select the project root (`ReCap-Jp-Mp-module2.1.3_fix_chatgpt_gemini_messages`).
4. Pin **AI-ReCap** from the extensions toolbar for quick access.

> The extension relies on Chrome’s built-in AI APIs. On first run, it will check availability and may trigger on-device model downloads.

---

## Using the Extension

1. **Open the popup**  
   The welcome screen checks AI readiness and offers a “Import & Analyze All Chats” button.

2. **Run the import**  
   - The progress screen shows platform-specific counters and a progress bar.
   - Popup opens background tabs (up to six at a time) to scrape each conversation.
   - Chats are saved locally via `StorageService`.

3. **Let AI analyze**  
   After importing, the popup calls `processChatsForLabels`. The background worker runs `AIService.extractTopics`, saves suggested labels, and returns status updates.

4. **Explore your library**  
   - Suggested labels appear with descriptions and confidence, ready to accept or dismiss.
  - Confirmed labels and chats are listed with platform filters, message counts, and dates.
  - Future modules will add mind maps, quizzes, and richer summaries using AIService hooks.

5. **Manage data**  
   The library footer includes “Clear All Data,” which wipes chats, labels, and settings from local storage.

---

## Data Model

All data is stored in `chrome.storage.local` under four namespaces:

| Key | Description |
|-----|-------------|
| `chats` | Dictionary keyed by `chat.id`. Each entry contains platform (`chatgpt`, `claude`, `gemini`), title, timestamp, URL, message array, raw text, label references, and processing status. |
| `labels` | User-approved labels that group related chats. Will later store mind map, summary, and quiz metadata. |
| `suggestedLabels` | AI-generated label suggestions with name, description, confidence, associated chat IDs, and dismissed flag. |
| `settings` | Extension metadata such as `lastSync`, `importStatus`, and `totalChatsImported`. |

---

## Roadmap

- **Mind maps** — Activate `AIService.generateMindMap` when a label is created or viewed.
- **Interactive quizzes** — Use `AIService.generateQuiz` to produce study prompts per label.
- **Settings panel** — Provide controls for AI thresholds, auto-processing, and platform toggles.
- **Export/backup** — Allow exporting chats or label structures for external tools.
- **Testing & telemetry** — Add integration tests/mocks for StorageService & AIService, surface optional analytics for user feedback.

---

## Team

- Sandy Yin  
- Mandy Yin

---

## License

MIT License – see [LICENSE](LICENSE) for details.