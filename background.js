// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Email Reply Helper installed');
  
  // Check if storage already exists before initializing
  const existingData = await chrome.storage.local.get(['taggedEmails']);
  console.log('Existing storage data:', existingData);
  
  if (!existingData.taggedEmails) {
    console.log('No existing data found, initializing storage...');
    await initializeStorage();
  } else {
    console.log('Existing data found, preserving storage:', existingData.taggedEmails);
  }
});

// Initialize storage
async function initializeStorage() {
  try {
    console.log('Initializing storage...');
    const initialData = {
      taggedEmails: {},
      userEmail: '',
      helperSettings: {
        notificationMethod: 'extension'
      }
    };
    
    await chrome.storage.local.set(initialData);
    console.log('Storage initialized with:', initialData);
    
    // Verify initialization
    const verifyResult = await chrome.storage.local.get(['taggedEmails']);
    console.log('Verification - Storage after initialization:', verifyResult);
    
    return verifyResult;
  } catch (error) {
    console.error('Error initializing storage:', error);
    throw error;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type, request.data);
  
  if (request.type === 'TEST_CONNECTION') {
    sendResponse({ success: true, message: 'Connection established' });
    return false;
  }
  
  if (request.type === 'TAG_EMAIL') {
    console.log('Processing TAG_EMAIL request with data:', request.data);
    handleEmailTagging(request.data)
      .then(response => {
        console.log('TAG_EMAIL processing complete. Response:', response);
        sendResponse(response);
      })
      .catch(error => {
        console.error('Error in TAG_EMAIL:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } 
  else if (request.type === 'ADD_SUGGESTION') {
    handleSuggestion(request.data)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } 
  else if (request.type === 'GET_USER_EMAIL') {
    getUserEmail()
      .then(email => {
        console.log('Returning user email:', email);
        sendResponse({ email });
      })
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  else if (request.type === 'GET_TAGGED_EMAILS') {
    console.log('Processing GET_TAGGED_EMAILS request');
    getTaggedEmails()
      .then(emails => {
        console.log('Retrieved tagged emails:', emails);
        sendResponse({ success: true, emails });
      })
      .catch(error => {
        console.error('Error getting tagged emails:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  return false;
});

// Get user's email using Chrome identity API
async function getUserEmail() {
  try {
    // First try to get from storage
    const result = await chrome.storage.local.get(['userEmail']);
    if (result.userEmail) {
      console.log('Retrieved email from storage:', result.userEmail);
      return result.userEmail;
    }

    // Get auth token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting auth token:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });

    // Get user info from Google
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    const email = data.email;

    // Store email for future use
    if (email) {
      console.log('Storing user email:', email);
      await chrome.storage.local.set({ userEmail: email });
    }

    return email;
  } catch (error) {
    console.error('Error getting user email:', error);
    
    // Fallback to getProfileUserInfo
    try {
      const userInfo = await chrome.identity.getProfileUserInfo();
      console.log('Got user info from getProfileUserInfo:', userInfo);
      if (userInfo.email) {
        await chrome.storage.local.set({ userEmail: userInfo.email });
        return userInfo.email;
      }
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
    }
    
    return '';
  }
}

// Handle email tagging
async function handleEmailTagging(data) {
  console.log('Starting email tagging process...', data);
  const { emailData, taggedPeople, note } = data;
  
  try {
    // Get user's email
    const userEmail = await getUserEmail();
    console.log('User email retrieved:', userEmail);
    const requesterEmail = userEmail || emailData.from || 'unknown';
    
    // Store the tagged email data
    console.log('Getting current tagged emails from storage...');
    const result = await chrome.storage.local.get(['taggedEmails']);
    let taggedEmails = result.taggedEmails;
    
    // Initialize if undefined
    if (!taggedEmails) {
      console.log('Tagged emails storage was undefined, initializing...');
      taggedEmails = {};
    }
    
    console.log('Current tagged emails:', taggedEmails);
    
    const emailId = `${emailData.subject}-${Date.now()}`; // Make ID unique
    console.log('Generated email ID:', emailId);
    
    // Store with more detailed information
    const newEmailData = {
      email: emailData,
      taggedPeople,
      note,
      requester: requesterEmail,
      timestamp: Date.now(),
      status: 'pending',
      suggestions: [],
      threadId: emailData.threadId || null
    };
    
    console.log('New email data to be stored:', newEmailData);
    
    // Update the storage object
    taggedEmails[emailId] = newEmailData;
    
    // Save to storage
    console.log('Saving to storage:', { taggedEmails });
    await chrome.storage.local.set({ taggedEmails });
    
    // Verify the save
    const verifyResult = await chrome.storage.local.get(['taggedEmails']);
    console.log('Verification - Data in storage after save:', verifyResult.taggedEmails);
    
    if (!verifyResult.taggedEmails || !verifyResult.taggedEmails[emailId]) {
      throw new Error('Failed to save email data - verification failed');
    }

    // Show notification to confirm request was saved
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Help Request Saved',
      message: `Your request has been saved and will be visible to ${taggedPeople.join(', ')}`
    });

    return { success: true, emailId };
  } catch (error) {
    console.error('Error in handleEmailTagging:', error);
    return { success: false, error: error.message };
  }
}

// Get all tagged emails
async function getTaggedEmails() {
  console.log('Getting tagged emails...');
  try {
    const result = await chrome.storage.local.get(['taggedEmails']);
    console.log('Raw storage data:', result);
    
    const taggedEmails = result.taggedEmails || {};
    console.log('Tagged emails from storage:', taggedEmails);
    
    const userEmail = await getUserEmail();
    console.log('Current user email for filtering:', userEmail);
    
    // Filter emails based on whether user is requester or tagged person
    const filteredEmails = {};
    Object.entries(taggedEmails).forEach(([emailId, data]) => {
      console.log('Checking email:', emailId);
      console.log('Email data:', data);
      console.log('Is user requester?', data.requester === userEmail);
      console.log('Is user tagged?', data.taggedPeople.includes(userEmail));
      
      if (data.requester === userEmail || data.taggedPeople.includes(userEmail)) {
        console.log('Including email in filtered results');
        filteredEmails[emailId] = data;
      }
    });
    
    console.log('Final filtered emails:', filteredEmails);
    return filteredEmails;
  } catch (error) {
    console.error('Error getting tagged emails:', error);
    throw error;
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