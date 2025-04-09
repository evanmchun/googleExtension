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
      
      // Test connection with background script with retries
      console.log('Testing connection with background script...');
      let testResponse = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          testResponse = await this.sendMessage({ type: 'TEST_CONNECTION' });
          console.log('Connection test response:', testResponse);
          break;
        } catch (error) {
          retryCount++;
          console.log(`Connection test attempt ${retryCount} failed:`, error);
          if (retryCount < maxRetries) {
            console.log('Retrying in 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!testResponse) {
        console.warn('Could not establish connection with background script after retries');
      }
      
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
    
    // Add styles for the sidebar and its components
    const style = document.createElement('style');
    style.textContent = `
      .email-helper-sidebar {
        position: fixed;
        top: 0;
        right: -400px;
        width: 400px;
        height: 100vh;
        background: white;
        box-shadow: -2px 0 5px rgba(0,0,0,0.1);
        z-index: 9999;
        transition: right 0.3s ease;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .email-helper-sidebar.active {
        right: 0;
      }
      
      .email-helper-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
      }
      
      .email-helper-header h3 {
        margin: 0;
        color: #202124;
        font-size: 18px;
      }
      
      .close-sidebar {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #5f6368;
        padding: 0;
      }
      
      .email-helper-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .tag-section {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      
      .input-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      .input-group label {
        font-size: 14px;
        color: #5f6368;
        font-weight: 500;
      }
      
      .tag-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #dadce0;
        border-radius: 4px;
        font-size: 14px;
        color: #202124;
      }
      
      .note-input {
        width: 100%;
        min-height: 100px;
        padding: 8px 12px;
        border: 1px solid #dadce0;
        border-radius: 4px;
        font-size: 14px;
        color: #202124;
        resize: vertical;
        font-family: inherit;
      }
      
      .tag-button {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .tag-button:hover {
        background: #1557b0;
      }
      
      .suggestions-section {
        margin-top: 20px;
      }
      
      .suggestions-section h4 {
        margin: 0 0 10px;
        color: #202124;
        font-size: 16px;
      }
      
      .suggestions-list {
        max-height: 300px;
        overflow-y: auto;
      }
    `;
    document.head.appendChild(style);
    
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

    tagButton.addEventListener('click', async (e) => {
      console.log('Request Help button clicked');
      e.preventDefault();
      await this.handleTagging();
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
    console.log('=== CONTENT: Starting updateCurrentEmail ===');
    
    try {
      // Find the email container
      const emailContainer = this.findEmailContainer();
      if (!emailContainer) {
        console.log('=== CONTENT: No email container found ===');
        return false;
      }
      
      // Find subject, body, and from elements
      const subjectElement = this.findSubjectElement(emailContainer);
      const bodyElement = this.findBodyElement(emailContainer);
      const fromElement = this.findFromElement(emailContainer);
      const toElement = this.findToElement(emailContainer);
      
      console.log('=== CONTENT: Found elements:', {
        subject: !!subjectElement,
        body: !!bodyElement,
        from: !!fromElement,
        to: !!toElement
      }, '===');
      
      if (!subjectElement || !bodyElement || !fromElement) {
        console.log('=== CONTENT: Missing required elements ===');
        return false;
      }
      
      // Get subject text
      const subject = subjectElement.textContent.trim();
      
      // Get body text
      let body = bodyElement.textContent.trim();
      if (body.length > 10000) {
        body = body.substring(0, 10000) + '... [Content truncated]';
      }
      
      // Get sender info
      const fromEmail = fromElement.getAttribute('email') || fromElement.textContent.trim();
      
      // Get recipient info (requester)
      const toEmail = toElement ? toElement.getAttribute('email') || toElement.textContent.trim() : null;
      console.log('=== CONTENT: Recipient email:', toEmail, '===');
      
      // Create email data object
      const emailData = {
        subject,
        body,
        from: fromEmail,
        to: toEmail, // Add the recipient email
        timestamp: Date.now()
      };
      
      console.log('=== CONTENT: Constructed email data:', {
        subject: emailData.subject,
        from: emailData.from,
        to: emailData.to,
        bodyLength: emailData.body.length,
        timestamp: emailData.timestamp
      }, '===');
      
      // Check if email has changed
      const emailKey = `${subject}-${fromEmail}-${toEmail}`;
      if (this.currentEmail && this.currentEmailKey === emailKey) {
        console.log('=== CONTENT: Email unchanged, keeping current data with key:', emailKey, '===');
        return false;
      }
      
      console.log('=== CONTENT: Email changed, updating current email ===');
      this.currentEmail = emailData;
      this.currentEmailKey = emailKey;
      
      return true;
    } catch (error) {
      console.error('=== CONTENT: Error in updateCurrentEmail:', error, '===');
      return false;
    }
  }

  findToElement(container) {
    console.log('Finding recipient element...');
    
    // First get the current user's email
    const userEmail = this.getUserEmail();
    console.log('Current user email:', userEmail);
    
    // Try to find the recipient element using Gmail's structure
    const selectors = [
      'span[email][data-hovercard-id]', // Gmail's modern email attribute
      'span[email]', // Email attribute
      '.gD[email]', // Gmail's older structure
      '.g2[email]', // Alternative Gmail class
      'div[role="gridcell"] span[email]', // Grid cell containing email
      'tr[data-legacy-last-message-id] td span[email]' // Legacy view
    ];
    
    // First try to find elements with the current user's email
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const email = element.getAttribute('email');
        const text = element.textContent.trim();
        console.log('Checking recipient element:', { selector, email, text });
        
        // If this is the current user's email, it's the recipient
        if (email === userEmail) {
          console.log('Found recipient element (current user):', { email, text });
          return element;
        }
      }
    }
    
    // If not found by email match, try to find by text content and position
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const email = element.getAttribute('email');
        const text = element.textContent.trim();
        const parentText = element.closest('div')?.textContent || '';
        
        // Check if this is a recipient element based on text content and position
        if (email && (
          parentText.toLowerCase().includes('to:') ||
          parentText.toLowerCase().includes('to me') ||
          text.toLowerCase() === 'me' ||
          element.closest('tr')?.textContent.toLowerCase().includes('to:') ||
          element.closest('div')?.textContent.toLowerCase().includes('to:')
        )) {
          console.log('Found recipient element by text content:', { email, text });
          return element;
        }
      }
    }
    
    // If still not found, try to find any element with the email attribute that's not the sender
    const allEmailElements = document.querySelectorAll('[email]');
    for (const element of allEmailElements) {
      const email = element.getAttribute('email');
      if (email && email !== this.currentEmail?.from) {
        console.log('Found recipient element as last resort:', { email });
        return element;
      }
    }
    
    console.log('No recipient element found');
    return null;
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
    console.log('=== CONTENT: handleTagging called ===');
    const tagInput = this.sidebar.querySelector('#tag-input');
    const noteInput = this.sidebar.querySelector('#note-input');
    
    console.log('=== CONTENT: Input values:', {
      tagInput: tagInput.value,
      noteInput: noteInput.value
    });
    
    // Process inputs
    const taggedPeople = tagInput.value.split(',').map(email => email.trim());
    const note = noteInput.value.trim();
    
    console.log('=== CONTENT: Processed inputs:', {
      taggedPeople,
      note
    });
    
    // Get current user email
    const currentUserEmail = await this.getUserEmail();
    console.log('=== CONTENT: Current user email:', currentUserEmail);
    
    // Get current email data
    console.log('=== CONTENT: Current email data:', this.currentEmail);
    
    // Prepare tag request
    const tagRequest = {
      emailData: {
        subject: this.currentEmail.subject,
        body: this.currentEmail.body,
        from: this.currentEmail.from,
        timestamp: this.currentEmail.timestamp
      },
      taggedPeople,
      note,
      requester: currentUserEmail,
      timestamp: Date.now(),
      status: 'pending',
      suggestions: []
    };
    
    console.log('=== CONTENT: Preparing tag request with data:', tagRequest);
    
    try {
      // Send tag request to background script
      const response = await chrome.runtime.sendMessage({
        type: 'TAG_EMAIL',
        data: tagRequest
      });
      
      console.log('=== CONTENT: Received tag response:', response);
      
      if (!response) {
        throw new Error('No response received from background script');
      }
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Clear inputs and close sidebar on success
      this.clearInputs();
      this.closeSidebar();
      
      // Show success message
      this.showError('Email tagged successfully!', 'success');
      
    } catch (error) {
      console.error('=== CONTENT: Error tagging email:', error);
      this.showError(`Error tagging email: ${error.message}`);
    }
  }

  findEmailContainer() {
    // Try different selectors used by Gmail for email containers
    const containers = [
      document.querySelector('div[role="main"] .h7'),
      document.querySelector('.ade'),
      document.querySelector('.BltHke'),
      document.querySelector('.adn.ads'),
      document.querySelector('.gs')
    ];
    
    // Return the first valid container found
    return containers.find(container => container !== null) || null;
  }

  findSubjectElement(container) {
    console.log('Finding subject element...');
    
    // Try to find the exact Gmail subject header structure
    const exactSubjectHeader = document.querySelector('h2[jsname="r4nke"][data-thread-perm-id].hP');
    if (exactSubjectHeader) {
      console.log('Found exact Gmail subject header:', {
        text: exactSubjectHeader.textContent,
        threadId: exactSubjectHeader.getAttribute('data-thread-perm-id'),
        className: exactSubjectHeader.className
      });
      return exactSubjectHeader;
    }

    // Try finding just by jsname and class
    const subjectByJsname = document.querySelector('h2[jsname="r4nke"].hP');
    if (subjectByJsname) {
      console.log('Found Gmail subject by jsname:', subjectByJsname);
      return subjectByJsname;
    }

    // Try finding by class only
    const subjectByClass = document.querySelector('h2.hP');
    if (subjectByClass) {
      console.log('Found Gmail subject by class:', subjectByClass);
      return subjectByClass;
    }

    // Try finding in the container
    if (container) {
      const containerSubject = container.querySelector('h2[jsname="r4nke"], h2.hP');
      if (containerSubject) {
        console.log('Found subject in container:', containerSubject);
        return containerSubject;
      }
    }

    console.log('No subject element found');
    return null;
  }

  findBodyElement(container) {
    return container.querySelector('.aiL') ||
           container.querySelector('.a3s') ||
           container.querySelector('.gt') ||
           container.querySelector('.msg') ||
           container.querySelector('.thread');
  }

  findFromElement(container) {
    return container.querySelector('.gD') ||
           container.querySelector('.g2') ||
           container.querySelector('.from') ||
           document.querySelector('.gD');
  }

  getUserEmail() {
    console.log('=== CONTENT: Starting getUserEmail ===');
    
    // First try to find email in the profile picture element
    const profilePicture = document.querySelector('img[aria-label*="@"]');
    if (profilePicture) {
      const email = profilePicture.getAttribute('aria-label');
      console.log('=== CONTENT: Found email in profile picture:', email, '===');
      if (email) return email;
    }

    // Try to find email in the account switcher
    const accountSwitcher = document.querySelector('div[data-ogab]');
    if (accountSwitcher) {
      const email = accountSwitcher.getAttribute('data-ogab');
      console.log('=== CONTENT: Found email in account switcher:', email, '===');
      if (email) return email;
    }

    // Try to find email in the profile element with better extraction
    const profileElement = document.querySelector('a[aria-label*="@"]');
    if (profileElement) {
      const label = profileElement.getAttribute('aria-label');
      // Extract email using regex that matches email pattern within parentheses
      const emailMatch = label.match(/\(([^)]+@[^)]+)\)/);
      if (emailMatch && emailMatch[1]) {
        const email = emailMatch[1].trim();
        console.log('=== CONTENT: Found email in profile element:', email, '===');
        return email;
      }
    }

    // Try to find email in the compose button
    const composeButton = document.querySelector('div[role="button"][gh="cm"]');
    if (composeButton) {
      const email = composeButton.getAttribute('data-email');
      console.log('=== CONTENT: Found email in compose button:', email, '===');
      if (email) return email;
    }

    // Try to find email in the page content
    const emailMatch = document.body.innerHTML.match(/"email":"([^"]+)"/);
    if (emailMatch && emailMatch[1]) {
      console.log('=== CONTENT: Found email in page content:', emailMatch[1], '===');
      return emailMatch[1];
    }

    // Try additional selectors
    const additionalSelectors = [
      'div[data-email]',
      'span[email]',
      'a[data-email]',
      'div[data-email-id]'
    ];
    
    console.log('=== CONTENT: Trying additional selectors ===');
    for (const selector of additionalSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const email = element.getAttribute('data-email') || element.getAttribute('email');
        if (email && email.includes('@')) {
          console.log(`=== CONTENT: Found email using selector "${selector}":`, email, '===');
          return email;
        }
      }
    }

    console.error('=== CONTENT: Could not find user email using any method ===');
    return null;
  }

  clearInputs() {
    console.log('=== CONTENT: Clearing inputs ===');
    const tagInput = this.sidebar.querySelector('#tag-input');
    const noteInput = this.sidebar.querySelector('#note-input');
    
    if (tagInput) tagInput.value = '';
    if (noteInput) noteInput.value = '';
    
    console.log('=== CONTENT: Inputs cleared ===');
  }

  closeSidebar() {
    console.log('=== CONTENT: Closing sidebar ===');
    if (this.sidebar) {
      this.sidebar.classList.remove('active');
      console.log('=== CONTENT: Sidebar closed ===');
    }
  }
}

// Initialize the helper when Gmail is loaded
console.log('Email Reply Helper script loaded');
const gmailHelper = new GmailHelper(); 