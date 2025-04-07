// Fetch and display tagged emails when popup opens
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup opened - DOM Content Loaded');
  
  // Debug: Check raw storage state
  chrome.storage.local.get(null, (result) => {
    console.log('Current storage state:', result);
  });
  
  // Get user email for debugging
  chrome.runtime.sendMessage({ type: 'GET_USER_EMAIL' }, (response) => {
    console.log('Current user email:', response.email);
    window.userEmail = response.email; // Store for later use
  });
  
  loadRequests();
});

async function loadRequests() {
  console.log('Starting to load requests...');
  const requestsList = document.getElementById('requests-list');
  if (!requestsList) {
    console.error('Could not find requests-list element');
    return;
  }
  
  try {
    // Get tagged emails from background script
    console.log('Sending GET_TAGGED_EMAILS message to background script...');
    const response = await chrome.runtime.sendMessage({ type: 'GET_TAGGED_EMAILS' });
    console.log('Received response from background script:', response);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to load requests');
    }

    const emails = response.emails;
    console.log('Processing emails:', emails);
    
    if (Object.keys(emails).length === 0) {
      console.log('No requests found, showing empty state');
      requestsList.innerHTML = '<div class="no-requests">No help requests found. Click the "Get Help" button in an email to create one.</div>';
      return;
    }

    // Sort emails by timestamp, newest first
    const sortedEmails = Object.entries(emails).sort((a, b) => b[1].timestamp - a[1].timestamp);
    console.log('Sorted emails:', sortedEmails);
    
    requestsList.innerHTML = sortedEmails.map(([emailId, data]) => `
      <div class="request-card">
        <div class="request-header">
          ${escapeHtml(data.email.subject)}
          <span class="status-badge status-${data.status}">${data.status}</span>
        </div>
        <div class="request-meta">
          ${data.requester === (window.userEmail || '') ? 'Requested by you' : `Requested by ${escapeHtml(data.requester)}`}
          • ${formatDate(data.timestamp)}
        </div>
        ${data.note ? `<div class="request-note">${escapeHtml(data.note)}</div>` : ''}
        <div class="request-meta">
          Tagged: ${data.taggedPeople.map(email => escapeHtml(email)).join(', ')}
        </div>
        ${data.suggestions.length > 0 ? `
          <div class="suggestions-list">
            ${data.suggestions.map(suggestion => `
              <div class="suggestion">
                <div class="request-meta">${escapeHtml(suggestion.author)} • ${formatDate(suggestion.timestamp)}</div>
                ${escapeHtml(suggestion.text)}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');
    
    console.log('Requests rendered successfully');
    
  } catch (error) {
    console.error('Error loading requests:', error);
    requestsList.innerHTML = `<div class="no-requests">Error loading requests: ${error.message}</div>`;
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
    
    const taggedCountElement = document.getElementById('taggedCount');
    const suggestionsCountElement = document.getElementById('suggestionsCount');
    
    if (taggedCountElement) {
      taggedCountElement.textContent = taggedCount;
    }
    if (suggestionsCountElement) {
      suggestionsCountElement.textContent = suggestionsCount;
    }
    
    console.log('Stats updated:', { taggedCount, suggestionsCount });
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', changes);
  if (namespace === 'local' && changes.taggedEmails) {
    console.log('Tagged emails changed, updating stats...');
    updateStats();
  }
}); 