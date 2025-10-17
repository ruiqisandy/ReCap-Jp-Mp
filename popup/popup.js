/**
 * Popup Script for AI-ReCap - Module 2
 * Parallel tab processing for fast chat import
 */

console.log('[Popup] Script loaded - Module 2');

// Configuration constants
const MAX_PARALLEL_TABS = 6;  // Process 6 conversations simultaneously (balanced speed vs stability)
const TAB_TIMEOUT = 6000;      // 6 second timeout per tab (increased for cross-account imports)
const BATCH_DELAY = 1000;      // Delay between batches (increased for browser recovery)
const DYNAMIC_CONTENT_DELAY = 2500;  // Wait after page load for dynamic content (increased for heavy ChatGPT pages)

// Platform configurations
const PLATFORMS = {
  chatgpt: {
    name: 'ChatGPT',
    baseUrl: 'https://chatgpt.com',
    enabled: true
  },
  claude: {
    name: 'Claude',
    baseUrl: 'https://claude.ai',
    enabled: true
  },
  gemini: {
    name: 'Gemini',
    baseUrl: 'https://gemini.google.com',
    enabled: true
  }
};

// DOM elements - Welcome Screen
const welcomeScreen = document.getElementById('welcomeScreen');
const welcomeAiStatus = document.getElementById('welcomeAiStatus');
const welcomeAiStatusDot = document.getElementById('welcomeAiStatusDot');
const startImportBtn = document.getElementById('startImportBtn');
const viewLibraryFromWelcomeBtn = document.getElementById('viewLibraryFromWelcomeBtn');

// DOM elements - Progress Screen
const progressScreen = document.getElementById('progressScreen');
const backToWelcomeBtn = document.getElementById('backToWelcomeBtn');
const chatgptCountEl = document.getElementById('chatgptCount');
const claudeCountEl = document.getElementById('claudeCount');
const geminiCountEl = document.getElementById('geminiCount');
const progressFillEl = document.getElementById('progressFill');
const statusTextEl = document.getElementById('statusText');
const viewLibraryBtn = document.getElementById('viewLibraryBtn');

// DOM elements - Library Screen
const libraryScreen = document.getElementById('libraryScreen');
const backToWelcomeFromLibraryBtn = document.getElementById('backToWelcomeFromLibraryBtn');
const refreshBtn = document.getElementById('refreshBtn');

// DOM elements - Label View Screen
const labelScreen = document.getElementById('labelScreen');
const backToLibraryBtn = document.getElementById('backToLibraryBtn');
const labelViewName = document.getElementById('labelViewName');
const labelViewChatCount = document.getElementById('labelViewChatCount');
const tabButtons = document.querySelectorAll('.tab-button');
const summaryContent = document.getElementById('summaryContent');
const generateSummaryBtn = document.getElementById('generateSummaryBtn');
const labelChatList = document.getElementById('labelChatList');
const chatlistFilters = document.querySelectorAll('.chatlist-filters .filter-btn');

// Summarization section
const summarizationSection = document.getElementById('summarizationSection');
const summarizeBtn = document.getElementById('summarizeBtn');
const summarizationProgress = document.getElementById('summarizationProgress');
const summarizeProgressFill = document.getElementById('summarizeProgressFill');
const summarizeStatusText = document.getElementById('summarizeStatusText');

// Label generation section
const labelGenerationSection = document.getElementById('labelGenerationSection');
const generateLabelsBtn = document.getElementById('generateLabelsBtn');
const labelGenerationProgress = document.getElementById('labelGenerationProgress');
const labelProgressFill = document.getElementById('labelProgressFill');
const labelStatusText = document.getElementById('labelStatusText');

// Label lists
const suggestedBadge = document.getElementById('suggestedBadge');
const suggestedList = document.getElementById('suggestedList');
const clearSuggestedBtn = document.getElementById('clearSuggestedBtn');
const createLabelBtn = document.getElementById('createLabelBtn');
const labelList = document.getElementById('labelList');
const clearAcceptedBtn = document.getElementById('clearAcceptedBtn');

// Footer
const settingsBtn = document.getElementById('settingsBtn');
const clearDataBtn = document.getElementById('clearDataBtn');

// Chat list
const allChatsBadge = document.getElementById('allChatsBadge');
const chatList = document.getElementById('chatList');
const filterButtons = document.querySelectorAll('.filter-btn');

/**
 * Initialize popup
 */
async function initialize() {
  console.log('[Popup] Initializing...');

  try {
    // Check AI availability
    await checkAIAvailability();

    // Determine which screen to show
    await loadCurrentScreen();

    // Setup event listeners
    setupEventListeners();

    console.log('[Popup] Initialization complete');
  } catch (error) {
    console.error('[Popup] Initialization error:', error);
  }
}

/**
 * Check AI availability and update UI
 * Now checks directly in popup context (not service worker)
 */
async function checkAIAvailability() {
  try {
    // Call AIService directly (available in popup context)
    const availability = await AIService.checkAvailability();

    if (availability.promptAPI && availability.summarizerAPI) {
      welcomeAiStatus.textContent = '✓ AI Ready';
      welcomeAiStatusDot.className = 'status-dot status-ready';
    } else if (availability.promptAPI || availability.summarizerAPI) {
      welcomeAiStatus.textContent = '⚠ AI Partially Available';
      welcomeAiStatusDot.className = 'status-dot status-partial';
    } else {
      welcomeAiStatus.textContent = '✗ AI Unavailable';
      welcomeAiStatusDot.className = 'status-dot status-unavailable';
    }

    console.log('[Popup] AI availability:', availability);
  } catch (error) {
    console.error('[Popup] Error checking AI:', error);
    welcomeAiStatus.textContent = 'Error checking AI';
    welcomeAiStatusDot.className = 'status-dot status-error';
  }
}

/**
 * Load current screen based on state
 */
