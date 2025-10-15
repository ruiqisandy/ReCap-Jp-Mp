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
   * Parse Claude messages from raw content text
   * @param {string} rawContent - Raw conversation text
   * @returns {Array} Array of message objects with role and content
   */
  function parseClaudeMessages(rawContent) {
    const messages = [];

    if (!rawContent || rawContent.length === 0) {
      return messages;
    }

    // Claude raw content structure:
    // 1. Title\nShare (first section, skip it)
    // 2. \nMY\n marks start of each user question
    // 3. \nRetry\n marks end of each assistant response
    // 4. Last section is boilerplate: "Claude can make mistakes..."

    // Remove the title section (everything before first "\nMY\n")
    const firstMYIndex = rawContent.indexOf('\nMY\n');
    if (firstMYIndex === -1) {
      // No messages found, return empty
      console.log('[Claude Scraper] No messages found (no MY marker)');
      return messages;
    }

    // Get content after title (skip "Title\nShare" section)
    let contentAfterTitle = rawContent.substring(firstMYIndex);

    // Remove boilerplate at the end
    const boilerplatePatterns = [
      'Claude can make mistakes. Please double-check responses.',
      'Claude does not have the ability to run the code it generates yet.',
      /Sonnet \d+\.\d+$/,
      /Claude \d+\.\d+$/
    ];

    for (const pattern of boilerplatePatterns) {
      if (typeof pattern === 'string') {
        contentAfterTitle = contentAfterTitle.replace(pattern, '').trim();
      } else {
        contentAfterTitle = contentAfterTitle.replace(pattern, '').trim();
      }
    }

    // Split by "\nMY\n" to get conversation pairs
    const conversationPairs = contentAfterTitle.split(/\nMY\n/).filter(s => s.trim());

    for (const pair of conversationPairs) {
      // Each pair contains: user question + "\nRetry\n" + assistant response
      const retryIndex = pair.indexOf('\nRetry\n');

      if (retryIndex === -1) {
        // No Retry found, treat entire content as user message
        const userContent = pair.trim();
        if (userContent && userContent !== 'Share') {
          messages.push({
            role: 'user',
            content: userContent
          });
        }
      } else {
        // Split by Retry
        const userContent = pair.substring(0, retryIndex).trim();
        const assistantContent = pair.substring(retryIndex + 7).trim(); // +7 for "\nRetry\n" length

        // Add user message
        if (userContent && userContent !== 'Share') {
          messages.push({
            role: 'user',
            content: userContent
          });
        }

        // Add assistant message (skip if it's boilerplate)
        if (assistantContent &&
            assistantContent !== 'Share' &&
            !assistantContent.startsWith('Claude can make mistakes') &&
            !assistantContent.startsWith('Claude does not have the ability')) {
          messages.push({
            role: 'assistant',
            content: assistantContent
          });
        }
      }
    }

    console.log('[Claude Scraper] Parsed', messages.length, 'individual messages');
    return messages;
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

      // Extract title - try h1 first, then generate from content
      let title = 'Untitled Conversation';

      console.log('[Claude Scraper] Looking for title...');

      const titleElement = document.querySelector('h1');
      if (titleElement && titleElement.textContent) {
        const extractedTitle = titleElement.textContent.trim();
        if (extractedTitle && extractedTitle !== 'Claude' && extractedTitle.length > 3) {
          title = extractedTitle;
          console.log('[Claude Scraper] ✓ Found title from h1:', title);
        }
      }

      // Extract URL and ID
      const url = window.location.href;
      const idMatch = url.match(/\/chat\/([a-zA-Z0-9-]+)/);
      const id = idMatch ? `claude-${idMatch[1]}` : `claude-${Date.now()}`;

      // Get main content area (Claude's new structure doesn't use data-testid attributes)
      const mainContent = document.querySelector('div.w-full.relative.min-w-0');

      // Extract all text content from main area
      const rawContent = mainContent?.innerText?.trim() || '';

      console.log('[Claude Scraper] Extracted conversation content:', rawContent.length, 'characters');

      // If no title found, generate from first part of content
      if (title === 'Untitled Conversation' && rawContent.length > 0) {
        console.log('[Claude Scraper] No h1, generating title from content...');
        // Take first line or first 60 chars, whichever is shorter
        const firstLine = rawContent.split('\n')[0].trim();
        title = firstLine.substring(0, 60);
        if (firstLine.length > 60) title += '...';
        console.log('[Claude Scraper] ✓ Generated title:', title);
      }

      // Parse individual messages from rawContent
      // Claude's innerText includes "MY" markers for user messages and "Retry" separators
      const messages = parseClaudeMessages(rawContent);

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
