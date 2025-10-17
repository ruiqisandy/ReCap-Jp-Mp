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
   * Truncate text at word boundary
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length (default 80)
   * @returns {string} Truncated text with ellipsis if needed
   */
  function truncateAtWordBoundary(text, maxLength = 80) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    // Find the last space before maxLength
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    // If there's a space, truncate there; otherwise use maxLength
    if (lastSpace > 0) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

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
          let title = titleElement?.textContent?.trim() || 'Untitled Conversation';

          // Truncate long titles at word boundary
          if (title !== 'Untitled Conversation') {
            title = truncateAtWordBoundary(title, 80);
          }

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
   * Parse Gemini messages using text-based pattern matching
   * Fallback method when DOM parsing fails
   * @param {string} rawContent - Raw conversation text
   * @returns {Array} Array of message objects with role and content
   */
  function parseGeminiMessagesByPattern(rawContent) {
    const messages = [];

    if (!rawContent || rawContent.length === 0) {
      return messages;
    }

    // Split by "Show thinking" pattern which appears after user questions
    // Pattern: User question + "\nShow thinking\n" + Assistant response
    const parts = rawContent.split(/\nShow thinking\n/i);

    if (parts.length === 1) {
      // No "Show thinking" found, try simpler split or return as-is
      console.log('[Gemini Scraper] No "Show thinking" pattern found');
      return messages;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();

      if (i === 0) {
        // First part is user question
        if (part.length > 0) {
          messages.push({
            role: 'user',
            content: part
          });
        }
      } else {
        // After "Show thinking": contains assistant response, possibly followed by next user question
        // Try to find next user question by looking for common patterns
        const nextUserQuestionMatch = part.match(/\n\n([^]+?)(?=\nShow thinking\n|$)/);

        // First part is assistant response
        const assistantContent = part.split(/\n\n[A-Z]/)[0].trim();
        if (assistantContent.length > 0) {
          messages.push({
            role: 'assistant',
            content: assistantContent
          });
        }

        // Check if there's a user question after the assistant response
        if (i < parts.length - 1) {
          const remainingText = part.substring(assistantContent.length).trim();
          if (remainingText.length > 0) {
            messages.push({
              role: 'user',
              content: remainingText
            });
          }
        }
      }
    }

    console.log('[Gemini Scraper] Parsed', messages.length, 'messages using pattern matching');
    return messages;
  }

  /**
   * Extract current conversation content
   * @returns {Promise<Object>} Conversation object with messages
   */
  async function extractCurrentConversation() {
    try {
      console.log('[Gemini Scraper] Extracting current conversation...');

      // Extract URL and ID first
      const url = window.location.href;
      const idMatch = url.match(/\/app\/([a-zA-Z0-9-]+)/);
      const id = idMatch ? `gemini-${idMatch[1]}` : `gemini-${Date.now()}`;

      const messages = [];
      let rawContent = '';

      // PRIMARY APPROACH: DOM-based parsing using specific selectors
      console.log('[Gemini Scraper] Attempting DOM-based message extraction...');

      // Wait for message content to load - try to wait for either user or assistant messages
      try {
        await Promise.race([
          waitForElement('[id^="user-query-content-"]', 3000),
          waitForElement('[id^="message-content-id-r_"]', 3000)
        ]);
      } catch (error) {
        console.log('[Gemini Scraper] Timeout waiting for specific message elements');
      }

      // Additional delay to ensure all content is rendered
      await new Promise(resolve => setTimeout(resolve, 800));

      // Try multiple selector patterns for user messages
      let userMessageElements = document.querySelectorAll('[id^="user-query-content-"]');

      // Also try data attributes or class-based selectors
      if (userMessageElements.length === 0) {
        userMessageElements = document.querySelectorAll('[data-test-id*="user"], [class*="user-message"]');
        console.log('[Gemini Scraper] Trying alternate user message selectors, found:', userMessageElements.length);
      }

      const assistantMessageElements = document.querySelectorAll('[id^="message-content-id-r_"]');

      console.log('[Gemini Scraper] Found', userMessageElements.length, 'user messages and',
                  assistantMessageElements.length, 'assistant messages via DOM');

      if (userMessageElements.length > 0 || assistantMessageElements.length > 0) {
        // Combine and sort by DOM position to preserve conversation order
        const allMessageElements = [
          ...Array.from(userMessageElements).map(el => ({ el, role: 'user' })),
          ...Array.from(assistantMessageElements).map(el => ({ el, role: 'assistant' }))
        ];

        // Sort by position in document
        allMessageElements.sort((a, b) => {
          const position = a.el.compareDocumentPosition(b.el);
          if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
            return -1; // a comes before b
          } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
            return 1; // b comes before a
          }
          return 0;
        });

        // Extract content from each message
        for (const { el, role } of allMessageElements) {
          // For user messages, get from span child; for assistant, get from element itself
          let content = '';

          if (role === 'user') {
            // Try multiple extraction methods for user messages
            const spanElement = el.querySelector('span');
            if (spanElement) {
              content = spanElement.innerText?.trim() || spanElement.textContent?.trim() || '';
            }

            // Fallback: try to get from the element itself
            if (!content) {
              content = el.innerText?.trim() || el.textContent?.trim() || '';
            }

            console.log('[Gemini Scraper] User message content length:', content.length, 'ID:', el.id);
          } else {
            content = el.innerText?.trim() || el.textContent?.trim() || '';
            console.log('[Gemini Scraper] Assistant message content length:', content.length, 'ID:', el.id);
          }

          if (content && content.length > 0) {
            messages.push({ role, content });
            rawContent += `[${role.toUpperCase()}]\n${content}\n\n`;
          } else {
            console.warn('[Gemini Scraper] Empty content for', role, 'message, element:', el);
          }
        }

        console.log('[Gemini Scraper] DOM parsing extracted', messages.length, 'messages');
      }

      // FALLBACK APPROACH: If DOM parsing found nothing, try text-based pattern matching
      if (messages.length === 0) {
        console.log('[Gemini Scraper] DOM parsing found no messages, trying fallback methods...');

        // Get all content from the page
        const mainContent = document.querySelector('main') || document.body;
        rawContent = mainContent?.innerText?.trim() || '';

        // Try pattern-based parsing
        const patternMessages = parseGeminiMessagesByPattern(rawContent);

        if (patternMessages.length > 0) {
          messages.push(...patternMessages);
          console.log('[Gemini Scraper] Pattern parsing extracted', messages.length, 'messages');
        } else {
          console.warn('[Gemini Scraper] No messages could be extracted');
        }
      }

      // Extract title from page - try multiple approaches (original method restored)
      let title = 'Untitled Conversation';

      const titleSelectors = [
        'h1',
        '[role="heading"]',
        '.chat-title',
        '[class*="conversation-title"]'
      ];

      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent) {
          const extractedTitle = titleElement.textContent.trim();
          // Filter out generic Gemini UI text
          if (extractedTitle &&
              extractedTitle !== 'Gemini' &&
              extractedTitle !== 'Google Gemini' &&
              extractedTitle !== 'Conversation with Gemini' &&
              extractedTitle !== 'Recent' &&
              extractedTitle.length > 0) {
            title = truncateAtWordBoundary(extractedTitle, 80);
            console.log('[Gemini Scraper] Found title:', title);
            break;
          }
        }
      }

      // If still no title, generate from first user message
      if (title === 'Untitled Conversation' && messages.length > 0) {
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (firstUserMessage) {
          title = truncateAtWordBoundary(firstUserMessage.content, 80);
          console.log('[Gemini Scraper] Generated title from first user message:', title);
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
