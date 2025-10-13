/**
 * Claude Content Script - Chat History Scraper
 *
 * Extracts conversation metadata and content from claude.ai
 * Supports parallel tab processing for fast bulk imports
 */

(function() {
  'use strict';

  console.log('[Claude Scraper] Content script loaded');

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
      console.log('[Claude Scraper] Extracting conversation list...');

      // Wait for sidebar navigation to load
      await waitForElement('nav[aria-label="Sidebar"]', 10000);

      // Small delay to ensure content is rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find all conversation links (Claude uses direct links with /chat/ in href)
      const conversationElements = document.querySelectorAll('a[href*="/chat/"]');
      console.log('[Claude Scraper] Found', conversationElements.length, 'conversations');

      const conversations = [];

      for (const elem of conversationElements) {
        try {
          // Extract title from link text
          const title = elem.textContent?.trim() || 'Untitled Conversation';

          // Extract URL
          const url = elem.href;

          // Extract ID from URL (format: /chat/{id})
          const idMatch = url.match(/\/chat\/([a-zA-Z0-9-]+)/);
          const id = idMatch ? `claude-${idMatch[1]}` : null;

          if (!id) {
            console.warn('[Claude Scraper] Could not extract ID from URL:', url);
            continue;
          }

          // Create conversation metadata object
          const conversation = {
            id,
            platform: 'claude',
            title,
            url,
            date: Date.now() // Will be updated with actual date if available
          };

          conversations.push(conversation);
        } catch (error) {
          console.error('[Claude Scraper] Error extracting conversation:', error);
        }
      }

      console.log('[Claude Scraper] Extracted', conversations.length, 'conversations');
      return conversations;

    } catch (error) {
      console.error('[Claude Scraper] Error in extractConversations:', error);
      throw error;
    }
  }

  /**
   * Extract current conversation content
   * @returns {Promise<Object>} Conversation object with messages
   */
  async function extractCurrentConversation() {
    try {
      console.log('[Claude Scraper] Extracting current conversation...');

      // Wait for main content area to load (Claude changed their structure)
      await waitForElement('div.w-full.relative.min-w-0', 10000);

      // Small delay to ensure all content is rendered
      await new Promise(resolve => setTimeout(resolve, 800));

      // Extract title from page or use default
      const titleElement = document.querySelector('h1');
      const title = titleElement?.textContent?.trim() || 'Untitled Conversation';

      // Extract URL and ID
      const url = window.location.href;
      const idMatch = url.match(/\/chat\/([a-zA-Z0-9-]+)/);
      const id = idMatch ? `claude-${idMatch[1]}` : `claude-${Date.now()}`;

      // Get main content area (Claude's new structure doesn't use data-testid attributes)
      const mainContent = document.querySelector('div.w-full.relative.min-w-0');

      // Extract all text content from main area
      const rawContent = mainContent?.innerText?.trim() || '';

      console.log('[Claude Scraper] Extracted conversation content:', rawContent.length, 'characters');

      // For Claude, we'll store the entire conversation as one message since
      // individual message separation is unreliable with their current DOM structure
      const messages = [
        {
          role: 'assistant',
          content: rawContent
        }
      ];

      // Create conversation object
      const conversation = {
        id,
        platform: 'claude',
        title,
        url,
        date: Date.now(),
        messages,
        rawContent,
        processed: false,
        labelIds: []
      };

      console.log('[Claude Scraper] Extracted conversation with', rawContent.length, 'characters of content');
      return conversation;

    } catch (error) {
      console.error('[Claude Scraper] Error in extractCurrentConversation:', error);
      throw error;
    }
  }

  /**
   * Message listener for popup commands
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Claude Scraper] Received message:', message.action);

    if (message.action === 'extractConversations') {
      // Extract conversation list from sidebar
      extractConversations()
        .then(conversations => {
          sendResponse({ success: true, data: conversations });
        })
        .catch(error => {
          console.error('[Claude Scraper] Error:', error);
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
          console.error('[Claude Scraper] Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }

    return false;
  });

  console.log('[Claude Scraper] Ready for extraction commands');

})();
