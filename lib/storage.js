/**
 * StorageService - Manages all Chrome storage operations for AI-ReCap
 *
 * Data Schemas:
 * - CHATS: Individual chat conversations from AI platforms
 * - LABELS: User-curated topic categories
 * - SUGGESTED_LABELS: AI-generated label suggestions
 * - SETTINGS: Extension configuration and status
 */

const StorageService = {
  // Storage keys
  KEYS: {
    CHATS: 'chats',
    LABELS: 'labels',
    SUGGESTED_LABELS: 'suggestedLabels',
    SETTINGS: 'settings'
  },

  /**
   * CHAT OPERATIONS
   */

  /**
   * Save a single chat to storage
   * @param {Object} chat - Chat object with id, platform, title, date, url, messages, etc.
   * @returns {Promise<void>}
   */
  async saveChat(chat) {
    try {
      const chats = await this.getAllChats();
      chats[chat.id] = chat;
      await chrome.storage.local.set({ [this.KEYS.CHATS]: chats });
      console.log(`[Storage] Chat saved: ${chat.id}`);
    } catch (error) {
      console.error('[Storage] Error saving chat:', error);
      throw error;
    }
  },

  /**
   * Get a single chat by ID
   * @param {string} chatId - Unique chat identifier
   * @returns {Promise<Object|null>}
   */
  async getChat(chatId) {
    try {
      const chats = await this.getAllChats();
      return chats[chatId] || null;
    } catch (error) {
      console.error('[Storage] Error getting chat:', error);
      throw error;
    }
  },

  /**
   * Get all chats from storage
   * @returns {Promise<Object>} Object with chatId as keys
   */
  async getAllChats() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.CHATS);
      return result[this.KEYS.CHATS] || {};
    } catch (error) {
      console.error('[Storage] Error getting all chats:', error);
      throw error;
    }
  },

  /**
   * Update specific fields of a chat
   * @param {string} chatId - Chat ID to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateChat(chatId, updates) {
    try {
      const chat = await this.getChat(chatId);
      if (!chat) {
        throw new Error(`Chat not found: ${chatId}`);
      }
      const updatedChat = { ...chat, ...updates };
      await this.saveChat(updatedChat);
      console.log(`[Storage] Chat updated: ${chatId}`);
    } catch (error) {
      console.error('[Storage] Error updating chat:', error);
      throw error;
    }
  },

  /**
   * Delete a chat by ID
   * @param {string} chatId - Chat ID to delete
   * @returns {Promise<void>}
   */
  async deleteChat(chatId) {
    try {
      const chats = await this.getAllChats();
      delete chats[chatId];
      await chrome.storage.local.set({ [this.KEYS.CHATS]: chats });
      console.log(`[Storage] Chat deleted: ${chatId}`);
    } catch (error) {
      console.error('[Storage] Error deleting chat:', error);
      throw error;
    }
  },

  /**
   * Save multiple chats at once (batch operation)
   * @param {Array<Object>} chatArray - Array of chat objects
   * @returns {Promise<void>}
   */
  async batchSaveChats(chatArray) {
    try {
      const chats = await this.getAllChats();
      chatArray.forEach(chat => {
        chats[chat.id] = chat;
      });
      await chrome.storage.local.set({ [this.KEYS.CHATS]: chats });
      console.log(`[Storage] Batch saved ${chatArray.length} chats`);
    } catch (error) {
      console.error('[Storage] Error batch saving chats:', error);
      throw error;
    }
  },

  /**
   * LABEL OPERATIONS
   */

  /**
   * Save a single label to storage
   * @param {Object} label - Label object with id, name, category, chatIds, etc.
   * @returns {Promise<void>}
   */
  async saveLabel(label) {
    try {
      const labels = await this.getAllLabels();
      labels[label.id] = label;
      await chrome.storage.local.set({ [this.KEYS.LABELS]: labels });
      console.log(`[Storage] Label saved: ${label.id}`);
    } catch (error) {
      console.error('[Storage] Error saving label:', error);
      throw error;
    }
  },

  /**
   * Get a single label by ID
   * @param {string} labelId - Unique label identifier
   * @returns {Promise<Object|null>}
   */
  async getLabel(labelId) {
    try {
      const labels = await this.getAllLabels();
      return labels[labelId] || null;
    } catch (error) {
      console.error('[Storage] Error getting label:', error);
      throw error;
    }
  },

  /**
   * Get all labels from storage
   * @returns {Promise<Object>} Object with labelId as keys
   */
  async getAllLabels() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.LABELS);
      return result[this.KEYS.LABELS] || {};
    } catch (error) {
      console.error('[Storage] Error getting all labels:', error);
      throw error;
    }
  },

  /**
   * Update specific fields of a label
   * @param {string} labelId - Label ID to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateLabel(labelId, updates) {
    try {
      const label = await this.getLabel(labelId);
      if (!label) {
        throw new Error(`Label not found: ${labelId}`);
      }
      const updatedLabel = { ...label, ...updates, updated: Date.now() };
      await this.saveLabel(updatedLabel);
      console.log(`[Storage] Label updated: ${labelId}`);
    } catch (error) {
      console.error('[Storage] Error updating label:', error);
      throw error;
    }
  },

  /**
   * Delete a label by ID
   * @param {string} labelId - Label ID to delete
   * @returns {Promise<void>}
   */
  async deleteLabel(labelId) {
    try {
      const labels = await this.getAllLabels();
      delete labels[labelId];
      await chrome.storage.local.set({ [this.KEYS.LABELS]: labels });
      console.log(`[Storage] Label deleted: ${labelId}`);
    } catch (error) {
      console.error('[Storage] Error deleting label:', error);
      throw error;
    }
  },

  /**
   * SUGGESTED LABEL OPERATIONS
   */

  /**
   * Save a suggested label
   * @param {Object} suggestedLabel - Suggested label object
   * @returns {Promise<void>}
   */
  async saveSuggestedLabel(suggestedLabel) {
    try {
      const suggestedLabels = await this.getAllSuggestedLabels();
      suggestedLabels[suggestedLabel.id] = suggestedLabel;
      await chrome.storage.local.set({ [this.KEYS.SUGGESTED_LABELS]: suggestedLabels });
      console.log(`[Storage] Suggested label saved: ${suggestedLabel.id}`);
    } catch (error) {
      console.error('[Storage] Error saving suggested label:', error);
      throw error;
    }
  },

  /**
   * Get all suggested labels
   * @returns {Promise<Object>} Object with suggested label IDs as keys
   */
  async getAllSuggestedLabels() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.SUGGESTED_LABELS);
      return result[this.KEYS.SUGGESTED_LABELS] || {};
    } catch (error) {
      console.error('[Storage] Error getting suggested labels:', error);
      throw error;
    }
  },

  /**
   * Mark a suggested label as dismissed
   * @param {string} labelId - Suggested label ID
   * @returns {Promise<void>}
   */
  async dismissSuggestedLabel(labelId) {
    try {
      const suggestedLabels = await this.getAllSuggestedLabels();
      if (suggestedLabels[labelId]) {
        suggestedLabels[labelId].dismissed = true;
        await chrome.storage.local.set({ [this.KEYS.SUGGESTED_LABELS]: suggestedLabels });
        console.log(`[Storage] Suggested label dismissed: ${labelId}`);
      }
    } catch (error) {
      console.error('[Storage] Error dismissing suggested label:', error);
      throw error;
    }
  },

  /**
   * Remove a suggested label entirely
   * @param {string} labelId - Suggested label ID to remove
   * @returns {Promise<void>}
   */
  async removeSuggestedLabel(labelId) {
    try {
      const suggestedLabels = await this.getAllSuggestedLabels();
      delete suggestedLabels[labelId];
      await chrome.storage.local.set({ [this.KEYS.SUGGESTED_LABELS]: suggestedLabels });
      console.log(`[Storage] Suggested label removed: ${labelId}`);
    } catch (error) {
      console.error('[Storage] Error removing suggested label:', error);
      throw error;
    }
  },

  /**
   * SETTINGS OPERATIONS
   */

  /**
   * Get extension settings
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.SETTINGS);
      return result[this.KEYS.SETTINGS] || {
        lastSync: null,
        importStatus: 'idle',
        totalChatsImported: 0
      };
    } catch (error) {
      console.error('[Storage] Error getting settings:', error);
      throw error;
    }
  },

  /**
   * Update settings
   * @param {Object} updates - Settings fields to update
   * @returns {Promise<void>}
   */
  async updateSettings(updates) {
    try {
      const settings = await this.getSettings();
      const updatedSettings = { ...settings, ...updates };
      await chrome.storage.local.set({ [this.KEYS.SETTINGS]: updatedSettings });
      console.log('[Storage] Settings updated:', updates);
    } catch (error) {
      console.error('[Storage] Error updating settings:', error);
      throw error;
    }
  },

  /**
   * UTILITY OPERATIONS
   */

  /**
   * Clear all stored data (use with caution)
   * @returns {Promise<void>}
   */
  async clearAllData() {
    try {
      await chrome.storage.local.clear();
      console.log('[Storage] All data cleared');
    } catch (error) {
      console.error('[Storage] Error clearing data:', error);
      throw error;
    }
  },

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats including bytes used
   */
  async getStorageStats() {
    try {
      const bytesUsed = await chrome.storage.local.getBytesInUse();
      const chats = await this.getAllChats();
      const labels = await this.getAllLabels();
      const suggestedLabels = await this.getAllSuggestedLabels();

      return {
        bytesUsed,
        chatCount: Object.keys(chats).length,
        labelCount: Object.keys(labels).length,
        suggestedLabelCount: Object.keys(suggestedLabels).length
      };
    } catch (error) {
      console.error('[Storage] Error getting storage stats:', error);
      throw error;
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
