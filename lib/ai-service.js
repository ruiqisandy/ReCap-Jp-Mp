/**
 * AIService - Wrapper for Chrome's Built-in AI APIs
 *
 * Integrates with:
 * - Prompt API (Gemini Nano) for text generation and topic extraction
 * - Summarizer API for content condensing
 *
 * Handles model availability, downloads, and error cases
 */

const AIService = {
  // AI session instances (reused for efficiency)
  promptSession: null,
  summarizerSession: null,

  /**
   * Check if Chrome's Built-in AI APIs are available
   * @returns {Promise<Object>} Object with promptAPI and summarizerAPI availability
   */
  async checkAvailability() {
    try {
      const promptAvailable = 'ai' in self && 'languageModel' in self.ai;
      const summarizerAvailable = 'ai' in self && 'summarizer' in self.ai;

      console.log('[AI Service] Availability check:', {
        promptAPI: promptAvailable,
        summarizerAPI: summarizerAvailable
      });

      return {
        promptAPI: promptAvailable,
        summarizerAPI: summarizerAvailable,
        available: promptAvailable || summarizerAvailable
      };
    } catch (error) {
      console.error('[AI Service] Error checking availability:', error);
      return {
        promptAPI: false,
        summarizerAPI: false,
        available: false
      };
    }
  },

  /**
   * Wait for model download with progress callback
   * @param {Function} onProgress - Callback for download progress (0-1)
   * @returns {Promise<boolean>} True if download successful
   */
  async waitForModelDownload(onProgress) {
    try {
      console.log('[AI Service] Starting model download...');

      // Check if languageModel API is available
      if (!('ai' in self && 'languageModel' in self.ai)) {
        throw new Error('Prompt API not available');
      }

      const capabilities = await self.ai.languageModel.capabilities();

      if (capabilities.available === 'no') {
        throw new Error('Language model not available on this device');
      }

      if (capabilities.available === 'after-download') {
        console.log('[AI Service] Model needs to be downloaded');

        // Create session which will trigger download
        const session = await self.ai.languageModel.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const progress = e.loaded / e.total;
              console.log(`[AI Service] Download progress: ${(progress * 100).toFixed(1)}%`);
              if (onProgress) {
                onProgress(progress);
              }
            });
          }
        });

        this.promptSession = session;
        console.log('[AI Service] Model download complete');
        return true;
      }

      if (capabilities.available === 'readily') {
        console.log('[AI Service] Model already available');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[AI Service] Error during model download:', error);
      throw error;
    }
  },

  /**
   * Generate text using Prompt API
   * @param {string} prompt - The prompt to send to the AI
   * @param {Object} options - Generation options (temperature, topK, etc.)
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    try {
      // Create session if not exists
      if (!this.promptSession) {
        if (!('ai' in self && 'languageModel' in self.ai)) {
          throw new Error('Prompt API not available');
        }
        this.promptSession = await self.ai.languageModel.create(options);
      }

      console.log('[AI Service] Generating text...');
      const result = await this.promptSession.prompt(prompt);
      console.log('[AI Service] Text generated successfully');

      return result;
    } catch (error) {
      console.error('[AI Service] Error generating text:', error);
      throw error;
    }
  },

  /**
   * Generate text with streaming
   * @param {string} prompt - The prompt to send to the AI
   * @param {Object} options - Generation options
   * @param {Function} onChunk - Callback for each chunk of text
   * @returns {Promise<string>} Complete generated text
   */
  async generateTextStream(prompt, options = {}, onChunk) {
    try {
      // Create session if not exists
      if (!this.promptSession) {
        if (!('ai' in self && 'languageModel' in self.ai)) {
          throw new Error('Prompt API not available');
        }
        this.promptSession = await self.ai.languageModel.create(options);
      }

      console.log('[AI Service] Generating text stream...');
      const stream = await this.promptSession.promptStreaming(prompt);

      let fullText = '';
      for await (const chunk of stream) {
        fullText = chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      console.log('[AI Service] Text stream complete');
      return fullText;
    } catch (error) {
      console.error('[AI Service] Error generating text stream:', error);
      throw error;
    }
  },

  /**
   * Summarize text using Summarizer API
   * @param {string} text - Text to summarize
   * @param {Object} options - Summarization options (type, format, length)
   * @returns {Promise<string>} Summary text
   */
  async summarize(text, options = {}) {
    try {
      if (!('ai' in self && 'summarizer' in self.ai)) {
        throw new Error('Summarizer API not available');
      }

      // Create new summarizer session
      const summarizer = await self.ai.summarizer.create(options);

      console.log('[AI Service] Summarizing text...');
      const summary = await summarizer.summarize(text);
      console.log('[AI Service] Summarization complete');

      // Clean up session
      summarizer.destroy();

      return summary;
    } catch (error) {
      console.error('[AI Service] Error summarizing text:', error);
      throw error;
    }
  },

  /**
   * Summarize text with streaming
   * @param {string} text - Text to summarize
   * @param {Object} options - Summarization options
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<string>} Complete summary
   */
  async summarizeStream(text, options = {}, onChunk) {
    try {
      if (!('ai' in self && 'summarizer' in self.ai)) {
        throw new Error('Summarizer API not available');
      }

      const summarizer = await self.ai.summarizer.create(options);

      console.log('[AI Service] Summarizing text stream...');
      const stream = await summarizer.summarizeStreaming(text);

      let fullSummary = '';
      for await (const chunk of stream) {
        fullSummary = chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      console.log('[AI Service] Summarization stream complete');

      // Clean up session
      summarizer.destroy();

      return fullSummary;
    } catch (error) {
      console.error('[AI Service] Error summarizing text stream:', error);
      throw error;
    }
  },

  /**
   * Extract topics from conversations using AI
   * @param {Array<Object>} conversations - Array of conversation objects
   * @returns {Promise<Array<Object>>} Array of extracted topics with metadata
   */
  async extractTopics(conversations) {
    try {
      console.log('[AI Service] Extracting topics from', conversations.length, 'conversations');

      // Prepare conversation data (limit content length)
      const conversationData = conversations.map(conv => {
        const content = conv.rawContent || JSON.stringify(conv.messages);
        const truncated = content.substring(0, 3000);
        return {
          id: conv.id,
          title: conv.title,
          content: truncated,
          platform: conv.platform
        };
      });

      // Create structured prompt
      const prompt = `Analyze the following AI chat conversations and extract 3-7 main topics or themes.
For each topic, provide:
1. A clear, concise name (2-5 words)
2. A brief description (one sentence)
3. The conversation IDs that discuss this topic
4. A confidence score (0-1)

Return ONLY valid JSON in this exact format:
[
  {
    "name": "Topic Name",
    "description": "Brief description",
    "conversationIds": ["id1", "id2"],
    "confidence": 0.85
  }
]

Conversations:
${JSON.stringify(conversationData, null, 2)}

IMPORTANT: Return ONLY valid JSON, no markdown formatting.`;

      // Generate topics using Prompt API
      const response = await this.generateText(prompt, {
        temperature: 0.7,
        topK: 40
      });

      // Parse JSON response
      let topics;
      try {
        // Remove markdown code blocks if present
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
        }

        topics = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('[AI Service] JSON parsing error:', parseError);
        console.error('[AI Service] Raw response:', response);
        throw new Error('Failed to parse AI response as JSON');
      }

      console.log('[AI Service] Extracted', topics.length, 'topics');
      return topics;

    } catch (error) {
      console.error('[AI Service] Error extracting topics:', error);
      throw error;
    }
  },

  /**
   * Generate mind map structure for a label (Week 3 feature)
   * @param {string} labelName - Name of the label
   * @param {Array<Object>} conversations - Related conversations
   * @returns {Promise<Object>} Mind map structure
   */
  async generateMindMap(labelName, conversations) {
    try {
      console.log('[AI Service] Generating mind map for:', labelName);

      // Prepare conversation summaries
      const conversationSummaries = conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        summary: conv.rawContent?.substring(0, 500) || ''
      }));

      const prompt = `Create a hierarchical mind map structure for the topic "${labelName}" based on these conversations:

${JSON.stringify(conversationSummaries, null, 2)}

Return a JSON structure with:
- central topic
- main branches (subtopics)
- connections between concepts
- conversation references

Format:
{
  "central": "Topic Name",
  "branches": [
    {
      "name": "Subtopic",
      "items": ["concept1", "concept2"],
      "conversationIds": ["id1"]
    }
  ]
}`;

      const response = await this.generateText(prompt);

      // Parse and return
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('[AI Service] Error generating mind map:', error);
      throw error;
    }
  },

  /**
   * Generate quiz questions for a label (Week 3 feature)
   * @param {string} labelName - Name of the label
   * @param {Array<Object>} conversations - Related conversations
   * @returns {Promise<Array<Object>>} Array of quiz questions
   */
  async generateQuiz(labelName, conversations) {
    try {
      console.log('[AI Service] Generating quiz for:', labelName);

      const conversationContent = conversations.map(conv =>
        conv.rawContent?.substring(0, 1000) || ''
      ).join('\n\n---\n\n');

      const prompt = `Create 5-10 quiz questions about "${labelName}" based on this content:

${conversationContent}

Return JSON array with this format:
[
  {
    "question": "Question text?",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "Why this is correct"
  }
]`;

      const response = await this.generateText(prompt);

      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('[AI Service] Error generating quiz:', error);
      throw error;
    }
  },

  /**
   * Clean up and destroy AI sessions
   */
  destroy() {
    if (this.promptSession) {
      this.promptSession.destroy();
      this.promptSession = null;
    }
    if (this.summarizerSession) {
      this.summarizerSession.destroy();
      this.summarizerSession = null;
    }
    console.log('[AI Service] Sessions destroyed');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
