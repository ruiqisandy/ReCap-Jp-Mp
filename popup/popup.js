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
const chatgptLimitSelect = document.getElementById('chatgptLimitSelect');
const claudeLimitSelect = document.getElementById('claudeLimitSelect');
const geminiLimitSelect = document.getElementById('geminiLimitSelect');

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
const bulletpointsContent = document.getElementById('bulletpointsContent');
const generateBulletPointsBtn = document.getElementById('generateBulletPointsBtn');
const labelWorkflowScreen = document.getElementById('labelWorkflowScreen');
const backToLibraryFromWorkflowBtn = document.getElementById('backToLibraryFromWorkflowBtn');

// Summarization section
const summarizationSection = document.getElementById('summarizationSection');
const summarizeBtn = document.getElementById('summarizeBtn');
const summarizationProgress = document.getElementById('summarizationProgress');
const summarizeProgressFill = document.getElementById('summarizeProgressFill');
const summarizeStatusText = document.getElementById('summarizeStatusText');
const summarizeHeading = document.getElementById('summarizeHeading');
const summarizeActionLabel = document.getElementById('summarizeActionLabel');
const summarizeCount = document.getElementById('summarizeCount');

// Label generation section
const labelGenerationSection = document.getElementById('labelGenerationSection');
const generateLabelsBtn = document.getElementById('generateLabelsBtn');
const labelGenerationTitle = document.getElementById('labelGenerationTitle');
const labelGenerationSubtitle = document.getElementById('labelGenerationSubtitle');
const labelGenerationProgress = document.getElementById('labelGenerationProgress');
const labelProgressFill = document.getElementById('labelProgressFill');
const labelStatusText = document.getElementById('labelStatusText');

// Preferred labels section
const preferredLabelsSection = document.getElementById('preferredLabelsSection');
const preferredLabelsList = document.getElementById('preferredLabelsList');
const addPreferredLabelBtn = document.getElementById('addPreferredLabelBtn');
const savePreferredLabelsBtn = document.getElementById('savePreferredLabelsBtn');
const continueWithoutPreferencesBtn = document.getElementById('continueWithoutPreferencesBtn');
const preferredLabelsStatus = document.getElementById('preferredLabelsStatus');
const toastEl = document.getElementById('toast');

// Label lists
const suggestedBadge = document.getElementById('suggestedBadge');
const suggestedList = document.getElementById('suggestedList');
const clearSuggestedBtn = document.getElementById('clearSuggestedBtn');
const createLabelBtn = document.getElementById('createLabelBtn');
const labelList = document.getElementById('labelList');
const clearAcceptedBtn = document.getElementById('clearAcceptedBtn');

// Library actions menu
const libraryDangerToggle = document.getElementById('libraryDangerToggle');
const libraryDangerMenu = document.getElementById('libraryDangerMenu');
const dropSummariesOption = document.getElementById('dropSummariesOption');
const deleteDataOption = document.getElementById('deleteDataOption');
const libraryDangerWrapper = libraryDangerToggle ? libraryDangerToggle.closest('.library-danger') : null;

// Chat list
const summarizedBadge = document.getElementById('summarizedBadge');
const unsummarizedBadge = document.getElementById('unsummarizedBadge');
const summarizedList = document.getElementById('summarizedList');
const unsummarizedList = document.getElementById('unsummarizedList');
const libraryViewElements = Array.from(document.querySelectorAll('.library-view'));
const libraryTabButtons = Array.from(document.querySelectorAll('.library-tab'));

// Summarization state
let isSummarizingChats = false;
let summarizeCancelRequested = false;
let currentLibraryView = 'library';
const libraryViewScrollPositions = {
  library: 0,
  summarized: 0,
  unsummarized: 0
};

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
  if (labelWorkflowScreen) {
    labelWorkflowScreen.style.display = 'none';
  }

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
      switchLibraryView(currentLibraryView, { force: true });
      break;
    case 'workflow':
      if (labelWorkflowScreen) {
        labelWorkflowScreen.style.display = 'flex';
      }
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
  clearSuggestedBtn.addEventListener('click', handleClearSuggestedLabels);
  createLabelBtn.addEventListener('click', handleCreateLabel);
  clearAcceptedBtn.addEventListener('click', handleClearAcceptedLabels);

  if (libraryDangerToggle && libraryDangerMenu && libraryDangerWrapper) {
    libraryDangerToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = libraryDangerWrapper.classList.contains('open');
      closeLibraryDangerMenu();
      if (!isOpen) {
        openLibraryDangerMenu();
      }
    });
  }
  if (dropSummariesOption) {
    dropSummariesOption.addEventListener('click', async (event) => {
      event.stopPropagation();
      closeLibraryDangerMenu();
      await handleDropSummaries();
    });
  }
  if (deleteDataOption) {
    deleteDataOption.addEventListener('click', async (event) => {
      event.stopPropagation();
      closeLibraryDangerMenu();
      await handleClearData();
    });
  }
  if (libraryDangerWrapper) {
    document.addEventListener('click', () => {
      closeLibraryDangerMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeLibraryDangerMenu();
      }
    });
  }

  if (libraryTabButtons.length > 0) {
    libraryTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.getAttribute('data-library-target');
        switchLibraryView(targetView);
      });
    });
  }

  if (addPreferredLabelBtn) {
    addPreferredLabelBtn.addEventListener('click', handleAddPreferredLabel);
  }
  if (savePreferredLabelsBtn) {
    savePreferredLabelsBtn.addEventListener('click', handleSavePreferredLabels);
  }
  if (continueWithoutPreferencesBtn) {
    continueWithoutPreferencesBtn.addEventListener('click', handleContinueWithoutPreferences);
  }
  if (preferredLabelsList) {
    preferredLabelsList.addEventListener('input', handlePreferredLabelsListInput);
    preferredLabelsList.addEventListener('click', handlePreferredLabelsListClick);
  }
  if (generateLabelsBtn) {
    generateLabelsBtn.addEventListener('click', handleGenerateLabels);
  }
  if (backToLibraryFromWorkflowBtn) {
    backToLibraryFromWorkflowBtn.addEventListener('click', handleWorkflowExit);
  }

  // Label View Screen
  backToLibraryBtn.addEventListener('click', () => {
    showScreen('library');
    loadLibrary();
  });
  generateSummaryBtn.addEventListener('click', handleGenerateLabelSummary);
  generateBulletPointsBtn.addEventListener('click', handleGenerateBulletPoints);

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
  document.querySelectorAll('.filter-buttons').forEach(group => {
    const context = group.getAttribute('data-filter-context') || 'unsummarized';
    const buttons = group.querySelectorAll('.filter-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilterForContext(context);
      });
    });
  });
}

/**
 * START IMPORT - Main orchestrator for parallel tab processing
 */
