/**
 * AIService - Chrome Built-in AI APIs Wrapper
 *
 * Provides a clean interface for:
 * - Summarizer API: Condensing message pairs into short TLDRs and chats into headlines (12-22 words)
 * - Prompt API (LanguageModel): Generating 5-10 thematic labels from all chat headlines in a single step
 *
 * Single-step label generation approach (optimized for accuracy):
 * 1. Message pairs → short TLDR summaries
 * 2. Chat → short headline (12-22 words)
 * 3. All headlines → 5-10 labels (one Prompt API call)
 *
 * Uses the updated API names (January 2025):
 * - `LanguageModel` instead of `self.ai.languageModel`
 * - `Summarizer` instead of `self.ai.summarizer`
 */

const AIService = {
  /**
   * Check if Summarizer API is available and ready
   * Uses the new Summarizer global API (updated Jan 2025)
   * @returns {Promise<Object>} Status object with availability info
   */
  async checkSummarizerAvailability() {
    try {

      // Check if Summarizer API exists (new global API)
      if (typeof Summarizer === 'undefined') {
        console.warn('[AI Service] Summarizer API not available');
        return {
          available: false,
          reason: 'Summarizer API not found - Browser may not support it'
        };
      }

      // Check availability using new API
      const availability = await Summarizer.availability();

      // Handle different availability states
      if (availability === 'no' || availability === 'unavailable') {
        return {
          available: false,
          reason: 'Summarizer not available on this device'
        };
      }

      if (availability === 'downloadable') {
        return {
          available: true,
          needsDownload: true,
          reason: 'Model download required - will download on first use'
        };
      }

      if (availability === 'downloading') {
        return {
          available: true,
          downloading: true,
          reason: 'Model is currently downloading'
        };
      }

      if (availability === 'available') {
        return {
          available: true,
          reason: 'Summarizer ready'
        };
      }

      return {
        available: false,
        reason: 'Unknown availability status: ' + availability
      };

    } catch (error) {
      console.error('[AI Service] Error checking Summarizer availability:', error);
      return {
        available: false,
        reason: 'Error: ' + error.message
      };
    }
  },

  /**
   * Check if Prompt API (LanguageModel) is available and ready
   * Uses the new LanguageModel global API (updated Jan 2025)
   * @returns {Promise<Object>} Status object with availability info
   */
  async checkPromptAvailability() {
    try {

      // Check if LanguageModel API exists (new global API)
      if (typeof LanguageModel === 'undefined') {
        console.warn('[AI Service] LanguageModel API not available');
        return {
          available: false,
          reason: 'LanguageModel API not found - Browser may not support it'
        };
      }

      // Check availability using new API
      const availability = await LanguageModel.availability();

      // Handle different availability states
      if (availability === 'no' || availability === 'unavailable') {
        return {
          available: false,
          reason: 'Language model not available on this device'
        };
      }

      if (availability === 'downloadable') {
        return {
          available: true,
          needsDownload: true,
          reason: 'Model download required - will download on first use'
        };
      }

      if (availability === 'downloading') {
        return {
          available: true,
          downloading: true,
          reason: 'Model is currently downloading'
        };
      }

      if (availability === 'available') {
        return {
          available: true,
          reason: 'Prompt API ready'
        };
      }

      return {
        available: false,
        reason: 'Unknown availability status: ' + availability
      };

    } catch (error) {
      console.error('[AI Service] Error checking Prompt API availability:', error);
      return {
        available: false,
        reason: 'Error: ' + error.message
      };
    }
  },

  /**
   * Check overall AI availability (both APIs)
   * @returns {Promise<Object>} Combined availability status
   */
  async checkAvailability() {
    const summarizer = await this.checkSummarizerAvailability();
    const prompt = await this.checkPromptAvailability();

    return {
      promptAPI: prompt.available,
      summarizerAPI: summarizer.available,
      available: prompt.available || summarizer.available,
      details: {
        summarizer,
        prompt
      }
    };
  },

  /**
   * Summarize a message pair (one user question + one assistant response)
   * Creates a TLDR headline for the Q&A exchange
   *
   * @param {string} userMessage - User's question/prompt
   * @param {string} assistantMessage - AI assistant's response
   * @returns {Promise<string>} TLDR headline for this exchange
   */
  async summarizeMessagePair(userMessage, assistantMessage) {
    try {
      console.log('[AI Service] Summarizing message pair...');

      // Check availability
      const status = await this.checkSummarizerAvailability();

      // If downloading, wait a bit and try again
      if (status.downloading) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Check again
        const newStatus = await this.checkSummarizerAvailability();
        if (!newStatus.available && !newStatus.needsDownload) {
          throw new Error(`Summarizer not ready: ${newStatus.reason}`);
        }
      } else if (!status.available && !status.needsDownload) {
        throw new Error(`Summarizer not available: ${status.reason}`);
      }

      // Truncate individual messages to prevent QuotaExceededError
      // Some chats have extremely long messages (HTML, code dumps, etc.)
      const MAX_MESSAGE_LENGTH = 2000;
      const truncatedUser = userMessage.length > MAX_MESSAGE_LENGTH
        ? userMessage.substring(0, MAX_MESSAGE_LENGTH) + '...'
        : userMessage;
      const truncatedAssistant = assistantMessage.length > MAX_MESSAGE_LENGTH
        ? assistantMessage.substring(0, MAX_MESSAGE_LENGTH) + '...'
        : assistantMessage;

      // Combine messages into a single text
      const combinedText = `User Question: ${truncatedUser}\n\nAssistant Response: ${truncatedAssistant}`;

      // Create summarizer using new global Summarizer API
      const summarizer = await Summarizer.create({
        type: 'tldr',
        format: 'plain-text',
        length: 'short',
        sharedContext: 'This is a conversation between a user and an AI assistant.',
        expectedInputLanguages: ['en'],
        outputLanguage: 'en'
      });


      // Generate summary
      const summary = await summarizer.summarize(combinedText);

      // Clean up
      summarizer.destroy();


      return summary.trim();

    } catch (error) {
      console.error('[AI Service] Error summarizing message pair:', error);
      // Return a fallback summary instead of throwing
      return `Discussion about: ${userMessage.substring(0, 50)}...`;
    }
  },

  /**
   * Summarize an entire chat from its message pair summaries
   * Creates a short headline (12-22 words) for the conversation
   *
   * @param {Array<string>} pairSummaries - Array of message pair summaries
   * @param {string} chatTitle - Original chat title (for context)
   * @returns {Promise<string>} Short headline for the chat (12-22 words)
   */
  async summarizeChat(pairSummaries, chatTitle = '') {
    try {
      console.log('[AI Service] Summarizing entire chat from', pairSummaries.length, 'pair summaries...');

      // Check availability
      const status = await this.checkSummarizerAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (!status.available && !status.needsDownload) {
        throw new Error(`Summarizer not available: ${status.reason}`);
      }

      // If no summaries, return title
      if (!pairSummaries || pairSummaries.length === 0) {
        return chatTitle || 'Empty conversation';
      }

      // Combine all pair summaries
      const combinedSummaries = pairSummaries
        .map((summary, index) => `${index + 1}. ${summary}`)
        .join('\n');

      const textToSummarize = chatTitle
        ? `Chat Title: ${chatTitle}\n\nKey Topics Discussed:\n${combinedSummaries}`
        : `Key Topics Discussed:\n${combinedSummaries}`;

      // Create summarizer using new global Summarizer API
      const summarizer = await Summarizer.create({
        type: 'headline',
        format: 'plain-text',
        length: 'short',
        sharedContext: 'Generate a concise headline for this AI chat conversation.',
        expectedInputLanguages: ['en'],
        outputLanguage: 'en'
      });


      // Generate summary
      const summary = await summarizer.summarize(textToSummarize);

      // Clean up
      summarizer.destroy();


      return summary.trim();

    } catch (error) {
      console.error('[AI Service] Error summarizing chat:', error);
      // Return a fallback
      return chatTitle || pairSummaries[0] || 'Conversation summary unavailable';
    }
  },

  /**
   * Aggregate multiple chat summaries into a coherent label summary
   * Uses Prompt API to intelligently synthesize the main themes
   *
   * @param {Array<string>} chatSummaries - Array of chat summary strings
   * @param {string} labelName - Name of the label (for context)
   * @returns {Promise<string>} Aggregated summary
   */
  async aggregateChatSummaries(chatSummaries, labelName = '') {
    try {

      // Check availability
      const status = await this.checkPromptAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (!status.available && !status.needsDownload) {
        throw new Error(`Prompt API not available: ${status.reason}`);
      }

      // If no summaries, return default
      if (!chatSummaries || chatSummaries.length === 0) {
        return labelName ? `Topics related to ${labelName}` : 'No summaries available';
      }

      // If only one summary, return it directly
      if (chatSummaries.length === 1) {
        return chatSummaries[0];
      }

      // Truncate very long summaries to prevent quota issues
      const MAX_SUMMARY_LENGTH = 300;
      const truncatedSummaries = chatSummaries.map(summary =>
        summary.length > MAX_SUMMARY_LENGTH
          ? summary.substring(0, MAX_SUMMARY_LENGTH) + '...'
          : summary
      );

      // Combine summaries with numbering
      const combinedSummaries = truncatedSummaries
        .map((summary, index) => `${index + 1}. ${summary}`)
        .join('\n');

      const prompt = `You are analyzing ${chatSummaries.length} AI conversations grouped under the label "${labelName}".

Here are the individual conversation summaries:

${combinedSummaries}

Create a cohesive 2-3 sentence summary (150-200 words max) that captures the main themes and topics covered across ALL these conversations. Focus on what the conversations have in common and the key areas discussed.

Return ONLY the summary text, no extra formatting or labels.`;


      // Create language model session
      const session = await LanguageModel.create({
        temperature: 0.7,
        topK: 40
      });

      // Generate aggregated summary
      const aggregatedSummary = await session.prompt(prompt);
      session.destroy();


      return aggregatedSummary.trim();

    } catch (error) {
      console.error('[AI Service] Error aggregating chat summaries:', error);
      // Return a simple concatenated fallback
      const combined = chatSummaries.join(' ').substring(0, 500);
      return `This label contains ${chatSummaries.length} conversations covering: ${combined}${chatSummaries.join(' ').length > 500 ? '...' : ''}`;
    }
  },

  /**
   * Generate a structured mind map from chat conversations
   * Creates a hierarchical summary with links to original chats
   *
   * @param {Array<Object>} chatsWithContext - Array of chat objects with {id, title, url, platform, chatSummary, messagePairSummaries}
   * @param {string} labelName - Name of the label (for context)
   * @returns {Promise<string>} HTML string representing the hierarchical mind map with chat links
   */
  async generateBulletPoints(chatsWithContext, labelName = '') {
    try {
      console.log(`[AI Service] Generating mind map from ${chatsWithContext.length} chats for label: ${labelName}`);

      // Check availability
      const status = await this.checkPromptAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (!status.available && !status.needsDownload) {
        throw new Error(`Prompt API not available: ${status.reason}`);
      }

      // If no chats, return default
      if (!chatsWithContext || chatsWithContext.length === 0) {
        return '<p class="bulletpoints-placeholder">No chats available.</p>';
      }

      const chatCount = chatsWithContext.length;

      // Truncate chat summaries to prevent quota issues
      const MAX_SUMMARY_LENGTH = 300;
      const chatList = chatsWithContext.map((chat, index) => {
        const truncatedSummary = chat.chatSummary.length > MAX_SUMMARY_LENGTH
          ? chat.chatSummary.substring(0, MAX_SUMMARY_LENGTH) + '...'
          : chat.chatSummary;

        return `${index + 1}. [${chat.platform}] "${chat.title}"
   Summary: ${truncatedSummary}`;
      }).join('\n\n');

      const prompt = `
You are analyzing ${chatCount} conversations about "${labelName}".

Here are the conversations with their summaries:

${chatList}

Goal:
Generate a structured mind map that captures how ideas in these conversations relate, build on, or contrast with each other.
The structure should adapt naturally — some topics may have many layers, others may stay flat.

Guidelines:
1. Identify the **main conceptual clusters** (2–6 broad themes).
2. For each cluster, build **subtopics** when you detect depth (e.g. when one idea explains, depends on, or exemplifies another).
3. If some ideas overlap between clusters, include a "relatedTo" field to mark those connections.
4. Keep descriptions concrete and domain-specific — use terminology, examples, or phrasing that actually appeared in the chats.
5. Avoid artificial hierarchy: only nest when one concept meaningfully expands or specifies another.
6. Adjust the level of detail to match the density and variety of the library (e.g. more detail for diverse or complex sets, simpler for tightly focused ones).

Return ONLY a JSON object in this format:

{
  "mindmap": [
    {
      "topic": "Main Topic Name",
      "summary": "1–2 sentence overview of this theme",
      "subtopics": [
        {
          "name": "Subtopic Name",
          "summary": "Brief explanation or question",
          "examples": [
            {
              "chatIndex": 3,
              "title": "Specific discussion from chat",
              "detail": "Concrete example or insight from that chat"
            }
          ],
          "relatedTo": ["Other Subtopic Names (optional)"]
        }
      ]
    }
  ]
}

Requirements:
- Allow variable depth (1–4 levels) depending on complexity.
- Merge redundant or near-duplicate conversations.
- Use actual chat language whenever possible.
- Return valid JSON only, no markdown or commentary.
`;


      // Create language model session
      const session = await LanguageModel.create({
        temperature: 0.7,
        topK: 40
      });

      // Generate categorization
      const response = await session.prompt(prompt);
      session.destroy();


      // Parse JSON response
      let mindmapData;
      try {
        let cleanedResponse = response.trim();

        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        // Extract JSON object
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        mindmapData = JSON.parse(cleanedResponse);

        if (!mindmapData.mindmap || !Array.isArray(mindmapData.mindmap)) {
          throw new Error('Invalid response structure: missing mindmap array');
        }


      } catch (parseError) {
        console.error('[AI Service] Error parsing JSON response:', parseError);
        console.error('[AI Service] Response was:', response);
        throw new Error('Failed to parse AI response: ' + parseError.message);
      }

      // Convert JSON to HTML with chat links
      const bulletPointsHTML = this._convertMindmapToHTML(mindmapData.mindmap, chatsWithContext);


      return bulletPointsHTML;

    } catch (error) {
      console.error('[AI Service] Error generating mind map:', error);
      // Return a simple fallback
      return `<p class="bulletpoints-placeholder" style="color: #ef4444;">Error generating mind map: ${error.message}</p>`;
    }
  },

  /**
   * Convert mindmap JSON to HTML with chat links
   * @param {Array} mindmap - Array of mindmap topic objects
   * @param {Array} chatsWithContext - Original chat objects for lookup
   * @returns {string} HTML string
   * @private
   */
  _convertMindmapToHTML(mindmap, chatsWithContext) {
    if (!mindmap || !Array.isArray(mindmap) || mindmap.length === 0) {
      return '<p class="bulletpoints-placeholder">No mind map generated.</p>';
    }

    const escapeText = text => this._escapeHtml(typeof text === 'string' ? text : String(text ?? ''));

    const renderExamples = examples => {
      if (!Array.isArray(examples) || examples.length === 0) {
        return '';
      }

      let html = '\n          <ul class="mindmap-examples">';

      examples.forEach(example => {
        const parsedIndex = typeof example.chatIndex === 'number'
          ? example.chatIndex
          : parseInt(example.chatIndex, 10);
        const chatIndex = Number.isInteger(parsedIndex) ? parsedIndex : null;
        const chat = chatIndex && chatIndex > 0 && chatIndex <= chatsWithContext.length
          ? chatsWithContext[chatIndex - 1]
          : null;

        const exampleTitle = typeof example.title === 'string' ? example.title.trim() : '';
        const detailText = typeof example.detail === 'string' ? example.detail.trim() : '';

        let usedExampleAsPrimary = false;

        html += '\n            <li class="chat-bullet">';

        if (chat && chat.url) {
          html += `\n              <a href="${this._escapeHtml(chat.url)}" class="chat-link" data-chat-id="${this._escapeHtml(chat.id || '')}">`;
          html += `\n                <span class="chat-platform ${chat.platform}">${this._getPlatformName(chat.platform)}</span>`;
          html += `\n                <span class="chat-title">${this._escapeHtml(chat.title)}</span>`;
          html += '\n              </a>';
        } else if (exampleTitle) {
          html += `\n              <span class="chat-title">${escapeText(exampleTitle)}</span>`;
          usedExampleAsPrimary = true;
        } else if (chatIndex) {
          html += `\n              <span class="chat-title">${escapeText(`Chat ${chatIndex}`)}</span>`;
        } else {
          html += '\n              <span class="chat-title">Conversation</span>';
        }

        if (exampleTitle && !usedExampleAsPrimary && (!chat || exampleTitle !== chat.title)) {
          html += `\n              <div class="example-title">${escapeText(exampleTitle)}</div>`;
        }

        if (detailText) {
          html += `\n              <div class="example-detail">${escapeText(detailText)}</div>`;
        }

        html += '\n            </li>';
      });

      html += '\n          </ul>';

      return html;
    };

    const renderSubtopics = (subtopics, level = 1) => {
      if (!Array.isArray(subtopics) || subtopics.length === 0) {
        return '';
      }

      let html = `\n      <ul class="mindmap-level level-${level}">`;

      subtopics.forEach(subtopic => {
        const name = escapeText(subtopic.name || subtopic.topic || 'Untitled Subtopic');
        const summary = typeof subtopic.summary === 'string' ? subtopic.summary.trim() : '';
        const relatedTo = Array.isArray(subtopic.relatedTo) ? subtopic.relatedTo : [];

        html += '\n        <li class="mindmap-node">';
        html += '\n          <div class="mindmap-node-header">';
        html += `\n            <span class="mindmap-node-title">${name}</span>`;

        if (summary) {
          html += `\n            <p class="mindmap-summary">${escapeText(summary)}</p>`;
        }

        html += '\n          </div>';

        if (relatedTo.length > 0) {
          const relatedList = relatedTo
            .filter(item => item)
            .map(item => escapeText(item))
            .join(', ');

          if (relatedList) {
            html += `\n          <p class="mindmap-related">Related to: ${relatedList}</p>`;
          }
        }

        html += renderExamples(subtopic.examples);
        html += renderSubtopics(subtopic.subtopics, level + 1);
        html += '\n        </li>';
      });

      html += '\n      </ul>';

      return html;
    };

    let html = '<ul class="bulletpoints-list">';

    mindmap.forEach(topic => {
      const topicTitle = escapeText(topic.topic || topic.name || 'Untitled Theme');
      const topicSummary = typeof topic.summary === 'string' ? topic.summary.trim() : '';

      html += '\n  <li class="mindmap-topic">';
      html += '\n    <div class="mindmap-topic-header">';
      html += `\n      <strong>${topicTitle}</strong>`;

      if (topicSummary) {
        html += `\n      <p class="mindmap-summary">${escapeText(topicSummary)}</p>`;
      }

      html += '\n    </div>';
      html += renderSubtopics(topic.subtopics, 1);
      html += '\n  </li>';
    });

    html += '\n</ul>';

    return html;
  },

  /**
   * Get platform display name
   * @param {string} platform - Platform identifier
   * @returns {string} Display name
   * @private
   */
  _getPlatformName(platform) {
    const names = {
      chatgpt: 'ChatGPT',
      claude: 'Claude',
      gemini: 'Gemini'
    };
    return names[platform] || platform;
  },

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Generate label insights from chat summaries.
   * When preferred labels are provided, classifies chats into those labels.
   * Otherwise falls back to general thematic label generation.
   *
   * @param {Array<Object>} chats - Array of chat objects with chatSummary field
   * @param {Array<string>} [preferredLabels=[]] - Optional list of user-selected labels
   * @returns {Promise<Array<Object>>} Array of label objects with conversationIds
   */
  async generateLabelsFromChatSummaries(chats, preferredLabels = []) {
    try {
      console.log('[AI Service] Generating labels from', chats.length, 'chat summaries...');

      // Check availability
      const status = await this.checkPromptAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (!status.available && !status.needsDownload) {
        throw new Error(`Prompt API not available: ${status.reason}`);
      }

      // Filter out chats without summaries
      const chatsWithSummaries = chats.filter(chat => chat.chatSummary && chat.chatSummary.length > 0);

      if (chatsWithSummaries.length === 0) {
        console.warn('[AI Service] No chats with summaries found');
        return [];
      }

      console.log('[AI Service] Analyzing', chatsWithSummaries.length, 'chats with summaries');

      if (Array.isArray(preferredLabels) && preferredLabels.length > 0) {
        console.log('[AI Service] Classifying chats using', preferredLabels.length, 'preferred labels');
        return await this._classifyChatsIntoPreferredLabels(chatsWithSummaries, preferredLabels);
      }

      // Process all chats in one step
      return await this._generateLabelsForAllChats(chatsWithSummaries);

    } catch (error) {
      console.error('[AI Service] Error generating labels:', error);
      throw error;
    }
  },

  /**
   * Prepare chat data for labeling prompts
   * @param {Array<Object>} chats - Chat objects with summaries
   * @returns {{chatData: Array<Object>, stats: Object}} Prepared data and stats
   * @private
   */
  _prepareChatDataForLabeling(chats) {
    const MAX_HEADLINE_LENGTH = 150;
    const MAX_TITLE_LENGTH = 80;

    const chatData = chats.map(chat => {
      const headline = chat.chatSummary || '';
      const truncatedHeadline = headline.length > MAX_HEADLINE_LENGTH
        ? headline.substring(0, MAX_HEADLINE_LENGTH) + '...'
        : headline;

      const title = chat.title || 'Untitled';
      const truncatedTitle = title.length > MAX_TITLE_LENGTH
        ? title.substring(0, MAX_TITLE_LENGTH) + '...'
        : title;

      return {
        id: chat.id,
        title: truncatedTitle,
        headline: truncatedHeadline,
        platform: chat.platform,
        originalTitleLength: title.length,
        originalHeadlineLength: headline.length
      };
    });

    const totalHeadlineLength = chatData.reduce((sum, chat) => sum + chat.headline.length, 0);
    const totalTitleLength = chatData.reduce((sum, chat) => sum + chat.title.length, 0);
    const avgHeadlineLength = chatData.length ? Math.round(totalHeadlineLength / chatData.length) : 0;
    const avgTitleLength = chatData.length ? Math.round(totalTitleLength / chatData.length) : 0;
    const truncatedHeadlines = chatData.filter(chat => chat.originalHeadlineLength > MAX_HEADLINE_LENGTH);
    const truncatedTitles = chatData.filter(chat => chat.originalTitleLength > MAX_TITLE_LENGTH);

    return {
      chatData,
      stats: {
        totalHeadlineLength,
        totalTitleLength,
        avgHeadlineLength,
        avgTitleLength,
        truncatedHeadlines,
        truncatedTitles,
        maxHeadlineLength: MAX_HEADLINE_LENGTH,
        maxTitleLength: MAX_TITLE_LENGTH
      }
    };
  },

  /**
   * Generate 3-7 labels for all chats in a single step
   * Uses short headline-based summaries (12-22 words) for better quota efficiency
   *
   * @param {Array<Object>} chats - Array of all chat objects
   * @returns {Promise<Array<Object>>} Array of 3-7 labels
   * @private
   */
  async _generateLabelsForAllChats(chats) {
    try {
      const { chatData, stats } = this._prepareChatDataForLabeling(chats);


      if (stats.truncatedHeadlines.length > 0) {
      }
      if (stats.truncatedTitles.length > 0) {
      }

      // Create the prompt for single-step label generation
      const prompt = `
Analyze ${chatData.length} AI chat headlines and propose 3–7 distinct thematic labels.
If the chats strongly overlap in topic, suggest fewer high-confidence themes instead of forcing variety.

${chatData.map((chat, i) => `${i + 1}. [${chat.platform}] ${chat.headline}`).join('\n')}

Return a JSON array where each object includes:
- name: concise label (2–5 words)
- description: short explanation (50–80 chars)
- conversationIds: array of chat numbers (e.g., [1,3,7])
- confidence: value between 0 and 1

Format:
[{"name":"Topic Name","description":"Brief summary","conversationIds":[1,2,3],"confidence":0.87}]

Return ONLY the JSON array.`;


      // Warn if prompt is large (but should be much smaller with headlines)
      if (prompt.length > 10000) {
        console.warn(`[AI Service] Large prompt: ${prompt.length} chars for ${chatData.length} chats`);
        console.warn(`[AI Service] Headlines total: ${stats.totalHeadlineLength} chars (avg ${stats.avgHeadlineLength})`);
      }

      // Create language model session
      const session = await LanguageModel.create({
        temperature: 0.7,
        topK: 40
      });

      // Generate response
      const response = await session.prompt(prompt);
      session.destroy();

      // Parse JSON response
      let labels;
      let cleanedResponse = ''; // Define outside try block for error logging
      try {
        cleanedResponse = response.trim();

        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        // Try to extract JSON array if there's extra text
        let jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        } else {
          // If no JSON array found, AI might have returned a formatted list
          // Try to extract labels from numbered/bulleted list
          console.warn('[AI Service] No JSON found, attempting to parse formatted list...');

          // Match patterns like:
          // 1. **Label Name**
          // - **Label Name**
          // • Label Name
          const listPattern = /(?:\d+\.|[-•*])\s*\*?\*?([^*\n]+?)\*?\*?(?:\s|$)/g;
          const matches = [...response.matchAll(listPattern)];

          if (matches.length > 0) {
            // Extract just the label names and create JSON objects
            const extractedLabels = matches.map(match => {
              const name = match[1].trim();
              return {
                name: name,
                description: `Topics related to ${name}`,
                conversationIds: chatData.map(c => c.id),
                confidence: 0.7
              };
            });

            labels = extractedLabels;

            // Skip JSON parsing since we manually created the array
            if (!Array.isArray(labels)) {
              throw new Error('Failed to extract labels from formatted list');
            }
            return labels;
          } else {
            throw new Error('No JSON array or formatted list found in response');
          }
        }

        // Fix common AI generation errors
        // Issue 1: Missing closing brace - AI sometimes forgets the } at end of last item
        // Example: "confidence": 0.9\n] should be "confidence": 0.9}\n]
        cleanedResponse = cleanedResponse.replace(/:\s*([\d.]+)\s*\n\s*\]/g, ': $1}\n]');

        // Issue 2: Wrong bracket - AI uses ] instead of } for last property
        // Example: "confidence": 0.8] should be "confidence": 0.8}
        cleanedResponse = cleanedResponse.replace(/:\s*([\d.]+)\]\s*\n?\s*\]/g, ': $1}\n]');
        cleanedResponse = cleanedResponse.replace(/:\s*([\d.]+)\]\s*,\s*\n/g, ': $1},\n');

        labels = JSON.parse(cleanedResponse);

        // Validate that we got an array
        if (!Array.isArray(labels)) {
          throw new Error('Response is not an array');
        }

        // Map conversationIds from indices (1, 2, 3...) back to actual chat IDs
        // AI sees "1. Chat Title" in prompt, so it returns ["1", "2"] as conversationIds
        // We need to convert these back to real IDs like "chatgpt-abc123..."
        labels = labels.map(label => {
          if (label.conversationIds && Array.isArray(label.conversationIds)) {
            label.conversationIds = label.conversationIds.map(idOrIndex => {
              // AI returns string numbers like "1", "2", etc
              const index = parseInt(idOrIndex, 10);
              if (!isNaN(index) && index >= 1 && index <= chatData.length) {
                // Convert 1-based index to 0-based, then get the real chat ID
                return chatData[index - 1].id;
              }
              // If it's already a real ID (fallback case), keep it
              return idOrIndex;
            });
          }
          return label;
        });


        // Sort labels by number of chats (descending), then alphabetically
        labels.sort((a, b) => {
          const chatCountA = a.conversationIds?.length || 0;
          const chatCountB = b.conversationIds?.length || 0;

          // First, sort by chat count (descending)
          if (chatCountB !== chatCountA) {
            return chatCountB - chatCountA;
          }

          // If chat counts are equal, sort alphabetically by name
          return a.name.localeCompare(b.name);
        });


      } catch (parseError) {
        console.error('[AI Service] Error parsing JSON response:', parseError);
        console.error('[AI Service] Response was:', response);
        console.error('[AI Service] Cleaned response was:', cleanedResponse);
        throw new Error('Failed to parse AI response as JSON: ' + parseError.message);
      }

      return labels;

    } catch (error) {
      console.error('[AI Service] Error generating labels:', error);
      throw error;
    }
  },

  /**
   * Classify chats into user preferred labels
   * @param {Array<Object>} chats - Chats with summaries
   * @param {Array<string>} preferredLabels - Preferred label names
   * @returns {Promise<Array<Object>>} Classified labels
   * @private
   */
  async _classifyChatsIntoPreferredLabels(chats, preferredLabels) {
    try {
      const sanitizedLabels = preferredLabels
        .map(label => (label || '').trim())
        .filter(label => label.length > 0);

      if (sanitizedLabels.length === 0) {
        console.warn('[AI Service] No valid preferred labels provided for classification');
        return [];
      }

      const { chatData, stats } = this._prepareChatDataForLabeling(chats);


      if (stats.truncatedHeadlines.length > 0) {
      }
      if (stats.truncatedTitles.length > 0) {
      }

      if (chatData.length === 0) {
        console.warn('[AI Service] No chats available for preferred label classification');
        return sanitizedLabels.map(label => ({
          name: label,
          description: `No chats matched ${label}`,
          conversationIds: [],
          confidence: 0
        }));
      }

      const preferencesList = sanitizedLabels.map((label, index) => `${index + 1}. ${label}`).join('\n');
      const chatSummariesList = chatData.map((chat, index) =>
        `${index + 1}. [${chat.platform}] ${chat.title} — ${chat.headline}`
      ).join('\n');

      const prompt = `You are grouping AI chat summaries into topics using only the user's preferred labels.

Preferred labels:
${preferencesList}

Chat summaries (${chatData.length}):
${chatSummariesList}

Instructions:
1. For each chat, infer the main intent or domain (e.g., coding help, creative writing, UI design).
2. Compare this intent to each preferred label and assign it ONLY if the match is conceptually strong.
3. Ignore superficial keyword overlaps (e.g., "Chrome" ≠ frontend unless it’s about code/UI).
4. If uncertain, leave the chat unassigned.
5. Return ONLY a JSON array of:
   - "name": label name exactly as provided
   - "description": short theme summary (≤80 characters)
   - "conversationIds": array of matching chat IDs
   - "confidence": number 0–1 for match strength.

Return ONLY the JSON array.`;


      const session = await LanguageModel.create({
        temperature: 0.4,
        topK: 32
      });

      const response = await session.prompt(prompt);
      session.destroy();

      let labels;
      let cleanedResponse = '';

      try {
        cleanedResponse = response.trim();

        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        labels = JSON.parse(cleanedResponse);

        if (!Array.isArray(labels)) {
          throw new Error('Response is not an array');
        }
      } catch (parseError) {
        console.error('[AI Service] Error parsing classification response:', parseError);
        console.error('[AI Service] Raw response:', response);
        console.error('[AI Service] Cleaned response:', cleanedResponse);
        throw new Error('Failed to parse AI classification response: ' + parseError.message);
      }

      const preferredLookup = new Map(sanitizedLabels.map(label => [label.toLowerCase(), label]));
      const responseLookup = new Map();

      labels.forEach(label => {
        if (label && typeof label.name === 'string') {
          responseLookup.set(label.name.trim().toLowerCase(), label);
        }
      });

      const unexpectedLabels = labels.filter(label => {
        const name = (label?.name || '').trim().toLowerCase();
        return name && !preferredLookup.has(name);
      });

      if (unexpectedLabels.length > 0) {
        console.warn('[AI Service] Received unexpected labels not in preferences:', unexpectedLabels.map(l => l.name));
      }

      const finalLabels = sanitizedLabels.map(labelName => {
        const key = labelName.toLowerCase();
        const matched = responseLookup.get(key);

        let conversationIds = Array.isArray(matched?.conversationIds) ? matched.conversationIds : [];
        conversationIds = conversationIds.map(idOrIndex => {
          const index = parseInt(idOrIndex, 10);

          if (!isNaN(index) && index >= 1 && index <= chatData.length) {
            return chatData[index - 1].id;
          }

          const chatMatch = chatData.find(chat => chat.id === idOrIndex);
          return chatMatch ? chatMatch.id : null;
        }).filter(Boolean);

        const uniqueConversationIds = [...new Set(conversationIds)];

        return {
          name: labelName,
          description: matched && matched.description
            ? matched.description.trim()
            : (uniqueConversationIds.length > 0
              ? `Chats related to ${labelName}`
              : `No chats matched ${labelName}`),
          conversationIds: uniqueConversationIds,
          confidence: matched && typeof matched.confidence === 'number'
            ? matched.confidence
            : (uniqueConversationIds.length > 0 ? 0.75 : 0)
        };
      });

      const totalMatches = finalLabels.reduce((sum, label) => sum + label.conversationIds.length, 0);
      console.log(`[AI Service] Preferred label classification produced ${finalLabels.length} labels with ${totalMatches} total matches`);

      return finalLabels;

    } catch (error) {
      console.error('[AI Service] Error classifying chats into preferred labels:', error);
      throw error;
    }
  },

  /**
   * Clean up any active sessions (called when needed)
   */
  destroy() {
    // Sessions are destroyed immediately after use, so nothing to do here
  }
};

