# AI-ReCap

**Chrome extension built for the Google Chrome Built-in AI Challenge 2025**

Turn raw conversations from ChatGPT, Claude, and Gemini into a curated knowledge hub. AI-ReCap imports your chat history, stores it locally, and uses Chrome's on-device Gemini Nano models to create interactive learning tools.

---

## Inspiration

We interact with LLMs daily, but these valuable conversations are often ephemeral and left unvisited. Many chats contain complex information that isn't fully understood in the moment.

We saw an opportunity to change this. We envisioned a personal knowledge hub that imports chats from services like Gemini, ChatGPT, and Claude. The goal is to transform these transient conversations into a structured, reviewable knowledge base, allowing users to revisit, recap, and truly learn from their AI interactions.

## What It Does

**AI-Recap** is a Chrome extension designed to capture and synthesize your AI chat history.

- **Imports Chats:** It seamlessly imports your conversations from Gemini, ChatGPT, and Claude.
- **Summarizes & Labels:** Using Chrome's built-in AI, the extension summarizes entire conversations and automatically labels them thematically (e.g., "Python Programming," "Marketing Strategy").
- **Creates a Knowledge Hub:** It synthesizes this information into interactive learning tools. The primary feature is a **dynamic mind map** that visually organizes the concepts from your chats, helping you understand the connections between topics and relearn key information.

## How We Built It

Our process focused on breaking down chats into digestible pieces of knowledge:

1. **Initial Summarization:** We first use a summarizer API to condense each individual message pair (a user's question and the AI's answer).
2. **Headline Generation:** These "message pair summaries" are then used to generate a concise headline for the entire chat.
3. **Thematic Labeling:** We process these summaries and headlines and feed them to another prompt API to generate relevant labels for each conversation.
4. **Knowledge Hub Curation:** Within a specific label (e.g., "Linear Algebra"), we reuse all the associated message pair summaries and headlines to build a dedicated knowledge page. This page features a generated **mind map** that helps users visualize the relationships between different pieces of information, making it easier to review and understand the topic.

### Tech Stack

- **Languages:** CSS, JavaScript
- **Core Technique:** DOM scraping to import chat data directly from the LLM web interfaces.
- **Storage:** Chrome's local storage is used to store all imported chats, summaries, and labels directly on the user's machine.
- **AI APIs:** Chrome's Built-in AI (Summarizer API and Prompt API) for on-device processing.

### Software Architecture

The extension follows a modular Chrome extension architecture:

| Layer | Components | Responsibilities |
|-------|-----------|------------------|
| **Popup UI** | `popup.html`, `popup.js`, `popup.css` | User interface for import controls, progress tracking, and knowledge hub visualization |
| **Background Service Worker** | `service-worker.js` | Message broker coordinating storage, AI processing, and communication between components |
| **Content Scripts** | Platform-specific scrapers (`chatgpt.js`, `claude.js`, `gemini.js`) | DOM scraping to extract conversations from each AI service |
| **Storage Layer** | `storage.js` | Manages local storage for chats, labels, and settings |
| **AI Layer** | `ai-service.js` | Wrapper around Chrome's Summarizer and Prompt APIs |

**Message Flow:**
1. User triggers import → Popup orchestrates scraping via content scripts
2. Content scripts extract conversations → Background worker saves to local storage
3. Background worker processes chats using AI APIs → Generates summaries and labels
4. Popup displays results in knowledge hub with mind maps

### Using Chrome's Built-in AI APIs

**Summarizer API:**
- Used to condense individual message pairs (user question + AI response) into concise summaries
- Each summary becomes part of the chat's metadata for quick reference
- Summaries are aggregated to generate a headline for the entire conversation

**Prompt API:**
- Processes the summaries and headlines to generate thematic labels (e.g., "Machine Learning," "Creative Writing")
- Powers the mind map generation by analyzing relationships between concepts across conversations
- Provides confidence scores for suggested labels to help users curate their knowledge base
- All processing happens on-device using Gemini Nano, ensuring privacy and speed

## Known Limitations

- **Same Google Account:** Import only works under the same Google account used for the chats.
- **Active Window Needed:** The chat page must remain open and visible during import; switching tabs will pause the process.
- **ChatGPT Cap:** Only ~28 chats load if you are not actively on the page. To import more, you must have the popup open on the ChatGPT tab.
- **Claude Limit:** Only the first 30 conversations can be scraped due to pagination issues.
- **Gemini Testing:** Only a few chat samples were tested; stability is not guaranteed.
- **No File Summaries:** Uploaded files or attachments are not processed.
- **No Incremental Sync:** The current scraper does not track timestamps or edits, so duplicates may appear on re-import.
- **Manual Sync Pending:** A "Re-Sync" button is planned. For now, users must re-import manually to refresh data.

---

## Setup & Installation

1. **Clone or download** this repository.
2. **Enable Developer Mode** in Chrome by visiting `chrome://extensions`.
3. Click **"Load unpacked"** and select the project root.
4. Pin **AI-ReCap** from the extensions toolbar for quick access.

> The extension relies on Chrome's built-in AI APIs. On first run, it will check availability and may trigger on-device model downloads.

---

## License

MIT License – see [LICENSE](LICENSE) for details.