async function startImport() {
  console.log('[Popup] Starting import...');

  try {
    const chatgptLimit = getChatgptImportLimit();
    const claudeLimit = getClaudeImportLimit();
    const geminiLimit = getGeminiImportLimit();

    const platformConfigs = [
      { key: 'chatgpt', label: 'ChatGPT', limit: chatgptLimit, countEl: chatgptCountEl },
      { key: 'claude', label: 'Claude', limit: claudeLimit, countEl: claudeCountEl },
      { key: 'gemini', label: 'Gemini', limit: geminiLimit, countEl: geminiCountEl }
    ];

    const activePlatforms = platformConfigs.filter(config => config.limit > 0);

    if (activePlatforms.length === 0) {
      alert('Select at least one platform to import.');
      return;
    }

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
    const progressSlice = 100 / activePlatforms.length;
    let progressBase = 0;

    for (const config of activePlatforms) {
      const chatNoun = config.limit === 1 ? 'chat' : 'chats';
      statusTextEl.textContent = `Importing latest ${config.limit} ${chatNoun} from ${config.label}...`;

      const platformCount = await importFromPlatformParallel(config.key, (current, total) => {
        config.countEl.textContent = current;
        const progress = total > 0
          ? progressBase + ((current / total) * progressSlice)
          : progressBase;
        updateProgress(Math.min(progress, 100));
      }, config.limit);

      platformResults[config.key] = platformCount;
      totalImported += platformCount;
      config.countEl.textContent = String(platformCount);
      progressBase += progressSlice;
      updateProgress(Math.min(progressBase, 100));
      console.log(`[Popup] ${config.label} import complete:`, platformCount);
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
async function importFromPlatformParallel(platform, onProgress, limit) {
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
    let conversations = await extractConversationList(platformTab.id, platform);
    const totalAvailable = Array.isArray(conversations) ? conversations.length : 0;

    if (!conversations || totalAvailable === 0) {
      console.log(`[Popup] No conversations found on ${platform}`);
      return 0;
    }

    console.log(`[Popup] Found ${totalAvailable} conversations on ${platform}`);

    if (typeof limit === 'number') {
      if (limit <= 0) {
        console.log(`[Popup] Skipping ${platform} import (limit set to 0)`);
        return 0;
      }

      if (limit > 0 && totalAvailable > limit) {
        console.log(`[Popup] Limiting ${platform} import to latest ${limit} conversations`);
        conversations = conversations.slice(0, limit);
      }
    }

    console.log(`[Popup] Processing ${conversations.length} conversations on ${platform}`);

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
async function summarizeChats(onProgress, options = {}) {
  console.log('[Popup] Starting chat summarization');

  try {
    const shouldCancel = typeof options.shouldCancel === 'function'
      ? options.shouldCancel
      : () => false;

    // Get all chats from storage
    const response = await chrome.runtime.sendMessage({ type: 'getAllChats' });
    if (!response.success) {
      throw new Error('Failed to get chats from storage');
    }

    const chats = response.data;

    if (chats.length === 0) {
      console.log('[Popup] No chats to process');
      return { processedCount: 0, totalCount: 0, canceled: false };
    }

    // Filter only unprocessed chats
    const unprocessedChats = chats.filter(chat => !chat.processed || !chat.chatSummary);

    console.log(`[Popup] Found ${unprocessedChats.length} unprocessed chats`);

    if (unprocessedChats.length === 0) {
      console.log('[Popup] All chats already processed');
      return { processedCount: 0, totalCount: 0, canceled: false };
    }

    // Process each unprocessed chat
    let processedCount = 0;
    let canceled = false;
    const totalCount = unprocessedChats.length;

    for (const chat of unprocessedChats) {
      if (shouldCancel()) {
        canceled = true;
        console.log('[Popup] Summarization cancellation requested. Stopping before next chat.');
        break;
      }

      try {
        if (onProgress) {
          const hasTitle = typeof chat.title === 'string' && chat.title.length > 0;
          const titlePreview = hasTitle ? chat.title.substring(0, 40) : 'Chat';
          const titleLabel = hasTitle && chat.title.length > 40 ? `${titlePreview}...` : titlePreview;
          onProgress(processedCount, totalCount, `"${titleLabel}" - generating highlights`);
        }

        console.log(`[Popup] Processing chat ${processedCount + 1}/${unprocessedChats.length}: ${chat.title}`);

        // Skip if no messages
        if (!chat.messages || chat.messages.length === 0) {
          console.log(`[Popup] Skipping chat ${chat.id} - no messages`);
          await chrome.runtime.sendMessage({
            type: 'updateChat',
            data: {
              chatId: chat.id,
              updates: {
                messagePairSummaries: [],
                chatSummary: chat.title || 'Summary unavailable',
                processed: true,
                summarizationFailed: true,
                excludeFromLibrary: true
              }
            }
          });
          processedCount++;
          continue;
        }

        // STEP 1: Split messages into pairs (robust pairing for text-only chats)
        const messagePairs = [];
        const userQueue = [];

        for (const message of chat.messages) {
          if (!message || typeof message.content !== 'string') {
            continue;
          }

          const content = message.content.trim();
          if (!content) {
            continue;
          }

          if (message.role === 'user') {
            userQueue.push(content);
          } else if (message.role === 'assistant') {
            const userContent = userQueue.length > 0 ? userQueue.shift() : null;

            if (userContent) {
              messagePairs.push({
                user: userContent,
                assistant: content
              });
            } else {
              messagePairs.push({
                user: 'User prompt not captured.',
                assistant: content
              });
            }
          }
        }

        while (userQueue.length > 0) {
          const remainingUser = userQueue.shift();
          if (remainingUser && remainingUser.trim().length > 0) {
            messagePairs.push({
              user: remainingUser,
              assistant: 'Assistant response not captured.'
            });
          }
        }

        console.log(`[Popup] Found ${messagePairs.length} message pairs in chat ${chat.id}`);

        // Skip if no valid pairs
        if (messagePairs.length === 0) {
          console.log(`[Popup] Skipping chat ${chat.id} - no valid message pairs`);
          await chrome.runtime.sendMessage({
            type: 'updateChat',
            data: {
              chatId: chat.id,
              updates: {
                messagePairSummaries: [],
                chatSummary: chat.title || 'Summary unavailable',
                processed: true,
                summarizationFailed: true,
                excludeFromLibrary: true
              }
            }
          });
          processedCount++;
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
              processed: true,
              summarizationFailed: false,
              excludeFromLibrary: false
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

    console.log(`[Popup] Summarization complete: ${processedCount}/${totalCount} chats processed${canceled ? ' (stopped early)' : ''}`);
    return { processedCount, totalCount, canceled };

  } catch (error) {
    console.error('[Popup] Error in chat summarization:', error);
    throw error;
  }
}

/**
 * Classify chats into preferred labels using AI
 * Runs in popup context (has access to AI Prompt API)
 *
 * @param {Array<string>} preferredLabelNames - Preferred label names selected by the user
 * @param {Function} onProgress - Progress callback (current, total, message)
 * @returns {Promise<{labelCount: number, matchedChatCount: number}>} Classification stats
 */
async function generateLabelsForMode({ mode, preferredLabelNames = [], onProgress }) {
  const isPreferredMode = mode === 'preferred' && Array.isArray(preferredLabelNames);
  const hasPreferredLabels = isPreferredMode && preferredLabelNames.length > 0;
  const stepsTotal = 3;

  console.log(`[Popup] Starting label generation in ${mode === 'auto' ? 'auto' : 'preferred'} mode`);

  try {
    if (isPreferredMode && !hasPreferredLabels) {
      throw new Error('No preferred labels provided for classification.');
    }

    if (onProgress) {
      onProgress(0, stepsTotal, 'Loading chats with summaries...');
    }

    const response = await chrome.runtime.sendMessage({ type: 'getAllChats' });
    if (!response.success) {
      throw new Error('Failed to get chats from storage');
    }

    const allChats = response.data;
    const chatsWithSummaries = allChats.filter(chat => chat.chatSummary);

    console.log(`[Popup] Found ${chatsWithSummaries.length} chats with summaries`);

    if (chatsWithSummaries.length === 0) {
      throw new Error('No chats with summaries found. Please run summarization first.');
    }

    if (onProgress) {
      onProgress(
        1,
        stepsTotal,
        isPreferredMode
          ? 'Classifying chats into preferred labels...'
          : 'Generating auto label suggestions...'
      );
    }

    const rawLabels = await AIService.generateLabelsFromChatSummaries(
      chatsWithSummaries,
      isPreferredMode ? preferredLabelNames : []
    );

    if (!Array.isArray(rawLabels)) {
      throw new Error('AI returned an unexpected response while generating labels.');
    }

    console.log(`[Popup] Label generation returned ${rawLabels.length} labels`);

    const indexToChatId = chatsWithSummaries.map(chat => chat.id);
    const chatIdSet = new Set(indexToChatId);
    const timestamp = Date.now();

    // Normalize conversation IDs and filter/sort before saving
    let processedLabels = rawLabels.map(label => {
      if (!label || !label.name) {
        return null;
      }

      const rawConversationIds = Array.isArray(label.conversationIds) ? label.conversationIds : [];
      const normalizedConversationIds = rawConversationIds
        .map(idOrIndex => {
          const numericIndex = parseInt(idOrIndex, 10);
          if (!isNaN(numericIndex) && numericIndex >= 1 && numericIndex <= indexToChatId.length) {
            return indexToChatId[numericIndex - 1];
          }
          if (typeof idOrIndex === 'string' && chatIdSet.has(idOrIndex)) {
            return idOrIndex;
          }
          return null;
        })
        .filter(Boolean);

      const uniqueChatIds = [...new Set(normalizedConversationIds)];
      const description = (label.description || '').trim() || `Chats related to ${label.name}`;
      const confidence = typeof label.confidence === 'number'
        ? label.confidence
        : isPreferredMode
          ? (uniqueChatIds.length > 0 ? 0.75 : 0)
          : 0.7;

      return {
        idPrefix: mode,
        timestamp,
        name: label.name,
        description,
        confidence,
        chatIds: uniqueChatIds
      };
    }).filter(Boolean);

    if (isPreferredMode) {
      processedLabels = processedLabels
        .filter(label => label.chatIds.length > 1)
        .sort((a, b) => (b.chatIds.length || 0) - (a.chatIds.length || 0));
    }

    if (!isPreferredMode) {
      processedLabels = processedLabels.sort((a, b) => (b.chatIds.length || 0) - (a.chatIds.length || 0));
    }

    if (onProgress) {
      onProgress(2, stepsTotal, 'Saving labels...');
    }

    try {
      await chrome.runtime.sendMessage({ type: 'clearSuggestedLabels' });
      console.log('[Popup] Cleared previous suggested labels before saving new ones');
    } catch (clearError) {
      console.warn('[Popup] Unable to clear previous suggested labels:', clearError);
    }

    let savedCount = 0;
    let matchedChatCount = 0;
    for (const label of processedLabels) {
      matchedChatCount += label.chatIds.length;

      const suggestedLabel = {
        id: `${label.idPrefix}_${label.timestamp}_${Math.random().toString(36).substring(2, 11)}`,
        name: label.name,
        description: label.description,
        confidence: label.confidence,
        chatIds: label.chatIds,
        dismissed: false
      };

      await chrome.runtime.sendMessage({
        type: 'saveSuggestedLabel',
        data: suggestedLabel
      });

      console.log(
        `[Popup] Saved ${mode === 'auto' ? 'auto' : 'preferred'} label: ${suggestedLabel.name} (${suggestedLabel.chatIds.length} chats)`
      );

      savedCount++;
    }

    console.log(`[Popup] Label generation (${mode}) complete`);

    return {
      labelCount: savedCount,
      matchedChatCount
    };
  } catch (error) {
    console.error('[Popup] Error generating labels:', error);
    throw error;
  }
}

/**
 * Handle summarization button click
 */
async function runWorkflowClassification(mode) {
  const isAutoMode = mode === 'auto';

  setWorkflowBusy(true);

  if (labelGenerationSection) {
    labelGenerationSection.style.display = 'block';
  }
  if (labelGenerationProgress) {
    labelGenerationProgress.style.display = 'flex';
    if (labelProgressFill) {
      labelProgressFill.style.width = '0%';
    }
  }
  if (labelStatusText) {
    labelStatusText.textContent = isAutoMode
      ? 'Preparing auto label suggestions...'
      : 'Initializing classification...';
  }

  try {
    const { labelCount, matchedChatCount } = await generateLabelsForMode({
      mode,
      preferredLabelNames: savedPreferredLabelNames,
      onProgress: (current, total, message) => {
        if (labelProgressFill && total > 0) {
          const progress = (current / total) * 100;
          labelProgressFill.style.width = `${progress}%`;
        }
        if (labelStatusText) {
          labelStatusText.textContent = message || (isAutoMode ? 'Generating labels...' : 'Classifying chats...');
        }
      }
    });

    const labelDescriptor = `${labelCount} ${isAutoMode ? 'suggested label' : 'preferred label'}${labelCount === 1 ? '' : 's'}`;
    const chatText = matchedChatCount > 0
      ? ` covering ${matchedChatCount} chat${matchedChatCount === 1 ? '' : 's'}`
      : ' (no matching chats found yet)';

    if (labelStatusText) {
      labelStatusText.textContent = isAutoMode
        ? `Generated ${labelDescriptor}${chatText}!`
        : `Successfully classified ${labelDescriptor}${chatText}!`;
    }

    showToast('Successfully added!', 'success');
    await loadLibrary();

    return { labelCount, matchedChatCount };
  } catch (error) {
    console.error('[Popup] Label generation error:', error);
    if (labelStatusText) {
      labelStatusText.textContent = 'Error: ' + error.message;
    }
    throw error;
  } finally {
    setWorkflowBusy(false);
  }
}

/**
 * Handle summarization button click
 */
async function handleSummarizeChats() {
  console.log('[Popup] Starting chat summarization from library screen');

  if (!summarizeBtn) {
    return;
  }

  // If already summarizing, interpret click as a stop request
  if (isSummarizingChats) {
    if (summarizeCancelRequested) {
      console.log('[Popup] Summarization stop already requested');
      return;
    }

    summarizeCancelRequested = true;
    summarizeBtn.disabled = true;
    summarizeBtn.classList.add('is-danger', 'is-active');
    if (summarizeActionLabel) {
      summarizeActionLabel.textContent = 'Stopping...';
    }
    if (summarizeCount) {
      summarizeCount.textContent = '';
    }
    summarizeBtn.setAttribute('aria-label', 'Stopping summarization');
    if (summarizationProgress) {
      summarizationProgress.style.display = 'flex';
      summarizeStatusText.textContent = 'Stopping after current chat...';
    }
    return;
  }

  isSummarizingChats = true;
  summarizeCancelRequested = false;

  if (summarizationProgress) {
    summarizationProgress.style.display = 'flex';
    summarizeProgressFill.style.width = '0%';
    summarizeStatusText.textContent = 'Initializing summarization...';
  }

  if (summarizeHeading) {
    summarizeHeading.style.display = 'none';
  }
  summarizeBtn.disabled = false;
  summarizeBtn.classList.add('is-danger', 'is-active');
  if (summarizeActionLabel) {
    summarizeActionLabel.textContent = 'Stop';
  }
  if (summarizeCount) {
    summarizeCount.textContent = '';
  }
  summarizeBtn.setAttribute('aria-label', 'Stop summarization');

  let summaryResult = null;
  let summaryError = null;
  let hideDelay = 2000;
  let shouldHideProgress = false;

  try {
    summaryResult = await summarizeChats((current, total, message) => {
      if (!summarizationProgress) {
        return;
      }

      const denominator = total > 0 ? total : 1;
      const progress = Math.min((current / denominator) * 100, 100);
      summarizeProgressFill.style.width = `${progress}%`;
      summarizeStatusText.textContent = message || `${current}/${total} chats - generating highlights...`;
    }, {
      shouldCancel: () => summarizeCancelRequested
    });

    shouldHideProgress = true;

    if (summarizationProgress && summaryResult) {
      const { processedCount, totalCount, canceled } = summaryResult;

      if (totalCount === 0) {
        summarizeProgressFill.style.width = '100%';
        summarizeStatusText.textContent = 'All chats already summarized.';
      } else if (canceled) {
        const progress = Math.min((processedCount / totalCount) * 100, 100);
        summarizeProgressFill.style.width = `${progress}%`;
        summarizeStatusText.textContent = `Stopped after ${processedCount} of ${totalCount} chats.`;
      } else {
        summarizeProgressFill.style.width = '100%';
        summarizeStatusText.textContent = `Successfully summarized ${processedCount} chats!`;
      }
    }

  } catch (error) {
    summaryError = error;
    console.error('[Popup] Summarization error:', error);
    shouldHideProgress = true;
    hideDelay = 5000;

    if (summarizationProgress) {
      summarizeStatusText.textContent = 'Error: ' + error.message;
    }

  } finally {
    isSummarizingChats = false;
    summarizeCancelRequested = false;

    summarizeBtn.disabled = false;
    summarizeBtn.classList.remove('is-danger', 'is-active');
    if (summarizeActionLabel) {
      summarizeActionLabel.textContent = 'Summarize';
    }
    if (summarizeCount) {
      summarizeCount.textContent = '0';
    }
    summarizeBtn.setAttribute('aria-label', 'Summarize chats');

    try {
      await loadLibrary();
    } catch (error) {
      console.error('[Popup] Error refreshing library after summarization:', error);
    }

    if (summarizationProgress && shouldHideProgress) {
      setTimeout(() => {
        summarizationProgress.style.display = 'none';
      }, hideDelay);
    }
  }

  if (summaryError) {
    showToast('Summarization failed. Check the status message for details.', 'error');
  }
}

/**
 * Drop existing summaries without deleting chats
 */
async function handleDropSummaries() {
  console.log('[Popup] Dropping chat summaries');

  const confirmed = confirm('This will remove summaries for every chat and return them to the unsummarized list.\n\nImported chats remain intact. Continue?');
  if (!confirmed) {
    return;
  }

  try {
    summarizeBtn.disabled = true;
    summarizeBtn.classList.add('is-active');
    if (summarizeActionLabel) {
      summarizeActionLabel.textContent = 'Working...';
    }
    if (summarizeCount) {
      summarizeCount.textContent = '';
    }
    summarizeBtn.setAttribute('aria-label', 'Dropping summaries');
    if (summarizeHeading) {
      summarizeHeading.style.display = 'none';
    }
    if (summarizationProgress) {
      summarizationProgress.style.display = 'flex';
      summarizeProgressFill.style.width = '0%';
      summarizeStatusText.textContent = 'Dropping summaries...';
    }

    const response = await chrome.runtime.sendMessage({ type: 'resetSummaries' });
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to drop summaries');
    }

    const resetCount = response.data?.resetCount;
    const labelStats = response.data?.labelClearStats || {};
    const labelMessage = labelStats.labelsCleared
      ? ` Removed ${labelStats.labelsCleared} label assignments.`
      : '';
    const toastMessage = typeof resetCount === 'number'
      ? `Dropped summaries for ${resetCount} chats.${labelMessage}`
      : `Summaries cleared successfully.${labelMessage}`;
    showToast(toastMessage);

    await loadLibrary();

    if (summarizationProgress) {
      summarizeStatusText.textContent = 'Summaries cleared.';
      setTimeout(() => {
        summarizationProgress.style.display = 'none';
      }, 3000);
    }
  } catch (error) {
    console.error('[Popup] Drop summaries error:', error);
    showToast('Unable to drop summaries: ' + error.message, 'error');
    if (summarizationProgress) {
      summarizeStatusText.textContent = 'Error: ' + error.message;
      setTimeout(() => {
        summarizationProgress.style.display = 'none';
      }, 5000);
    }
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.classList.remove('is-active', 'is-danger');
    if (summarizeActionLabel) {
      summarizeActionLabel.textContent = 'Summarize';
    }
    if (summarizeCount && !summarizeCount.textContent) {
      summarizeCount.textContent = '0';
    }
  }
}

/**
 * Handle label generation button click
 */
async function handleGenerateLabels() {
  if (!generateLabelsBtn) {
    console.warn('[Popup] Generate labels button not available; triggering workflow classification instead.');
    await openLabelWorkflow();
    return;
  }

  const isAutoMode = classificationMode === 'auto';
  console.log(`[Popup] Starting label generation from library screen (mode: ${isAutoMode ? 'auto' : 'preferred'})`);

  if (!isAutoMode && savedPreferredLabelNames.length === 0) {
    updatePreferredLabelsStatus('Save at least one preferred label or choose "Continue Without Preferences" before continuing.', 'error');
    return;
  }

  if (processedChatCount === 0) {
    updatePreferredLabelsStatus('Summarize chats before generating labels.', 'error');
    return;
  }

  try {
    // Disable button and show progress
    generateLabelsBtn.disabled = true;
    generateLabelsBtn.dataset.state = 'busy';
    generateLabelsBtn.textContent = isAutoMode ? 'Generating...' : 'Classifying...';
    labelGenerationProgress.style.display = 'flex';
    labelProgressFill.style.width = '0%';
    labelStatusText.textContent = isAutoMode
      ? 'Preparing auto label suggestions...'
      : 'Initializing classification...';

    const { labelCount, matchedChatCount } = await generateLabelsForMode({
      mode: isAutoMode ? 'auto' : 'preferred',
      preferredLabelNames: savedPreferredLabelNames,
      onProgress: (current, total, message) => {
        const progress = total > 0 ? (current / total) * 100 : 0;
        labelProgressFill.style.width = `${progress}%`;
        labelStatusText.textContent = message || (isAutoMode ? 'Generating labels...' : 'Classifying chats...');
      }
    });

    // Success
    labelProgressFill.style.width = '100%';
    const labelDescriptor = `${labelCount} ${isAutoMode ? 'suggested label' : 'preferred label'}${labelCount === 1 ? '' : 's'}`;
    const chatText = matchedChatCount > 0
      ? ` covering ${matchedChatCount} chat${matchedChatCount === 1 ? '' : 's'}`
      : ' (no matching chats found yet)';

    labelStatusText.textContent = isAutoMode
      ? `Generated ${labelDescriptor}${chatText}!`
      : `Successfully classified ${labelDescriptor}${chatText}!`;

    // Wait a moment then hide progress and refresh library
    setTimeout(async () => {
      labelGenerationProgress.style.display = 'none';
      generateLabelsBtn.disabled = false;
      generateLabelsBtn.dataset.state = 'idle';
      updateLabelGenerationModeUI(processedChatCount);
      await loadLibrary();
    }, 2000);

  } catch (error) {
    console.error('[Popup] Label generation error:', error);
    labelStatusText.textContent = 'Error: ' + error.message;
    generateLabelsBtn.disabled = false;
    generateLabelsBtn.dataset.state = 'idle';
    updateLabelGenerationModeUI(processedChatCount);

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
    await loadPreferredLabels();

    // Get chat processing state to determine which buttons to show
    const response = await chrome.runtime.sendMessage({ type: 'getAllChats' });
    if (response.success) {
      const chats = Object.values(response.data);
      const visibleChats = chats.filter(chat => !chat.excludeFromLibrary);
      const unprocessedChats = visibleChats.filter(chat => !chat.processed || !chat.chatSummary);
      const processedChats = visibleChats.filter(chat => chat.processed && chat.chatSummary);

      console.log(`[Popup] Chat state: ${unprocessedChats.length} unprocessed, ${processedChats.length} processed`);

      processedChatCount = processedChats.length;

      if (summarizationSection) {
        summarizationSection.style.display = 'block';
      }

      const pendingCount = unprocessedChats.length;

      if (summarizeHeading) {
        summarizeHeading.style.display = isSummarizingChats ? 'none' : 'block';
        summarizeHeading.textContent = pendingCount > 0 ? 'Summarize Conversations' : 'Summaries Up To Date';
      }

      if (summarizationProgress) {
        summarizationProgress.style.display = isSummarizingChats ? 'flex' : 'none';
      }

      if (summarizeBtn) {
        if (isSummarizingChats) {
          summarizeBtn.disabled = summarizeCancelRequested;
          summarizeBtn.classList.add('is-danger', 'is-active');
          if (summarizeActionLabel) {
            summarizeActionLabel.textContent = summarizeCancelRequested ? 'Stopping...' : 'Stop';
          }
          if (summarizeCount) {
            summarizeCount.textContent = '';
          }
          summarizeBtn.setAttribute('aria-label', summarizeCancelRequested ? 'Stopping summarization' : 'Stop summarization');
        } else {
          summarizeBtn.classList.remove('is-danger', 'is-active');
          const hasPending = pendingCount > 0;
          summarizeBtn.disabled = !hasPending;
          if (summarizeActionLabel) {
            summarizeActionLabel.textContent = hasPending ? 'Summarize' : 'Summarized';
          }
          if (summarizeCount) {
            summarizeCount.textContent = pendingCount.toString();
          }
          summarizeBtn.setAttribute('aria-label', hasPending ? `Summarize ${pendingCount} chats` : 'All chats summarized');
        }
      }

    } else {
      processedChatCount = 0;
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

async function openLabelWorkflow() {
  try {
    resetWorkflowProgress();
    setWorkflowBusy(false);
    await loadPreferredLabels();
    showScreen('workflow');
  } catch (error) {
    console.error('[Popup] Error opening label workflow:', error);
    showToast('Unable to open organizer. Please try again.', 'error');
    showScreen('library');
  }
}

async function handleWorkflowExit() {
  try {
    resetWorkflowProgress();
    setWorkflowBusy(false);
    showScreen('library');
    await loadLibrary();
  } catch (error) {
    console.error('[Popup] Error returning from workflow:', error);
    showToast('Error returning to library.', 'error');
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

      // Filter out chats we can't summarize or display
      const visibleChats = chats.filter(chat => !chat.excludeFromLibrary);
      const summarizedChats = visibleChats.filter(chat => chat.processed && chat.chatSummary);
      const unsummarizedChats = visibleChats.filter(chat => !chat.processed || !chat.chatSummary);

      // Store chats globally for filtering and label counts
      window.allChats = visibleChats;
      window.summarizedChats = summarizedChats;
      window.unsummarizedChats = unsummarizedChats;

      if (summarizedBadge) {
        summarizedBadge.textContent = summarizedChats.length;
      }
      if (unsummarizedBadge) {
        unsummarizedBadge.textContent = unsummarizedChats.length;
      }

      applyFilterForContext('summarized');
      applyFilterForContext('unsummarized');
    }
  } catch (error) {
    console.error('[Popup] Error loading chats:', error);
  }
}

/**
 * Render chat list
 * @param {Array} chats - Array of chat objects
 */
function renderChatList(chats, options = {}) {
  const {
    container = unsummarizedList,
    context = 'library',
    emptyMessage = 'No conversations yet. Import chats to see them here.'
  } = options;

  if (!container) {
    return;
  }

  if (!Array.isArray(chats) || chats.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
    return;
  }

  container.innerHTML = chats.map(chat => {
    const messageCount = chat.messages ? chat.messages.length : 0;
    const date = new Date(chat.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const chatSummary = chat.chatSummary || 'No summary available';
    const hasPairSummaries = chat.messagePairSummaries && chat.messagePairSummaries.length > 0;
    const pairCount = hasPairSummaries
      ? chat.messagePairSummaries.length
      : Math.floor(messageCount / 2);

    return `
      <div class="chat-item" data-id="${chat.id}" data-platform="${chat.platform}">
        <div class="chat-item-header">
          <span class="chat-platform-badge ${chat.platform}">${PLATFORMS[chat.platform].name}</span>
          <span class="chat-item-title">${chat.title}</span>
          <div class="chat-item-actions">
            <button class="chat-item-delete-btn" data-chat-id="${chat.id}" title="Delete chat">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M3 3.5h6M4 3.5V2.5C4 2.22386 4.22386 2 4.5 2h3C7.77614 2 8 2.22386 8 2.5v1M9 3.5v6c0 .5523-.4477 1-1 1H4c-.55228 0-1-.4477-1-1v-6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 5.5v3M7 5.5v3" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="chat-item-link-btn" data-url="${chat.url}" title="Open original chat">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M9 6.5V9.5C9 9.77614 8.77614 10 8.5 10H2.5C2.22386 10 2 9.77614 2 9.5V3.5C2 3.22386 2.22386 3 2.5 3H5.5" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M7 2H10M10 2V5M10 2L6 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="chat-item-summary-headline">${chatSummary}</div>
        <div class="chat-item-meta">
          <span class="chat-item-messages">${pairCount} Q&As</span>
          <span class="chat-item-date">${date}</span>
          ${hasPairSummaries ? `
            <button class="chat-item-expand-btn" data-chat-id="${chat.id}" title="Show message pair summaries">
              <svg class="chevron-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M3 4.5L6 7.5L9 4.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Details
            </button>
          ` : ''}
        </div>
        ${hasPairSummaries ? `
          <div class="chat-item-expansion" data-chat-id="${chat.id}">
            <div class="chat-item-expansion-header">Message Pair Summaries:</div>
            <div class="chat-item-pair-summaries">
              ${chat.messagePairSummaries.map((summary, index) => `
                <div class="chat-item-pair-summary">
                  <span class="pair-number">${index + 1}.</span>
                  <span class="pair-text">${summary}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Add event listeners for "View Original" buttons
  const linkButtons = container.querySelectorAll('.chat-item-link-btn');
  linkButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent chat item click
      const url = btn.getAttribute('data-url');
      if (url) {
        chrome.tabs.create({ url, active: true });
      }
    });
  });

  // Add event listeners for delete buttons
  const deleteButtons = container.querySelectorAll('.chat-item-delete-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chatId = btn.getAttribute('data-chat-id');
      await handleDeleteChat(chatId, 'library');
    });
  });

  // Add event listeners for expand/collapse buttons
  const expandButtons = container.querySelectorAll('.chat-item-expand-btn');
  expandButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const chatId = btn.getAttribute('data-chat-id');
      toggleChatExpansion(chatId, btn, context);
    });
  });

  // Restore expansion states
  expandedLibraryChats.forEach(chatId => {
    const expansion = container.querySelector(`.chat-item-expansion[data-chat-id="${chatId}"]`);
    const button = container.querySelector(`.chat-item-expand-btn[data-chat-id="${chatId}"]`);
    if (expansion && button) {
      expansion.classList.add('expanded');
      const chevron = button.querySelector('.chevron-icon');
      if (chevron) {
        chevron.style.transform = 'rotate(180deg)';
      }
    }
  });
}

/**
 * Switch between library views (library, summarized, unsummarized)
 * @param {string} targetView
 * @param {{force?: boolean}} options
 */
function switchLibraryView(targetView, options = {}) {
  const { force = false } = options;

  if (libraryViewElements.length === 0 || libraryTabButtons.length === 0) {
    currentLibraryView = targetView || 'library';
    return;
  }

  const allowedViews = ['library', 'summarized', 'unsummarized'];
  const normalizedView = allowedViews.includes(targetView) ? targetView : 'library';

  if (!force && normalizedView === currentLibraryView) {
    return;
  }

  const activeElement = libraryViewElements.find(view => view.classList.contains('active'));
  if (activeElement) {
    const activeViewKey = activeElement.getAttribute('data-library-view');
    if (activeViewKey && Object.prototype.hasOwnProperty.call(libraryViewScrollPositions, activeViewKey)) {
      libraryViewScrollPositions[activeViewKey] = activeElement.scrollTop;
    }
  }

  libraryViewElements.forEach(view => {
    view.classList.remove('active');
  });

  libraryTabButtons.forEach(btn => {
    const matches = btn.getAttribute('data-library-target') === normalizedView;
    btn.classList.toggle('active', matches);
    btn.setAttribute('aria-pressed', matches ? 'true' : 'false');
  });

  const nextElement = libraryViewElements.find(view => view.getAttribute('data-library-view') === normalizedView);
  if (nextElement) {
    nextElement.classList.add('active');
    const savedScroll = libraryViewScrollPositions[normalizedView] || 0;
    requestAnimationFrame(() => {
      nextElement.scrollTop = savedScroll;
    });
  }

  currentLibraryView = normalizedView;
}

/**
 * Toggle library maintenance menu visibility
 */
function openLibraryDangerMenu() {
  if (!libraryDangerWrapper || !libraryDangerToggle) {
    return;
  }
  libraryDangerWrapper.classList.add('open');
  libraryDangerToggle.setAttribute('aria-expanded', 'true');
  if (libraryDangerMenu) {
    libraryDangerMenu.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      libraryDangerMenu.focus({ preventScroll: true });
    });
  }
}

function closeLibraryDangerMenu() {
  if (!libraryDangerWrapper || !libraryDangerToggle) {
    return;
  }
  libraryDangerWrapper.classList.remove('open');
  libraryDangerToggle.setAttribute('aria-expanded', 'false');
  if (libraryDangerMenu) {
    libraryDangerMenu.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Filter chats by platform
 * @param {string} platform - Platform name or 'all'
 */
function applyFilterForContext(context) {
  const platform = getActiveFilterPlatform(context);

  let chats = [];
  let container = null;
  let emptyMessage = 'No conversations yet. Import chats to see them here.';
  let renderContext = 'library';

  if (context === 'summarized') {
    chats = window.summarizedChats || [];
    container = summarizedList;
    emptyMessage = 'No summarized chats yet. Run Summarize to generate them.';
    renderContext = 'summarized';
  } else if (context === 'unsummarized') {
    chats = window.unsummarizedChats || [];
    container = unsummarizedList;
    emptyMessage = 'No unsummarized chats. Import or summarize new chats to populate this list.';
    renderContext = 'unsummarized';
  } else {
    console.warn('[Popup] Unknown filter context:', context);
    return;
  }

  if (platform !== 'all') {
    chats = chats.filter(chat => chat.platform === platform);
  }

  renderChatList(chats, {
    container,
    context: renderContext,
    emptyMessage
  });
}

function getActiveFilterPlatform(context) {
  const group = document.querySelector(`.filter-buttons[data-filter-context="${context}"]`);
  if (!group) {
    return 'all';
  }

  let activeBtn = group.querySelector('.filter-btn.active');
  if (!activeBtn) {
    activeBtn = group.querySelector('.filter-btn');
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }

  return activeBtn ? (activeBtn.dataset.platform || 'all') : 'all';
}

/**
 * Toggle expansion of chat item to show/hide message pair summaries
 * @param {string} chatId - Chat ID
 * @param {HTMLElement} button - The expand button element
 * @param {string} context - 'library' or 'label' to track which screen we're on
 */
function toggleChatExpansion(chatId, button, context = 'library') {
  console.log(`[Popup] toggleChatExpansion called: chatId=${chatId}, context=${context}`);

  // Determine container scope based on context
  let container;
  switch (context) {
    case 'label':
      container = labelChatList;
      break;
    case 'summarized':
      container = summarizedList;
      break;
    case 'unsummarized':
    case 'library':
    default:
      container = unsummarizedList;
      break;
  }

  let expansion = null;

  if (container) {
    expansion = container.querySelector(`.chat-item-expansion[data-chat-id="${chatId}"]`);
  }

  // Fallback: scope to nearest chat item just in case markup differs
  if (!expansion && button) {
    const parentItem = button.closest('.chat-item');
    if (parentItem) {
      expansion = parentItem.querySelector('.chat-item-expansion');
    }
  }

  if (!expansion) {
    console.warn('[Popup] No expansion element found for chat:', chatId);
    // Log all expansion elements to see what's available
    const allExpansions = document.querySelectorAll('.chat-item-expansion');
    console.log('[Popup] Available expansion elements:', allExpansions.length);
    allExpansions.forEach(el => {
      console.log('  - expansion with data-chat-id:', el.getAttribute('data-chat-id'));
    });
    return;
  }

  console.log('[Popup] Found expansion element:', expansion);
  console.log('[Popup] Expansion current classes:', expansion.className);
  console.log('[Popup] Expansion innerHTML length:', expansion.innerHTML.length);
  console.log('[Popup] Expansion computed display:', window.getComputedStyle(expansion).display);
  console.log('[Popup] Expansion computed maxHeight:', window.getComputedStyle(expansion).maxHeight);
  console.log('[Popup] Expansion computed opacity:', window.getComputedStyle(expansion).opacity);

  // Find the chevron icon within the button
  const chevron = button.querySelector('.chevron-icon');

  // Determine which Set to use based on context
  const expandedSet = context === 'label' ? expandedLabelChats : expandedLibraryChats;

  // Toggle the expanded state
  const isExpanded = expansion.classList.contains('expanded');

  if (isExpanded) {
    // Collapse
    expansion.classList.remove('expanded');
    if (chevron) {
      chevron.style.transform = 'rotate(0deg)';
    }
    expandedSet.delete(chatId);
    console.log('[Popup] Collapsed chat:', chatId);
  } else {
    // Expand
    expansion.classList.add('expanded');
    if (chevron) {
      chevron.style.transform = 'rotate(180deg)';
    }
    expandedSet.add(chatId);
    console.log('[Popup] Expanded chat:', chatId);
  console.log('[Popup] After adding expanded class:', expansion.className);
  console.log('[Popup] After expand - computed maxHeight:', window.getComputedStyle(expansion).maxHeight);
  console.log('[Popup] After expand - computed opacity:', window.getComputedStyle(expansion).opacity);
  }
}

/**
 * Delete a chat from storage and update UI
 * @param {string} chatId - Chat ID to delete
 * @param {'library'|'label'} context - Current view context
 */
async function handleDeleteChat(chatId, context = 'library') {
  const confirmed = confirm('Delete this chat?\n\nIt will be removed from your library and any labels.');

  if (!confirmed) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'deleteChat', data: { chatId } });

    expandedLibraryChats.delete(chatId);
    expandedLabelChats.delete(chatId);

    showToast('Chat deleted.', 'success');

    if (context === 'label') {
      currentLabelChats = currentLabelChats.filter(chat => chat.id !== chatId);
      if (labelViewChatCount) {
        labelViewChatCount.textContent = `${currentLabelChats.length} chat${currentLabelChats.length === 1 ? '' : 's'}`;
      }
      renderLabelChatList(currentLabelChats);
    }

    await loadLibrary();
  } catch (error) {
    console.error('[Popup] Error deleting chat:', error);
    showToast('Error deleting chat. Please try again.', 'error');
  }
}

/**
 * Remove a chat from the current label without deleting the chat
 * @param {string} chatId - Chat ID to remove
 */
async function handleRemoveChatFromLabel(chatId) {
  if (!currentLabelId) {
    return;
  }

  const confirmed = confirm('Remove this chat from this label?\n\nThe chat will stay in your library and other labels.');

  if (!confirmed) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'removeChatFromLabel',
      data: { labelId: currentLabelId, chatId }
    });

    currentLabelChats = currentLabelChats.filter(chat => chat.id !== chatId);
    expandedLabelChats.delete(chatId);

    if (labelViewChatCount) {
      labelViewChatCount.textContent = `${currentLabelChats.length} chat${currentLabelChats.length === 1 ? '' : 's'}`;
    }

    renderLabelChatList(currentLabelChats);
    showToast('Removed from label.', 'success');
    await loadLibrary();
  } catch (error) {
    console.error('[Popup] Error removing chat from label:', error);
    showToast('Error removing chat from label. Please try again.', 'error');
  }
}

/**
 * Delete a label and update associated UI
 * @param {string} labelId - Label ID to delete
 */
async function handleDeleteLabel(labelId) {
  const confirmed = confirm('Delete this label?\n\nChats will remain in your library and other labels.');

  if (!confirmed) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'deleteLabel', data: { labelId } });

    if (currentLabelId === labelId) {
      currentLabelId = null;
      showScreen('library');
    }

    expandedLabelChats.clear();

    showToast('Label deleted.', 'success');
    await loadLibrary();
  } catch (error) {
    console.error('[Popup] Error deleting label:', error);
    showToast('Error deleting label. Please try again.', 'error');
  }
}

/**
 * Escape HTML for safe attribute usage
 * @param {string} text - Raw text
 * @returns {string} Escaped text
 */
function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Update preferred labels status message
 * @param {string} message - Message to display
 * @param {'info'|'success'|'error'} variant - Status variant
 * @param {boolean} persist - Whether to keep the message without auto-reset
 */
function updatePreferredLabelsStatus(message, variant = 'info', persist = false) {
  if (!preferredLabelsStatus) {
    return;
  }

  const colors = {
    info: '#5b21b6',
    success: '#15803d',
    error: '#b91c1c'
  };

  preferredLabelsStatus.textContent = message;
  preferredLabelsStatus.style.color = colors[variant] || colors.info;

  if (preferredStatusTimeout) {
    clearTimeout(preferredStatusTimeout);
    preferredStatusTimeout = null;
  }

  if (!persist && variant !== 'info') {
    preferredStatusTimeout = setTimeout(() => {
      preferredLabelsStatus.textContent = PREFERRED_LABEL_STATUS_DEFAULT;
      preferredLabelsStatus.style.color = colors.info;
      preferredStatusTimeout = null;
    }, 4000);
  }
}

function setWorkflowBusy(isBusy) {
  [savePreferredLabelsBtn, continueWithoutPreferencesBtn, addPreferredLabelBtn].forEach(btn => {
    if (btn) {
      btn.disabled = isBusy;
    }
  });
  if (backToLibraryFromWorkflowBtn) {
    backToLibraryFromWorkflowBtn.disabled = isBusy;
  }
}

function resetWorkflowProgress() {
  if (labelGenerationProgress) {
    labelGenerationProgress.style.display = 'flex';
  }
  if (labelProgressFill) {
    labelProgressFill.style.width = '0%';
  }
  if (labelStatusText) {
    labelStatusText.textContent = 'Ready to categorize chats.';
  }
}

function showToast(message, variant = 'info') {
  if (!toastEl) {
    return;
  }

  const backgrounds = {
    success: 'rgba(16, 185, 129, 0.95)',
    error: 'rgba(239, 68, 68, 0.95)',
    info: 'rgba(37, 99, 235, 0.95)'
  };

  toastEl.style.background = backgrounds[variant] || backgrounds.info;
  toastEl.textContent = message;
  toastEl.classList.add('show');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
    toastTimeout = null;
  }, 2500);
}

/**
 * Get the friendly action name for label generation button
 * @returns {string}
 */
function getLabelGenerationActionName() {
  return classificationMode === 'auto'
    ? 'Generate Suggested Labels'
    : 'Classify Chats';
}

/**
 * Update label generation button text when idle
 * @param {number} processedCount - Number of processed chats
 */
function setGenerateLabelsIdleButtonText(processedCount = processedChatCount) {
  if (!generateLabelsBtn || generateLabelsBtn.dataset.state === 'busy') {
    return;
  }

  const baseText = getLabelGenerationActionName();
  const countSuffix = processedCount > 0 ? ` (${processedCount} chats)` : '';
  generateLabelsBtn.textContent = `${baseText}${countSuffix}`;
}

/**
 * Update label generation section copy based on current mode
 * @param {number} processedCount - Number of processed chats
 */
function updateLabelGenerationModeUI(processedCount = processedChatCount) {
  const isAutoMode = classificationMode === 'auto';

  if (labelGenerationTitle) {
    labelGenerationTitle.textContent = isAutoMode
      ? 'Step 3: Generate Suggested Labels'
      : 'Step 3: Classify Preferred Labels';
  }

  if (labelGenerationSubtitle) {
    labelGenerationSubtitle.textContent = isAutoMode
      ? 'Analyze chat summaries and auto-group them into thematic categories.'
      : 'Analyze chat summaries and categorize only into your preferred labels.';
  }

  setGenerateLabelsIdleButtonText(processedCount);
}

/**
 * Focus a preferred label input by ID
 * @param {string|null} labelId - Label ID to focus
 */
function focusPreferredLabelInput(labelId) {
  if (!labelId || !preferredLabelsList) {
    return;
  }

  const input = preferredLabelsList.querySelector(`.preferred-label-input[data-id="${labelId}"]`);
  if (input) {
    input.focus();
    input.select();
  }
}

/**
 * Render preferred labels list
 * @param {string|null} focusLabelId - Optional label ID to focus after render
 */
function renderPreferredLabels(focusLabelId = null) {
  if (!preferredLabelsList) {
    return;
  }

  if (!preferredLabels.length) {
    preferredLabelsList.innerHTML = `
      <div class="preferred-labels-empty">
        <p>Add the topics you care about to get tailored label suggestions.</p>
      </div>
    `;
    return;
  }

  preferredLabelsList.innerHTML = preferredLabels.map((label, index) => `
    <div class="preferred-label-item" data-id="${label.id}">
      <span class="preferred-label-index">${index + 1}</span>
      <input
        type="text"
        class="preferred-label-input"
        data-id="${label.id}"
        value="${escapeHtml(label.name)}"
        placeholder="e.g., Probability"
        maxlength="40"
      />
      <button class="preferred-label-remove" type="button" data-id="${label.id}" title="Remove label">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
          <path d="M4 4l6 6M10 4l-6 6" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');

  focusPreferredLabelInput(focusLabelId);
}

/**
 * Add a preferred label entry
 * @param {string} initialValue - Optional initial value
 * @param {Object} options - Additional options
 * @param {boolean} [options.silent=false] - Skip status message update
 * @param {boolean} [options.focus=true] - Focus the new input after render
 */
function addPreferredLabel(initialValue = '', { silent = false, focus = true } = {}) {
  if (!preferredLabelsList) {
    return;
  }

  if (preferredLabels.length >= MAX_PREFERRED_LABELS) {
    updatePreferredLabelsStatus(`You can add up to ${MAX_PREFERRED_LABELS} preferred labels.`, 'error');
    return;
  }

  const label = {
    id: `pref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: initialValue || ''
  };

  preferredLabels.push(label);
  renderPreferredLabels(focus ? label.id : null);

  if (!silent) {
    updatePreferredLabelsStatus('Save to apply these preferences.', 'info', true);
  }
}

/**
 * Remove a preferred label entry
 * @param {string} labelId - Label ID to remove
 * @param {Object} options - Additional options
 * @param {boolean} [options.silent=false] - Skip status message update
 */
function removePreferredLabel(labelId, { silent = false } = {}) {
  const index = preferredLabels.findIndex(label => label.id === labelId);
  if (index === -1) {
    return;
  }

  preferredLabels.splice(index, 1);
  renderPreferredLabels();

  if (!preferredLabels.length) {
    addPreferredLabel('', { silent: true, focus: true });
  }

  if (!silent) {
    updatePreferredLabelsStatus('Save to apply these preferences.', 'info', true);
  }
}

/**
 * Collect preferred labels from inputs (trimmed and deduplicated)
 * @returns {Array<{id: string, name: string}>} Preferred labels
 */
function collectPreferredLabelsFromInputs() {
  if (!preferredLabelsList) {
    return [];
  }

  const inputs = preferredLabelsList.querySelectorAll('.preferred-label-input');
  const seen = new Set();
  const collected = [];

  inputs.forEach(input => {
    const id = input.getAttribute('data-id');
    const rawValue = (input.value || '').trim();

    // Update in-memory representation with current value (even if empty)
    const storedLabel = preferredLabels.find(label => label.id === id);
    if (storedLabel) {
      storedLabel.name = input.value || '';
    }

    if (!rawValue) {
      return;
    }

    const normalized = rawValue.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);

    collected.push({
      id,
      name: rawValue
    });
  });

  return collected;
}

/**
 * Handle preferred label add button
 */
function handleAddPreferredLabel() {
  addPreferredLabel();
}

/**
 * Handle input changes in preferred labels list
 * @param {InputEvent} event - Input event
 */
function handlePreferredLabelsListInput(event) {
  if (!event.target.classList.contains('preferred-label-input')) {
    return;
  }

  const labelId = event.target.getAttribute('data-id');
  const label = preferredLabels.find(item => item.id === labelId);
  if (label) {
    label.name = event.target.value;
  }

  updatePreferredLabelsStatus('Save to apply these preferences.', 'info', true);
}

/**
 * Handle click events within preferred labels list
 * @param {MouseEvent} event - Click event
 */
function handlePreferredLabelsListClick(event) {
  const removeBtn = event.target.closest('.preferred-label-remove');
  if (removeBtn) {
    const labelId = removeBtn.getAttribute('data-id');
    removePreferredLabel(labelId);
  }
}

/**
 * Save preferred labels to storage
 */
async function handleSavePreferredLabels() {
  try {
    const collected = collectPreferredLabelsFromInputs();

    if (collected.length === 0) {
      updatePreferredLabelsStatus('Add at least one preferred label before saving.', 'error');
      return;
    }

    setWorkflowBusy(true);

    preferredLabels = collected.map(item => ({
      id: item.id,
      name: item.name
    }));

    const labelsToSave = preferredLabels.map(item => item.name);

    const response = await chrome.runtime.sendMessage({
      type: 'savePreferredLabels',
      data: { labels: labelsToSave }
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Unable to save preferred labels');
    }

    savedPreferredLabelNames = labelsToSave;
    classificationMode = 'preferred';
    updatePreferredLabelsStatus('Preferences saved! Categorizing chats now...', 'success', true);
    renderPreferredLabels();
    updateLabelGenerationModeUI(processedChatCount);

    await runWorkflowClassification('preferred');
  } catch (error) {
    console.error('[Popup] Error saving preferred labels:', error);
    updatePreferredLabelsStatus('Unable to categorize chats. ' + error.message, 'error');
    setWorkflowBusy(false);
  }
}

/**
 * Continue to next step without saving preferred labels
 */
async function handleContinueWithoutPreferences() {
  try {
    setWorkflowBusy(true);

    const response = await chrome.runtime.sendMessage({
      type: 'savePreferredLabels',
      data: { labels: [] }
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Unable to update preferences');
    }

    classificationMode = 'auto';
    savedPreferredLabelNames = [];
    preferredLabels = [];
    renderPreferredLabels();
    addPreferredLabel('', { silent: true, focus: false });

    updatePreferredLabelsStatus('Continuing without preferences. We\'ll auto-generate labels in the next step.', 'info', true);
    updateLabelGenerationModeUI(processedChatCount);

    await runWorkflowClassification('auto');
  } catch (error) {
    console.error('[Popup] Error continuing without preferences:', error);
    updatePreferredLabelsStatus('Unable to categorize chats. ' + error.message, 'error');
    setWorkflowBusy(false);
  }
}

/**
 * Load preferred labels from storage
 */
async function loadPreferredLabels() {
  if (!preferredLabelsList) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'getPreferredLabels' });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to load preferred labels');
    }

    const labels = Array.isArray(response.data)
      ? response.data.map(label => (label || '').trim()).filter(label => label.length > 0)
      : [];

    savedPreferredLabelNames = labels;
    preferredLabels = labels.map(label => ({
      id: `saved_${Math.random().toString(36).slice(2, 10)}`,
      name: label
    }));

    classificationMode = labels.length > 0 ? 'preferred' : 'auto';

    if (!preferredLabels.length) {
      preferredLabels = [];
      renderPreferredLabels();
      addPreferredLabel('', { silent: true, focus: false });
      updatePreferredLabelsStatus(PREFERRED_LABEL_STATUS_DEFAULT, 'info', true);
    } else {
      renderPreferredLabels();
      updatePreferredLabelsStatus(
        `${preferredLabels.length} preferred label${preferredLabels.length === 1 ? '' : 's'} saved.`,
        'info',
        true
      );
    }

    updateLabelGenerationModeUI(processedChatCount);
    updateClassificationAvailability(processedChatCount);
  } catch (error) {
    console.error('[Popup] Error loading preferred labels:', error);
    preferredLabels = [];
    renderPreferredLabels();
    addPreferredLabel('', { silent: true, focus: false });
    updatePreferredLabelsStatus('Error loading preferred labels. Try again.', 'error');
    updateLabelGenerationModeUI(processedChatCount);
    updateClassificationAvailability(processedChatCount);
  }
}

/**
 * Update classification availability based on processed chats and preferences
 * @param {number} processedCount - Number of processed chats
 */
function updateClassificationAvailability(processedCount) {
  if (!generateLabelsBtn) {
    return;
  }

  const hasPreferences = savedPreferredLabelNames.length > 0;
  const isAutoMode = classificationMode === 'auto';
  const canClassify = processedCount > 0 && (hasPreferences || isAutoMode);

  generateLabelsBtn.disabled = !canClassify;

  if (processedCount === 0) {
    generateLabelsBtn.title = 'Summarize chats before generating labels.';
  } else if (!hasPreferences && !isAutoMode) {
    generateLabelsBtn.title = 'Save preferred labels or skip to auto-categorize.';
  } else {
    generateLabelsBtn.removeAttribute('title');
  }

  setGenerateLabelsIdleButtonText(processedCount);
}

/**
 * Count chats in a label that are still visible in the library
 * @param {Array<string>} chatIds
 * @returns {number}
 */
function calculateVisibleChatCount(chatIds = []) {
  if (!Array.isArray(chatIds) || chatIds.length === 0) {
    return 0;
  }

  if (!Array.isArray(window.allChats) || window.allChats.length === 0) {
    return chatIds.length;
  }

  const visibleSet = new Set(window.allChats.map(chat => chat.id));
  return chatIds.reduce((count, chatId) => count + (visibleSet.has(chatId) ? 1 : 0), 0);
}

/**
 * Render suggested labels
 */
function renderSuggestedLabels(labels) {
  labels = [...labels].sort((a, b) => (b.chatIds?.length || 0) - (a.chatIds?.length || 0));

  if (labels.length === 0) {
    suggestedList.innerHTML = '<div class="empty-state"><p>No suggestions yet. Run AI processing to generate label suggestions.</p></div>';
    clearSuggestedBtn.style.display = 'none';
    return;
  }

  // Show clear button when there are suggested labels
  clearSuggestedBtn.style.display = 'inline-flex';

  suggestedList.innerHTML = labels.map(label => {
    const visibleChatCount = calculateVisibleChatCount(label.chatIds);
    return `
      <div class="label-item suggested" data-id="${label.id}">
        <div class="label-content">
          <h3>${label.name}</h3>
          <p>${label.description}</p>
          <span class="badge-small">${visibleChatCount} chats</span>
        </div>
        <div class="label-actions">
          <button class="btn btn-small btn-accept" data-label-id="${label.id}">Accept</button>
          <button class="btn btn-small btn-dismiss" data-label-id="${label.id}">Dismiss</button>
        </div>
      </div>
    `;
  }).join('');

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

  // Sort labels by position (if available), otherwise maintain original order
  labels.sort((a, b) => {
    const posA = typeof a.position === 'number' ? a.position : 999999;
    const posB = typeof b.position === 'number' ? b.position : 999999;
    return posA - posB;
  });

  // Show clear button when there are accepted labels
  clearAcceptedBtn.style.display = 'inline-flex';

  labelList.innerHTML = labels.map(label => {
    const visibleChatCount = calculateVisibleChatCount(label.chatIds);

    return `
      <div class="label-item clickable" data-id="${label.id}" draggable="true">
        <div class="label-drag-handle">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" opacity="0.4">
            <path d="M6 4h.01M6 8h.01M6 12h.01M10 4h.01M10 8h.01M10 12h.01" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="label-content">
          <h3>${label.name}</h3>
          <span class="badge-small">${visibleChatCount} chats</span>
        </div>
        <div class="label-item-actions">
          <button class="label-delete-btn" data-label-id="${label.id}" title="Delete label" draggable="false">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor">
              <path d="M3 3.5h6M4 3.5V2.5C4 2.22386 4.22386 2 4.5 2h3C7.77614 2 8 2.22386 8 2.5v1M9 3.5v6c0 .5523-.4477 1-1 1H4c-.55228 0-1-.4477-1-1v-6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 5.5v3M7 5.5v3" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <svg class="label-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path d="M7 4L13 10L7 16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;
  }).join('');

  // Add click listeners to navigate to label detail page
  labelList.querySelectorAll('.label-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't navigate if user is dragging
      if (e.target.closest('.label-drag-handle')) {
        return;
      }
      if (e.target.closest('.label-delete-btn')) {
        return;
      }
      const labelId = item.getAttribute('data-id');
      openLabelDetail(labelId);
    });
  });

  // Add delete button listeners
  labelList.querySelectorAll('.label-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const labelId = btn.getAttribute('data-label-id');
      await handleDeleteLabel(labelId);
    });
  });

  // Setup drag and drop
  setupLabelDragAndDrop();
}

/**
 * Setup drag and drop for label reordering
 */
function setupLabelDragAndDrop() {
  const labelItems = labelList.querySelectorAll('.label-item');
  let draggedElement = null;
  let draggedOverElement = null;

  labelItems.forEach(item => {
    // Drag start
    item.addEventListener('dragstart', (e) => {
      draggedElement = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', item.innerHTML);
    });

    // Drag end
    item.addEventListener('dragend', (e) => {
      item.classList.remove('dragging');
      // Remove all drag-over classes
      labelItems.forEach(i => i.classList.remove('drag-over'));
      draggedElement = null;
      draggedOverElement = null;
    });

    // Drag over
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (draggedElement && draggedElement !== item) {
        item.classList.add('drag-over');
        draggedOverElement = item;
      }
    });

    // Drag leave
    item.addEventListener('dragleave', (e) => {
      item.classList.remove('drag-over');
    });

    // Drop
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      item.classList.remove('drag-over');

      if (draggedElement && draggedElement !== item) {
        // Reorder DOM elements
        const allItems = Array.from(labelList.querySelectorAll('.label-item'));
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(item);

        if (draggedIndex < targetIndex) {
          item.parentNode.insertBefore(draggedElement, item.nextSibling);
        } else {
          item.parentNode.insertBefore(draggedElement, item);
        }

        // Save new order to storage
        await saveLabelOrder();
      }
    });
  });
}

/**
 * Save label order to storage
 */
async function saveLabelOrder() {
  try {
    const labelItems = labelList.querySelectorAll('.label-item');
    const labelOrder = Array.from(labelItems).map(item => item.getAttribute('data-id'));

    console.log('[Popup] Saving label order:', labelOrder);

    // Get all labels
    const response = await chrome.runtime.sendMessage({ type: 'getAllLabels' });
    if (!response.success) {
      throw new Error('Failed to get labels');
    }

    const labels = Object.values(response.data);

    // Update each label with its new position
    for (let i = 0; i < labelOrder.length; i++) {
      const labelId = labelOrder[i];
      const label = labels.find(l => l.id === labelId);

      if (label) {
        await chrome.runtime.sendMessage({
          type: 'updateLabel',
          data: {
            labelId: labelId,
            updates: { position: i }
          }
        });
      }
    }

    console.log('[Popup] Label order saved successfully');
  } catch (error) {
    console.error('[Popup] Error saving label order:', error);
  }
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

// Track expanded chat states
let expandedLibraryChats = new Set();
let expandedLabelChats = new Set();

// Preferred labels state
const MAX_PREFERRED_LABELS = 6;
const PREFERRED_LABEL_STATUS_DEFAULT = 'Add up to six labels or skip to auto-categorize.';
let preferredLabels = [];
let savedPreferredLabelNames = [];
let preferredStatusTimeout = null;
let processedChatCount = 0;
let classificationMode = 'preferred';
let toastTimeout = null;

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

    // Load chats
    currentLabelChats = [];
    for (const chatId of label.chatIds) {
      const chat = await StorageService.getChat(chatId);
      if (chat && !chat.excludeFromLibrary) {
        currentLabelChats.push(chat);
      } else if (chat && chat.excludeFromLibrary) {
        console.log(`[Popup] Skipping chat ${chat.id} in label view - excluded from library`);
      }
    }

    // Sort by date (newest first)
    currentLabelChats.sort((a, b) => b.date - a.date);

    labelViewChatCount.textContent = `${currentLabelChats.length} chat${currentLabelChats.length !== 1 ? 's' : ''}`;

    // Load summary if exists
    if (label.summary) {
      summaryContent.innerHTML = `<p>${label.summary}</p>`;
    } else {
      summaryContent.innerHTML = `<p class="summary-placeholder">Click "Generate Summary" to create an aggregated summary from all conversations in this label.</p>`;
    }

    // Load stored mind map if it exists
    if (label.bulletPoints) {
      bulletpointsContent.innerHTML = label.bulletPoints;
      // Attach click handlers to loaded mind map links
      attachBulletPointsClickHandlers();
    } else {
      bulletpointsContent.innerHTML = `<p class="bulletpoints-placeholder">Click "Generate Mind Map" to create a layered overview of every conversation in this label.</p>`;
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
    bulletpoints: document.getElementById('bulletpointsTab')
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

    const chatSummary = chat.chatSummary || 'No summary available';
    const hasPairSummaries = chat.messagePairSummaries && chat.messagePairSummaries.length > 0;
    const pairCount = hasPairSummaries
      ? chat.messagePairSummaries.length
      : Math.floor(messageCount / 2);

    // Debug logging
    console.log(`[Popup] Rendering chat ${chat.id}: hasPairSummaries=${hasPairSummaries}, pairCount=${pairCount}`);

    return `
      <div class="chat-item" data-id="${chat.id}" data-platform="${chat.platform}">
        <div class="chat-item-header">
          <span class="chat-platform-badge ${chat.platform}">${PLATFORMS[chat.platform].name}</span>
          <span class="chat-item-title">${chat.title}</span>
          <div class="chat-item-actions">
            <button class="chat-item-delete-btn" data-chat-id="${chat.id}" title="Remove chat from this label">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M3 3.5h6M4 3.5V2.5C4 2.22386 4.22386 2 4.5 2h3C7.77614 2 8 2.22386 8 2.5v1M9 3.5v6c0 .5523-.4477 1-1 1H4c-.55228 0-1-.4477-1-1v-6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 5.5v3M7 5.5v3" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="chat-item-link-btn" data-url="${chat.url}" title="Open original chat">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M9 6.5V9.5C9 9.77614 8.77614 10 8.5 10H2.5C2.22386 10 2 9.77614 2 9.5V3.5C2 3.22386 2.22386 3 2.5 3H5.5" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M7 2H10M10 2V5M10 2L6 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="chat-item-summary-headline">${chatSummary}</div>
        <div class="chat-item-meta">
          <span class="chat-item-messages">${pairCount} Q&As</span>
          <span class="chat-item-date">${date}</span>
          ${hasPairSummaries ? `
            <button class="chat-item-expand-btn" data-chat-id="${chat.id}" title="Show message pair summaries">
              <svg class="chevron-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M3 4.5L6 7.5L9 4.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Details
            </button>
          ` : ''}
        </div>
        ${hasPairSummaries ? `
          <div class="chat-item-expansion" data-chat-id="${chat.id}">
            <div class="chat-item-expansion-header">Message Pair Summaries:</div>
            <div class="chat-item-pair-summaries">
              ${chat.messagePairSummaries.map((summary, index) => `
                <div class="chat-item-pair-summary">
                  <span class="pair-number">${index + 1}.</span>
                  <span class="pair-text">${summary}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
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

  // Add event listeners for delete buttons
  const deleteButtons = labelChatList.querySelectorAll('.chat-item-delete-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chatId = btn.getAttribute('data-chat-id');
      await handleRemoveChatFromLabel(chatId);
    });
  });

  // Add event listeners for expand/collapse buttons
  const expandButtons = labelChatList.querySelectorAll('.chat-item-expand-btn');
  expandButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const chatId = btn.getAttribute('data-chat-id');
      toggleChatExpansion(chatId, btn, 'label');
    });
  });

  // Restore expansion states
  expandedLabelChats.forEach(chatId => {
    const expansion = labelChatList.querySelector(`.chat-item-expansion[data-chat-id="${chatId}"]`);
    const button = labelChatList.querySelector(`.chat-item-expand-btn[data-chat-id="${chatId}"]`);
    if (expansion && button) {
      expansion.classList.add('expanded');
      const chevron = button.querySelector('.chevron-icon');
      if (chevron) {
        chevron.style.transform = 'rotate(180deg)';
      }
    }
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
    summaryContent.innerHTML = `<p class="summary-placeholder">Generating AI-powered aggregated summary from ${chatSummaries.length} conversations...</p>`;

    // Get label name for context
    const label = await StorageService.getLabel(currentLabelId);
    const labelName = label ? label.name : '';

    // Use AI to create intelligent aggregated summary
    const aggregatedSummary = await AIService.aggregateChatSummaries(chatSummaries, labelName);

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
 * Handle mind map generation
 */
async function handleGenerateBulletPoints() {
  console.log('[Popup] Generating mind map...');

  try {
    // Disable button
    generateBulletPointsBtn.disabled = true;
    generateBulletPointsBtn.textContent = 'Generating...';

    // Prepare chat objects with full context (not just flat summaries)
    const chatsWithContext = currentLabelChats
      .filter(chat => chat.chatSummary && chat.messagePairSummaries && chat.messagePairSummaries.length > 0)
      .map(chat => ({
        id: chat.id,
        title: chat.title,
        url: chat.url,
        platform: chat.platform,
        chatSummary: chat.chatSummary,
        messagePairSummaries: chat.messagePairSummaries
      }));

    if (chatsWithContext.length === 0) {
      throw new Error('No chats with summaries available. Please run summarization first.');
    }

    // Show loading state
    bulletpointsContent.innerHTML = `<p class="bulletpoints-placeholder">Generating an AI-powered mind map from ${chatsWithContext.length} conversations...</p>`;

    // Get label name for context
    const label = await StorageService.getLabel(currentLabelId);
    const labelName = label ? label.name : '';

    // Use AI to create a structured mind map with chat links
    const bulletPointsHTML = await AIService.generateBulletPoints(chatsWithContext, labelName);

    bulletpointsContent.innerHTML = bulletPointsHTML;

    // Save mind map to label
    await StorageService.updateLabel(currentLabelId, {
      bulletPoints: bulletPointsHTML
    });

    // Attach click handlers to chat links
    attachBulletPointsClickHandlers();

    console.log('[Popup] Mind map generated successfully');

  } catch (error) {
    console.error('[Popup] Error generating mind map:', error);
    bulletpointsContent.innerHTML = `<p class="bulletpoints-placeholder" style="color: #ef4444;">Error: ${error.message}</p>`;
  } finally {
    // Re-enable button
    generateBulletPointsBtn.disabled = false;
    generateBulletPointsBtn.innerHTML = `
      <svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <circle cx="8" cy="8" r="2.5" stroke-width="1.4"/>
        <circle cx="3" cy="3" r="1.8" stroke-width="1.2"/>
        <circle cx="13" cy="4" r="1.5" stroke-width="1.2"/>
        <circle cx="4" cy="13" r="1.5" stroke-width="1.2"/>
        <path d="M4.5 4.5L6.8 6.8M11.2 5L9 6.5M5.5 11.5L7.3 9.7" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      Generate Mind Map
    `;
  }
}

/**
 * Attach click handlers to mind map chat links
 */
function attachBulletPointsClickHandlers() {
  const chatLinks = bulletpointsContent.querySelectorAll('.chat-link');
  chatLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = link.getAttribute('href');
      if (url) {
        chrome.tabs.create({ url, active: true });
      }
    });
  });
}

/**
 * Handle create label
 */
async function handleCreateLabel() {
  await openLabelWorkflow();
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

/**
 * Get the user-selected ChatGPT import limit
 * @returns {number} Number of ChatGPT conversations to import (default 200)
 */
function getChatgptImportLimit() {
  if (!chatgptLimitSelect) {
    return 200;
  }

  const value = parseInt(chatgptLimitSelect.value, 10);
  if (Number.isNaN(value)) {
    return 200;
  }

  return Math.min(Math.max(value, 0), 200);
}

/**
 * Get the user-selected Claude import limit
 * @returns {number} Number of Claude conversations to import (default 50)
 */
function getClaudeImportLimit() {
  if (!claudeLimitSelect) {
    return 50;
  }

  const value = parseInt(claudeLimitSelect.value, 10);
  if (Number.isNaN(value)) {
    return 50;
  }

  return Math.min(Math.max(value, 0), 50);
}

/**
 * Get the user-selected Gemini import limit
 * @returns {number} Number of Gemini conversations to import (default 50)
 */
function getGeminiImportLimit() {
  if (!geminiLimitSelect) {
    return 50;
  }

  const value = parseInt(geminiLimitSelect.value, 10);
  if (Number.isNaN(value)) {
    return 50;
  }

  return Math.min(Math.max(value, 0), 50);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
