// Server configuration
const SERVER_URL = 'http://localhost:3001'; // Local test server URL

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Email Reply Helper installed');
  
  // Add a test email to local storage
  try {
    console.log('=== BACKGROUND: Adding test email on installation ===');
    
    // Clear storage first
    await clearLocalStorage();
    
    // Create test email data
    const emailId = `Test Email-${Date.now()}`;
    console.log('=== BACKGROUND: Generated emailId:', emailId, '===');
    
    const testEmail = {
      email: {
        subject: 'Test Email',
        body: 'This is a test email body',
        from: '4288melheritage@gmail.com',
        timestamp: Date.now()
      },
      taggedPeople: ['jchun1112@gmail.com'],
      note: 'This is a test note',
      requester: '4288melheritage@gmail.com',
      timestamp: Date.now(),
      status: 'pending',
      suggestions: []
    };
    
    console.log('=== BACKGROUND: Created test email data:', testEmail, '===');
    
    // Save to local storage
    console.log('=== BACKGROUND: Saving to local storage ===');
    await chrome.storage.local.set({ taggedEmails: { [emailId]: testEmail } });
    
    // Verify the save
    console.log('=== BACKGROUND: Verifying save ===');
    const verifyResult = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Verification result:', verifyResult, '===');
    
    console.log('=== BACKGROUND: Test email added successfully on installation ===');
  } catch (error) {
    console.error('=== BACKGROUND: Error adding test email on installation:', error, '===');
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
  else if (request.type === 'ADD_TEST_EMAIL') {
    console.log('=== BACKGROUND: Handling ADD_TEST_EMAIL request ===');
    addTestEmail()
      .then(response => {
        console.log('=== BACKGROUND: ADD_TEST_EMAIL response:', response, '===');
        sendResponse(response);
      })
      .catch(error => {
        console.error('=== BACKGROUND: ADD_TEST_EMAIL error:', error, '===');
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
  console.log('=== BACKGROUND: Starting email tagging process with data:', data, '===');
  
  try {
    // Get the current user's email
    const userEmail = await getUserEmail();
    console.log('=== BACKGROUND: Current user email:', userEmail, '===');
    
    if (!userEmail) {
      console.error('=== BACKGROUND: Could not determine user email ===');
      throw new Error('Could not determine your email address');
    }
    
    // For testing, use local storage instead of the server
    console.log('=== BACKGROUND: Using local storage for testing ===');
    const result = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Current storage state:', result, '===');
    
    // Initialize taggedEmails if it doesn't exist
    let taggedEmails = result.taggedEmails || {};
    console.log('=== BACKGROUND: Total emails in storage:', Object.keys(taggedEmails).length, '===');
    
    // Generate a unique ID for the email
    const emailId = `${data.emailData.subject}-${Date.now()}`;
    console.log('=== BACKGROUND: Generated email ID:', emailId, '===');
    
    // Create the new email data
    const newEmailData = {
      email: data.emailData,
      taggedPeople: data.taggedPeople,
      note: data.note,
      requester: userEmail,
      timestamp: Date.now(),
      status: 'pending',
      suggestions: []
    };
    
    console.log('=== BACKGROUND: New email data:', newEmailData, '===');
    
    // Add the new email to the storage
    taggedEmails[emailId] = newEmailData;
    
    // Save to local storage
    console.log('=== BACKGROUND: Saving to local storage ===');
    await chrome.storage.local.set({ taggedEmails });
    
    // Verify the save
    const verifyResult = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Verification - Data in storage after save:', verifyResult, '===');
    
    // Create a notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Help Request Saved',
      message: `Your help request has been saved and will be visible to ${data.taggedPeople.join(', ')}`
    });
    
    console.log('=== BACKGROUND: Email tagging process completed successfully ===');
    return { success: true, emailId };
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
    
    // For testing, use local storage instead of the server
    console.log('=== BACKGROUND: Using local storage for testing ===');
    const result = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Raw storage data:', result, '===');
    
    const taggedEmails = result.taggedEmails || {};
    console.log('=== BACKGROUND: Total emails in storage:', Object.keys(taggedEmails).length, '===');
    
    // Filter emails based on whether user is requester or tagged person
    const filteredEmails = {};
    Object.entries(taggedEmails).forEach(([emailId, data]) => {
      const isRequester = data.requester && data.requester.toLowerCase() === userEmail.toLowerCase();
      const isTagged = data.taggedPeople && 
                      data.taggedPeople.some(person => person.toLowerCase() === userEmail.toLowerCase());
      
      console.log('=== BACKGROUND: Checking email:', emailId, '===');
      console.log('=== BACKGROUND: Is requester:', isRequester, '===');
      console.log('=== BACKGROUND: Is tagged:', isTagged, '===');
      
      if (isRequester || isTagged) {
        console.log('=== BACKGROUND: Including email in filtered results:', emailId, '===');
        filteredEmails[emailId] = data;
      } else {
        console.log('=== BACKGROUND: Excluding email from filtered results:', emailId, '===');
      }
    });
    
    console.log('=== BACKGROUND: Filtered emails count:', Object.keys(filteredEmails).length, '===');
    return filteredEmails;
  } catch (error) {
    console.error('=== BACKGROUND: Error getting tagged emails:', error, '===');
    return {};
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

// Add a test email to local storage
async function addTestEmail() {
  try {
    console.log('=== BACKGROUND: Adding test email to local storage ===');
    
    // Clear storage first
    await clearLocalStorage();
    
    // Get current storage
    console.log('=== BACKGROUND: Getting current storage ===');
    const result = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Current storage result:', result, '===');
    
    let taggedEmails = result.taggedEmails || {};
    console.log('=== BACKGROUND: Current taggedEmails:', taggedEmails, '===');
    
    // Create test email data
    const emailId = `Test Email-${Date.now()}`;
    console.log('=== BACKGROUND: Generated emailId:', emailId, '===');
    
    const testEmail = {
      email: {
        subject: 'Test Email',
        body: 'This is a test email body',
        from: '4288melheritage@gmail.com',
        timestamp: Date.now()
      },
      taggedPeople: ['jchun1112@gmail.com'],
      note: 'This is a test note',
      requester: '4288melheritage@gmail.com',
      timestamp: Date.now(),
      status: 'pending',
      suggestions: []
    };
    
    console.log('=== BACKGROUND: Created test email data:', testEmail, '===');
    
    // Add to storage
    taggedEmails[emailId] = testEmail;
    console.log('=== BACKGROUND: Updated taggedEmails:', taggedEmails, '===');
    
    // Save to local storage
    console.log('=== BACKGROUND: Saving to local storage ===');
    await chrome.storage.local.set({ taggedEmails });
    
    // Verify the save
    console.log('=== BACKGROUND: Verifying save ===');
    const verifyResult = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Verification result:', verifyResult, '===');
    
    console.log('=== BACKGROUND: Test email added successfully ===');
    return { success: true, emailId };
  } catch (error) {
    console.error('=== BACKGROUND: Error adding test email:', error, '===');
    return { success: false, error: error.message };
  }
}

// Add a test email when the extension is loaded
async function addTestEmailOnLoad() {
  try {
    console.log('=== BACKGROUND: Adding test email on load ===');
    
    // Get current storage
    const result = await chrome.storage.local.get(['taggedEmails']);
    console.log('=== BACKGROUND: Current storage on load:', result, '===');
    
    // If no emails exist, add a test email
    if (!result.taggedEmails || Object.keys(result.taggedEmails).length === 0) {
      console.log('=== BACKGROUND: No emails found on load, adding test email ===');
      await addTestEmail();
    } else {
      console.log('=== BACKGROUND: Emails already exist on load, count:', Object.keys(result.taggedEmails).length, '===');
    }
  } catch (error) {
    console.error('=== BACKGROUND: Error adding test email on load:', error, '===');
  }
}

// Call addTestEmailOnLoad when the extension is loaded
addTestEmailOnLoad(); 