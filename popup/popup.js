/**
 * Popup Script for AI-ReCap - Module 2
 * Parallel tab processing for fast chat import
 */

console.log('[Popup] Script loaded - Module 2');

// Configuration constants
const MAX_PARALLEL_TABS = 6;  // Process 6 conversations simultaneously
const TAB_TIMEOUT = 3000;      // 3 second timeout per tab
const BATCH_DELAY = 500;       // Delay between batches
const DYNAMIC_CONTENT_DELAY = 800;  // Wait after page load for dynamic content

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
const suggestedBadge = document.getElementById('suggestedBadge');
const suggestedList = document.getElementById('suggestedList');
const createLabelBtn = document.getElementById('createLabelBtn');
const labelList = document.getElementById('labelList');
const settingsBtn = document.getElementById('settingsBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
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
 */
async function checkAIAvailability() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'checkAI' });

    if (response.success) {
      const availability = response.data;

      if (availability.promptAPI && availability.summarizerAPI) {
        welcomeAiStatus.textContent = '✓ AI Ready';
        welcomeAiStatusDot.className = 'status-dot status-ready';
      } else if (availability.promptAPI) {
        welcomeAiStatus.textContent = '⚠ AI Partially Available';
        welcomeAiStatusDot.className = 'status-dot status-partial';
      } else {
        welcomeAiStatus.textContent = '✗ AI Unavailable';
        welcomeAiStatusDot.className = 'status-dot status-unavailable';
      }

      console.log('[Popup] AI availability:', availability);
    }
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
 * @param {string} screenName - 'welcome', 'progress', or 'library'
 */
function showScreen(screenName) {
  // Hide all screens
  welcomeScreen.style.display = 'none';
  progressScreen.style.display = 'none';
  libraryScreen.style.display = 'none';

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
  createLabelBtn.addEventListener('click', handleCreateLabel);
  settingsBtn.addEventListener('click', handleSettings);
  clearDataBtn.addEventListener('click', handleClearData);

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

    // Gemini: 55-80%
    if (PLATFORMS.gemini.enabled) {
      statusTextEl.textContent = 'Importing from Gemini...';
      const geminiCount = await importFromPlatformParallel('gemini', (current, total) => {
        geminiCountEl.textContent = current;
        const progress = 55 + ((current / total) * 25);
        updateProgress(progress);
      });
      platformResults.gemini = geminiCount;
      totalImported += geminiCount;
      console.log('[Popup] Gemini import complete:', geminiCount);
    }

    // AI Processing: 80-100%
    if (totalImported > 0) {
      updateProgress(80);
      statusTextEl.textContent = 'Analyzing conversations with AI...';

      try {
        await chrome.runtime.sendMessage({ type: 'processChatsForLabels' });
        console.log('[Popup] AI processing complete');
      } catch (error) {
        console.error('[Popup] AI processing error:', error);
        statusTextEl.textContent = 'Import complete (AI processing failed)';
      }
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
    let processed = 0;

    for (const batch of batches) {
      const chats = await processBatchParallel(batch);
      allChats.push(...chats);
      processed += batch.length;

      // Update progress
      onProgress(processed, conversations.length);

      // Small delay between batches
      if (processed < conversations.length) {
        await delay(BATCH_DELAY);
      }
    }

    // Step 5: Batch save all chats
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
 * @returns {Promise<Array>} Array of extracted conversations
 */
async function processBatchParallel(conversationBatch) {
  console.log(`[Popup] Processing batch of ${conversationBatch.length} conversations`);

  // Create array of promises
  const promises = conversationBatch.map(conv => extractConversationInNewTab(conv));

  // Use Promise.allSettled to handle failures gracefully
  const results = await Promise.allSettled(promises);

  // Filter successful extractions
  const successfulChats = results
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => result.value);

  console.log(`[Popup] Batch complete: ${successfulChats.length}/${conversationBatch.length} successful`);

  return successfulChats;
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
    const EXTRACTION_TIMEOUT = 15000; // 15 seconds max per extraction

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
    // ALWAYS close tab in finally block
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
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
 * Inject content script into a tab
 * @param {number} tabId - Tab ID
 * @param {string} platform - Platform name
 * @returns {Promise<void>}
 */
async function injectContentScript(tabId, platform) {
  try {
    const scriptFile = `content-scripts/${platform}-scraper.js`;
    console.log(`[Popup] Injecting ${scriptFile} into tab ${tabId}`);

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile]
    });

    // Wait a bit for script to initialize
    await delay(500);

    console.log(`[Popup] Content script injected successfully`);
    return true;
  } catch (error) {
    // Error pages, invalid tabs, etc. - just log and return false
    // The caller will handle this gracefully
    console.warn(`[Popup] Could not inject content script into tab ${tabId}:`, error.message);
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
 * Load library screen data
 */
async function loadLibrary() {
  try {
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

    // Load all chats
    await loadAllChats();

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
        </div>
        <div class="chat-item-meta">
          <span class="chat-item-messages">${messageCount} messages</span>
          <span class="chat-item-date">${date}</span>
        </div>
      </div>
    `;
  }).join('');
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
    return;
  }

  suggestedList.innerHTML = labels.map(label => `
    <div class="label-item suggested" data-id="${label.id}">
      <div class="label-content">
        <h3>${label.name}</h3>
        <p>${label.description}</p>
        <span class="badge-small">${label.chatIds.length} chats</span>
      </div>
      <div class="label-actions">
        <button class="btn btn-small btn-accept" onclick="acceptLabel('${label.id}')">Accept</button>
        <button class="btn btn-small btn-dismiss" onclick="dismissLabel('${label.id}')">Dismiss</button>
      </div>
    </div>
  `).join('');
}

/**
 * Render user labels
 */
function renderLabels(labels) {
  if (labels.length === 0) {
    labelList.innerHTML = '<div class="empty-state"><p>Your curated labels will appear here.</p></div>';
    return;
  }

  labelList.innerHTML = labels.map(label => `
    <div class="label-item" data-id="${label.id}">
      <div class="label-content">
        <h3>${label.name}</h3>
        <span class="badge-small">${label.chatIds.length} chats</span>
      </div>
    </div>
  `).join('');
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
