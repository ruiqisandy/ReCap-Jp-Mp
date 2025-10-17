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

      // Combine messages into a single text
      const combinedText = `User Question: ${userMessage}\n\nAssistant Response: ${assistantMessage}`;

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
        length: 'medium',
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

      // Prepare data for analysis - use summaries only, not full content
      // Truncate summaries to prevent QuotaExceededError
      const chatData = chats.map(chat => {
        const summary = chat.chatSummary || '';
        const truncatedSummary = summary.length > MAX_SUMMARY_LENGTH
          ? summary.substring(0, MAX_SUMMARY_LENGTH) + '...'
          : summary;

        return {
          id: chat.id,
          title: chat.title,
          summary: truncatedSummary,
          platform: chat.platform,
          originalLength: summary.length
        };
      });

      // Log summary lengths for debugging
      const totalLength = chatData.reduce((sum, chat) => sum + chat.summary.length, 0);
      const avgLength = Math.round(totalLength / chatData.length);
      console.log(`[AI Service] Batch summary stats: total=${totalLength} chars, avg=${avgLength} chars/chat, max=${MAX_SUMMARY_LENGTH} chars`);

      // Warn if any summaries were truncated
      const truncated = chatData.filter(chat => chat.originalLength > MAX_SUMMARY_LENGTH);
      if (truncated.length > 0) {
        console.log(`[AI Service] Truncated ${truncated.length} long summaries (>${MAX_SUMMARY_LENGTH} chars)`);
      }

      // Create the prompt
      const prompt = `You are analyzing AI chat conversation summaries to extract common topics and themes.

Below are ${chatData.length} conversation summaries from ChatGPT, Claude, and Gemini:

${chatData.map((chat, i) => `${i + 1}. [${chat.platform.toUpperCase()}] ${chat.title}\nSummary: ${chat.summary}`).join('\n\n')}

Task: Identify 4-10 main topics or themes that appear across these conversations.

For each topic:
1. Choose a clear, concise name (2-5 words)
2. Write a brief description (one sentence)
3. List the conversation IDs that discuss this topic
4. Assign a confidence score (0.0-1.0) based on how clearly this theme appears

Return ONLY a valid JSON array in this exact format (no markdown, no code blocks):
[
  {
    "name": "Topic Name",
    "description": "Brief description of what this topic covers",
    "conversationIds": ["id1", "id2", "id3"],
    "confidence": 0.85
  }
]

IMPORTANT: Return ONLY the JSON array, nothing else.`;

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
      try {
        let cleanedResponse = response.trim();

        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        // Try to extract JSON array if there's extra text
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        labels = JSON.parse(cleanedResponse);

        // Validate that we got an array
        if (!Array.isArray(labels)) {
          throw new Error('Response is not an array');
        }

        console.log(`[AI Service] Successfully parsed ${labels.length} labels from batch`);

      } catch (parseError) {
        console.error('[AI Service] Error parsing JSON response:', parseError);
        console.error('[AI Service] Response was:', response);
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
      const MAX_TOP_LABELS = 25; // Keep only top N highest-confidence labels
      const MAX_LABEL_DESC_LENGTH = 200; // Initial truncation length
      const FALLBACK_DESC_LENGTH = 100; // Aggressive truncation if needed

      // STEP 1: Sort by confidence and keep top labels
      const sortedLabels = [...rawLabels].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      const topLabels = sortedLabels.slice(0, MAX_TOP_LABELS);

      if (rawLabels.length > MAX_TOP_LABELS) {
        console.log(`[AI Service] Filtered ${rawLabels.length} raw labels down to top ${MAX_TOP_LABELS} by confidence`);
        const minConfidence = topLabels[topLabels.length - 1]?.confidence || 0;
        console.log(`[AI Service] Confidence range: ${topLabels[0]?.confidence.toFixed(2)} - ${minConfidence.toFixed(2)}`);
      }

      // STEP 2: Truncate label descriptions
      const truncatedLabels = topLabels.map(label => {
        const desc = label.description || '';
        const truncatedDesc = desc.length > MAX_LABEL_DESC_LENGTH
          ? desc.substring(0, MAX_LABEL_DESC_LENGTH) + '...'
          : desc;

        return {
          name: label.name,
          description: truncatedDesc,
          conversationIds: label.conversationIds,
          confidence: label.confidence,
          originalDescLength: desc.length
        };
      });

      // Log for debugging
      const totalLength = truncatedLabels.reduce((sum, label) => sum + label.description.length, 0);
      const avgLength = Math.round(totalLength / truncatedLabels.length);
      console.log(`[AI Service] Consolidation input: ${truncatedLabels.length} labels, total=${totalLength} chars, avg=${avgLength} chars/label`);

      // STEP 3: Check if we need more aggressive truncation
      const estimatedPromptSize = 1000 + totalLength; // 1000 chars for static prompt text
      if (estimatedPromptSize > 5000) {
        console.warn(`[AI Service] Estimated prompt size ${estimatedPromptSize} chars exceeds safe limit, applying aggressive truncation`);

        // Re-truncate to fallback length
        truncatedLabels.forEach(label => {
          if (label.description.length > FALLBACK_DESC_LENGTH) {
            label.description = label.description.substring(0, FALLBACK_DESC_LENGTH) + '...';
          }
        });

        const newTotalLength = truncatedLabels.reduce((sum, label) => sum + label.description.length, 0);
        console.log(`[AI Service] After aggressive truncation: ${newTotalLength} chars (was ${totalLength} chars)`);
      }

      // Create consolidation prompt
      const prompt = `You are consolidating AI-generated topic labels from multiple batches.

You have ${truncatedLabels.length} raw labels from analyzing ${allChats.length} chat conversations:

${truncatedLabels.map((label, i) => `${i + 1}. "${label.name}": ${label.description} (covers ${label.conversationIds?.length || 0} chats, confidence: ${label.confidence})`).join('\n')}

Task: Merge similar/overlapping labels and produce 5-10 FINAL distinct topic labels.

Rules:
1. Merge labels with similar meanings into one broader label
2. Keep labels that represent clearly distinct topics
3. For merged labels, combine ALL conversationIds from source labels (remove duplicates)
4. Use clear, concise names (2-5 words)
5. Write comprehensive descriptions that cover merged topics
6. Maintain high confidence scores (≥0.7) for final labels

Return ONLY a valid JSON array in this exact format (no markdown, no code blocks):
[
  {
    "name": "Final Topic Name",
    "description": "Comprehensive description covering merged topics",
    "conversationIds": ["id1", "id2", "id3", ...],
    "confidence": 0.85
  }
]

IMPORTANT:
- Produce 5-10 labels (not more, not less)
- Ensure conversationIds contain ALL relevant IDs from merged raw labels
- Return ONLY the JSON array, nothing else`;

      // Create language model session with lower temperature for consistency
      console.log('[AI Service] Creating consolidation session...');
      const session = await LanguageModel.create({
        temperature: 0.5,
        topK: 40
      });

      const response = await session.prompt(prompt);
      session.destroy();

      // Parse JSON response
      let consolidatedLabels;
      try {
        let cleanedResponse = response.trim();

        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        // Try to extract JSON array if there's extra text
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        consolidatedLabels = JSON.parse(cleanedResponse);

        // Validate that we got an array
        if (!Array.isArray(consolidatedLabels)) {
          throw new Error('Response is not an array');
        }

        // Ensure we have 5-10 labels
        if (consolidatedLabels.length < 5) {
          console.warn(`[AI Service] Only ${consolidatedLabels.length} labels generated, expected 5-10`);
        } else if (consolidatedLabels.length > 10) {
          console.warn(`[AI Service] ${consolidatedLabels.length} labels generated, limiting to 10`);
          consolidatedLabels = consolidatedLabels.slice(0, 10);
        }

        console.log(`[AI Service] Successfully consolidated into ${consolidatedLabels.length} final labels`);

      } catch (parseError) {
        console.error('[AI Service] Error parsing consolidation response:', parseError);
        console.error('[AI Service] Response was:', response);
        throw new Error('Failed to parse consolidation response as JSON: ' + parseError.message);
      }

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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
