// Server configuration
const SERVER_URL = 'http://localhost:3001'; // Local test server URL

// Track popup window
let popupWindowId = null;

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Email Reply Helper installed');
  
  try {
    // Clear storage on fresh install
    await clearLocalStorage();
    console.log('=== BACKGROUND: Storage cleared on installation ===');
  } catch (error) {
    console.error('=== BACKGROUND: Error clearing storage on installation:', error, '===');
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('=== BACKGROUND: Received message:', request, '===');
  
  // Handle different message types
  if (request.type === 'TEST_CONNECTION') {
    console.log('=== BACKGROUND: Handling TEST_CONNECTION request ===');
    sendResponse({ success: true, message: 'Connection successful' });
  } 
  else if (request.type === 'DUMP_STORAGE') {
    console.log('=== BACKGROUND: Handling DUMP_STORAGE request ===');
    dumpLocalStorage()
      .then(result => {
        console.log('=== BACKGROUND: DUMP_STORAGE response sent ===');
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('=== BACKGROUND: DUMP_STORAGE error:', error, '===');
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  else if (request.type === 'TAG_EMAIL') {
    console.log('=== BACKGROUND: Handling TAG_EMAIL request ===');
    handleEmailTagging(request.data)
      .then(response => {
        console.log('=== BACKGROUND: TAG_EMAIL response:', response, '===');
        sendResponse(response);
      })
      .catch(error => {
        console.error('=== BACKGROUND: TAG_EMAIL error:', error, '===');
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  else if (request.type === 'GET_USER_EMAIL') {
    console.log('=== BACKGROUND: Handling GET_USER_EMAIL request ===');
    getUserEmail()
      .then(email => {
        console.log('=== BACKGROUND: GET_USER_EMAIL response:', email, '===');
        sendResponse({ success: true, email });
      })
      .catch(error => {
        console.error('=== BACKGROUND: GET_USER_EMAIL error:', error, '===');
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  else if (request.type === 'GET_TAGGED_EMAILS') {
    console.log('=== BACKGROUND: Handling GET_TAGGED_EMAILS request ===');
    getTaggedEmails()
      .then(emails => {
        console.log('=== BACKGROUND: GET_TAGGED_EMAILS response:', { count: Object.keys(emails).length }, '===');
        sendResponse({ success: true, emails });
      })
      .catch(error => {
        console.error('=== BACKGROUND: GET_TAGGED_EMAILS error:', error, '===');
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  else if (request.type === 'ADD_SUGGESTION') {
    (async () => {
      console.log('=== BACKGROUND: Handling ADD_SUGGESTION request ===');
      try {
        const { emailId, suggestion, author } = request.data;
        const response = await fetch(`${SERVER_URL}/api/emails/${emailId}/suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            suggestion,
            author
          })
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        sendResponse({ success: true, data });
      } catch (error) {
        console.error('Error adding suggestion:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  else if (request.type === 'CLEAR_STORAGE') {
    console.log('=== BACKGROUND: Handling CLEAR_STORAGE request ===');
    clearLocalStorage()
      .then(response => {
        console.log('=== BACKGROUND: CLEAR_STORAGE response:', response, '===');
        sendResponse(response);
      })
      .catch(error => {
        console.error('=== BACKGROUND: CLEAR_STORAGE error:', error, '===');
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Get user's email using Chrome identity API
async function getUserEmail() {
  try {
    // Try getProfileUserInfo first as it's more reliable for multiple accounts
    const userInfo = await chrome.identity.getProfileUserInfo();
    console.log('Got user info from getProfileUserInfo:', userInfo);
    if (userInfo.email) {
      console.log('Using email from getProfileUserInfo:', userInfo.email);
      return userInfo.email;
    }

    // Fallback to OAuth token method
    console.log('getProfileUserInfo failed, trying OAuth token method...');
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting auth token:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Successfully got auth token');
          resolve(token);
        }
      });
    });

    console.log('Making request to Google userinfo endpoint...');
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch user info:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Got user info from OAuth:', data);
    
    if (!data.email) {
      console.error('No email in user info response:', data);
      throw new Error('No email found in user info response');
    }
    
    return data.email;
  } catch (error) {
    console.error('Error getting user email:', error);
    // Try to get email from Gmail's user info
    try {
      const gmailResponse = await fetch('https://mail.google.com/mail/u/0/feed/atom');
      const gmailText = await gmailResponse.text();
      const emailMatch = gmailText.match(/<email>([^<]+)<\/email>/);
      if (emailMatch && emailMatch[1]) {
        console.log('Got email from Gmail feed:', emailMatch[1]);
        return emailMatch[1];
      }
    } catch (gmailError) {
      console.error('Error getting email from Gmail:', gmailError);
    }
    throw new Error('Could not determine your email address. Please make sure you are signed in to Chrome and have granted the necessary permissions.');
  }
}

// Handle email tagging
async function handleEmailTagging(data) {
  console.log('=== BACKGROUND: Handling email tagging request ===');
  console.log('=== BACKGROUND: Request data:', data);
  
  try {
    console.log('=== BACKGROUND: Sending request to server at http://localhost:3001/api/emails');
    const response = await fetch(`${SERVER_URL}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    console.log('=== BACKGROUND: Server response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== BACKGROUND: Server error response:', errorText);
      throw new Error(`Server responded with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('=== BACKGROUND: Server response data:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('=== BACKGROUND: Error tagging email:', error);
    console.error('=== BACKGROUND: Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

// Get tagged emails for the current user
async function getTaggedEmails() {
  try {
    console.log('=== BACKGROUND: Getting tagged emails... ===');
    
    // Get the current user's email
    const userEmail = await getUserEmail();
    console.log('=== BACKGROUND: Current user email:', userEmail, '===');
    
    if (!userEmail) {
      console.error('=== BACKGROUND: Could not determine user email ===');
      return {};
    }
    
    console.log('=== BACKGROUND: Fetching emails from server at http://localhost:3001/api/emails');
    const response = await fetch(`${SERVER_URL}/api/emails?userEmail=${encodeURIComponent(userEmail)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('=== BACKGROUND: Server response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== BACKGROUND: Server error response:', errorText);
      throw new Error(`Server responded with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('=== BACKGROUND: Server response data:', data);
    
    // Handle empty array case
    if (Array.isArray(data) && data.length === 0) {
      console.log('=== BACKGROUND: No emails found, returning empty array');
      return [];
    }
    
    // Cache the results in local storage
    await chrome.storage.local.set({ taggedEmails: data });
    
    return data;
  } catch (error) {
    console.error('=== BACKGROUND: Error getting tagged emails:', error);
    console.error('=== BACKGROUND: Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Fallback to local storage if server is unavailable
    console.log('=== BACKGROUND: Falling back to local storage ===');
    const storage = await chrome.storage.local.get(['taggedEmails']);
    return storage.taggedEmails || [];
  }
}

// Handle incoming suggestions
async function handleSuggestion(data) {
  const { emailId, suggestion, author } = data;
  
  try {
    const result = await chrome.storage.local.get(['taggedEmails']);
    const taggedEmails = result.taggedEmails || {};
    
    if (taggedEmails[emailId]) {
      taggedEmails[emailId].suggestions = taggedEmails[emailId].suggestions || [];
      taggedEmails[emailId].suggestions.push({
        text: suggestion,
        author,
        timestamp: Date.now()
      });
      
      await chrome.storage.local.set({ taggedEmails });
      console.log('Suggestion added. Current storage:', taggedEmails);
      
      // Show notification in extension
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'New Suggestion Received',
        message: `${author} has provided a suggestion for your email "${emailId}"`
      });

      return { success: true };
    }
    return { success: false, error: 'Email not found' };
  } catch (error) {
    console.error('Error handling suggestion:', error);
    return { success: false, error: error.message };
  }
}

// Clean up old data periodically
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(['taggedEmails']);
    const taggedEmails = result.taggedEmails || {};
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    // Remove entries older than one week
    Object.keys(taggedEmails).forEach(emailId => {
      if (now - taggedEmails[emailId].timestamp > oneWeek) {
        delete taggedEmails[emailId];
      }
    });
    
    await chrome.storage.local.set({ taggedEmails });
    console.log('Cleaned up old data. Current storage:', taggedEmails);
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
}, 24 * 60 * 60 * 1000); // Run once per day 

// Add a suggestion to an email
async function addSuggestion(emailId, suggestion, author) {
  console.log('=== BACKGROUND: Adding message to thread:', emailId, '===');
  console.log('=== BACKGROUND: Message:', suggestion, '===');
  console.log('=== BACKGROUND: Author:', author, '===');
  
  try {
    // Create the new message data
    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: suggestion,
      author,
      timestamp: Date.now()
    };

    // First update local storage
    console.log('=== BACKGROUND: Updating local storage ===');
    const storage = await chrome.storage.local.get(['taggedEmails']);
    const taggedEmails = storage.taggedEmails || {};

    if (!taggedEmails[emailId]) {
      console.error('=== BACKGROUND: Email not found:', emailId, '===');
      throw new Error('Email not found in storage');
    }

    // Initialize suggestions array if it doesn't exist
    if (!taggedEmails[emailId].suggestions) {
      taggedEmails[emailId].suggestions = [];
    }

    // Add the new message
    taggedEmails[emailId].suggestions.push(messageData);

    // Save to local storage first
    await chrome.storage.local.set({ taggedEmails });
    console.log('=== BACKGROUND: Local storage updated successfully ===');

    // Try to send to server
    try {
      console.log('=== BACKGROUND: Sending message to server ===');
      const response = await fetch(`${SERVER_URL}/api/emails/${encodeURIComponent(emailId)}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          message: messageData
        })
      });

      const responseText = await response.text();
      console.log('=== BACKGROUND: Server response text:', responseText, '===');

      if (!response.ok) {
        console.warn('=== BACKGROUND: Server error:', response.status, responseText, '===');
      } else {
        try {
          const result = JSON.parse(responseText);
          console.log('=== BACKGROUND: Server response parsed:', result, '===');
        } catch (parseError) {
          console.warn('=== BACKGROUND: Could not parse server response:', parseError, '===');
        }
      }
    } catch (serverError) {
      console.warn('=== BACKGROUND: Server communication error:', serverError, '===');
      // Continue since we already saved to local storage
    }

    // Create a notification for the recipient
    const recipientEmail = taggedEmails[emailId].taggedPeople[0];
    if (recipientEmail && recipientEmail !== author) {
      // Get the subject from either email structure
      const subject = taggedEmails[emailId].emailData?.subject || taggedEmails[emailId].email?.subject || 'No Subject';
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'New Message',
        message: `${author} sent a new message in the thread "${subject}"`
      });
    }

    console.log('=== BACKGROUND: Message added successfully ===');
    return { success: true, messageId: messageData.id };
  } catch (error) {
    console.error('=== BACKGROUND: Error adding message:', error, '===');
    return { success: false, error: error.message };
  }
}

// Dump local storage contents for debugging
async function dumpLocalStorage() {
  try {
    console.log('=== BACKGROUND: Dumping local storage contents ===');
    const result = await chrome.storage.local.get(null);
    console.log('=== BACKGROUND: All storage data:', result, '===');
    
    if (result.taggedEmails) {
      console.log('=== BACKGROUND: Tagged emails count:', Object.keys(result.taggedEmails).length, '===');
      console.log('=== BACKGROUND: Tagged emails:', result.taggedEmails, '===');
    } else {
      console.log('=== BACKGROUND: No tagged emails found in storage ===');
    }
    
    return result;
  } catch (error) {
    console.error('=== BACKGROUND: Error dumping local storage:', error, '===');
    return null;
  }
}

// Clear local storage
async function clearLocalStorage() {
  try {
    console.log('=== BACKGROUND: Clearing local storage ===');
    await chrome.storage.local.clear();
    console.log('=== BACKGROUND: Local storage cleared ===');
    return { success: true };
  } catch (error) {
    console.error('=== BACKGROUND: Error clearing local storage:', error, '===');
    return { success: false, error: error.message };
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async () => {
  // Check if popup window already exists
  if (popupWindowId !== null) {
    try {
      // Try to focus the existing window
      const window = await chrome.windows.get(popupWindowId);
      if (window) {
        await chrome.windows.update(popupWindowId, { focused: true });
        return;
      }
    } catch (error) {
      // Window doesn't exist anymore, reset the ID
      popupWindowId = null;
    }
  }

  // Create new popup window
  const popup = await chrome.windows.create({
    url: 'window.html',
    type: 'popup',
    width: 1000,
    height: 800
  });
  
  // Store the window ID
  popupWindowId = popup.id;

  // Listen for window close
  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === popupWindowId) {
      popupWindowId = null;
    }
  });
}); 