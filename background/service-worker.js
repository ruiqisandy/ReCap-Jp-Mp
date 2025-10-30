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

        case 'getPreferredLabels':
          const preferredLabels = await StorageService.getPreferredLabels();
          sendResponse({ success: true, data: preferredLabels });
          break;

        case 'savePreferredLabels':
          await StorageService.savePreferredLabels(message.data?.labels || []);
          sendResponse({ success: true });
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

        case 'updateChat':
          await StorageService.updateChat(message.data.chatId, message.data.updates);
          sendResponse({ success: true });
          break;

        case 'saveSuggestedLabel':
          await StorageService.saveSuggestedLabel(message.data);
          sendResponse({ success: true });
          break;

        case 'clearAllData':
          await StorageService.clearAllData();
          sendResponse({ success: true });
          break;

        case 'clearSuggestedLabels':
          await handleClearSuggestedLabels();
          sendResponse({ success: true });
          break;

        case 'clearAcceptedLabels':
          await handleClearAcceptedLabels();
          sendResponse({ success: true });
          break;

        case 'updateLabel':
          await StorageService.updateLabel(message.data.labelId, message.data.updates);
          sendResponse({ success: true });
          break;

        case 'deleteChat':
          await handleDeleteChat(message.data.chatId);
          sendResponse({ success: true });
          break;

        case 'deleteLabel':
          await handleDeleteLabel(message.data.labelId);
          sendResponse({ success: true });
          break;

        case 'removeChatFromLabel':
          await handleRemoveChatFromLabel(message.data.labelId, message.data.chatId);
          sendResponse({ success: true });
          break;

        case 'resetSummaries':
          const resetCount = await handleResetSummaries();
          const labelClearStats = await handleClearLabelAssignments();
          sendResponse({ success: true, data: { resetCount, labelClearStats } });
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
 * Handle deleting a chat and cleaning up label references
 * @param {string} chatId - Chat ID to delete
 */
async function handleDeleteChat(chatId) {
  console.log('[Background] Deleting chat:', chatId);
  await StorageService.deleteChat(chatId);
}

/**
 * Handle deleting a label and cleaning up chat references
 * @param {string} labelId - Label ID to delete
 */
async function handleDeleteLabel(labelId) {
  console.log('[Background] Deleting label:', labelId);
  await StorageService.deleteLabel(labelId);
}

/**
 * Handle removing a chat from a specific label
 * @param {string} labelId - Label ID
 * @param {string} chatId - Chat ID
 */
async function handleRemoveChatFromLabel(labelId, chatId) {
  console.log('[Background] Removing chat', chatId, 'from label', labelId);
  await StorageService.removeChatFromLabel(labelId, chatId);
}

/**
 * Handle resetting chat summaries
 * @returns {Promise<number>} Number of chats reset
 */
async function handleResetSummaries() {
  console.log('[Background] Resetting chat summaries');
  const resetCount = await StorageService.resetAllSummaries();
  return resetCount;
}

