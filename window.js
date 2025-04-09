// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== WINDOW: DOM Content Loaded ===');
  
  // Add event listeners
  document.getElementById('refresh-btn').addEventListener('click', loadRequests);
  document.getElementById('clear-storage-btn').addEventListener('click', clearStorage);
  
  // Initial load
  loadRequests();
});

// Load email requests
async function loadRequests() {
  console.log('=== WINDOW: Loading requests ===');
  
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const emptyEl = document.getElementById('empty');
  const gridEl = document.getElementById('email-grid');
  
  try {
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    emptyEl.style.display = 'none';
    gridEl.innerHTML = '';
    
    // Get current user's email
    const userResponse = await chrome.runtime.sendMessage({ type: 'GET_USER_EMAIL' });
    if (!userResponse.success) {
      throw new Error(userResponse.error || 'Could not get user email');
    }
    
    const userEmail = userResponse.email;
    console.log('=== WINDOW: Current user email:', userEmail, '===');
    
    // Get tagged emails
    const response = await chrome.runtime.sendMessage({ type: 'GET_TAGGED_EMAILS' });
    if (!response.success) {
      throw new Error(response.error || 'Could not get tagged emails');
    }
    
    const emails = response.emails;
    const emailCount = Object.keys(emails).length;
    console.log('=== WINDOW: Received', emailCount, 'emails ===');
    
    // Log the first email to see its structure
    if (emailCount > 0) {
      const firstEmailId = Object.keys(emails)[0];
      const firstEmail = emails[firstEmailId];
      console.log('=== WINDOW: First email structure:', JSON.stringify(firstEmail, null, 2), '===');
    }
    
    if (emailCount === 0) {
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    
    // Sort emails by timestamp (newest first)
    const sortedEmails = Object.entries(emails)
      .sort(([, a], [, b]) => b.timestamp - a.timestamp);
    
    // Create email cards
    const emailCards = sortedEmails.map(([emailId, email]) => {
      const suggestions = email.suggestions || [];
      const subject = email.email?.subject || 'No Subject';
      const from = email.email?.from || 'Unknown Sender';
      const body = email.email?.body || 'No content available';
      
      return `
        <div class="email-card" data-email-id="${emailId}">
          <div class="email-header">
            <div class="email-title">
              ${escapeHtml(subject)}
              <span class="status-badge ${email.status}">${email.status}</span>
            </div>
            <div class="email-meta">
              From: ${escapeHtml(from)}<br>
              Requester: ${escapeHtml(email.requester)}<br>
              Tagged: ${escapeHtml(email.taggedPeople.join(', '))}<br>
              Note: ${escapeHtml(email.note || '')}
            </div>
          </div>
          <div class="email-content" style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 4px;">
            <h4>Email Content:</h4>
            <div style="max-height: 300px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.5; margin-top: 8px; padding: 10px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
              ${escapeHtml(body)}
            </div>
          </div>
          <div class="suggestions">
            <h4>Messages (${suggestions.length})</h4>
            ${suggestions.length > 0 ? 
              `<ul>${suggestions.map(s => `
                <li class="${s.author === userEmail ? 'sent' : 'received'}">
                  <div class="message-bubble">
                    ${escapeHtml(s.text)}
                  </div>
                  <div class="message-meta">
                    ${s.author === userEmail ? 'You' : escapeHtml(s.author)} • ${formatDate(s.timestamp)}
                  </div>
                </li>
              `).join('')}</ul>` : 
              '<p>No messages in this thread yet</p>'
            }
          </div>
          <div class="add-suggestion">
            <textarea 
              class="message-input"
              placeholder="Type your message..."
              rows="2"
              data-email-id="${emailId}"
            ></textarea>
            <button class="btn send-message" data-email-id="${emailId}">
              Send Message
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Update the grid
    gridEl.innerHTML = emailCards;
    
    // Add message handlers to the new buttons
    addMessageHandlers();
    
    // Add event listeners for enter key in textareas
    gridEl.querySelectorAll('.message-input').forEach(textarea => {
      textarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const emailId = textarea.dataset.emailId;
          const sendButton = textarea.parentElement.querySelector('.send-message');
          handleSendMessage({ target: sendButton });
        }
      });
    });
    
    loadingEl.style.display = 'none';
    console.log('=== WINDOW: Finished displaying emails ===');
  } catch (error) {
    console.error('=== WINDOW: Error loading requests:', error, '===');
    loadingEl.style.display = 'none';
    errorEl.textContent = `Error: ${error.message}`;
    errorEl.style.display = 'block';
  }
}

// Add click handlers to all send message buttons
function addMessageHandlers() {
  const sendButtons = document.querySelectorAll('.send-message');
  sendButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const emailId = event.target.dataset.emailId;
      const textarea = event.target.parentElement.querySelector('.message-input');
      const text = textarea.value.trim();
      
      if (!text) {
        console.log('=== WINDOW: Empty message, not sending ===');
        return;
      }
      
      try {
        // Disable button and show loading state
        button.disabled = true;
        button.textContent = 'Sending...';
        
        // Get current user's email
        const userResponse = await chrome.runtime.sendMessage({ type: 'GET_USER_EMAIL' });
        if (!userResponse.success) {
          throw new Error(userResponse.error || 'Could not get user email');
        }
        
        // Send the message
        const response = await chrome.runtime.sendMessage({
          type: 'ADD_SUGGESTION',
          data: {
            emailId,
            suggestion: text,
            author: userResponse.email
          }
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to send message');
        }
        
        // Clear the textarea
        textarea.value = '';
        
        // Show success state
        button.textContent = 'Sent!';
        button.style.backgroundColor = '#34A853';
        
        // Reset button after 2 seconds
        setTimeout(() => {
          button.disabled = false;
          button.textContent = 'Send Message';
          button.style.backgroundColor = '';
        }, 2000);
        
        // Reload to show the new message
        await loadRequests();
      } catch (error) {
        console.error('=== WINDOW: Error sending message:', error, '===');
        button.textContent = 'Failed to send';
        button.style.backgroundColor = '#EA4335';
        
        // Reset button after 2 seconds
        setTimeout(() => {
          button.disabled = false;
          button.textContent = 'Send Message';
          button.style.backgroundColor = '';
        }, 2000);
      }
    });
  });
}

// Clear storage
async function clearStorage() {
  if (!confirm('Are you sure you want to clear all stored emails?')) {
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_STORAGE' });
    if (!response.success) {
      throw new Error(response.error || 'Failed to clear storage');
    }
    
    await loadRequests();
  } catch (error) {
    console.error('=== WINDOW: Error clearing storage:', error, '===');
    alert('Failed to clear storage: ' + error.message);
  }
}

// Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than a minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  
  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  
  // Format date
  return date.toLocaleString();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
} 