// Console debugging helpers - exposed globally
if (typeof window !== 'undefined') {
  window.debugLabels = {
    /**
     * View all suggested labels
     * Usage: debugLabels.viewSuggested()
     */
    viewSuggested: () => {
      chrome.storage.local.get('suggestedLabels', (result) => {
        const labels = result.suggestedLabels || {};
        console.log('=== SUGGESTED LABELS ===');
        console.log(`Total: ${Object.keys(labels).length}`);
        console.log(JSON.stringify(labels, null, 2));
      });
    },

    /**
     * View all accepted labels
     * Usage: debugLabels.viewAccepted()
     */
    viewAccepted: () => {
      chrome.storage.local.get('labels', (result) => {
        const labels = result.labels || {};
        console.log('=== ACCEPTED LABELS ===');
        console.log(`Total: ${Object.keys(labels).length}`);
        console.log(JSON.stringify(labels, null, 2));
      });
    },

    /**
     * View chat statistics
     * Usage: debugLabels.viewChats()
     */
    viewChats: () => {
      chrome.storage.local.get('chats', (result) => {
        const chats = result.chats || {};
        const chatArray = Object.values(chats);
        console.log('=== CHATS ===');
        console.log(`Total: ${chatArray.length}`);

        const processed = chatArray.filter(c => c.processed);
        const withSummaries = chatArray.filter(c => c.chatSummary);

        console.log(`Processed: ${processed.length}`);
        console.log(`With summaries: ${withSummaries.length}`);

        // Show sample chat
        if (chatArray.length > 0) {
          console.log('\n=== SAMPLE CHAT ===');
          const sample = chatArray[0];
          console.log(JSON.stringify({
            id: sample.id,
            title: sample.title,
            platform: sample.platform,
            processed: sample.processed,
            messageCount: sample.messages?.length || 0,
            hasSummary: !!sample.chatSummary,
            summaryLength: sample.chatSummary?.length || 0
          }, null, 2));
        }
      });
    },

    /**
     * View a specific chat by index
     * Usage: debugLabels.viewChat(0)
     */
    viewChat: (index = 0) => {
      chrome.storage.local.get('chats', (result) => {
        const chats = result.chats || {};
        const chatArray = Object.values(chats);

        if (index >= chatArray.length) {
          console.error(`Index ${index} out of range. Total chats: ${chatArray.length}`);
          return;
        }

        console.log(`=== CHAT ${index} ===`);
        console.log(JSON.stringify(chatArray[index], null, 2));
      });
    },

    /**
     * View chats for a specific label (by label index or name)
     * Usage: debugLabels.viewLabelChats(0) or debugLabels.viewLabelChats("Probability")
     */
    viewLabelChats: (labelIdentifier) => {
      chrome.storage.local.get(['labels', 'chats'], (result) => {
        const labels = result.labels || {};
        const chats = result.chats || {};
        const labelArray = Object.values(labels);

        if (labelArray.length === 0) {
          console.log('No accepted labels found. Use debugLabels.viewAccepted() to see all labels.');
          return;
        }

        // Find label by index or name
        let targetLabel;
        if (typeof labelIdentifier === 'number') {
          if (labelIdentifier >= labelArray.length) {
            console.error(`Index ${labelIdentifier} out of range. Total labels: ${labelArray.length}`);
            return;
          }
          targetLabel = labelArray[labelIdentifier];
        } else if (typeof labelIdentifier === 'string') {
          targetLabel = labelArray.find(l => l.name.toLowerCase().includes(labelIdentifier.toLowerCase()));
          if (!targetLabel) {
            console.error(`No label found matching "${labelIdentifier}"`);
            console.log('Available labels:', labelArray.map(l => l.name));
            return;
          }
        } else {
          console.error('Please provide a label index (number) or name (string)');
          return;
        }

        console.log(`\n=== LABEL: ${targetLabel.name} ===`);
        console.log(`Chat IDs: ${targetLabel.chatIds.length} total`);
        console.log(`Category: ${targetLabel.category || 'General'}`);
        console.log(`Created: ${new Date(targetLabel.created).toLocaleString()}`);
        console.log('\n=== CHAT TITLES ===');

        targetLabel.chatIds.forEach((chatId, index) => {
          const chat = chats[chatId];
          if (chat) {
            console.log(`${index + 1}. [${chat.platform}] ${chat.title}`);
            console.log(`   Summary: ${(chat.chatSummary || 'No summary').substring(0, 100)}...`);
            console.log(`   URL: ${chat.url}`);
          } else {
            console.warn(`${index + 1}. Chat ${chatId} not found in storage`);
          }
        });

        console.log(`\n=== SUMMARY ===`);
        console.log(`Label: ${targetLabel.name}`);
        console.log(`Total chats: ${targetLabel.chatIds.length}`);
      });
    },

    /**
     * Clear all data (use with caution!)
     * Usage: debugLabels.clearAll()
     */
    clearAll: () => {
      if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
        chrome.storage.local.clear(() => {
          console.log('All data cleared!');
        });
      }
    },

    /**
     * Show help
     * Usage: debugLabels.help()
     */
    help: () => {
      console.log(`
=== DEBUG LABELS HELPER ===

Available commands:
  debugLabels.viewSuggested()         - View all suggested labels
  debugLabels.viewAccepted()          - View all accepted labels
  debugLabels.viewLabelChats(id)      - View all chats for a specific label
  debugLabels.viewChats()             - View chat statistics
  debugLabels.viewChat(index)         - View specific chat (e.g., debugLabels.viewChat(0))
  debugLabels.clearAll()              - Clear all storage data (use with caution!)
  debugLabels.help()                  - Show this help message

Examples:
  debugLabels.viewSuggested()         // See all AI-generated label suggestions
  debugLabels.viewLabelChats(0)       // View chats in first label (by index)
  debugLabels.viewLabelChats("Prob")  // View chats in "Probability" label (by name)
  debugLabels.viewChat(5)             // See details of the 6th chat
      `);
    }
  };

}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
