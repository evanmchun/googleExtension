// Server configuration
const SERVER_URL = 'http://localhost:3001'; // Local test server URL

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
  console.log('=== BACKGROUND: Received message:', request.type, '===');
  
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
    console.log('=== BACKGROUND: Handling ADD_SUGGESTION request ===');
    addSuggestion(request.emailId, request.suggestion, request.author)
      .then(response => {
        console.log('=== BACKGROUND: ADD_SUGGESTION response:', response, '===');
        sendResponse(response);
      })
      .catch(error => {
        console.error('=== BACKGROUND: ADD_SUGGESTION error:', error, '===');
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
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
  try {
    console.log('=== BACKGROUND: Starting email tagging process ===');
    console.log('=== BACKGROUND: Received data:', {
      subject: data.emailData.subject,
      from: data.emailData.from,
      taggedPeople: data.taggedPeople,
      note: data.note
    }, '===');
    
    // Get the current user's email
    const userEmail = await getUserEmail();
    console.log('=== BACKGROUND: Current user email:', userEmail, '===');
    
    if (!userEmail) {
      console.error('=== BACKGROUND: Could not determine user email ===');
      return { success: false, error: 'Could not determine user email' };
    }
    
    // Create the new email data
    const newEmailData = {
      emailData: {
        subject: data.emailData.subject,
        body: data.emailData.body,
        from: data.emailData.from,
        timestamp: data.emailData.timestamp
      },
      taggedPeople: data.taggedPeople,
      note: data.note || '', // Ensure note is included
      requester: userEmail,
      timestamp: Date.now(),
      status: 'pending',
      suggestions: []
    };
    
    console.log('=== BACKGROUND: Sending data to server:', {
      url: `${SERVER_URL}/api/emails`,
      method: 'POST',
      data: newEmailData
    }, '===');
    
    // Send to server
    const response = await fetch(`${SERVER_URL}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newEmailData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== BACKGROUND: Server error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      }, '===');
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('=== BACKGROUND: Server response:', result, '===');
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown server error');
    }
    
    // Also save to local storage for caching
    const storage = await chrome.storage.local.get(['taggedEmails']);
    const taggedEmails = storage.taggedEmails || {};
    taggedEmails[result.emailId] = newEmailData;
    await chrome.storage.local.set({ taggedEmails });
    
    // Create a notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Help Request Saved',
      message: `Your help request has been saved and will be visible to ${data.taggedPeople.join(', ')}`
    });
    
    console.log('=== BACKGROUND: Email tagging process completed successfully ===');
    return { success: true, emailId: result.emailId };
  } catch (error) {
    console.error('=== BACKGROUND: Error in email tagging process:', error, '===');
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
    
    console.log('=== BACKGROUND: Fetching emails from server ===');
    const response = await fetch(`${SERVER_URL}/api/emails/${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== BACKGROUND: Server error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      }, '===');
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('=== BACKGROUND: Server response:', result, '===');
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown server error');
    }
    
    // Cache the results in local storage
    await chrome.storage.local.set({ taggedEmails: result.emails });
    
    return result.emails;
  } catch (error) {
    console.error('=== BACKGROUND: Error getting tagged emails:', error, '===');
    
    // Fallback to local storage if server is unavailable
    console.log('=== BACKGROUND: Falling back to local storage ===');
    const storage = await chrome.storage.local.get(['taggedEmails']);
    return storage.taggedEmails || {};
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
  console.log('=== BACKGROUND: Adding suggestion to email:', emailId, '===');
  console.log('=== BACKGROUND: Suggestion:', suggestion, '===');
  console.log('=== BACKGROUND: Author:', author, '===');
  
  try {
    // For testing, use local storage instead of the server
    console.log('=== BACKGROUND: Using local storage for testing ===');
    const result = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Current storage state:', result, '===');
    
    const taggedEmails = result.taggedEmails || {};
    
    if (!taggedEmails[emailId]) {
      console.error('=== BACKGROUND: Email not found:', emailId, '===');
      throw new Error('Email not found');
    }
    
    // Initialize suggestions array if it doesn't exist
    if (!taggedEmails[emailId].suggestions) {
      taggedEmails[emailId].suggestions = [];
    }
    
    // Add the new suggestion
    taggedEmails[emailId].suggestions.push({
      text: suggestion,
      author,
      timestamp: Date.now()
    });
    
    // Save to local storage
    console.log('=== BACKGROUND: Saving to local storage ===');
    await chrome.storage.local.set({ taggedEmails });
    
    // Verify the save
    const verifyResult = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Verification - Data in storage after save:', verifyResult, '===');
    
    console.log('=== BACKGROUND: Suggestion added successfully ===');
    return { success: true };
  } catch (error) {
    console.error('=== BACKGROUND: Error adding suggestion:', error, '===');
    throw error;
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