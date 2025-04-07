// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Email Reply Helper installed');
  // Initialize storage
  chrome.storage.local.set({
    taggedEmails: {},
    userEmail: '',
    helperSettings: {
      notificationMethod: 'extension'
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  
  if (request.type === 'TAG_EMAIL') {
    handleEmailTagging(request.data)
      .then(response => {
        console.log('Sending response:', response);
        sendResponse(response);
      })
      .catch(error => {
        console.error('Error in TAG_EMAIL:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } 
  else if (request.type === 'ADD_SUGGESTION') {
    handleSuggestion(request.data)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } 
  else if (request.type === 'GET_USER_EMAIL') {
    getUserEmail()
      .then(email => sendResponse({ email }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Get user's email using Chrome identity API
async function getUserEmail() {
  try {
    // First check if we have it stored
    const result = await chrome.storage.local.get(['userEmail']);
    if (result.userEmail) {
      return result.userEmail;
    }

    // Try to get from identity API
    const info = await chrome.identity.getProfileUserInfo();
    if (info.email) {
      // Store it for future use
      await chrome.storage.local.set({ userEmail: info.email });
      return info.email;
    }

    // If we can't get the email, use the domain from the current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('mail.google.com')) {
      // Extract email from Gmail URL or interface
      const emailMatch = currentTab.url.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
      if (emailMatch && emailMatch[0]) {
        const email = emailMatch[0];
        await chrome.storage.local.set({ userEmail: email });
        return email;
      }
    }

    // If all else fails, prompt user to enter their email
    return null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

// Handle email tagging
async function handleEmailTagging(data) {
  console.log('Handling email tagging:', data);
  const { emailData, taggedPeople, note } = data;
  
  try {
    // Get user's email
    const userEmail = await getUserEmail();
    if (!userEmail) {
      // Instead of throwing error, use the from field of the email
      const requesterEmail = emailData.from || 'unknown';
      console.log('Using email from field as requester:', requesterEmail);
      
      // Store the tagged email data
      const taggedEmails = await chrome.storage.local.get(['taggedEmails']).then(result => result.taggedEmails || {});
      const emailId = emailData.subject || new Date().toISOString();
      
      taggedEmails[emailId] = {
        email: emailData,
        taggedPeople,
        note,
        requester: requesterEmail,
        timestamp: Date.now(),
        suggestions: []
      };

      await chrome.storage.local.set({ taggedEmails });
      console.log('Email tagged successfully');
      return { success: true, emailId };
    }

    // Normal flow with user email
    const taggedEmails = await chrome.storage.local.get(['taggedEmails']).then(result => result.taggedEmails || {});
    const emailId = emailData.subject || new Date().toISOString();
    
    taggedEmails[emailId] = {
      email: emailData,
      taggedPeople,
      note,
      requester: userEmail,
      timestamp: Date.now(),
      suggestions: []
    };

    await chrome.storage.local.set({ taggedEmails });
    console.log('Email tagged successfully');
    return { success: true, emailId };
  } catch (error) {
    console.error('Error in handleEmailTagging:', error);
    return { success: false, error: error.message };
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
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
}, 24 * 60 * 60 * 1000); // Run once per day 