/**
 * ChatGPT Content Script - Chat History Scraper
 *
 * Extracts conversation metadata and content from chat.openai.com
 * Supports parallel tab processing for fast bulk imports
 */

(function() {
  'use strict';

  console.log('[ChatGPT Scraper] Content script loaded');

  /**
   * Wait for an element to appear in the DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Element>} The found element
   */
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      // Check if element already exists
      const element = document.querySelector(selector);
      if (element) {
        return resolve(element);
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);

      // Set up MutationObserver
      const observer = new MutationObserver((mutations) => {
        const element = document.querySelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(element);
        }
      });

      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  /**
   * Scroll sidebar to load all lazy-loaded conversations
   * @param {number} maxScrolls - Maximum number of scroll attempts
   * @returns {Promise<void>}
   */
  async function scrollToLoadAll(maxScrolls = 100) {
    console.log('[ChatGPT Scraper] Starting auto-scroll to load all conversations...');

    let previousCount = 0;
    let unchangedCount = 0;
    let scrollAttempts = 0;

    while (scrollAttempts < maxScrolls) {
      // Count current conversations before scroll
      const currentLinks = document.querySelectorAll('nav[aria-label="Chat history"] a[href*="/c/"]');
      const currentCount = currentLinks.length;

      console.log(`[ChatGPT Scraper] Scroll attempt ${scrollAttempts + 1}: Found ${currentCount} conversations`);

      // Get the last conversation link
      if (currentLinks.length > 0) {
        const lastLink = currentLinks[currentLinks.length - 1];

        // Scroll the last link into view to trigger lazy loading
        lastLink.scrollIntoView({ behavior: 'smooth', block: 'end' });

        console.log(`[ChatGPT Scraper] Scrolled last link into view`);
      } else {
        console.warn('[ChatGPT Scraper] No conversation links found to scroll');
        break;
      }

      // Wait longer for content to load (ChatGPT can be slow)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Count again after scroll
      const newLinks = document.querySelectorAll('nav[aria-label="Chat history"] a[href*="/c/"]');
      const newCount = newLinks.length;

      // Check if new content loaded
      if (newCount === previousCount) {
        unchangedCount++;
        console.log(`[ChatGPT Scraper] No new conversations loaded (unchanged: ${unchangedCount})`);

        // If count hasn't changed for 5 consecutive checks, we've reached the end
        if (unchangedCount >= 5) {
          console.log('[ChatGPT Scraper] Reached end of conversation list');
          break;
        }
      } else {
        unchangedCount = 0;
        console.log(`[ChatGPT Scraper] Loaded ${newCount - previousCount} new conversations`);
      }

      previousCount = newCount;
      scrollAttempts++;
    }

    const finalCount = document.querySelectorAll('nav[aria-label="Chat history"] a[href*="/c/"]').length;
    console.log(`[ChatGPT Scraper] Auto-scroll complete after ${scrollAttempts} attempts. Total: ${finalCount} conversations`);
  }

  /**
   * Extract conversation list from sidebar
   * @returns {Promise<Array>} Array of conversation metadata objects
   */
  async function extractConversations() {
    try {
      console.log('[ChatGPT Scraper] Extracting conversation list...');

      // Wait for sidebar navigation to load
      await waitForElement('nav[aria-label="Chat history"]', 10000);

      // Small delay to ensure content is rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[ChatGPT Scraper] Starting lazy-load scroll...');

      // Scroll to load all conversations
      await scrollToLoadAll();

      // Now extract all conversation links
      const conversationElements = document.querySelectorAll('nav[aria-label="Chat history"] a');
      console.log('[ChatGPT Scraper] Found', conversationElements.length, 'potential links');

      const conversations = [];

      for (const elem of conversationElements) {
        try {
          // Extract URL
          const url = elem.href;

          // Only process conversation links (must contain /c/)
          if (!url || !url.includes('/c/')) {
            continue;
          }

          // Extract ID from URL (format: /c/{id})
          const idMatch = url.match(/\/c\/([a-zA-Z0-9-]+)/);
          const id = idMatch ? `chatgpt-${idMatch[1]}` : null;

          if (!id) {
            console.warn('[ChatGPT Scraper] Could not extract ID from URL:', url);
            continue;
          }

          // Extract title - try multiple methods
          let title = '';

          // Method 1: Look for .grow class (old structure)
          const growElement = elem.querySelector('.grow');
          if (growElement) {
            title = growElement.textContent?.trim();
          }

          // Method 2: Get text content directly from link
          if (!title) {
            title = elem.textContent?.trim();
          }

          // Method 3: Fallback to URL-based title
          if (!title || title.length === 0) {
            title = 'Untitled Conversation';
          }

          // Create conversation metadata object
          const conversation = {
            id,
            platform: 'chatgpt',
            title,
            url,
            date: Date.now() // Will be updated with actual date if available
          };

          conversations.push(conversation);
        } catch (error) {
          console.error('[ChatGPT Scraper] Error extracting conversation:', error);
        }
      }

      console.log('[ChatGPT Scraper] Extracted', conversations.length, 'conversations');
      return conversations;

    } catch (error) {
      console.error('[ChatGPT Scraper] Error in extractConversations:', error);
      throw error;
    }
  }

  /**
   * Extract current conversation content
   * @returns {Promise<Object>} Conversation object with messages
   */
  async function extractCurrentConversation() {
    try {
      console.log('[ChatGPT Scraper] Extracting current conversation...');

      // Wait for conversation turns to load (with extended timeout)
      // Some conversations may take longer to load
      try {
        await waitForElement('[data-testid^="conversation-turn-"]', 12000);
      } catch (error) {
        console.warn('[ChatGPT Scraper] Timeout waiting for conversation turns, will try to extract anyway:', error.message);
        // Don't throw - try to extract what we can
      }

      // Small delay to ensure all content is rendered
      await new Promise(resolve => setTimeout(resolve, 800));

      // Wait for title to be updated (ChatGPT updates it dynamically)
      // Give it some time, but don't wait too long
      let title = 'Untitled Conversation';
      const startTime = Date.now();
      const titleTimeout = 3000; // Wait max 3 seconds for title

      while (Date.now() - startTime < titleTimeout) {
        const currentTitle = document.title?.trim();
        // Check if title is set and is not the default "ChatGPT" or empty
        if (currentTitle && currentTitle !== 'ChatGPT' && currentTitle.length > 0) {
          title = currentTitle;
          break;
        }
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('[ChatGPT Scraper] Extracted title:', title);

      // Extract URL and ID
      const url = window.location.href;
      const idMatch = url.match(/\/c\/([a-zA-Z0-9-]+)/);
      const id = idMatch ? `chatgpt-${idMatch[1]}` : `chatgpt-${Date.now()}`;

      // Extract all conversation turns
      const turnElements = document.querySelectorAll('[data-testid^="conversation-turn-"]');
      console.log('[ChatGPT Scraper] Found', turnElements.length, 'conversation turns');

      const messages = [];
      let rawContent = '';

      for (const turnElement of turnElements) {
        try {
          // Determine role from data-testid
          const testId = turnElement.getAttribute('data-testid');
          const isUser = testId && testId.includes('user');
          const role = isUser ? 'user' : 'assistant';

          // Extract content - try markdown first, fallback to innerText
          let content = '';
          const markdownElement = turnElement.querySelector('.markdown');
          if (markdownElement) {
            content = markdownElement.innerText?.trim() || '';
          } else {
            content = turnElement.innerText?.trim() || '';
          }

          if (content) {
            messages.push({ role, content });
            rawContent += `[${role.toUpperCase()}]\n${content}\n\n`;
          }
        } catch (error) {
          console.error('[ChatGPT Scraper] Error extracting turn:', error);
        }
      }

      // Create conversation object
      const conversation = {
        id,
        platform: 'chatgpt',
        title,
        url,
        date: Date.now(),
        messages,
        rawContent: rawContent.trim(),
        processed: false,
        labelIds: []
      };

      console.log('[ChatGPT Scraper] Extracted conversation with', messages.length, 'messages');
      return conversation;

    } catch (error) {
      console.error('[ChatGPT Scraper] Error in extractCurrentConversation:', error);
      throw error;
    }
  }

  /**
   * Message listener for popup commands
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ChatGPT Scraper] Received message:', message.action);

    if (message.action === 'extractConversations') {
      // Extract conversation list from sidebar
      extractConversations()
        .then(conversations => {
          sendResponse({ success: true, data: conversations });
        })
        .catch(error => {
          console.error('[ChatGPT Scraper] Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }

    if (message.action === 'extractCurrentConversation') {
      // Extract current conversation content
      extractCurrentConversation()
        .then(conversation => {
          sendResponse({ success: true, data: conversation });
        })
        .catch(error => {
          console.error('[ChatGPT Scraper] Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }

    return false;
  });

  console.log('[ChatGPT Scraper] Ready for extraction commands');

})();