async function loadCurrentScreen() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getStorageStats' });

    if (response.success) {
      const stats = response.data;

      // If chats exist, show library screen by default
      if (stats.chatCount > 0) {
        showScreen('library');
        await loadLibrary();
        // Also show the "View My Library" button on welcome screen
        viewLibraryFromWelcomeBtn.style.display = 'block';
      } else {
        // Otherwise show welcome screen
        showScreen('welcome');
        viewLibraryFromWelcomeBtn.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('[Popup] Error loading current screen:', error);
    showScreen('welcome');
  }
}

/**
 * Show specific screen
 * @param {string} screenName - 'welcome', 'progress', 'library', or 'label'
 */
function showScreen(screenName) {
  // Hide all screens
  welcomeScreen.style.display = 'none';
  progressScreen.style.display = 'none';
  libraryScreen.style.display = 'none';
  labelScreen.style.display = 'none';

  // Show requested screen
  switch (screenName) {
    case 'welcome':
      welcomeScreen.style.display = 'block';
      break;
    case 'progress':
      progressScreen.style.display = 'block';
      break;
    case 'library':
      libraryScreen.style.display = 'block';
      break;
    case 'label':
      labelScreen.style.display = 'block';
      break;
  }

  console.log('[Popup] Showing screen:', screenName);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Welcome Screen
  startImportBtn.addEventListener('click', startImport);
  viewLibraryFromWelcomeBtn.addEventListener('click', () => {
    showScreen('library');
    loadLibrary();
  });

  // Progress Screen
  backToWelcomeBtn.addEventListener('click', () => showScreen('welcome'));
  viewLibraryBtn.addEventListener('click', () => {
    showScreen('library');
    loadLibrary();
  });

  // Library Screen
  backToWelcomeFromLibraryBtn.addEventListener('click', () => showScreen('welcome'));
  refreshBtn.addEventListener('click', loadLibrary);
  summarizeBtn.addEventListener('click', handleSummarizeChats);
  generateLabelsBtn.addEventListener('click', handleGenerateLabels);
  clearSuggestedBtn.addEventListener('click', handleClearSuggestedLabels);
  createLabelBtn.addEventListener('click', handleCreateLabel);
  clearAcceptedBtn.addEventListener('click', handleClearAcceptedLabels);
  settingsBtn.addEventListener('click', handleSettings);
  clearDataBtn.addEventListener('click', handleClearData);

  // Label View Screen
  backToLibraryBtn.addEventListener('click', () => {
    showScreen('library');
    loadLibrary();
  });
  generateSummaryBtn.addEventListener('click', handleGenerateLabelSummary);

  // Tab buttons
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Chat list filters (label view)
  chatlistFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all
      chatlistFilters.forEach(b => b.classList.remove('active'));
      // Add active to clicked
      btn.classList.add('active');
      // Filter
      const platform = btn.getAttribute('data-platform');
      filterLabelChats(platform);
    });
  });

  // Chat filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      filterButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      // Filter chats
      const platform = btn.dataset.platform;
      filterChats(platform);
    });
  });
}

/**
 * START IMPORT - Main orchestrator for parallel tab processing
 */
async function startImport() {
  console.log('[Popup] Starting import...');

  try {
    // Show progress screen
    showScreen('progress');

    // Reset counters
    chatgptCountEl.textContent = '0';
    claudeCountEl.textContent = '0';
    geminiCountEl.textContent = '0';
    updateProgress(0);
    statusTextEl.textContent = 'Initializing import...';

    let totalImported = 0;
    const platformResults = {};

    // Import from each platform sequentially
    // ChatGPT: 0-30%
    if (PLATFORMS.chatgpt.enabled) {
      statusTextEl.textContent = 'Importing from ChatGPT...';
      const chatgptCount = await importFromPlatformParallel('chatgpt', (current, total) => {
        chatgptCountEl.textContent = current;
        const progress = (current / total) * 30;
        updateProgress(progress);
      });
      platformResults.chatgpt = chatgptCount;
      totalImported += chatgptCount;
      console.log('[Popup] ChatGPT import complete:', chatgptCount);
    }

    // Claude: 30-55%
    if (PLATFORMS.claude.enabled) {
      statusTextEl.textContent = 'Importing from Claude...';
      const claudeCount = await importFromPlatformParallel('claude', (current, total) => {
        claudeCountEl.textContent = current;
        const progress = 30 + ((current / total) * 25);
        updateProgress(progress);
      });
      platformResults.claude = claudeCount;
      totalImported += claudeCount;
      console.log('[Popup] Claude import complete:', claudeCount);
    }

    // Gemini: 55-100%
    if (PLATFORMS.gemini.enabled) {
      statusTextEl.textContent = 'Importing from Gemini...';
      const geminiCount = await importFromPlatformParallel('gemini', (current, total) => {
        geminiCountEl.textContent = current;
        const progress = 55 + ((current / total) * 45);
        updateProgress(progress);
      });
      platformResults.gemini = geminiCount;
      totalImported += geminiCount;
      console.log('[Popup] Gemini import complete:', geminiCount);
    }

    // Complete
    updateProgress(100);
    statusTextEl.textContent = `Successfully imported ${totalImported} conversations!`;
    viewLibraryBtn.style.display = 'block';

    // Save settings
    await chrome.runtime.sendMessage({
      type: 'updateSettings',
      data: { totalChatsImported: totalImported, lastSync: Date.now() }
    });

    console.log('[Popup] Import complete:', platformResults);

  } catch (error) {
    console.error('[Popup] Import error:', error);
    statusTextEl.textContent = 'Import failed: ' + error.message;
  }
}

/**
 * Import from platform with parallel tab processing
 * @param {string} platform - Platform name (chatgpt, claude, gemini)
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<number>} Number of imported conversations
 */
