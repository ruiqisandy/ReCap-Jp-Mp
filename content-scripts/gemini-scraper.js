/**
 * Gemini Content Script - Chat History Scraper
 *
 * Extracts conversation metadata and content from gemini.google.com
 * Supports parallel tab processing for fast bulk imports
 * Note: Gemini's DOM structure may vary - designed with flexibility
 */

(function() {
  'use strict';

  console.log('[Gemini Scraper] Content script loaded');

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
   * Extract conversation list from sidebar
   * @returns {Promise<Array>} Array of conversation metadata objects
   */
  async function extractConversations() {
    try {
      console.log('[Gemini Scraper] Extracting conversation list...');

      // Wait for conversation elements to load (Gemini uses divs, not links)
      await waitForElement('.conversation', 10000);

      // Small delay to ensure content is rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Gemini uses div elements with class "conversation" instead of links
      const conversationElements = document.querySelectorAll('.conversation');
      console.log('[Gemini Scraper] Found', conversationElements.length, 'conversations');

      const conversations = [];

      for (const elem of conversationElements) {
        try {
          // Extract title from conversation-title element
          const titleElement = elem.querySelector('.conversation-title');
          const title = titleElement?.textContent?.trim() || 'Untitled Conversation';

          // Extract ID from jslog attribute
          // Format: jslog="...BardVeMetadataKey:[...,["c_CONVERSATION_ID",...]]..."
          const jslogAttr = elem.getAttribute('jslog');
          let conversationId = null;

          if (jslogAttr) {
            // Try to extract conversation ID from jslog using regex
            const idMatch = jslogAttr.match(/\["c_([a-zA-Z0-9]+)"/);
            if (idMatch) {
              conversationId = idMatch[1];
            }
          }

          if (!conversationId) {
            console.warn('[Gemini Scraper] Could not extract conversation ID from element');
            continue;
          }

          // Build URL (format: /app/{id})
          const url = `https://gemini.google.com/app/${conversationId}`;
          const id = `gemini-${conversationId}`;

          // Create conversation metadata object
          const conversation = {
            id,
            platform: 'gemini',
            title,
            url,
            date: Date.now() // Will be updated with actual date if available
          };

          conversations.push(conversation);
        } catch (error) {
          console.error('[Gemini Scraper] Error extracting conversation:', error);
        }
      }

      console.log('[Gemini Scraper] Extracted', conversations.length, 'conversations');
      return conversations;

    } catch (error) {
      console.error('[Gemini Scraper] Error in extractConversations:', error);
      throw error;
    }
  }

  /**
   * Extract current conversation content
   * @returns {Promise<Object>} Conversation object with messages
   */
  async function extractCurrentConversation() {
    try {
      console.log('[Gemini Scraper] Extracting current conversation...');

      // Try multiple possible selectors for message container
      const possibleSelectors = [
        '[data-test-id="message"]',
        '[role="article"]',
        '.conversation-turn',
        '[class*="message"]'
      ];

      let messageElements = [];

      for (const selector of possibleSelectors) {
        try {
          await waitForElement(selector, 3000);
          messageElements = document.querySelectorAll(selector);
          if (messageElements.length > 0) {
            console.log('[Gemini Scraper] Found messages with selector:', selector);
            break;
          }
        } catch (error) {
          console.log('[Gemini Scraper] Selector not found:', selector);
        }
      }

      if (messageElements.length === 0) {
        console.warn('[Gemini Scraper] No message elements found');
        throw new Error('No messages found in conversation');
      }

      // Small delay to ensure all content is rendered
      await new Promise(resolve => setTimeout(resolve, 800));

      // Extract title from page
      const titleElement = document.querySelector('h1, [role="heading"]');
      const title = titleElement?.textContent?.trim() || 'Untitled Conversation';

      // Extract URL and ID
      const url = window.location.href;
      const idMatch = url.match(/\/app\/([a-zA-Z0-9-]+)/);
      const id = idMatch ? `gemini-${idMatch[1]}` : `gemini-${Date.now()}`;

      console.log('[Gemini Scraper] Found', messageElements.length, 'message elements');

      const messages = [];
      let rawContent = '';

      for (const messageElement of messageElements) {
        try {
          // Try to determine role from context
          // Gemini typically alternates user/model or has distinguishing attributes
          const isUserMessage =
            messageElement.textContent?.toLowerCase().includes('you:') ||
            messageElement.getAttribute('data-author') === 'user' ||
            messageElement.classList.contains('user-message');

          const role = isUserMessage ? 'user' : 'assistant';

          // Extract content from innerText
          let content = messageElement.innerText?.trim() || '';

          // Clean up common prefixes
          content = content.replace(/^(You:|Model:)\s*/i, '');

          if (content && content.length > 10) { // Filter out very short messages
            messages.push({ role, content });
            rawContent += `[${role.toUpperCase()}]\n${content}\n\n`;
          }
        } catch (error) {
          console.error('[Gemini Scraper] Error extracting message:', error);
        }
      }

      // Create conversation object
      const conversation = {
        id,
        platform: 'gemini',
        title,
        url,
        date: Date.now(),
        messages,
        rawContent: rawContent.trim(),
        processed: false,
        labelIds: []
      };

      console.log('[Gemini Scraper] Extracted conversation with', messages.length, 'messages');
      return conversation;

    } catch (error) {
      console.error('[Gemini Scraper] Error in extractCurrentConversation:', error);
      throw error;
    }
  }

  /**
   * Message listener for popup commands
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Gemini Scraper] Received message:', message.action);

    if (message.action === 'extractConversations') {
      // Extract conversation list from sidebar
      extractConversations()
        .then(conversations => {
          sendResponse({ success: true, data: conversations });
        })
        .catch(error => {
          console.error('[Gemini Scraper] Error:', error);
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
          console.error('[Gemini Scraper] Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }

    return false;
  });

  console.log('[Gemini Scraper] Ready for extraction commands');

})();
