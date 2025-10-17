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
   * Uses Prompt API (LanguageModel) to analyze themes across all conversations
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

      // Prepare data for analysis - use summaries only, not full content
      const chatData = chatsWithSummaries.map(chat => ({
        id: chat.id,
        title: chat.title,
        summary: chat.chatSummary,
        platform: chat.platform
      }));

      // Create the prompt
      const prompt = `You are analyzing AI chat conversation summaries to extract common topics and themes.

Below are ${chatData.length} conversation summaries from ChatGPT, Claude, and Gemini:

${chatData.map((chat, i) => `${i + 1}. [${chat.platform.toUpperCase()}] ${chat.title}\nSummary: ${chat.summary}`).join('\n\n')}

Task: Identify 5-10 main topics or themes that appear across these conversations.

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

      // Create language model session using new global LanguageModel API
      console.log('[AI Service] Creating Prompt API session...');
      const session = await LanguageModel.create({
        temperature: 0.7,
        topK: 40
      });

      console.log('[AI Service] Prompt API session created, generating labels...');

      // Generate response
      const response = await session.prompt(prompt);

      // Clean up session
      session.destroy();

      console.log('[AI Service] Raw response from Prompt API:', response);

      // Parse JSON response
      let labels;
      try {
        // Clean up response - remove markdown code blocks if present
        let cleanedResponse = response.trim();

        // Remove markdown code blocks
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

        // Limit to 10 labels
        if (labels.length > 10) {
          labels = labels.slice(0, 10);
        }

        console.log('[AI Service] Successfully parsed', labels.length, 'labels');

      } catch (parseError) {
        console.error('[AI Service] Error parsing JSON response:', parseError);
        console.error('[AI Service] Response was:', response);
        throw new Error('Failed to parse AI response as JSON: ' + parseError.message);
      }

      return labels;

    } catch (error) {
      console.error('[AI Service] Error generating labels:', error);
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