async function importFromPlatformParallel(platform, onProgress) {
  console.log(`[Popup] Starting parallel import from ${platform}`);

  try {
    // Step 1: Get or create tab for platform
    const platformTab = await getOrCreatePlatformTab(platform);

    if (!platformTab) {
      console.warn(`[Popup] Could not access ${platform} tab`);
      return 0;
    }

    // Step 2: Extract conversation list from sidebar
    console.log(`[Popup] Extracting conversation list from ${platform}...`);
    const conversations = await extractConversationList(platformTab.id, platform);

    if (!conversations || conversations.length === 0) {
      console.log(`[Popup] No conversations found on ${platform}`);
      return 0;
    }

    console.log(`[Popup] Found ${conversations.length} conversations on ${platform}`);

    // Step 3: Split into batches of MAX_PARALLEL_TABS
    const batches = [];
    for (let i = 0; i < conversations.length; i += MAX_PARALLEL_TABS) {
      batches.push(conversations.slice(i, i + MAX_PARALLEL_TABS));
    }

    console.log(`[Popup] Processing ${batches.length} batches for ${platform}`);

    // Step 4: Process each batch in parallel
    const allChats = [];
    const allFailedConversations = [];
    let processed = 0;

    for (const batch of batches) {
      const { successfulChats, failedConversations } = await processBatchParallel(batch);
      allChats.push(...successfulChats);
      allFailedConversations.push(...failedConversations);
      processed += batch.length;

      // Update progress
      onProgress(processed, conversations.length);

      // Small delay between batches
      if (processed < conversations.length) {
        await delay(BATCH_DELAY);
      }
    }

    // Step 5: Retry failed conversations automatically
    if (allFailedConversations.length > 0) {
      console.log(`[Popup] Retrying ${allFailedConversations.length} failed conversations...`);
      const retriedChats = await retryFailedConversations(allFailedConversations);
      allChats.push(...retriedChats);
    }

    // Step 6: Batch save all chats
    if (allChats.length > 0) {
      console.log(`[Popup] Batch saving ${allChats.length} chats from ${platform}`);
      await chrome.runtime.sendMessage({
        type: 'batchSaveChats',
        data: allChats
      });
    }

    return allChats.length;

  } catch (error) {
    console.error(`[Popup] Error importing from ${platform}:`, error);
    return 0;
  }
}

/**
 * Process batch of conversations in parallel
 * @param {Array} conversationBatch - Array of conversation metadata
 * @returns {Promise<Object>} Object with successfulChats and failedConversations arrays
 */
async function processBatchParallel(conversationBatch) {
  console.log(`[Popup] Processing batch of ${conversationBatch.length} conversations`);

  // Create array of promises
  const promises = conversationBatch.map(conv => extractConversationInNewTab(conv));

  // Use Promise.allSettled to handle failures gracefully
  const results = await Promise.allSettled(promises);

  // Separate successful and failed extractions
  const successfulChats = [];
  const failedConversations = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value !== null) {
      successfulChats.push(result.value);
    } else {
      // Track the failed conversation metadata for retry
      failedConversations.push(conversationBatch[index]);
    }
  });

  console.log(`[Popup] Batch complete: ${successfulChats.length}/${conversationBatch.length} successful`);

  return { successfulChats, failedConversations };
}

/**
 * Retry failed conversations sequentially with longer timeouts
 * @param {Array} failedConversations - Array of failed conversation metadata
 * @returns {Promise<Array>} Array of successfully recovered conversations
 */
async function retryFailedConversations(failedConversations) {
  if (failedConversations.length === 0) {
    return [];
  }

  console.log(`[Popup] Retrying ${failedConversations.length} failed conversations (sequential, longer timeouts)...`);

  const retryConfig = {
    TAB_TIMEOUT: 10000,           // 10s timeout for retry
    DYNAMIC_CONTENT_DELAY: 4000,  // 4s delay for retry
    EXTRACTION_TIMEOUT: 60000     // 60s extraction timeout for retry
  };

  const retriedChats = [];

  // Process sequentially to avoid overwhelming the browser
  for (const conversation of failedConversations) {
    let tabId = null;

    try {
      console.log(`[Popup] Retrying: ${conversation.title}`);

      // Create background tab
      const tab = await chrome.tabs.create({
        url: conversation.url,
        active: false
      });

      tabId = tab.id;

      // Wait for tab to load with longer timeout
      await waitForTabLoad(tabId, retryConfig.TAB_TIMEOUT);

      // Wait longer for dynamic content
      await delay(retryConfig.DYNAMIC_CONTENT_DELAY);

      // Inject content script
      const injected = await injectContentScript(tabId, conversation.platform);
      if (!injected) {
        console.warn(`[Popup] Retry failed - injection failed: ${conversation.title}`);
        continue;
      }

      // Extract with longer timeout
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, {
          action: 'extractCurrentConversation'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Extraction timeout')), retryConfig.EXTRACTION_TIMEOUT)
        )
      ]).catch(error => {
        console.warn(`[Popup] Retry extraction error for ${conversation.title}:`, error.message);
        return null;
      });

      if (response && response.success) {
        console.log(`[Popup] Retry successful: ${response.data.title}`);
        retriedChats.push(response.data);
      } else {
        console.warn(`[Popup] Retry failed: ${conversation.title}`);
      }

    } catch (error) {
      console.error(`[Popup] Retry error for ${conversation.title}:`, error);
    } finally {
      // Close tab
      if (tabId) {
        try {
          await Promise.race([
            chrome.tabs.remove(tabId),
            new Promise((resolve) => setTimeout(resolve, 2000))
          ]);
        } catch (error) {
          console.warn(`[Popup] Error closing retry tab ${tabId}:`, error);
        }
      }

      // Small delay between retries
      await delay(1000);
    }
  }

  console.log(`[Popup] Retry complete: ${retriedChats.length}/${failedConversations.length} recovered`);

  return retriedChats;
}

/**
 * Extract conversation in a new background tab
 * @param {Object} conversation - Conversation metadata
 * @returns {Promise<Object|null>} Extracted conversation or null
 */
