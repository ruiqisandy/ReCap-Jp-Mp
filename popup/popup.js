/**
 * Popup Script for AI-ReCap
 * Handles user interactions and communicates with background service worker
 */

console.log('[Popup] Script loaded');

// DOM elements
const chatCountEl = document.getElementById('chatCount');
const labelCountEl = document.getElementById('labelCount');
const aiStatusEl = document.getElementById('aiStatus');
const importBtn = document.getElementById('importBtn');
const processBtn = document.getElementById('processBtn');
const viewLabelsBtn = document.getElementById('viewLabelsBtn');
const settingsBtn = document.getElementById('settingsBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
const importStatusEl = document.getElementById('importStatus');
const progressFillEl = document.getElementById('progressFill');
const statusTextEl = document.getElementById('statusText');

/**
 * Initialize popup when loaded
 */
async function initialize() {
  console.log('[Popup] Initializing...');

  try {
    // Load statistics
    await loadStats();

    // Check AI availability
    await checkAIAvailability();

    // Setup event listeners
    setupEventListeners();

    console.log('[Popup] Initialization complete');
  } catch (error) {
    console.error('[Popup] Initialization error:', error);
  }
}

/**
 * Load and display statistics
 */
async function loadStats() {
  try {
    // Get storage stats
    const response = await chrome.runtime.sendMessage({
      type: 'getStorageStats'
    });

    if (response.success) {
      const stats = response.data;
      chatCountEl.textContent = stats.chatCount;
      labelCountEl.textContent = stats.labelCount;

      console.log('[Popup] Stats loaded:', stats);
    }
  } catch (error) {
    console.error('[Popup] Error loading stats:', error);
    chatCountEl.textContent = 'Error';
    labelCountEl.textContent = 'Error';
  }
}

/**
 * Check AI availability
 */
async function checkAIAvailability() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'checkAI'
    });

    if (response.success) {
      const availability = response.data;

      if (availability.promptAPI && availability.summarizerAPI) {
        aiStatusEl.textContent = '✓ Ready';
        aiStatusEl.style.color = '#22c55e';
        processBtn.disabled = false;
      } else if (availability.promptAPI) {
        aiStatusEl.textContent = '⚠ Partial';
        aiStatusEl.style.color = '#f59e0b';
        processBtn.disabled = false;
      } else {
        aiStatusEl.textContent = '✗ Unavailable';
        aiStatusEl.style.color = '#ef4444';
        processBtn.disabled = true;
      }

      console.log('[Popup] AI availability:', availability);
    }
  } catch (error) {
    console.error('[Popup] Error checking AI:', error);
    aiStatusEl.textContent = 'Error';
    aiStatusEl.style.color = '#ef4444';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  importBtn.addEventListener('click', handleImport);
  processBtn.addEventListener('click', handleProcess);
  viewLabelsBtn.addEventListener('click', handleViewLabels);
  settingsBtn.addEventListener('click', handleSettings);
  clearDataBtn.addEventListener('click', handleClearData);
}

/**
 * Handle import button click
 */
async function handleImport() {
  console.log('[Popup] Import button clicked');

  // Module 2 will implement full import functionality
  // For now, show a placeholder message
  alert('Import functionality will be implemented in Module 2!\n\nThis will allow you to import chat histories from ChatGPT, Claude, and Gemini.');
}

/**
 * Handle process button click
 */
async function handleProcess() {
  console.log('[Popup] Process button clicked');

  try {
    // Check if there are chats to process
    const statsResponse = await chrome.runtime.sendMessage({
      type: 'getStorageStats'
    });

    if (!statsResponse.success || statsResponse.data.chatCount === 0) {
      alert('No chats to process. Please import chats first.');
      return;
    }

    // Show processing status
    importStatusEl.style.display = 'block';
    statusTextEl.textContent = 'Processing with AI...';
    progressFillEl.style.width = '50%';
    processBtn.disabled = true;

    // Trigger AI processing
    const response = await chrome.runtime.sendMessage({
      type: 'processChatsForLabels'
    });

    if (response.success) {
      statusTextEl.textContent = 'Processing complete!';
      progressFillEl.style.width = '100%';

      // Reload stats
      await loadStats();

      setTimeout(() => {
        importStatusEl.style.display = 'none';
        processBtn.disabled = false;
      }, 2000);

      console.log('[Popup] Processing complete');
    } else {
      throw new Error(response.error || 'Processing failed');
    }
  } catch (error) {
    console.error('[Popup] Processing error:', error);
    statusTextEl.textContent = 'Error: ' + error.message;
    processBtn.disabled = false;
  }
}

/**
 * Handle view labels button click
 */
function handleViewLabels() {
  console.log('[Popup] View labels button clicked');

  // Module 4 will implement label library interface
  // For now, show a placeholder message
  alert('Label Library will be implemented in Module 4!\n\nYou will be able to:\n- View all labels\n- Accept or dismiss AI suggestions\n- Curate your knowledge library');
}

/**
 * Handle settings button click
 */
function handleSettings() {
  console.log('[Popup] Settings button clicked');
  alert('Settings panel coming soon!');
}

/**
 * Handle clear data button click
 */
async function handleClearData() {
  const confirmed = confirm('Are you sure you want to clear all data?\n\nThis will delete:\n- All imported chats\n- All labels\n- All suggested labels\n- All settings\n\nThis action cannot be undone.');

  if (!confirmed) {
    return;
  }

  try {
    // Send message to background to clear data
    await chrome.runtime.sendMessage({
      type: 'clearAllData'
    });

    console.log('[Popup] All data cleared');

    // Reload popup
    await loadStats();
    await checkAIAvailability();

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
