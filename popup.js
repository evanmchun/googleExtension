// Fetch and display tagged emails when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== POPUP: DOM Content Loaded ===');
  
  // Add clear storage button
  const header = document.querySelector('.header');
  const clearButton = document.createElement('button');
  clearButton.textContent = 'Clear Storage';
  clearButton.style.cssText = `
    position: absolute;
    right: 10px;
    top: 10px;
    padding: 4px 8px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  clearButton.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all stored emails? This cannot be undone.')) {
      const response = await chrome.runtime.sendMessage({ type: 'CLEAR_STORAGE' });
      if (response.success) {
        alert('Storage cleared successfully');
        loadRequests(); // Reload the requests list
      } else {
        alert('Failed to clear storage: ' + response.error);
      }
    }
  });
  header.appendChild(clearButton);
  
  // Show loading state
  const requestsList = document.getElementById('requests-list');
  requestsList.innerHTML = '<div class="loading">Loading requests...</div>';
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.marginBottom = '10px';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';
  
  // Add debug button
  const debugButton = document.createElement('button');
  debugButton.textContent = 'Debug Storage';
  debugButton.style.padding = '5px 10px';
  debugButton.style.backgroundColor = '#f1f3f4';
  debugButton.style.border = '1px solid #dadce0';
  debugButton.style.borderRadius = '4px';
  debugButton.style.cursor = 'pointer';
  debugButton.onclick = async () => {
    try {
      console.log('=== POPUP: Dumping storage contents ===');
      const response = await chrome.runtime.sendMessage({ type: 'DUMP_STORAGE' });
      
      if (response.success) {
        console.log('=== POPUP: Storage dump successful ===');
        console.log('=== POPUP: Storage data:', response.data, '===');
        
        // Display storage data in a pre element
        const pre = document.createElement('pre');
        pre.style.backgroundColor = '#f1f3f4';
        pre.style.padding = '10px';
        pre.style.borderRadius = '4px';
        pre.style.overflow = 'auto';
        pre.style.maxHeight = '300px';
        pre.style.fontSize = '12px';
        pre.textContent = JSON.stringify(response.data, null, 2);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#1a73e8';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => {
          document.body.removeChild(debugContainer);
        };
        
        // Create container for debug info
        const debugContainer = document.createElement('div');
        debugContainer.style.position = 'fixed';
        debugContainer.style.top = '0';
        debugContainer.style.left = '0';
        debugContainer.style.width = '100%';
        debugContainer.style.height = '100%';
        debugContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        debugContainer.style.zIndex = '1000';
        debugContainer.style.display = 'flex';
        debugContainer.style.flexDirection = 'column';
        debugContainer.style.alignItems = 'center';
        debugContainer.style.justifyContent = 'center';
        debugContainer.style.padding = '20px';
        
        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Storage Debug Info';
        title.style.color = 'white';
        title.style.marginBottom = '10px';
        
        // Add elements to container
        debugContainer.appendChild(title);
        debugContainer.appendChild(pre);
        debugContainer.appendChild(closeButton);
        
        // Add container to body
        document.body.appendChild(debugContainer);
      } else {
        console.error('=== POPUP: Storage dump failed:', response.error, '===');
      }
    } catch (error) {
      console.error('=== POPUP: Error dumping storage:', error, '===');
    }
  };
  
  // Add buttons to container
  buttonContainer.appendChild(debugButton);
  
  // Insert button container before requests list
  requestsList.parentNode.insertBefore(buttonContainer, requestsList);
  
  try {
    // Get current user's email
    console.log('=== POPUP: Getting current user email ===');
    const response = await chrome.runtime.sendMessage({ type: 'GET_USER_EMAIL' });
    
    if (!response.success) {
      console.error('=== POPUP: Failed to get user email:', response.error, '===');
      requestsList.innerHTML = `<div class="error">Error: ${response.error}</div>`;
      return;
    }
    
    const userEmail = response.email;
    console.log('=== POPUP: Current user email:', userEmail, '===');
    
    // Get tagged emails
    console.log('=== POPUP: Getting tagged emails ===');
    const emailsResponse = await chrome.runtime.sendMessage({ type: 'GET_TAGGED_EMAILS' });
    
    if (!emailsResponse.success) {
      console.error('=== POPUP: Failed to get tagged emails:', emailsResponse.error, '===');
      requestsList.innerHTML = `<div class="error">Error: ${emailsResponse.error}</div>`;
      return;
    }
    
    const emails = emailsResponse.emails;
    console.log('=== POPUP: Received', Object.keys(emails).length, 'emails ===');
    
    // Display emails
    if (Object.keys(emails).length === 0) {
      requestsList.innerHTML = '<div class="empty">No help requests found</div>';
      return;
    }
    
    // Sort emails by timestamp (newest first)
    const sortedEmails = Object.entries(emails)
      .sort(([, a], [, b]) => b.timestamp - a.timestamp);
    
    requestsList.innerHTML = '';
    
    sortedEmails.forEach(([emailId, data]) => {
      console.log('=== POPUP: Processing email:', emailId, '===');
      const email = data.email;
      const requester = data.requester;
      const taggedPeople = data.taggedPeople;
      const note = data.note;
      const timestamp = new Date(data.timestamp);
      const suggestions = data.suggestions || [];
      
      const emailElement = document.createElement('div');
      emailElement.className = 'email-item';
      emailElement.innerHTML = `
        <div class="email-header">
          <h3>${email.subject}</h3>
          <span class="timestamp">${timestamp.toLocaleString()}</span>
        </div>
        <div class="email-details">
          <p><strong>From:</strong> ${email.from}</p>
          <p><strong>Requester:</strong> ${requester}</p>
          <p><strong>Tagged:</strong> ${taggedPeople.join(', ')}</p>
          ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        </div>
        <div class="suggestions">
          <h4>Suggestions (${suggestions.length})</h4>
          ${suggestions.length > 0 ? 
            `<ul>${suggestions.map(s => `
              <li>
                <p>${s.text}</p>
                <small>By ${s.author} on ${new Date(s.timestamp).toLocaleString()}</small>
              </li>
            `).join('')}</ul>` : 
            '<p>No suggestions yet</p>'
          }
        </div>
        <div class="add-suggestion">
          <textarea id="suggestion-${emailId}" placeholder="Add a suggestion..."></textarea>
          <button onclick="addSuggestion('${emailId}')">Add Suggestion</button>
        </div>
      `;
      
      requestsList.appendChild(emailElement);
    });
    
    console.log('=== POPUP: Finished displaying emails ===');
  } catch (error) {
    console.error('=== POPUP: Error loading requests:', error, '===');
    requestsList.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
});

// Add a suggestion to an email
async function addSuggestion(emailId) {
  console.log('=== POPUP: Adding suggestion to email:', emailId, '===');
  
  const suggestionText = document.getElementById(`suggestion-${emailId}`).value;
  if (!suggestionText.trim()) {
    console.log('=== POPUP: Suggestion text is empty, not adding ===');
    return;
  }
  
  try {
    // Get current user's email
    const response = await chrome.runtime.sendMessage({ type: 'GET_USER_EMAIL' });
    if (!response.success) {
      console.error('=== POPUP: Failed to get user email for suggestion:', response.error, '===');
      return;
    }
    
    const userEmail = response.email;
    console.log('=== POPUP: Adding suggestion as user:', userEmail, '===');
    
    // Send suggestion to background script
    const result = await chrome.runtime.sendMessage({
      type: 'ADD_SUGGESTION',
      emailId,
      suggestion: suggestionText,
      author: userEmail
    });
    
    if (result.success) {
      console.log('=== POPUP: Suggestion added successfully ===');
      // Clear the textarea
      document.getElementById(`suggestion-${emailId}`).value = '';
      // Reload the requests to show the new suggestion
      location.reload();
    } else {
      console.error('=== POPUP: Failed to add suggestion:', result.error, '===');
    }
  } catch (error) {
    console.error('=== POPUP: Error adding suggestion:', error, '===');
  }
}

// Update stats when popup opens
document.addEventListener('DOMContentLoaded', () => {
  console.log('Updating stats...');
  updateStats();
});

// Update statistics
function updateStats() {
  console.log('Getting storage for stats update...');
  chrome.storage.local.get(['taggedEmails'], (result) => {
    console.log('Storage retrieved for stats:', result);
    const taggedEmails = result.taggedEmails || {};
    const taggedCount = Object.keys(taggedEmails).length;
    
    let suggestionsCount = 0;
    Object.values(taggedEmails).forEach(email => {
      suggestionsCount += (email.suggestions || []).length;
    });
    
    // Create stats container if it doesn't exist
    let statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) {
      statsContainer = document.createElement('div');
      statsContainer.id = 'statsContainer';
      statsContainer.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; background: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; color: #666;';
      document.body.appendChild(statsContainer);
    }
    
    statsContainer.innerHTML = `
      <div>Tagged Emails: ${taggedCount}</div>
      <div>Suggestions: ${suggestionsCount}</div>
    `;
    
    console.log('Stats updated:', { taggedCount, suggestionsCount });
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', changes);
  if (namespace === 'local' && changes.taggedEmails) {
    console.log('Tagged emails changed, updating stats...');
    updateStats();
    loadRequests(); // Reload requests when storage changes
  }
});

// Load requests when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== POPUP: DOM Content Loaded ===');
  
  // Show a visible notification in the popup
  const popupBody = document.body;
  const notification = document.createElement('div');
  notification.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #f8f9fa; padding: 10px; text-align: center; z-index: 9999;';
  notification.textContent = 'Loading requests...';
  popupBody.appendChild(notification);
  
  // Create requests list container if it doesn't exist
  let requestsList = document.getElementById('requestsList');
  if (!requestsList) {
    requestsList = document.createElement('div');
    requestsList.id = 'requestsList';
    requestsList.style.cssText = 'margin-top: 50px; padding: 10px;';
    popupBody.appendChild(requestsList);
  }
  
  // Debug: Check raw storage state
  chrome.storage.local.get(null, (result) => {
    console.log('=== POPUP: Current storage state:', result, '===');
    notification.textContent = `Storage check complete. Found ${Object.keys(result.taggedEmails || {}).length} emails.`;
  });
  
  // Get user email for debugging
  chrome.runtime.sendMessage({ type: 'GET_USER_EMAIL' }, (response) => {
    console.log('=== POPUP: Current user email:', response.email, '===');
    notification.textContent += ` | User email: ${response.email || 'Not found'}`;
    window.userEmail = response.email; // Store for later use
  });
  
  loadRequests();
});

// Load and display requests
async function loadRequests() {
  console.log('=== POPUP: Starting to load requests ===');
  try {
    // Get current user's email
    const response = await chrome.runtime.sendMessage({ type: 'GET_USER_EMAIL' });
    const currentUserEmail = response.email;
    console.log('=== POPUP: Current user email:', currentUserEmail, '===');
    
    if (!currentUserEmail) {
      console.error('=== POPUP: Could not determine user email ===');
      showError('Could not determine your email address');
      return;
    }
    
    // Get tagged emails from background script
    console.log('=== POPUP: Requesting tagged emails from background ===');
    const result = await chrome.runtime.sendMessage({ type: 'GET_TAGGED_EMAILS' });
    console.log('=== POPUP: Received response from background:', result, '===');
    
    if (!result.success) {
      console.error('=== POPUP: Failed to get tagged emails:', result.error, '===');
      showError(result.error || 'Failed to load requests');
      return;
    }
    
    const emails = result.emails;
    console.log('=== POPUP: Number of emails found:', Object.keys(emails).length, '===');
    
    if (Object.keys(emails).length === 0) {
      console.log('=== POPUP: No requests found, showing empty state ===');
      showEmptyState();
      return;
    }
    
    // Process and display emails
    console.log('=== POPUP: Processing emails for display ===');
    const requestsList = document.getElementById('requestsList');
    if (!requestsList) {
      console.error('=== POPUP: Requests list element not found ===');
      showError('UI element not found');
      return;
    }
    
    requestsList.innerHTML = '';
    
    // Sort emails by timestamp (newest first)
    const sortedEmails = Object.entries(emails)
      .sort(([, a], [, b]) => b.timestamp - a.timestamp);
    
    console.log('=== POPUP: Sorted emails:', sortedEmails.map(([id, data]) => ({
      id,
      subject: data.email.subject,
      requester: data.requester,
      taggedPeople: data.taggedPeople,
      note: data.note,
      timestamp: new Date(data.timestamp).toLocaleString()
    })), '===');
    
    sortedEmails.forEach(([emailId, data]) => {
      console.log('=== POPUP: Creating card for email:', emailId, '===');
      const card = document.createElement('div');
      card.className = 'request-card';
      card.style.cssText = 'background: white; border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 10px;';
      
      const isRequester = data.requester === currentUserEmail;
      console.log('=== POPUP: Card details:', {
        emailId,
        subject: data.email.subject,
        isRequester,
        currentUserEmail,
        requesterEmail: data.requester,
        note: data.note
      }, '===');
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 14px;">${escapeHtml(data.email.subject)}</h3>
          <span style="background: ${isRequester ? '#e3f2fd' : '#f5f5f5'}; padding: 2px 6px; border-radius: 3px; font-size: 12px;">
            ${isRequester ? 'Requested' : 'Tagged'}
          </span>
        </div>
        <div style="font-size: 12px; color: #666;">
          <p style="margin: 4px 0;"><strong>From:</strong> ${escapeHtml(data.email.from)}</p>
          <p style="margin: 4px 0;"><strong>${isRequester ? 'Tagged' : 'Requested by'}:</strong> ${escapeHtml(isRequester ? data.taggedPeople.join(', ') : data.requester)}</p>
          <p style="margin: 4px 0;"><strong>Note:</strong> ${escapeHtml(data.note || 'No note provided')}</p>
          <p style="margin: 4px 0;"><strong>Time:</strong> ${formatDate(data.timestamp)}</p>
          <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;">
            <p style="margin: 4px 0;"><strong>Email Content:</strong></p>
            <div style="background: #f8f9fa; padding: 8px; border-radius: 4px; font-family: Arial, sans-serif; max-height: 300px; overflow-y: auto; white-space: pre-wrap; line-height: 1.5;">
              ${data.email.body}
            </div>
          </div>
        </div>
      `;
      
      requestsList.appendChild(card);
    });
    
    // Update notification
    const notification = document.querySelector('div');
    if (notification) {
      notification.textContent = `Found ${Object.keys(emails).length} requests`;
    }
  } catch (error) {
    console.error('=== POPUP: Error loading requests:', error, '===');
    showError('Failed to load requests');
  }
}

function showError(message) {
  const requestsList = document.getElementById('requestsList');
  if (requestsList) {
    requestsList.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #d32f2f;">
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }
  
  // Update notification
  const notification = document.querySelector('div');
  if (notification) {
    notification.textContent = `Error: ${message}`;
    notification.style.backgroundColor = '#ffebee';
  }
}

function showEmptyState() {
  const requestsList = document.getElementById('requestsList');
  if (requestsList) {
    requestsList.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #666;">
        <p>No help requests found.</p>
        <p style="font-size: 12px;">Requests will appear here when you or others tag you for help.</p>
      </div>
    `;
  }
  
  // Update notification
  const notification = document.querySelector('div');
  if (notification) {
    notification.textContent = 'No requests found';
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
} 