async function extractConversationInNewTab(conversation) {
  let tabId = null;

  try {
    console.log(`[Popup] Opening tab for: ${conversation.title}`);

    // Create background tab
    const tab = await chrome.tabs.create({
      url: conversation.url,
      active: false  // Don't interrupt user
    });

    tabId = tab.id;

    // Wait for tab to load
    await waitForTabLoad(tabId, TAB_TIMEOUT);

    // Wait for dynamic content
    await delay(DYNAMIC_CONTENT_DELAY);

    // Inject content script
    const injected = await injectContentScript(tabId, conversation.platform);
    if (!injected) {
      console.warn(`[Popup] Skipping ${conversation.title} - injection failed`);
      return null;
    }

    // Send message to content script to extract conversation
    // IMPORTANT: This is an async operation that may take 10+ seconds
    // Add timeout to prevent hanging indefinitely
    const EXTRACTION_TIMEOUT = 30000; // 30 seconds max per extraction (increased for large conversations)

    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, {
        action: 'extractCurrentConversation'
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Extraction timeout')), EXTRACTION_TIMEOUT)
      )
    ]).catch(error => {
      console.warn(`[Popup] Extraction error for ${conversation.title}:`, error.message);
      return null;
    });

    if (response && response.success) {
      console.log(`[Popup] Extracted: ${response.data.title}`);
      return response.data;
    } else {
      console.warn(`[Popup] Failed to extract: ${conversation.title}`);
      return null;
    }

  } catch (error) {
    console.error(`[Popup] Error extracting conversation:`, error);
    return null;
  } finally {
    // ALWAYS close tab in finally block with timeout to prevent hanging
    if (tabId) {
      try {
        // Wrap tab removal in timeout to prevent batch from hanging
        await Promise.race([
          chrome.tabs.remove(tabId),
          new Promise((resolve) => setTimeout(resolve, 2000)) // 2s timeout for tab removal
        ]);
      } catch (error) {
        console.warn(`[Popup] Error closing tab ${tabId}:`, error);
      }
    }
  }
}

/**
 * Wait for tab to finish loading
 * @param {number} tabId - Tab ID
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
function waitForTabLoad(tabId, timeout) {
  return new Promise((resolve) => {
    let timeoutId;
    let listener;

    // Timeout fallback - resolve anyway, don't block
    timeoutId = setTimeout(() => {
      if (listener) {
        chrome.tabs.onUpdated.removeListener(listener);
      }
      console.log(`[Popup] Tab ${tabId} load timeout`);
      resolve();
    }, timeout);

    // Listen for tab updates
    listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        console.log(`[Popup] Tab ${tabId} loaded`);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Inject content script into a tab with retry logic
 * @param {number} tabId - Tab ID
 * @param {string} platform - Platform name
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function injectContentScript(tabId, platform, retryCount = 0) {
  const MAX_RETRIES = 1;
  const RETRY_DELAY = 1000;

  try {
    const scriptFile = `content-scripts/${platform}-scraper.js`;
    console.log(`[Popup] Injecting ${scriptFile} into tab ${tabId}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile]
    });

    // Wait a bit for script to initialize (increased for stability)
    await delay(800);

    console.log(`[Popup] Content script injected successfully`);
    return true;
  } catch (error) {
    const errorMsg = error.message || String(error);

    // Check if this is a transient error that might succeed on retry
    const isTransientError =
      errorMsg.includes('Frame') ||
      errorMsg.includes('was removed') ||
      errorMsg.includes('Connection') ||
      errorMsg.includes('Receiving end does not exist');

    // Retry logic for transient errors
    if (isTransientError && retryCount < MAX_RETRIES) {
      console.warn(`[Popup] Transient injection error, retrying in ${RETRY_DELAY}ms...`);
      await delay(RETRY_DELAY);
      return injectContentScript(tabId, platform, retryCount + 1);
    }

    // Error pages, invalid tabs, permanent errors - log and return false
    console.warn(`[Popup] Could not inject content script into tab ${tabId}:`, errorMsg);
    return false;
  }
}

/**
 * Get or create tab for platform
 * @param {string} platform - Platform name
 * @returns {Promise<Tab|null>} Chrome tab object
 */
async function getOrCreatePlatformTab(platform) {
  try {
    const platformConfig = PLATFORMS[platform];
    if (!platformConfig) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    // Check if tab already exists
    let tabs = await chrome.tabs.query({ url: `${platformConfig.baseUrl}/*` });

    // For ChatGPT, also check old URL
    if (platform === 'chatgpt' && tabs.length === 0) {
      tabs = await chrome.tabs.query({ url: 'https://chat.openai.com/*' });
    }

    if (tabs.length > 0) {
      console.log(`[Popup] Using existing ${platform} tab`);
      // Inject content script into existing tab
      await injectContentScript(tabs[0].id, platform);
      return tabs[0];
    }

    // Create new tab
    console.log(`[Popup] Creating new ${platform} tab`);
    const tab = await chrome.tabs.create({
      url: platformConfig.baseUrl,
      active: false
    });

    // Wait for it to load
    await waitForTabLoad(tab.id, 10000);
    await delay(1000); // Wait for platform to initialize

    // Inject content script
    await injectContentScript(tab.id, platform);

    return tab;

  } catch (error) {
    console.error(`[Popup] Error getting/creating ${platform} tab:`, error);
    return null;
  }
}

/**
 * Extract conversation list from platform tab
 * @param {number} tabId - Tab ID
 * @param {string} platform - Platform name
 * @returns {Promise<Array>} Array of conversation metadata
 */
async function extractConversationList(tabId, platform) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'extractConversations'
    });

    if (response && response.success) {
      return response.data;
    } else {
      console.error(`[Popup] Failed to extract conversation list from ${platform}`);
      return [];
    }
  } catch (error) {
    console.error(`[Popup] Error extracting conversation list:`, error);
    return [];
  }
}

/**
 * Update progress bar
 * @param {number} percent - Progress percentage (0-100)
 */
function updateProgress(percent) {
  progressFillEl.style.width = `${percent}%`;
}

/**
 * Simple delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Summarize all unprocessed chats
 * Runs in popup context (has access to AI Summarizer API)
 *
 * @param {Function} onProgress - Progress callback (current, total, message)
 * @returns {Promise<number>} Number of chats successfully summarized
 */
