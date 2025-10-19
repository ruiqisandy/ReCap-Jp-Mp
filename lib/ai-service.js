/**
 * AIService - Chrome Built-in AI APIs Wrapper
 *
 * Provides a clean interface for:
 * - Summarizer API: Condensing message pairs and chats into headlines
 * - Prompt API (LanguageModel): Generating labels from chat summaries
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
      console.log('[AI Service] Checking Summarizer API availability...');

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
      console.log('[AI Service] Summarizer availability:', availability);

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
      console.log('[AI Service] Checking Prompt API availability...');

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
      console.log('[AI Service] LanguageModel availability:', availability);

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
        console.log('[AI Service] Model is downloading, waiting 2 seconds...');
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
      console.log('[AI Service] Creating summarizer session...');
      const summarizer = await Summarizer.create({
        type: 'tldr',
        format: 'plain-text',
        length: 'medium',
        sharedContext: 'This is a conversation between a user and an AI assistant.',
        expectedInputLanguages: ['en'],
        outputLanguage: 'en'
      });

      console.log('[AI Service] Summarizer created, generating summary...');

      // Generate summary
      const summary = await summarizer.summarize(combinedText);

      // Clean up
      summarizer.destroy();

      console.log('[AI Service] Message pair summary generated:', summary.substring(0, 100) + '...');

      return summary.trim();

    } catch (error) {
      console.error('[AI Service] Error summarizing message pair:', error);
      // Return a fallback summary instead of throwing
      return `Discussion about: ${userMessage.substring(0, 50)}...`;
    }
  },

  /**
   * Summarize an entire chat from its message pair summaries
   * Creates an overall TLDR of what the conversation was about
   *
   * @param {Array<string>} pairSummaries - Array of message pair summaries
   * @param {string} chatTitle - Original chat title (for context)
   * @returns {Promise<string>} Overall chat summary
   */
  async summarizeChat(pairSummaries, chatTitle = '') {
    try {
      console.log('[AI Service] Summarizing entire chat from', pairSummaries.length, 'pair summaries...');

      // Check availability
      const status = await this.checkSummarizerAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        console.log('[AI Service] Model is downloading, waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (!status.available && !status.needsDownload) {
        throw new Error(`Summarizer not available: ${status.reason}`);
      }

      // If no summaries, return title
      if (!pairSummaries || pairSummaries.length === 0) {
        return chatTitle || 'Empty conversation';
      }

      // If only one summary, return it
      if (pairSummaries.length === 1) {
        return pairSummaries[0];
      }

      // Combine all pair summaries
      const combinedSummaries = pairSummaries
        .map((summary, index) => `${index + 1}. ${summary}`)
        .join('\n');

      const textToSummarize = chatTitle
        ? `Chat Title: ${chatTitle}\n\nKey Topics Discussed:\n${combinedSummaries}`
        : `Key Topics Discussed:\n${combinedSummaries}`;

      // Create summarizer using new global Summarizer API
      console.log('[AI Service] Creating summarizer session...');
      const summarizer = await Summarizer.create({
        type: 'tldr',
        format: 'plain-text',
        length: 'short',
        sharedContext: 'This is a summary of topics discussed in an AI chat conversation.',
        expectedInputLanguages: ['en'],
        outputLanguage: 'en'
      });

      console.log('[AI Service] Summarizer created, generating chat summary...');

      // Generate summary
      const summary = await summarizer.summarize(textToSummarize);

      // Clean up
      summarizer.destroy();

      console.log('[AI Service] Chat summary generated:', summary.substring(0, 100) + '...');

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
      console.log(`[AI Service] Aggregating ${chatSummaries.length} chat summaries for label: ${labelName}`);

      // Check availability
      const status = await this.checkPromptAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        console.log('[AI Service] Model is downloading, waiting 2 seconds...');
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

      console.log(`[AI Service] Aggregation prompt length: ${prompt.length} chars`);

      // Create language model session
      const session = await LanguageModel.create({
        temperature: 0.7,
        topK: 40
      });

      // Generate aggregated summary
      const aggregatedSummary = await session.prompt(prompt);
      session.destroy();

      console.log(`[AI Service] Aggregated summary generated: ${aggregatedSummary.substring(0, 100)}...`);

      return aggregatedSummary.trim();

    } catch (error) {
      console.error('[AI Service] Error aggregating chat summaries:', error);
      // Return a simple concatenated fallback
      const combined = chatSummaries.join(' ').substring(0, 500);
      return `This label contains ${chatSummaries.length} conversations covering: ${combined}${chatSummaries.join(' ').length > 500 ? '...' : ''}`;
    }
  },

  /**
   * Generate structured bullet points from chat conversations
   * Creates a mindmap-style hierarchical summary with links to original chats
   *
   * @param {Array<Object>} chatsWithContext - Array of chat objects with {id, title, url, platform, chatSummary, messagePairSummaries}
   * @param {string} labelName - Name of the label (for context)
   * @returns {Promise<string>} HTML string with structured bullet points and chat links
   */
  async generateBulletPoints(chatsWithContext, labelName = '') {
    try {
      console.log(`[AI Service] Generating bullet points from ${chatsWithContext.length} chats for label: ${labelName}`);

      // Check availability
      const status = await this.checkPromptAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        console.log('[AI Service] Model is downloading, waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (!status.available && !status.needsDownload) {
        throw new Error(`Prompt API not available: ${status.reason}`);
      }

      // If no chats, return default
      if (!chatsWithContext || chatsWithContext.length === 0) {
        return '<p class="bulletpoints-placeholder">No chats available.</p>';
      }

      const chatCount = chatsWithContext.length;

      // Dynamic category count based on chat count
      const minCategories = Math.max(3, Math.ceil(chatCount / 3));
      const maxCategories = Math.min(10, Math.ceil(chatCount / 2));

      // Truncate chat summaries to prevent quota issues
      const MAX_SUMMARY_LENGTH = 300;
      const chatList = chatsWithContext.map((chat, index) => {
        const truncatedSummary = chat.chatSummary.length > MAX_SUMMARY_LENGTH
          ? chat.chatSummary.substring(0, MAX_SUMMARY_LENGTH) + '...'
          : chat.chatSummary;

        return `${index + 1}. [${chat.platform}] "${chat.title}"
   Summary: ${truncatedSummary}`;
      }).join('\n\n');

      const prompt = `You are analyzing ${chatCount} conversations about "${labelName}".

Here are the conversations with their summaries:

${chatList}

Organize these ${chatCount} conversations into ${minCategories}-${maxCategories} topical categories.

For each category:
- Name the main topic (3-6 words)
- List which conversation numbers (1-${chatCount}) belong to this topic
- For each conversation, extract 2-4 key discussion points that include:
  * Specific questions asked or problems discussed
  * Concrete examples, code snippets, or use cases mentioned
  * Important concepts or techniques explained
  * Practical takeaways or solutions provided

Make the key points specific to what was actually discussed in that conversation, not generic statements.
Include actual details, examples, or terminology from the conversation when possible.

Return ONLY a JSON object in this exact format:
{
  "categories": [
    {
      "topic": "Topic Name",
      "chats": [
        {
          "chatIndex": 1,
          "keyPoints": ["Specific point or question from chat", "Concrete example discussed", "Key concept explained"]
        }
      ]
    }
  ]
}

IMPORTANT: Return ONLY the JSON object, no extra text or markdown.`;

      console.log(`[AI Service] Bullet points prompt length: ${prompt.length} chars`);

      // Create language model session
      const session = await LanguageModel.create({
        temperature: 0.7,
        topK: 40
      });

      // Generate categorization
      const response = await session.prompt(prompt);
      session.destroy();

      console.log(`[AI Service] AI response received: ${response.substring(0, 200)}...`);

      // Parse JSON response
      let categoriesData;
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

        categoriesData = JSON.parse(cleanedResponse);

        if (!categoriesData.categories || !Array.isArray(categoriesData.categories)) {
          throw new Error('Invalid response structure: missing categories array');
        }

        console.log(`[AI Service] Successfully parsed ${categoriesData.categories.length} categories`);

      } catch (parseError) {
        console.error('[AI Service] Error parsing JSON response:', parseError);
        console.error('[AI Service] Response was:', response);
        throw new Error('Failed to parse AI response: ' + parseError.message);
      }

      // Convert JSON to HTML with chat links
      const bulletPointsHTML = this._convertCategoriesToHTML(categoriesData.categories, chatsWithContext);

      console.log(`[AI Service] Bullet points HTML generated: ${bulletPointsHTML.length} chars`);

      return bulletPointsHTML;

    } catch (error) {
      console.error('[AI Service] Error generating bullet points:', error);
      // Return a simple fallback
      return `<p class="bulletpoints-placeholder" style="color: #ef4444;">Error generating bullet points: ${error.message}</p>`;
    }
  },

  /**
   * Convert categories JSON to HTML with chat links
   * @param {Array} categories - Array of category objects
   * @param {Array} chatsWithContext - Original chat objects for lookup
   * @returns {string} HTML string
   * @private
   */
  _convertCategoriesToHTML(categories, chatsWithContext) {
    if (!categories || categories.length === 0) {
      return '<p class="bulletpoints-placeholder">No categories generated.</p>';
    }

    let html = '<ul class="bulletpoints-list">';

    categories.forEach(category => {
      html += `\n  <li><strong>${this._escapeHtml(category.topic)}</strong>\n    <ul class="category-chats">`;

      if (category.chats && Array.isArray(category.chats)) {
        category.chats.forEach(chatItem => {
          const chatIndex = chatItem.chatIndex - 1; // Convert 1-based to 0-based
          const chat = chatsWithContext[chatIndex];

          if (chat) {
            html += `\n      <li class="chat-bullet">
        <a href="${this._escapeHtml(chat.url)}" class="chat-link" data-chat-id="${this._escapeHtml(chat.id)}">
          <span class="chat-platform ${chat.platform}">${this._getPlatformName(chat.platform)}</span>
          <span class="chat-title">${this._escapeHtml(chat.title)}</span>
        </a>`;

            if (chatItem.keyPoints && Array.isArray(chatItem.keyPoints) && chatItem.keyPoints.length > 0) {
              html += `\n        <ul class="key-points">`;
              chatItem.keyPoints.forEach(point => {
                html += `\n          <li>${this._escapeHtml(point)}</li>`;
              });
              html += `\n        </ul>`;
            }

            html += `\n      </li>`;
          }
        });
      }

      html += `\n    </ul>\n  </li>`;
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
   * Generate 5-10 suggested labels from all chat summaries
   * Uses batch processing for large datasets to avoid quota limits
   *
   * @param {Array<Object>} chats - Array of chat objects with chatSummary field
   * @returns {Promise<Array<Object>>} Array of suggested labels
   */
  async generateLabelsFromChatSummaries(chats) {
    try {
      console.log('[AI Service] Generating labels from', chats.length, 'chat summaries...');

      // Check availability
      const status = await this.checkPromptAvailability();

      // If downloading, wait a bit
      if (status.downloading) {
        console.log('[AI Service] Model is downloading, waiting 2 seconds...');
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

      // Use batch processing for large datasets (>8 chats)
      // Reduced from 10 to 8 to prevent QuotaExceededError
      const BATCH_SIZE = 8;
      if (chatsWithSummaries.length > BATCH_SIZE) {
        console.log(`[AI Service] Using batch processing: ${Math.ceil(chatsWithSummaries.length / BATCH_SIZE)} batches of ${BATCH_SIZE}`);
        return await this._generateLabelsWithBatching(chatsWithSummaries, BATCH_SIZE);
      }

      // Small dataset: process directly
      return await this._generateLabelsForBatch(chatsWithSummaries);

    } catch (error) {
      console.error('[AI Service] Error generating labels:', error);
      throw error;
    }
  },

  /**
   * Generate labels using batch processing for large datasets
   * Step 1: Generate raw labels for each batch
   * Step 2: Consolidate all raw labels into 5-10 final labels
   *
   * @param {Array<Object>} chats - Array of chat objects
   * @param {number} batchSize - Number of chats per batch
   * @returns {Promise<Array<Object>>} Final consolidated labels
   * @private
   */
  async _generateLabelsWithBatching(chats, batchSize) {
    try {
      const numBatches = Math.ceil(chats.length / batchSize);
      console.log(`[AI Service] Processing ${chats.length} chats in ${numBatches} batches`);

      // Step 1: Generate raw labels for each batch
      const rawLabels = [];
      for (let i = 0; i < chats.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        const batch = chats.slice(i, i + batchSize);

        console.log(`[AI Service] Processing batch ${batchNum}/${numBatches} (${batch.length} chats)`);

        const batchLabels = await this._generateLabelsForBatch(batch);
        console.log(`[AI Service] Batch ${batchNum} generated ${batchLabels.length} labels`);

        rawLabels.push(...batchLabels);
      }

      console.log(`[AI Service] Generated ${rawLabels.length} raw labels from all batches`);

      // Step 2: Consolidate raw labels into 5-10 final labels
      console.log('[AI Service] Consolidating raw labels...');
      const finalLabels = await this._consolidateLabels(rawLabels, chats);

      console.log(`[AI Service] Consolidated into ${finalLabels.length} final labels`);
      return finalLabels;

    } catch (error) {
      console.error('[AI Service] Error in batch processing:', error);
      throw error;
    }
  },

  /**
   * Generate 4-10 labels for a single batch of chats (≤8 chats)
   * This is the core label generation logic
   *
   * @param {Array<Object>} chats - Array of chat objects
   * @returns {Promise<Array<Object>>} Array of labels
   * @private
   */
  async _generateLabelsForBatch(chats) {
    try {
      const MAX_SUMMARY_LENGTH = 400; // Truncate long summaries to prevent quota errors
      const MAX_TITLE_LENGTH = 100; // Truncate long titles (some contain HTML/code)

      // Prepare data for analysis - use summaries only, not full content
      // Truncate summaries AND titles to prevent QuotaExceededError
      const chatData = chats.map(chat => {
        const summary = chat.chatSummary || '';
        const truncatedSummary = summary.length > MAX_SUMMARY_LENGTH
          ? summary.substring(0, MAX_SUMMARY_LENGTH) + '...'
          : summary;

        const title = chat.title || 'Untitled';
        const truncatedTitle = title.length > MAX_TITLE_LENGTH
          ? title.substring(0, MAX_TITLE_LENGTH) + '...'
          : title;

        return {
          id: chat.id,
          title: truncatedTitle,
          summary: truncatedSummary,
          platform: chat.platform,
          originalTitleLength: title.length,
          originalSummaryLength: summary.length
        };
      });

      // Log summary and title lengths for debugging
      const totalSummaryLength = chatData.reduce((sum, chat) => sum + chat.summary.length, 0);
      const totalTitleLength = chatData.reduce((sum, chat) => sum + chat.title.length, 0);
      const avgSummaryLength = Math.round(totalSummaryLength / chatData.length);
      const avgTitleLength = Math.round(totalTitleLength / chatData.length);

      console.log(`[AI Service] Batch stats: summaries=${totalSummaryLength} chars (avg ${avgSummaryLength}), titles=${totalTitleLength} chars (avg ${avgTitleLength})`);

      // Warn if any summaries or titles were truncated
      const truncatedSummaries = chatData.filter(chat => chat.originalSummaryLength > MAX_SUMMARY_LENGTH);
      const truncatedTitles = chatData.filter(chat => chat.originalTitleLength > MAX_TITLE_LENGTH);

      if (truncatedSummaries.length > 0) {
        console.log(`[AI Service] Truncated ${truncatedSummaries.length} long summaries (>${MAX_SUMMARY_LENGTH} chars)`);
      }
      if (truncatedTitles.length > 0) {
        console.log(`[AI Service] Truncated ${truncatedTitles.length} long titles (>${MAX_TITLE_LENGTH} chars)`);
        // Log which titles were truncated
        truncatedTitles.forEach(chat => {
          console.log(`  - Title truncated from ${chat.originalTitleLength} to ${chat.title.length} chars`);
        });
      }

      // Debug: Log each chat data before creating prompt
      if (chatData.some(chat => chat.summary.length > 500)) {
        console.warn('[AI Service] WARNING: Some summaries exceed expected length!');
        chatData.forEach((chat, i) => {
          if (chat.summary.length > 500) {
            console.warn(`  Chat ${i + 1}: ${chat.title} - ${chat.summary.length} chars (original: ${chat.originalLength})`);
            console.warn(`  First 100 chars: ${chat.summary.substring(0, 100)}`);
          }
        });
      }

      // Create the prompt (simplified to reduce overhead)
      const prompt = `Extract 4-10 topic labels from these AI chat summaries:

${chatData.map((chat, i) => `${i + 1}. [${chat.platform}] ${chat.title}: ${chat.summary}`).join('\n')}

Return JSON array with: name (2-5 words), description (one sentence, under 80 chars), conversationIds, confidence (0-1).
Keep descriptions concise (50-80 chars max).

Format:
[{"name":"Topic","description":"Short description","conversationIds":["id1"],"confidence":0.8}]

Return ONLY the JSON array.`;

      console.log(`[AI Service] Batch prompt length: ${prompt.length} chars`);

      // If prompt is suspiciously large, log more details
      if (prompt.length > 10000) {
        console.error(`[AI Service] ALERT: Batch prompt exceeds 10k chars!`);
        console.error(`[AI Service] Static overhead: ~${prompt.length - chatData.reduce((sum, c) => sum + c.summary.length, 0)} chars`);
        console.error(`[AI Service] Chat summaries total: ${chatData.reduce((sum, c) => sum + c.summary.length, 0)} chars`);
        console.error(`[AI Service] Longest summary: ${Math.max(...chatData.map(c => c.summary.length))} chars`);
        console.error(`[AI Service] Chat titles total: ${chatData.reduce((sum, c) => sum + c.title.length, 0)} chars`);

        // Log the actual prompt (truncated)
        console.error(`[AI Service] Prompt preview (first 1000 chars):`);
        console.error(prompt.substring(0, 1000));
        console.error(`[AI Service] Prompt preview (last 1000 chars):`);
        console.error(prompt.substring(prompt.length - 1000));
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

            console.log(`[AI Service] Extracted ${extractedLabels.length} labels from formatted list`);
            labels = extractedLabels;

            // Skip JSON parsing since we manually created the array
            if (!Array.isArray(labels)) {
              throw new Error('Failed to extract labels from formatted list');
            }
            console.log(`[AI Service] Successfully parsed ${labels.length} labels from formatted list`);
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

        console.log(`[AI Service] Successfully parsed ${labels.length} labels from batch`);

      } catch (parseError) {
        console.error('[AI Service] Error parsing JSON response:', parseError);
        console.error('[AI Service] Response was:', response);
        console.error('[AI Service] Cleaned response was:', cleanedResponse);
        throw new Error('Failed to parse AI response as JSON: ' + parseError.message);
      }

      return labels;

    } catch (error) {
      console.error('[AI Service] Error generating labels for batch:', error);
      throw error;
    }
  },

  /**
   * Consolidate multiple raw labels into 5-10 final distinct labels
   * Merges similar topics and combines chatIds
   *
   * @param {Array<Object>} rawLabels - Array of raw labels from all batches
   * @param {Array<Object>} allChats - All chat objects (for reference)
   * @returns {Promise<Array<Object>>} Final consolidated labels
   * @private
   */
  async _consolidateLabels(rawLabels, allChats) {
    try {
      const MAX_TOP_LABELS = 40; // Keep more labels for better consolidation

      // STEP 1: Sort by confidence and keep top labels
      const sortedLabels = [...rawLabels].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      const topLabels = sortedLabels.slice(0, MAX_TOP_LABELS);

      if (rawLabels.length > MAX_TOP_LABELS) {
        console.log(`[AI Service] Filtered ${rawLabels.length} raw labels down to top ${MAX_TOP_LABELS} by confidence`);
        const minConfidence = topLabels[topLabels.length - 1]?.confidence || 0;
        console.log(`[AI Service] Confidence range: ${topLabels[0]?.confidence.toFixed(2)} - ${minConfidence.toFixed(2)}`);
      }

      // STEP 2: Create indexed raw labels array (for merging chat IDs later)
      const indexedLabels = topLabels.map((label, index) => ({
        index: index + 1, // 1-based indexing for prompt
        name: label.name,
        description: label.description,
        conversationIds: label.conversationIds || [],
        confidence: label.confidence,
        chatCount: (label.conversationIds || []).length
      }));

      // Log raw labels structure for debugging
      console.log('[AI Service] Raw labels (sample with chat counts):');
      console.log(indexedLabels.slice(0, 5).map(l => `${l.name} (${l.chatCount} chats)`));

      // STEP 3: Send label names WITH chat counts to consolidation
      const labelList = indexedLabels.map(l =>
        `${l.index}. ${l.name} (${l.chatCount} chats)`
      ).join('\n');

      console.log(`[AI Service] Consolidation input: ${topLabels.length} labels with chat counts, ${labelList.length} chars total`);

      const prompt = `Merge these ${topLabels.length} topic labels into 5-10 distinct final categories by grouping similar topics:

${labelList}

Group related topics together. For each final category, return the category name and which source label numbers to merge.

Return JSON array:
[
  {"name": "Final Category Name", "sourceIndices": [1, 5, 12]},
  {"name": "Another Category", "sourceIndices": [2, 8]}
]

IMPORTANT: Return ONLY the JSON array, no extra text.`;

      // Log prompt details
      console.log(`[AI Service] Consolidation prompt length: ${prompt.length} chars`);
      console.log(`[AI Service] Prompt preview (first 500 chars):`);
      console.log(prompt.substring(0, 500));
      console.log(`[AI Service] Prompt preview (last 300 chars):`);
      console.log(prompt.substring(prompt.length - 300));

      // Create language model session with lower temperature for consistency
      console.log('[AI Service] Creating consolidation session...');
      const session = await LanguageModel.create({
        temperature: 0.5,
        topK: 40
      });

      console.log('[AI Service] Sending consolidation prompt...');
      const response = await session.prompt(prompt);
      session.destroy();
      console.log('[AI Service] Consolidation response received');

      // Parse JSON response (expecting array of objects with name and sourceIndices)
      let finalLabelGroups;
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
        // Use greedy matching to capture the entire outer array (not just first element)
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        finalLabelGroups = JSON.parse(cleanedResponse);

        // Validate that we got an array of objects
        if (!Array.isArray(finalLabelGroups)) {
          throw new Error('Response is not an array');
        }

        // Validate structure and filter valid items
        finalLabelGroups = finalLabelGroups.filter(item =>
          item && typeof item === 'object' &&
          typeof item.name === 'string' &&
          Array.isArray(item.sourceIndices) &&
          item.sourceIndices.length > 0
        );

        // Ensure we have 5-10 labels
        if (finalLabelGroups.length < 5) {
          console.warn(`[AI Service] Only ${finalLabelGroups.length} label groups generated, expected 5-10`);
        } else if (finalLabelGroups.length > 10) {
          console.warn(`[AI Service] ${finalLabelGroups.length} label groups generated, limiting to 10`);
          finalLabelGroups = finalLabelGroups.slice(0, 10);
        }

        console.log(`[AI Service] Successfully parsed ${finalLabelGroups.length} label groups with source mappings`);

      } catch (parseError) {
        console.error('[AI Service] Error parsing consolidation response:', parseError);
        console.error('[AI Service] Response was:', response);
        console.error('[AI Service] Cleaned response was:', cleanedResponse);
        throw new Error('Failed to parse consolidation response as JSON: ' + parseError.message);
      }

      // STEP 4: Merge chat IDs and descriptions from source labels
      console.log('[AI Service] Merging chat IDs from source labels...');
      const consolidatedLabels = finalLabelGroups.map(group => {
        const allConversationIds = [];
        const descriptions = [];
        let totalConfidence = 0;
        let sourceLabelsUsed = 0;

        console.log(`[AI Service] Processing group "${group.name}" with source indices:`, group.sourceIndices);

        // Merge data from all source labels
        group.sourceIndices.forEach(index => {
          // Convert 1-based index to 0-based
          const labelIndex = index - 1;

          if (labelIndex >= 0 && labelIndex < indexedLabels.length) {
            const sourceLabel = indexedLabels[labelIndex];
            allConversationIds.push(...sourceLabel.conversationIds);
            descriptions.push(sourceLabel.description);
            totalConfidence += sourceLabel.confidence;
            sourceLabelsUsed++;

            console.log(`  - Merged from "${sourceLabel.name}": ${sourceLabel.conversationIds.length} chats`);
          } else {
            console.warn(`  - Invalid index ${index}, skipping`);
          }
        });

        // Remove duplicate conversation IDs
        const uniqueConversationIds = [...new Set(allConversationIds)];

        // Use first non-empty description, or create generic one
        const description = descriptions.find(d => d && d.length > 0) ||
                           `Topics related to ${group.name}`;

        const avgConfidence = sourceLabelsUsed > 0 ? totalConfidence / sourceLabelsUsed : 0.7;

        console.log(`  → Final: "${group.name}" with ${uniqueConversationIds.length} unique chats`);

        return {
          name: group.name,
          description: description,
          conversationIds: uniqueConversationIds,
          confidence: avgConfidence
        };
      });

      console.log(`[AI Service] Final labels with merged chat IDs:`);
      consolidatedLabels.forEach(l =>
        console.log(`  - ${l.name}: ${l.conversationIds.length} chats`)
      );

      return consolidatedLabels;

    } catch (error) {
      console.error('[AI Service] Error consolidating labels:', error);
      throw error;
    }
  },

  /**
   * Clean up any active sessions (called when needed)
   */
  destroy() {
    console.log('[AI Service] Cleanup called');
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

  console.log('[AI Service] Debug helpers loaded. Type "debugLabels.help()" for usage.');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