async function handleClearLabelAssignments() {
  console.log('[Background] Clearing label assignments');
  const stats = await StorageService.clearAllLabelAssignments();
  return stats;
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
 *
 * Pipeline:
 * 1. For each chat, split messages into pairs (user + assistant)
 * 2. Summarize each pair using Summarizer API
 * 3. Generate overall chat summary from pair summaries
 * 4. Store summaries in chat object
 * 5. Use Prompt API to analyze all chat summaries and generate 5-10 labels
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

    console.log('[Background] Processing', chats.length, 'chats with new summarization pipeline');

    // STEP 1 & 2: Process each chat - summarize message pairs and generate chat summary
    let processedCount = 0;

    for (const chat of chats) {
      try {
        console.log(`[Background] Processing chat ${processedCount + 1}/${chats.length}: ${chat.title}`);

        // Skip if no messages
        if (!chat.messages || chat.messages.length === 0) {
          console.log(`[Background] Skipping chat ${chat.id} - no messages`);
          continue;
        }

        // STEP 1: Split messages into pairs
        const messagePairs = [];
        for (let i = 0; i < chat.messages.length; i += 2) {
          const userMsg = chat.messages[i];
          const assistantMsg = chat.messages[i + 1];

          // Only create pair if both user and assistant messages exist
          if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
            messagePairs.push({
              user: userMsg.content,
              assistant: assistantMsg.content
            });
          }
        }

        console.log(`[Background] Found ${messagePairs.length} message pairs in chat ${chat.id}`);

        // Skip if no valid pairs
        if (messagePairs.length === 0) {
          console.log(`[Background] Skipping chat ${chat.id} - no valid message pairs`);
          continue;
        }

        // STEP 2: Summarize each message pair
        const pairSummaries = [];
        for (let i = 0; i < messagePairs.length; i++) {
          const pair = messagePairs[i];
          console.log(`[Background] Summarizing pair ${i + 1}/${messagePairs.length} for chat ${chat.id}`);

          try {
            const pairSummary = await AIService.summarizeMessagePair(pair.user, pair.assistant);
            pairSummaries.push(pairSummary);
            console.log(`[Background] Pair ${i + 1} summary: ${pairSummary.substring(0, 60)}...`);
          } catch (error) {
            console.error(`[Background] Error summarizing pair ${i + 1}:`, error);
            // Use fallback summary
            pairSummaries.push(`Discussion: ${pair.user.substring(0, 50)}...`);
          }
        }

        // STEP 3: Generate overall chat summary from pair summaries
        console.log(`[Background] Generating overall summary for chat ${chat.id}`);
        let chatSummary;
        try {
          chatSummary = await AIService.summarizeChat(pairSummaries, chat.title);
          console.log(`[Background] Chat summary: ${chatSummary.substring(0, 100)}...`);
        } catch (error) {
          console.error(`[Background] Error generating chat summary:`, error);
          // Use first pair summary as fallback
          chatSummary = pairSummaries[0] || chat.title || 'Summary unavailable';
        }

        // STEP 4: Update chat with summaries
        await StorageService.updateChat(chat.id, {
          messagePairSummaries: pairSummaries,
          chatSummary: chatSummary,
          processed: true
        });

        processedCount++;
        console.log(`[Background] Chat ${processedCount}/${chats.length} processed successfully`);

      } catch (error) {
        console.error(`[Background] Error processing chat ${chat.id}:`, error);
        // Continue with next chat instead of failing entirely
        continue;
      }
    }

    console.log(`[Background] Successfully processed ${processedCount}/${chats.length} chats`);

    // STEP 5: Generate labels from all chat summaries (when preferences exist)
    if (processedCount > 0) {
      console.log('[Background] Generating labels from chat summaries (preferred labels flow)...');

      try {
        const preferredLabels = await StorageService.getPreferredLabels();

        if (!preferredLabels || preferredLabels.length === 0) {
          console.log('[Background] No preferred labels saved; skipping classification step.');
        } else {
          // Get updated chats with summaries
          const updatedChatsObj = await StorageService.getAllChats();
          const updatedChats = Object.values(updatedChatsObj);

          // Generate labels using Prompt API with preferred labels
          const labels = await AIService.generateLabelsFromChatSummaries(updatedChats, preferredLabels);

          console.log('[Background] Generated', labels.length, 'preferred label groups');

          await handleClearSuggestedLabels();

          // Save as suggested labels
          for (const label of labels) {
            const suggestedLabel = {
              id: `suggested_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: label.name,
              description: label.description,
              confidence: label.confidence,
              chatIds: label.conversationIds || [],
              dismissed: false
            };

            await StorageService.saveSuggestedLabel(suggestedLabel);
            console.log('[Background] Saved preferred label suggestion:', suggestedLabel.name);
          }
        }

      } catch (error) {
        console.error('[Background] Error generating preferred label suggestions from summaries:', error);
        // Don't throw - summaries were saved successfully, labels can be regenerated later
      }
    }

    // Update status
    await StorageService.updateSettings({ importStatus: 'idle' });

    console.log('[Background] AI processing pipeline complete');

  } catch (error) {
    console.error('[Background] Error in processing pipeline:', error);
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

  // Get current labels to determine next position
  const existingLabels = await StorageService.getAllLabels();
  const existingLabelsArray = Object.values(existingLabels);

  // Find the highest position value, or default to 0
  let maxPosition = -1;
  for (const label of existingLabelsArray) {
    if (typeof label.position === 'number' && label.position > maxPosition) {
      maxPosition = label.position;
    }
  }
  const nextPosition = maxPosition + 1;

  // Create actual label
  const newLabel = {
    id: `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: suggestedLabel.name,
    category: data.category || 'General', // Allow user to specify category
    chatIds: suggestedLabel.chatIds,
    created: Date.now(),
    updated: Date.now(),
    position: nextPosition,
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
 * Handle clearing all suggested labels
 */
async function handleClearSuggestedLabels() {
  console.log('[Background] Clearing all suggested labels');

  try {
    // Get all suggested labels
    const suggestedLabels = await StorageService.getAllSuggestedLabels();
    const labelIds = Object.keys(suggestedLabels);

    console.log(`[Background] Removing ${labelIds.length} suggested labels`);

    // Remove each suggested label
    for (const labelId of labelIds) {
      await StorageService.removeSuggestedLabel(labelId);
    }

    console.log('[Background] All suggested labels cleared');
  } catch (error) {
    console.error('[Background] Error clearing suggested labels:', error);
    throw error;
  }
}

/**
 * Handle clearing all accepted labels
 */
async function handleClearAcceptedLabels() {
  console.log('[Background] Clearing all accepted labels');

  try {
    // Get all accepted labels
    const labels = await StorageService.getAllLabels();
    const labelIds = Object.keys(labels);

    console.log(`[Background] Removing ${labelIds.length} accepted labels`);

    // For each label, remove label references from chats
    for (const labelId of labelIds) {
      const label = labels[labelId];

      if (label.chatIds && label.chatIds.length > 0) {
        // Remove this label ID from each chat
        for (const chatId of label.chatIds) {
          const chat = await StorageService.getChat(chatId);
          if (chat && chat.labelIds) {
            const updatedLabelIds = chat.labelIds.filter(id => id !== labelId);
            await StorageService.updateChat(chatId, { labelIds: updatedLabelIds });
          }
        }
      }

      // Remove the label itself
      await StorageService.deleteLabel(labelId);
    }

    console.log('[Background] All accepted labels cleared');
  } catch (error) {
    console.error('[Background] Error clearing accepted labels:', error);
    throw error;
  }
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