async function summarizeChats(onProgress) {
  console.log('[Popup] Starting chat summarization');

  try {
    // Get all chats from storage
    const response = await chrome.runtime.sendMessage({ type: 'getAllChats' });
    if (!response.success) {
      throw new Error('Failed to get chats from storage');
    }

    const chats = response.data;

    if (chats.length === 0) {
      console.log('[Popup] No chats to process');
      return 0;
    }

    // Filter only unprocessed chats
    const unprocessedChats = chats.filter(chat => !chat.processed || !chat.chatSummary);

    console.log(`[Popup] Found ${unprocessedChats.length} unprocessed chats`);

    if (unprocessedChats.length === 0) {
      console.log('[Popup] All chats already processed');
      return 0;
    }

    // Process each unprocessed chat
    let processedCount = 0;

    for (const chat of unprocessedChats) {
      try {
        if (onProgress) {
          onProgress(processedCount, unprocessedChats.length, `Summarizing "${chat.title.substring(0, 30)}..."`);
        }

        console.log(`[Popup] Processing chat ${processedCount + 1}/${unprocessedChats.length}: ${chat.title}`);

        // Skip if no messages
        if (!chat.messages || chat.messages.length === 0) {
          console.log(`[Popup] Skipping chat ${chat.id} - no messages`);
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

        console.log(`[Popup] Found ${messagePairs.length} message pairs in chat ${chat.id}`);

        // Skip if no valid pairs
        if (messagePairs.length === 0) {
          console.log(`[Popup] Skipping chat ${chat.id} - no valid message pairs`);
          continue;
        }

        // STEP 2: Summarize each message pair
        const pairSummaries = [];
        for (let i = 0; i < messagePairs.length; i++) {
          const pair = messagePairs[i];
          console.log(`[Popup] Summarizing pair ${i + 1}/${messagePairs.length} for chat ${chat.id}`);

          try {
            const pairSummary = await AIService.summarizeMessagePair(pair.user, pair.assistant);
            pairSummaries.push(pairSummary);
            console.log(`[Popup] Pair ${i + 1} summary: ${pairSummary.substring(0, 60)}...`);
          } catch (error) {
            console.error(`[Popup] Error summarizing pair ${i + 1}:`, error);
            // Use fallback summary
            pairSummaries.push(`Discussion: ${pair.user.substring(0, 50)}...`);
          }
        }

        // STEP 3: Generate overall chat summary from pair summaries
        console.log(`[Popup] Generating overall summary for chat ${chat.id}`);
        let chatSummary;
        try {
          chatSummary = await AIService.summarizeChat(pairSummaries, chat.title);
          console.log(`[Popup] Chat summary: ${chatSummary.substring(0, 100)}...`);
        } catch (error) {
          console.error(`[Popup] Error generating chat summary:`, error);
          // Use first pair summary as fallback
          chatSummary = pairSummaries[0] || chat.title || 'Summary unavailable';
        }

        // STEP 4: Update chat with summaries via service worker
        await chrome.runtime.sendMessage({
          type: 'updateChat',
          data: {
            chatId: chat.id,
            updates: {
              messagePairSummaries: pairSummaries,
              chatSummary: chatSummary,
              processed: true
            }
          }
        });

        processedCount++;
        console.log(`[Popup] Chat ${processedCount}/${unprocessedChats.length} processed successfully`);

      } catch (error) {
        console.error(`[Popup] Error processing chat ${chat.id}:`, error);
        // Continue with next chat instead of failing entirely
        continue;
      }
    }

    console.log(`[Popup] Successfully summarized ${processedCount}/${unprocessedChats.length} chats`);
    return processedCount;

  } catch (error) {
    console.error('[Popup] Error in chat summarization:', error);
    throw error;
  }
}

/**
 * Generate label suggestions from chat summaries
 * Runs in popup context (has access to AI Prompt API)
 *
 * @param {Function} onProgress - Progress callback (current, total, message)
 * @returns {Promise<number>} Number of labels generated
 */
async function generateLabels(onProgress) {
  console.log('[Popup] Starting label generation from chat summaries');

  try {
    if (onProgress) {
      onProgress(0, 1, 'Loading chats with summaries...');
    }

    // Get all chats with summaries
    const response = await chrome.runtime.sendMessage({ type: 'getAllChats' });
    if (!response.success) {
      throw new Error('Failed to get chats from storage');
    }

    const allChats = response.data;
    const chatsWithSummaries = allChats.filter(chat => chat.chatSummary);

    console.log(`[Popup] Found ${chatsWithSummaries.length} chats with summaries`);

    if (chatsWithSummaries.length === 0) {
      console.warn('[Popup] No chats with summaries available for label generation');
      throw new Error('No chats with summaries found. Please run summarization first.');
    }

    if (onProgress) {
      onProgress(0, 1, 'Generating labels from summaries...');
    }

    // Generate labels using Prompt API (with batch processing)
    const labels = await AIService.generateLabelsFromChatSummaries(chatsWithSummaries);

    console.log('[Popup] Generated', labels.length, 'labels');

    if (onProgress) {
      onProgress(1, 1, 'Saving label suggestions...');
    }

    // Save labels via service worker
    for (const label of labels) {
      const suggestedLabel = {
        id: `suggested_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name: label.name,
        description: label.description,
        confidence: label.confidence,
        chatIds: label.conversationIds || [],
        dismissed: false
      };

      await chrome.runtime.sendMessage({
        type: 'saveSuggestedLabel',
        data: suggestedLabel
      });
      console.log('[Popup] Saved suggested label:', suggestedLabel.name);
    }

    console.log('[Popup] Label generation complete');
    return labels.length;

  } catch (error) {
    console.error('[Popup] Error generating labels:', error);
    throw error;
  }
}

/**
 * Handle summarization button click
 */
async function handleSummarizeChats() {
  console.log('[Popup] Starting chat summarization from library screen');

  try {
    // Disable button and show progress
    summarizeBtn.disabled = true;
    summarizeBtn.textContent = 'Summarizing...';
    summarizationProgress.style.display = 'block';
    summarizeProgressFill.style.width = '0%';
    summarizeStatusText.textContent = 'Initializing summarization...';

    // Run summarization
    const count = await summarizeChats((current, total, message) => {
      // Update progress
      const progress = (current / total) * 100;
      summarizeProgressFill.style.width = `${progress}%`;
      summarizeStatusText.textContent = message || `Summarizing ${current}/${total} chats...`;
    });

    // Success
    summarizeProgressFill.style.width = '100%';
    summarizeStatusText.textContent = `Successfully summarized ${count} chats!`;

    // Wait a moment then hide progress and refresh library
    setTimeout(async () => {
      summarizationProgress.style.display = 'none';
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = 'Summarize Chats';
      await loadLibrary();
    }, 2000);

  } catch (error) {
    console.error('[Popup] Summarization error:', error);
    summarizeStatusText.textContent = 'Error: ' + error.message;
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = 'Summarize Chats';

    // Show error for 5 seconds then hide
    setTimeout(() => {
      summarizationProgress.style.display = 'none';
    }, 5000);
  }
}

/**
 * Handle label generation button click
 */
async function handleGenerateLabels() {
  console.log('[Popup] Starting label generation from library screen');

  try {
    // Disable button and show progress
    generateLabelsBtn.disabled = true;
    generateLabelsBtn.textContent = 'Generating...';
    labelGenerationProgress.style.display = 'block';
    labelProgressFill.style.width = '0%';
    labelStatusText.textContent = 'Initializing label generation...';

    // Run label generation
    const count = await generateLabels((current, total, message) => {
      // Update progress
      const progress = (current / total) * 100;
      labelProgressFill.style.width = `${progress}%`;
      labelStatusText.textContent = message || `Generating labels...`;
    });

    // Success
    labelProgressFill.style.width = '100%';
    labelStatusText.textContent = `Successfully generated ${count} label suggestions!`;

    // Wait a moment then hide progress and refresh library
    setTimeout(async () => {
      labelGenerationProgress.style.display = 'none';
      generateLabelsBtn.disabled = false;
      generateLabelsBtn.textContent = 'Generate Labels';
      await loadLibrary();
    }, 2000);

  } catch (error) {
    console.error('[Popup] Label generation error:', error);
    labelStatusText.textContent = 'Error: ' + error.message;
    generateLabelsBtn.disabled = false;
    generateLabelsBtn.textContent = 'Generate Labels';

    // Show error for 5 seconds then hide
    setTimeout(() => {
      labelGenerationProgress.style.display = 'none';
    }, 5000);
  }
}

/**
 * Load library screen data
 */
async function loadLibrary() {
  try {
    // Load all chats first to check button visibility
    await loadAllChats();

    // Get chat processing state to determine which buttons to show
    const response = await chrome.runtime.sendMessage({ type: 'getAllChats' });
    if (response.success) {
      const chats = Object.values(response.data);
      const unprocessedChats = chats.filter(chat => !chat.processed || !chat.chatSummary);
      const processedChats = chats.filter(chat => chat.processed && chat.chatSummary);

      console.log(`[Popup] Chat state: ${unprocessedChats.length} unprocessed, ${processedChats.length} processed`);

      // Show summarization section if there are unprocessed chats
      if (unprocessedChats.length > 0) {
        summarizationSection.style.display = 'block';
        // Update button text to show count
        const baseText = 'Summarize Chats';
        summarizeBtn.textContent = `${baseText} (${unprocessedChats.length})`;
      } else {
        summarizationSection.style.display = 'none';
      }

      // Show label generation section if there are processed chats
      if (processedChats.length > 0) {
        labelGenerationSection.style.display = 'block';
        // Update button text to show count
        const baseText = 'Generate Labels';
        generateLabelsBtn.textContent = `${baseText} (${processedChats.length} chats)`;
      } else {
        labelGenerationSection.style.display = 'none';
      }
    }

    // Load suggested labels
    const suggestedResponse = await chrome.runtime.sendMessage({ type: 'getAllSuggestedLabels' });
    if (suggestedResponse.success) {
      const suggestedLabels = Object.values(suggestedResponse.data).filter(label => !label.dismissed);
      suggestedBadge.textContent = suggestedLabels.length;
      renderSuggestedLabels(suggestedLabels);
    }

    // Load user labels
    const labelsResponse = await chrome.runtime.sendMessage({ type: 'getAllLabels' });
    if (labelsResponse.success) {
      const labels = Object.values(labelsResponse.data);
      renderLabels(labels);
    }

  } catch (error) {
    console.error('[Popup] Error loading library:', error);
  }
}

/**
 * Load all chats
 */
async function loadAllChats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getAllChats' });

    if (response.success) {
      const chats = Object.values(response.data);

      // Sort by date (newest first)
      chats.sort((a, b) => b.date - a.date);

      // Update badge
      allChatsBadge.textContent = chats.length;

      // Store chats globally for filtering
      window.allChats = chats;

      // Render all chats initially
      renderChatList(chats);
    }
  } catch (error) {
    console.error('[Popup] Error loading chats:', error);
  }
}

/**
 * Render chat list
 * @param {Array} chats - Array of chat objects
 */
function renderChatList(chats) {
  if (chats.length === 0) {
    chatList.innerHTML = '<div class="empty-state"><p>No conversations yet. Import chats to see them here.</p></div>';
    return;
  }

  chatList.innerHTML = chats.map(chat => {
    const messageCount = chat.messages ? chat.messages.length : 0;
    const date = new Date(chat.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `
      <div class="chat-item" data-id="${chat.id}" data-platform="${chat.platform}">
        <div class="chat-item-header">
          <span class="chat-platform-badge ${chat.platform}">${PLATFORMS[chat.platform].name}</span>
          <span class="chat-item-title">${chat.title}</span>
          <button class="chat-item-link-btn" data-url="${chat.url}" title="Open original chat">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor">
              <path d="M9 6.5V9.5C9 9.77614 8.77614 10 8.5 10H2.5C2.22386 10 2 9.77614 2 9.5V3.5C2 3.22386 2.22386 3 2.5 3H5.5" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M7 2H10M10 2V5M10 2L6 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="chat-item-meta">
          <span class="chat-item-messages">${messageCount} messages</span>
          <span class="chat-item-date">${date}</span>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for "View Original" buttons
  const linkButtons = chatList.querySelectorAll('.chat-item-link-btn');
  linkButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent chat item click
      const url = btn.getAttribute('data-url');
      if (url) {
        chrome.tabs.create({ url, active: true });
      }
    });
  });
}

