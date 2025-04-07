// Gmail integration
class GmailHelper {
  constructor() {
    this.sidebar = null;
    this.currentEmail = null;
    this.lastProcessedEmail = null;
    this.debounceTimeout = null;
    this.buttonAddAttempts = 0;
    this.maxButtonAttempts = 150;
    console.log('Email Reply Helper class instantiated');
    // Delay initialization to ensure Gmail is fully loaded
    setTimeout(() => this.init(), 1000);
  }

  async init() {
    console.log('Starting initialization...');
    try {
      // Check if we're actually on Gmail
      const isGmail = window.location.hostname === 'mail.google.com';
      console.log('Is Gmail page:', isGmail);
      
      if (!isGmail) {
        console.log('Not a Gmail page, stopping initialization');
        return;
      }

      await this.waitForGmail();
      console.log('Gmail loaded, creating sidebar...');
      this.createSidebar();
      
      console.log('Setting up email view detection...');
      this.checkForEmailView();
      
      // Test connection with background script
      console.log('Testing connection with background script...');
      const testResponse = await this.sendMessage({ type: 'TEST_CONNECTION' });
      console.log('Connection test response:', testResponse);
      
      // Force initial button check
      console.log('Forcing initial button check...');
      this.buttonAddAttempts = 0;
      this.tryAddButton();
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.showError('Extension needs to be reloaded. Please refresh the page.');
    }
  }

