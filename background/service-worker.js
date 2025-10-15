/**
 * Background Service Worker for AI-ReCap
 *
 * Responsibilities:
 * - Message handling between popup and content scripts
 * - AI processing pipeline coordination
 * - Periodic sync management
 * - Storage operations orchestration
 */

// Import required services
importScripts('../lib/storage.js', '../lib/ai-service.js');

console.log('[Background] Service worker loaded');

/**
 * Installation handler - Initialize default settings
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First-time installation
    try {
      await StorageService.updateSettings({
        lastSync: null,
        importStatus: 'idle',
        totalChatsImported: 0
      });

      console.log('[Background] Default settings initialized');

      // Check AI availability on install
      const availability = await AIService.checkAvailability();
      console.log('[Background] AI availability:', availability);

    } catch (error) {
      console.error('[Background] Error during installation:', error);
    }
  }

  if (details.reason === 'update') {
    console.log('[Background] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Message handler - Process messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type, 'from', sender.tab ? 'content script' : 'popup');

  // Handle async responses
  (async () => {
    try {
      switch (message.type) {
        case 'saveChat':
          await handleSaveChat(message.data);
          sendResponse({ success: true });
          break;

        case 'batchSaveChats':
          await handleBatchSaveChats(message.data);
          sendResponse({ success: true });
          break;

        case 'getAllChats':
          const chats = await handleGetAllChats();
          sendResponse({ success: true, data: chats });
          break;

        case 'processChatsForLabels':
          await handleProcessChatsForLabels();
          sendResponse({ success: true });
          break;

        case 'checkAI':
          const availability = await handleCheckAI();
          sendResponse({ success: true, data: availability });
          break;

        case 'getStorageStats':
          const stats = await StorageService.getStorageStats();
          sendResponse({ success: true, data: stats });
          break;

        case 'updateSettings':
          await StorageService.updateSettings(message.data);
          sendResponse({ success: true });
          break;

        case 'getAllLabels':
          const labels = await StorageService.getAllLabels();
          sendResponse({ success: true, data: labels });
          break;

        case 'getAllSuggestedLabels':
          const suggestedLabels = await StorageService.getAllSuggestedLabels();
          sendResponse({ success: true, data: suggestedLabels });
          break;

        case 'acceptSuggestedLabel':
          await handleAcceptSuggestedLabel(message.data);
          sendResponse({ success: true });
          break;

        case 'dismissSuggestedLabel':
          await StorageService.dismissSuggestedLabel(message.data.labelId);
          sendResponse({ success: true });
          break;

        case 'clearAllData':
          await StorageService.clearAllData();
          sendResponse({ success: true });
          break;

        default:
          console.warn('[Background] Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Background] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate async response
  return true;
});

/**
 * Handle saving a single chat
 */
async function handleSaveChat(chatData) {
  console.log('[Background] Saving chat:', chatData.id);
  await StorageService.saveChat(chatData);

  // Update total count
  const settings = await StorageService.getSettings();
  await StorageService.updateSettings({
    totalChatsImported: settings.totalChatsImported + 1
  });
}

/**
 * Handle batch saving chats
 */
async function handleBatchSaveChats(chatsArray) {
  console.log('[Background] Batch saving', chatsArray.length, 'chats');
  await StorageService.batchSaveChats(chatsArray);

  // Update total count
  const settings = await StorageService.getSettings();
  await StorageService.updateSettings({
    totalChatsImported: settings.totalChatsImported + chatsArray.length,
    lastSync: Date.now()
  });
}

/**
 * Handle getting all chats
 */
async function handleGetAllChats() {
  console.log('[Background] Getting all chats');
  const chats = await StorageService.getAllChats();

  // Convert to array for easier handling
  return Object.values(chats);
}

/**
 * Handle checking AI availability
 */
async function handleCheckAI() {
  console.log('[Background] Checking AI availability');
  return await AIService.checkAvailability();
}

/**
 * Process all chats for AI-powered label extraction
 */
async function handleProcessChatsForLabels() {
  console.log('[Background] Starting AI processing for label extraction');

  try {
    // Update status
    await StorageService.updateSettings({ importStatus: 'processing' });

    // Get all chats
    const chatsObj = await StorageService.getAllChats();
    const chats = Object.values(chatsObj);

    if (chats.length === 0) {
      console.log('[Background] No chats to process');
      await StorageService.updateSettings({ importStatus: 'idle' });
      return;
    }

    console.log('[Background] Processing', chats.length, 'chats for topic extraction');

    // Extract topics using AI
    const topics = await AIService.extractTopics(chats);

    console.log('[Background] Extracted', topics.length, 'topics');

    // Save as suggested labels
    for (const topic of topics) {
      const suggestedLabel = {
        id: `suggested_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: topic.name,
        description: topic.description,
        confidence: topic.confidence,
        chatIds: topic.conversationIds || [],
        dismissed: false
      };

      await StorageService.saveSuggestedLabel(suggestedLabel);
      console.log('[Background] Saved suggested label:', suggestedLabel.name);
    }

    // Update status
    await StorageService.updateSettings({ importStatus: 'idle' });

    console.log('[Background] AI processing complete');

  } catch (error) {
    console.error('[Background] Error processing chats for labels:', error);
    await StorageService.updateSettings({ importStatus: 'idle' });
    throw error;
  }
}

/**
 * Handle accepting a suggested label (convert to actual label)
 */
async function handleAcceptSuggestedLabel(data) {
  const { labelId } = data;

  console.log('[Background] Accepting suggested label:', labelId);

  // Get the suggested label
  const suggestedLabels = await StorageService.getAllSuggestedLabels();
  const suggestedLabel = suggestedLabels[labelId];

  if (!suggestedLabel) {
    throw new Error('Suggested label not found');
  }

  // Create actual label
  const newLabel = {
    id: `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: suggestedLabel.name,
    category: data.category || 'General', // Allow user to specify category
    chatIds: suggestedLabel.chatIds,
    created: Date.now(),
    updated: Date.now(),
    mindMapData: null,
    summary: null,
    quizData: null
  };

  await StorageService.saveLabel(newLabel);

  // Update chats to reference this label
  for (const chatId of newLabel.chatIds) {
    const chat = await StorageService.getChat(chatId);
    if (chat) {
      const labelIds = chat.labelIds || [];
      if (!labelIds.includes(newLabel.id)) {
        labelIds.push(newLabel.id);
        await StorageService.updateChat(chatId, { labelIds });
      }
    }
  }

  // Remove the suggested label
  await StorageService.removeSuggestedLabel(labelId);

  console.log('[Background] Suggested label accepted and converted:', newLabel.name);
}

/**
 * Setup periodic sync (optional - runs every 60 minutes)
 * Uncomment to enable periodic background processing
 */
/*
chrome.alarms.create('periodicSync', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodicSync') {
    console.log('[Background] Running periodic sync');

    try {
      const settings = await StorageService.getSettings();

      // Only process if not currently importing
      if (settings.importStatus === 'idle') {
        // Check if there are unprocessed chats
        const chats = await StorageService.getAllChats();
        const unprocessedChats = Object.values(chats).filter(chat => !chat.processed);

        if (unprocessedChats.length > 0) {
          console.log('[Background] Found', unprocessedChats.length, 'unprocessed chats');
          await handleProcessChatsForLabels();
        }
      }
    } catch (error) {
      console.error('[Background] Error during periodic sync:', error);
    }
  }
});
*/

console.log('[Background] Service worker initialized and ready');