/**
 * Filter chats by platform
 * @param {string} platform - Platform name or 'all'
 */
function filterChats(platform) {
  if (!window.allChats) {
    return;
  }

  let filteredChats;

  if (platform === 'all') {
    filteredChats = window.allChats;
  } else {
    filteredChats = window.allChats.filter(chat => chat.platform === platform);
  }

  renderChatList(filteredChats);
}

/**
 * Render suggested labels
 */
function renderSuggestedLabels(labels) {
  if (labels.length === 0) {
    suggestedList.innerHTML = '<div class="empty-state"><p>No suggestions yet. Run AI processing to generate label suggestions.</p></div>';
    clearSuggestedBtn.style.display = 'none';
    return;
  }

  // Show clear button when there are suggested labels
  clearSuggestedBtn.style.display = 'inline-flex';

  suggestedList.innerHTML = labels.map(label => `
    <div class="label-item suggested" data-id="${label.id}">
      <div class="label-content">
        <h3>${label.name}</h3>
        <p>${label.description}</p>
        <span class="badge-small">${label.chatIds.length} chats</span>
      </div>
      <div class="label-actions">
        <button class="btn btn-small btn-accept" data-label-id="${label.id}">Accept</button>
        <button class="btn btn-small btn-dismiss" data-label-id="${label.id}">Dismiss</button>
      </div>
    </div>
  `).join('');

  // Add event listeners for accept/dismiss buttons
  suggestedList.querySelectorAll('.btn-accept').forEach(btn => {
    btn.addEventListener('click', () => {
      const labelId = btn.getAttribute('data-label-id');
      acceptLabel(labelId);
    });
  });

  suggestedList.querySelectorAll('.btn-dismiss').forEach(btn => {
    btn.addEventListener('click', () => {
      const labelId = btn.getAttribute('data-label-id');
      dismissLabel(labelId);
    });
  });
}