  // Helper method to send messages to background script
  async sendMessage(message) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        this.showError('Extension needs to be reloaded. Please refresh the page.');
        throw error;
      }
      throw error;
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'email-helper-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <div class="error-title">⚠️ Email Reply Helper Error</div>
        <div class="error-message">${message}</div>
        <button class="error-refresh">Refresh Page</button>
        <button class="error-close">×</button>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .email-helper-error {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        background: #fce8e6;
        border: 1px solid #d93025;
        border-radius: 8px;
        padding: 16px;
        max-width: 400px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      .error-content {
        position: relative;
      }
      .error-title {
        font-weight: 500;
        margin-bottom: 8px;
        color: #d93025;
      }
      .error-message {
        color: #3c4043;
        font-size: 14px;
        line-height: 1.4;
        margin-bottom: 12px;
      }
      .error-refresh {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      .error-close {
        position: absolute;
        top: -8px;
        right: -8px;
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
        color: #5f6368;
      }
    `;
    document.head.appendChild(style);

    // Add event listeners
    errorDiv.querySelector('.error-refresh').addEventListener('click', () => {
      window.location.reload();
    });
    errorDiv.querySelector('.error-close').addEventListener('click', () => {
      errorDiv.remove();
    });

    document.body.appendChild(errorDiv);
  }

  waitForGmail() {
    console.log('Waiting for Gmail to load...');
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds maximum wait time
      
      const checkGmail = setInterval(() => {
        attempts++;
        console.log(`Gmail check attempt ${attempts}/${maxAttempts}`);
        
        const mainView = document.querySelector('div[role="main"]');
        const gmailView = document.querySelector('.aAU');
        console.log('Elements found:', {
          mainView: !!mainView,
          gmailView: !!gmailView
        });
        
        if (mainView && gmailView) {
          console.log('Gmail interface detected');
          clearInterval(checkGmail);
          
          // Wait a bit longer for the UI to stabilize
          setTimeout(() => {
            console.log('Gmail UI should be stable now');
            resolve();
          }, 1000);
        } else if (attempts >= maxAttempts) {
          console.log('Max attempts reached, forcing resolution');
          clearInterval(checkGmail);
          resolve();
        }
      }, 100);
    });
  }

  checkForEmailView() {
    console.log('Checking for email view...');
    // Initial check
    this.tryAddButton();

    // Set up observers
    this.observeEmailView();
    this.observeToolbar();
    console.log('Email view observers set up');
  }

  tryAddButton() {
    console.log('Attempting to add button, attempt #', this.buttonAddAttempts + 1);
    
    if (this.buttonAddAttempts >= this.maxButtonAttempts) {
      console.log('Max button add attempts reached');
      return;
    }

    // Try to find email container with expanded selectors
    const containers = [
      document.querySelector('div[role="main"] .h7'),
      document.querySelector('.ade'),
      document.querySelector('.BltHke'),
      document.querySelector('.adn.ads'),
      document.querySelector('.gs')
    ];
    
    console.log('Looking for email containers...');
    console.log('Available containers:', containers.map(c => c?.className || 'null').join(', '));
    
    const emailContainer = containers.find(container => container !== null);
    console.log('Selected email container:', emailContainer?.className || 'none');

    if (!emailContainer) {
      console.log('No email container found, retrying...');
      this.buttonAddAttempts++;
      setTimeout(() => this.tryAddButton(), 1000);
      return;
    }

    // Try to find the toolbar with expanded selectors
    const toolbarSelectors = [
      'div[role="main"] .G-tF',
      'div[role="main"] .aeH',
      'div[gh="mtb"]',
      '.aaq',
      '.amn',
      '.ams'
    ];
    
    console.log('Looking for toolbar using selectors:', toolbarSelectors);
    
    let toolbar = null;
    for (const selector of toolbarSelectors) {
      const element = document.querySelector(selector) || emailContainer.querySelector(selector);
      if (element) {
        toolbar = element;
        console.log('Found toolbar with selector:', selector);
        break;
      }
    }

    if (!toolbar) {
      console.log('No toolbar found, retrying...');
      this.buttonAddAttempts++;
      setTimeout(() => this.tryAddButton(), 1000);
      return;
    }

    // Reset attempts if we found both container and toolbar
    this.buttonAddAttempts = 0;
    
    // Now try to add the button
    this.addTagButton(toolbar);
  }

  observeEmailView() {
    console.log('Setting up email view observer...');
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          // Check if we're in an email view
          const emailContainer = document.querySelector('div[role="main"] .h7') || 
                               document.querySelector('.ade') ||
                               document.querySelector('.BltHke');
          
          if (emailContainer) {
            console.log('Email view detected, updating...');
            this.updateCurrentEmail();
            this.tryAddButton();
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('Email view observer initialized');
  }

  observeToolbar() {
    const observer = new MutationObserver(() => {
      const button = document.querySelector('.email-helper-tag-button');
      const toolbar = document.querySelector('div[role="main"] .G-tF') || 
                     document.querySelector('div[role="main"] .aeH') ||
                     document.querySelector('div[gh="mtb"]');
      
      if (toolbar && !button) {
        this.tryAddButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  createSidebar() {
    console.log('Creating sidebar...');
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'email-helper-sidebar';
    this.sidebar.innerHTML = `
      <div class="email-helper-header">
        <h3>Email Reply Helper</h3>
        <button class="close-sidebar">×</button>
      </div>
      <div class="email-helper-content">
        <div class="tag-section">
          <div class="input-group">
            <label for="tag-input">Tag people for help (comma-separated emails)</label>
            <input type="text" id="tag-input" placeholder="e.g., colleague@company.com" class="tag-input">
          </div>
          <div class="input-group">
            <label for="note-input">Add a note (optional)</label>
            <textarea id="note-input" placeholder="What kind of help do you need?" class="note-input"></textarea>
          </div>
          <button class="tag-button" id="request-help-btn">Request Help</button>
        </div>
        <div class="suggestions-section">
          <h4>Suggested Replies</h4>
          <div class="suggestions-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.sidebar);
    console.log('Sidebar created and injected');

    // Add event listeners
    const closeButton = this.sidebar.querySelector('.close-sidebar');
    const tagButton = this.sidebar.querySelector('#request-help-btn');

    closeButton.addEventListener('click', () => {
      console.log('Close button clicked');
      this.sidebar.classList.remove('active');
      console.log('Sidebar closed');
    });

    tagButton.addEventListener('click', (e) => {
      console.log('Request Help button clicked');
      e.preventDefault();
      this.handleTagging();
    });

    // Debug: Add mutation observer to track sidebar visibility
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          console.log('Sidebar class changed:', this.sidebar.className);
          console.log('Sidebar is active:', this.sidebar.classList.contains('active'));
        }
      });
    });

    observer.observe(this.sidebar, {
      attributes: true
    });
  }

  updateCurrentEmail() {
    console.log('Updating current email...');
    
    // Try different selectors for email container
    const emailContainer = document.querySelector('div[role="main"] .h7') || 
                         document.querySelector('.adn.ads') ||
                         document.querySelector('.gs');
                         
    console.log('Found email container:', !!emailContainer);
    if (emailContainer) {
      console.log('Email container classes:', emailContainer.className);
    }
    
    if (!emailContainer) {
      console.log('No email container found');
      return;
    }

    // Try different selectors for subject
    const subjectElement = document.querySelector('h2.hP') || 
                          document.querySelector('.hP') ||
                          emailContainer.querySelector('.ha h2');
                          
    // Try different selectors for body
    const bodyElement = emailContainer.querySelector('.a3s.aiL') ||
                       emailContainer.querySelector('.a3s') ||
                       emailContainer.querySelector('.ii.gt');
                       
    // Try different selectors for sender
    const fromElement = emailContainer.querySelector('.gD') ||
                       emailContainer.querySelector('.g2') ||
                       emailContainer.querySelector('.from');

    console.log('Found elements:', {
      subject: !!subjectElement,
      body: !!bodyElement,
      from: !!fromElement
    });

    if (subjectElement) {
      console.log('Subject element text:', subjectElement.textContent);
    }
    if (fromElement) {
      console.log('From element:', {
        email: fromElement.getAttribute('email'),
        text: fromElement.textContent
      });
    }

    if (!subjectElement || !bodyElement) {
      console.log('Missing required elements');
      return;
    }

    const emailData = {
      subject: subjectElement.textContent.trim(),
      body: bodyElement.textContent.trim(),
      from: fromElement ? fromElement.getAttribute('email') || fromElement.textContent.trim() : 'unknown',
      timestamp: Date.now()
    };

    console.log('Constructed email data:', emailData);

    // Only update if email has changed
    const emailKey = `${emailData.subject}-${emailData.from}`;
    if (this.lastProcessedEmail !== emailKey) {
      console.log('Email changed, updating current email');
      this.currentEmail = emailData;
      this.lastProcessedEmail = emailKey;
      console.log('Current email updated:', this.currentEmail);
    } else {
      console.log('Email unchanged, keeping current data:', this.currentEmail);
    }
  }

  addTagButton(toolbar) {
    console.log('Adding tag button to toolbar...');
    // Check if button already exists
    const existingButton = document.querySelector('.email-helper-tag-button');
    if (existingButton) {
      console.log('Tag button already exists');
      return;
    }

    // Create the button with Gmail's style
    const button = document.createElement('button');
    button.className = 'T-I J-J5-Ji email-helper-tag-button';
    button.setAttribute('role', 'button');
    button.setAttribute('data-tooltip', 'Get help with this email');
    button.innerHTML = `
      <span class="email-helper-button-text">Get Help</span>
    `;

    // Add Gmail's button styling
    const buttonStyle = `
      display: inline-flex !important;
      align-items: center !important;
      padding: 0 15px !important;
      margin-left: 8px !important;
      min-width: 56px !important;
      height: 32px !important;
      line-height: 32px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      font-family: 'Google Sans', Roboto, sans-serif !important;
      font-size: 14px !important;
      letter-spacing: 0.25px !important;
      background-color: #0b57d0 !important;
      color: #fff !important;
      font-weight: 500 !important;
      border: none !important;
      position: relative !important;
      z-index: 999 !important;
    `;
    
    button.setAttribute('style', buttonStyle);

    // Add click handler with debugging
    const clickHandler = (e) => {
      console.log('Get Help button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      // Force update email data
      this.updateCurrentEmail();
      
      // Show sidebar
      if (this.sidebar) {
        console.log('Activating sidebar');
        this.sidebar.classList.add('active');
        console.log('Sidebar class after activation:', this.sidebar.className);
        
        // Focus the tag input
        const tagInput = this.sidebar.querySelector('#tag-input');
        if (tagInput) {
          setTimeout(() => tagInput.focus(), 100);
        }
      } else {
        console.error('Sidebar not found');
      }
    };

    button.addEventListener('click', clickHandler);
    button.addEventListener('mousedown', (e) => e.preventDefault());

    // Insert the button into the toolbar
    console.log('Inserting button into toolbar:', toolbar);
    toolbar.appendChild(button);
    
    // Verify button is in DOM and styled correctly
    const addedButton = document.querySelector('.email-helper-tag-button');
    if (addedButton) {
      const styles = window.getComputedStyle(addedButton);
      console.log('Button successfully added with styles:', {
        display: styles.display,
        backgroundColor: styles.backgroundColor,
        visibility: styles.visibility,
        position: styles.position,
        zIndex: styles.zIndex
      });
    }
    
    console.log('Tag button added successfully');
  }

  async handleTagging() {
    console.log('handleTagging called');
    const tagInput = this.sidebar.querySelector('#tag-input');
    const noteInput = this.sidebar.querySelector('#note-input');
    
    console.log('Current email state:', this.currentEmail);
    console.log('Input values:', {
      tagInput: tagInput.value,
      noteInput: noteInput.value
    });
    
    const taggedPeople = tagInput.value.split(',').map(email => email.trim()).filter(email => email);
    
    if (taggedPeople.length === 0) {
      console.log('No email addresses entered');
      alert('Please enter at least one email address');
      return;
    }

    if (!this.currentEmail) {
      console.log('No email selected/captured');
      alert('No email selected');
      return;
    }

    try {
      const requestData = {
        emailData: this.currentEmail,
        taggedPeople,
        note: noteInput.value.trim()
      };
      
      console.log('Preparing tag request with data:', requestData);

      const response = await this.sendMessage({
        type: 'TAG_EMAIL',
        data: requestData
      });

      console.log('Received tag response:', response);

      if (response && response.success) {
        console.log('Tag request successful');
        // Show success message
        const notification = document.createElement('div');
        notification.className = 'email-helper-notification';
        notification.innerHTML = `
          <div class="notification-content">
            <div class="notification-title">✓ Help request sent successfully!</div>
            <div class="notification-text">
              To view all help requests, click the puzzle piece icon 🧩 in Chrome's toolbar 
              and select "Email Reply Helper"
            </div>
            <button class="notification-close">×</button>
          </div>
        `;

        // Add styles for the notification
        const style = document.createElement('style');
        style.textContent = `
          .email-helper-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            padding: 16px;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
          }
          .notification-content {
            position: relative;
          }
          .notification-title {
            font-weight: 500;
            margin-bottom: 8px;
            color: #137333;
          }
          .notification-text {
            color: #3c4043;
            font-size: 14px;
            line-height: 1.4;
          }
          .notification-close {
            position: absolute;
            top: -8px;
            right: -8px;
            border: none;
            background: none;
            font-size: 20px;
            cursor: pointer;
            color: #5f6368;
          }
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Add close button handler
        notification.querySelector('.notification-close').addEventListener('click', () => {
          notification.remove();
        });

        // Clear inputs and close sidebar
        tagInput.value = '';
        noteInput.value = '';
        this.sidebar.classList.remove('active');
        console.log('Inputs cleared and sidebar closed');

        // Auto-close notification after 8 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 8000);
      } else {
        console.log('Tag request failed:', response?.error || 'Unknown error');
        throw new Error(response?.error || 'Failed to send help request');
      }
    } catch (error) {
      console.error('Error in handleTagging:', error);
      this.showError('Failed to send help request. Please refresh the page and try again.');
    }
  }
}

// Initialize the helper when Gmail is loaded
console.log('Email Reply Helper script loaded');
const gmailHelper = new GmailHelper(); 