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

  const KNOWN_FILE_EXTENSIONS = [
    'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'heic', 'heif',
    'txt', 'md', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'zip', 'rar', '7z',
    'tar', 'gz', 'json', 'xml', 'html', 'htm', 'js', 'jsx', 'ts', 'tsx', 'py', 'java',
    'rb', 'go', 'c', 'cpp', 'h', 'cs', 'php', 'sql', 'yaml', 'yml', 'ini', 'cfg', 'log',
    'mp3', 'm4a', 'wav', 'flac', 'ogg', 'mp4', 'mov', 'avi', 'wmv', 'webm', 'mkv',
    'stl', 'psd', 'ai', 'sketch', 'fig', 'apk', 'dmg', 'pkg', 'iso'
  ];

  const MAX_FILENAME_LENGTH = 80;

  function sanitizeAttachmentLabel(label) {
    if (!label) {
      return '';
    }
    return label
      .replace(/[\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeFilename(rawName) {
    if (!rawName) {
      return null;
    }

    let name = String(rawName)
      .replace(/\uFFFD/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) {
      return null;
    }

    try {
      name = decodeURIComponent(name);
    } catch (err) {
      // Ignore decoding errors, use original string
    }

    name = name
      .replace(/\+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove surrounding punctuation like bullets or colons
    name = name.replace(/^[\-\u2022:]+/, '').trim();

    // Strip query/hash and directory components
    const withoutQuery = name.split(/[?#]/)[0];
    const pathSegments = withoutQuery.split(/[\\/]/);
    name = pathSegments[pathSegments.length - 1] || withoutQuery;

    if (!name) {
      return null;
    }

    if (name.length > MAX_FILENAME_LENGTH) {
      const start = name.slice(0, 40);
      const end = name.slice(-20);
      name = `${start}…${end}`;
    }

    return name.trim();
  }

  function buildFileNameRegex() {
    const extensions = KNOWN_FILE_EXTENSIONS.join('|');
    return new RegExp(
      `([^\\s/\\\\]+\\.(?:${extensions}))(?=$|[\\s,.;:!?()\\[\\]{}"\'\\u2013\\u2014])`,
      'ig'
    );
  }

  function extractFileNamesFromText(text) {
    if (!text) {
      return [];
    }

    const matches = [];
    const regex = buildFileNameRegex();
    text.replace(regex, (match) => {
      matches.push(match);
      return match;
    });
    return matches;
  }

  function extractFilenameFromHref(href) {
    if (!href) {
      return null;
    }

    let candidate = null;
    try {
      const url = new URL(href, window.location.origin);
      candidate = url.pathname ? url.pathname.split('/').pop() : null;
    } catch (err) {
      // Fall back to manual parsing for relative or blob URLs
      candidate = href.split(/[?#]/)[0].split('/').pop();
    }

    if (!candidate) {
      return null;
    }

    return normalizeFilename(candidate);
  }

  function createAttachmentToken(rawName, fallback = 'FILE') {
    if (!rawName) {
      return `[${fallback}]`;
    }

    const sanitized = sanitizeAttachmentLabel(rawName);
    const normalized = normalizeFilename(sanitized);
    const finalName = normalized || fallback;

    return `[${finalName}]`;
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
          // Extract content first - try markdown first, fallback to innerText
          let content = '';
          const markdownElement = turnElement.querySelector('.markdown');
          if (markdownElement) {
            content = markdownElement.innerText?.trim() || '';
          } else {
            content = turnElement.innerText?.trim() || '';
          }

          // Determine role from data-testid first
          const testId = turnElement.getAttribute('data-testid');
          let role = (testId && testId.includes('user')) ? 'user' : 'assistant';

          // Fallback: Check content for "You said:" pattern (more reliable)
          // ChatGPT shows user messages with "You said:\n" prefix
          if (content.startsWith('You said:\n')) {
            role = 'user';
            // Remove the "You said:\n" prefix to get clean user content
            content = content.substring(10).trim();
          }

          const attachmentTokens = [];
          const attachmentTokenSet = new Set();
          const registerAttachmentToken = (token) => {
            if (!token) {
              return;
            }
            const trimmed = token.trim();
            if (!trimmed) {
              return;
            }
            const formatted = trimmed.startsWith('[') && trimmed.endsWith(']')
              ? trimmed
              : createAttachmentToken(trimmed);
            if (!attachmentTokenSet.has(formatted)) {
              attachmentTokenSet.add(formatted);
              attachmentTokens.push(formatted);
            }
          };

          if (role === 'user') {
            // Detect uploaded images
            const uploadedImages = Array.from(
              turnElement.querySelectorAll('img[alt="Uploaded image"]')
            );

            // Fall back to any image within the message bubble (excluding avatars/icons)
            if (uploadedImages.length === 0) {
              const fallbackImages = Array.from(
                turnElement.querySelectorAll('img')
              ).filter(img => {
                const altText = (img.alt || '').toLowerCase();
                const isAvatar = img.closest('[data-testid*="avatar"]');
                const isEmoji = img.closest('[data-testid="emotion_svg"]');
                return !isAvatar && !isEmoji && altText !== 'avatar';
              });
              uploadedImages.push(...fallbackImages);
            }

            if (uploadedImages.length > 0) {
              // Deduplicate by src to avoid double counting the same preview
              const uniqueSources = new Set();
              uploadedImages.forEach((img, index) => {
                const src = img.currentSrc || img.src || `image-${index}`;
                if (src && !uniqueSources.has(src)) {
                  uniqueSources.add(src);
                  const altLabel = sanitizeAttachmentLabel(img.alt);
                  const altIsGeneric = altLabel.toLowerCase() === 'uploaded image';
                  const token = altLabel && !altIsGeneric
                    ? `[IMAGE:${altLabel}]`
                    : '[IMAGE]';
                  registerAttachmentToken(token);
                }
              });
            }

            // Detect referenced file names within the visible text
            if (content) {
              const fileRegex = buildFileNameRegex();
              content = content.replace(fileRegex, (match) => {
                const token = createAttachmentToken(match);
                registerAttachmentToken(token);
                return token;
              });
            }

            // Detect attachments rendered as separate DOM nodes (files, documents, etc.)
            const attachmentSelectors = [
              '[download]',
              '[data-testid*="attachment"]',
              '[data-testid*="file"]',
              '[data-test-id*="attachment"]',
              '[data-test-id*="file"]',
              'a[data-download-url]',
              'a[href*="attachment"]',
              'a[href*="/file/"]',
              'a[href*="/files/"]',
              'a[href^="blob:"]',
              'button[aria-label*="Download"]',
              'button[aria-label*="Open file"]'
            ].join(',');

            const attachmentElements = Array.from(turnElement.querySelectorAll(attachmentSelectors));

            attachmentElements.forEach((elem) => {
              try {
                const possibleValues = new Set();
                const downloadAttr = elem.getAttribute && elem.getAttribute('download');
                const ariaLabel = elem.getAttribute && elem.getAttribute('aria-label');
                const dataTestId = elem.getAttribute && (elem.getAttribute('data-testid') || elem.getAttribute('data-test-id'));
                const hrefAttr = elem.getAttribute && elem.getAttribute('href');
                const dataset = elem.dataset || {};

                if (downloadAttr) {
                  possibleValues.add(downloadAttr);
                }
                if (ariaLabel) {
                  possibleValues.add(ariaLabel);
                }
                if (dataset.filename) {
                  possibleValues.add(dataset.filename);
                }
                if (dataset.fileName) {
                  possibleValues.add(dataset.fileName);
                }
                if (dataset.name) {
                  possibleValues.add(dataset.name);
                }

                const textContent = elem.textContent;
                if (textContent && textContent.trim().length > 0 && textContent.trim().length <= 160) {
                  possibleValues.add(textContent.trim());
                }

                if (hrefAttr && /attachment|upload|file|blob:/i.test(hrefAttr)) {
                  const fromHref = extractFilenameFromHref(hrefAttr);
                  if (fromHref) {
                    possibleValues.add(fromHref);
                  }
                }

                const matchedNames = new Set();
                possibleValues.forEach((value) => {
                  extractFileNamesFromText(value).forEach((match) => {
                    matchedNames.add(match);
                  });
                });

                matchedNames.forEach((name) => {
                  registerAttachmentToken(createAttachmentToken(name));
                });

                const hintedAttachment = !!downloadAttr
                  || !!dataset.filename
                  || !!dataset.fileName
                  || !!dataset.name
                  || (hrefAttr && /attachment|upload|file|blob:/i.test(hrefAttr))
                  || (dataTestId && /attachment|file/i.test(dataTestId));

                if (matchedNames.size === 0 && hintedAttachment) {
                  const fallbackSource =
                    downloadAttr
                    || (hrefAttr && extractFilenameFromHref(hrefAttr))
                    || Array.from(possibleValues)[0];

                  const normalized = normalizeFilename(fallbackSource);
                  if (normalized) {
                    registerAttachmentToken(createAttachmentToken(normalized));
                  }
                }
              } catch (err) {
                console.warn('[ChatGPT Scraper] Attachment detection error:', err);
              }
            });
          }

          const tokensToPrefix = attachmentTokens.filter(token => token && !content.includes(token));

          if (!content && attachmentTokens.length === 0) {
            continue; // Skip empty messages without attachments
          }

          if (!content && attachmentTokens.length > 0) {
            content = attachmentTokens.join(' ');
          } else if (tokensToPrefix.length > 0) {
            content = `${tokensToPrefix.join(' ')} ${content}`.trim();
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