/**
 * Render user labels
 */
function renderLabels(labels) {
  if (labels.length === 0) {
    labelList.innerHTML = '<div class="empty-state"><p>Your curated labels will appear here.</p></div>';
    clearAcceptedBtn.style.display = 'none';
    return;
  }

  // Show clear button when there are accepted labels
  clearAcceptedBtn.style.display = 'inline-flex';

  labelList.innerHTML = labels.map(label => `
    <div class="label-item clickable" data-id="${label.id}">
      <div class="label-content">
        <h3>${label.name}</h3>
        <span class="badge-small">${label.chatIds.length} chats</span>
      </div>
      <svg class="label-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <path d="M7 4L13 10L7 16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `).join('');

  // Add click listeners to navigate to label detail page
  labelList.querySelectorAll('.label-item').forEach(item => {
    item.addEventListener('click', () => {
      const labelId = item.getAttribute('data-id');
      openLabelDetail(labelId);
    });
  });
}

/**
 * Accept suggested label
 */
window.acceptLabel = async function(labelId) {
  try {
    await chrome.runtime.sendMessage({
      type: 'acceptSuggestedLabel',
      data: { labelId }
    });
    loadLibrary();
  } catch (error) {
    console.error('[Popup] Error accepting label:', error);
  }
};

/**
 * Dismiss suggested label
 */
window.dismissLabel = async function(labelId) {
  try {
    await chrome.runtime.sendMessage({
      type: 'dismissSuggestedLabel',
      data: { labelId }
    });
    loadLibrary();
  } catch (error) {
    console.error('[Popup] Error dismissing label:', error);
  }
};

/**
 * Handle clear suggested labels
 */
async function handleClearSuggestedLabels() {
  const confirmed = confirm('Clear all suggested labels?\n\nThis will remove all AI-generated label suggestions. You can regenerate them later.');

  if (!confirmed) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'clearSuggestedLabels' });
    console.log('[Popup] Suggested labels cleared');
    await loadLibrary();
  } catch (error) {
    console.error('[Popup] Error clearing suggested labels:', error);
    alert('Error clearing suggested labels: ' + error.message);
  }
}

/**
 * Handle clear accepted labels
 */
async function handleClearAcceptedLabels() {
  const confirmed = confirm('Clear all accepted labels?\n\nThis will delete all your curated labels and remove label references from chats.\n\nThis action cannot be undone.');

  if (!confirmed) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'clearAcceptedLabels' });
    console.log('[Popup] Accepted labels cleared');
    await loadLibrary();
  } catch (error) {
    console.error('[Popup] Error clearing accepted labels:', error);
    alert('Error clearing accepted labels: ' + error.message);
  }
}

/**
 * Open label view screen
 */
async function openLabelDetail(labelId) {
  showScreen('label');
  await loadLabelView(labelId);
}

// Global state for label view
let currentLabelId = null;
let currentLabelChats = [];

/**
 * Load label view screen
 */
async function loadLabelView(labelId) {
  try {
    console.log('[Popup] Loading label view:', labelId);
    currentLabelId = labelId;

    // Get label from storage
    const label = await StorageService.getLabel(labelId);

    if (!label) {
      throw new Error('Label not found');
    }

    // Update header
    labelViewName.textContent = label.name;
    labelViewChatCount.textContent = `${label.chatIds.length} chat${label.chatIds.length !== 1 ? 's' : ''}`;

    // Load chats
    currentLabelChats = [];
    for (const chatId of label.chatIds) {
      const chat = await StorageService.getChat(chatId);
      if (chat) {
        currentLabelChats.push(chat);
      }
    }

    // Sort by date (newest first)
    currentLabelChats.sort((a, b) => b.date - a.date);

    // Load summary if exists
    if (label.summary) {
      summaryContent.innerHTML = `<p>${label.summary}</p>`;
    } else {
      summaryContent.innerHTML = `<p class="summary-placeholder">Click "Generate Summary" to create an aggregated summary from all conversations in this label.</p>`;
    }

    // Reset to summary tab
    switchTab('summary');

    // Render chat list (will be shown when user clicks Chat List tab)
    renderLabelChatList(currentLabelChats);

    console.log('[Popup] Label view loaded successfully');
  } catch (error) {
    console.error('[Popup] Error loading label view:', error);
    labelViewName.textContent = 'Error loading label';
    summaryContent.innerHTML = `<p class="summary-placeholder" style="color: #ef4444;">Error: ${error.message}</p>`;
  }
}

/**
 * Switch tabs in label view
 */
function switchTab(tabName) {
  // Update button styles
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Show/hide panels
  const panels = {
    summary: document.getElementById('summaryTab'),
    chatlist: document.getElementById('chatlistTab'),
    mindmap: document.getElementById('mindmapTab'),
    quiz: document.getElementById('quizTab')
  };

  Object.keys(panels).forEach(key => {
    if (key === tabName) {
      panels[key].classList.add('active');
    } else {
      panels[key].classList.remove('active');
    }
  });

  console.log('[Popup] Switched to tab:', tabName);
}

/**
 * Render chat list in label view
 */
function renderLabelChatList(chats) {
  if (chats.length === 0) {
    labelChatList.innerHTML = '<div class="empty-state"><p>No conversations match this filter.</p></div>';
    return;
  }

  labelChatList.innerHTML = chats.map(chat => {
    const messageCount = chat.messages ? chat.messages.length : 0;
    const date = new Date(chat.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const summary = chat.chatSummary || 'No summary available';

    return `
      <div class="chat-item" data-id="${chat.id}" data-platform="${chat.platform}">
        <div class="chat-item-header">
          <span class="chat-platform-badge ${chat.platform}">${PLATFORMS[chat.platform].name}</span>
          <span class="chat-item-title">${chat.title}</span>
          <button class="chat-item-link-btn" data-url="${chat.url}" title="Open original chat">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor">
              <path d="M9 6.5V9.5C9 9.77614 8.77614 10 8.5 10H2.5C2.22386 10 2 9.77614 2 9.5V3.5C2 3.22386 2.22386 3 2.5 3H5.5" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M7 2H10M10 2V5M10 2L6 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="chat-item-summary">${summary.substring(0, 150)}${summary.length > 150 ? '...' : ''}</div>
        <div class="chat-item-meta">
          <span class="chat-item-messages">${messageCount} messages</span>
          <span class="chat-item-date">${date}</span>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for link buttons
  const linkButtons = labelChatList.querySelectorAll('.chat-item-link-btn');
  linkButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.getAttribute('data-url');
      if (url) {
        chrome.tabs.create({ url, active: true });
      }
    });
  });
}

/**
 * Filter label chats by platform
 */
function filterLabelChats(platform) {
  if (platform === 'all') {
    renderLabelChatList(currentLabelChats);
  } else {
    const filtered = currentLabelChats.filter(chat => chat.platform === platform);
    renderLabelChatList(filtered);
  }
}

/**
 * Handle generate label summary
 */
async function handleGenerateLabelSummary() {
  console.log('[Popup] Generating label summary...');

  try {
    // Disable button
    generateSummaryBtn.disabled = true;
    generateSummaryBtn.textContent = 'Generating...';

    // Collect all chat summaries
    const chatSummaries = currentLabelChats
      .filter(chat => chat.chatSummary)
      .map(chat => chat.chatSummary);

    if (chatSummaries.length === 0) {
      throw new Error('No chat summaries available. Please run summarization first.');
    }

    // Show loading state
    summaryContent.innerHTML = `<p class="summary-placeholder">Generating aggregated summary from ${chatSummaries.length} conversations...</p>`;

    // Simple aggregation (combine and truncate for now)
    // TODO: Use AI to create better aggregated summary
    const combinedText = chatSummaries.join(' ');
    const aggregatedSummary = `This label contains ${currentLabelChats.length} conversations covering: ${combinedText.substring(0, 500)}${combinedText.length > 500 ? '...' : ''}`;

    summaryContent.innerHTML = `<p>${aggregatedSummary}</p>`;

    // Save summary to label
    await StorageService.updateLabel(currentLabelId, {
      summary: aggregatedSummary
    });

    console.log('[Popup] Summary generated successfully');

  } catch (error) {
    console.error('[Popup] Error generating summary:', error);
    summaryContent.innerHTML = `<p class="summary-placeholder" style="color: #ef4444;">Error: ${error.message}</p>`;
  } finally {
    // Re-enable button
    generateSummaryBtn.disabled = false;
    generateSummaryBtn.innerHTML = `
      <svg class="btn-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
        <path d="M7 1v12M1 7h12" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Generate Summary
    `;
  }
}

/**
 * Handle create label
 */
function handleCreateLabel() {
  alert('Create new label functionality coming in Module 4!');
}

/**
 * Handle settings
 */
function handleSettings() {
  alert('Settings panel coming soon!');
}

/**
 * Handle clear data
 */
async function handleClearData() {
  const confirmed = confirm('Are you sure you want to clear all data?\n\nThis will delete:\n- All imported chats\n- All labels\n- All suggested labels\n- All settings\n\nThis action cannot be undone.');

  if (!confirmed) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'clearAllData' });
    console.log('[Popup] All data cleared');
    showScreen('welcome');
    alert('All data cleared successfully.');
  } catch (error) {
    console.error('[Popup] Error clearing data:', error);
    alert('Error clearing data: ' + error.message);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
