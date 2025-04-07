// Gmail integration
class GmailHelper {
  constructor() {
    this.sidebar = null;
    this.currentEmail = null;
    this.lastProcessedEmail = null;
    this.debounceTimeout = null;
    this.buttonAddAttempts = 0;
    this.maxButtonAttempts = 10;
    this.init();
    console.log('Email Reply Helper initialized');
  }

  init() {
    // Wait for Gmail to fully load
    this.waitForGmail().then(() => {
      // Create and inject sidebar
      this.createSidebar();
      
      // Start checking for email view and toolbar
      this.checkForEmailView();
    });
  }

  waitForGmail() {
    return new Promise((resolve) => {
      const checkGmail = setInterval(() => {
        if (document.querySelector('div[role="main"]')) {
          clearInterval(checkGmail);
          resolve();
        }
      }, 100);
    });
  }

  checkForEmailView() {
    // Initial check
    this.tryAddButton();

    // Set up observers
    this.observeEmailView();
    this.observeToolbar();
  }

  tryAddButton() {
    if (this.buttonAddAttempts >= this.maxButtonAttempts) {
      console.log('Max button add attempts reached');
      return;
    }

    // Try to find email container first
    const emailContainer = document.querySelector('div[role="main"] .h7') || 
                         document.querySelector('.ade') ||
                         document.querySelector('.BltHke');

    if (!emailContainer) {
      this.buttonAddAttempts++;
      setTimeout(() => this.tryAddButton(), 1000);
      return;
    }

    // Reset attempts if we found the container
    this.buttonAddAttempts = 0;
    
    // Now try to add the button
    this.addTagButton();
  }

  observeEmailView() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          // Check if we're in an email view
          const emailContainer = document.querySelector('div[role="main"] .h7') || 
                               document.querySelector('.ade') ||
                               document.querySelector('.BltHke');
          
          if (emailContainer) {
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
          <button class="tag-button">Request Help</button>
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
    this.sidebar.querySelector('.close-sidebar').addEventListener('click', () => {
      this.sidebar.classList.remove('active');
      console.log('Sidebar closed');
    });

    this.sidebar.querySelector('.tag-button').addEventListener('click', () => {
      this.handleTagging();
    });
  }

  updateCurrentEmail() {
    const emailContainer = document.querySelector('div[role="main"] .h7');
    if (!emailContainer) return;

    const subjectElement = document.querySelector('h2.hP');
    const bodyElement = emailContainer.querySelector('.a3s.aiL');
    const fromElement = emailContainer.querySelector('.gD');

    if (!subjectElement || !bodyElement) return;

    const emailData = {
      subject: subjectElement.textContent,
      body: bodyElement.textContent,
      from: fromElement ? fromElement.getAttribute('email') : 'unknown'
    };

    // Only update if email has changed
    const emailKey = `${emailData.subject}-${emailData.from}`;
    if (this.lastProcessedEmail !== emailKey) {
      this.currentEmail = emailData;
      this.lastProcessedEmail = emailKey;
      console.log('Current email updated:', this.currentEmail);
    }
  }

  addTagButton() {
    // Check if button already exists
    if (document.querySelector('.email-helper-tag-button')) return;

    // Try to find the emoji/reaction area
    const reactionArea = document.querySelector('.btb') || // Primary reaction container
                        document.querySelector('[data-tooltip*="reaction"]')?.parentElement || // Reaction button parent
                        document.querySelector('.bta'); // Alternative reaction container

    if (reactionArea) {
      // Create the button with Gmail's style
      const button = document.createElement('div');
      button.className = 'bta email-helper-tag-button';
      button.setAttribute('role', 'button');
      button.setAttribute('data-tooltip', 'Get help with this email');
      button.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-left: 4px;
        cursor: pointer;
      `;

      button.innerHTML = `
        <div class="T-I J-J5-Ji" style="
          background-color: #fff;
          border: 1px solid #dadce0;
          border-radius: 4px;
          height: 32px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          font-family: 'Google Sans',Roboto,RobotoDraft,Helvetica,Arial,sans-serif;
          font-size: 14px;
          letter-spacing: 0.25px;
          color: #444746;
          margin: 0 4px;
        ">
          <span class="button-text">Get Help</span>
        </div>
      `;

      // Add hover effect
      const buttonInner = button.querySelector('.T-I');
      button.addEventListener('mouseover', () => {
        buttonInner.style.backgroundColor = '#f6f8fc';
        buttonInner.style.borderColor = '#dadce0';
      });

      button.addEventListener('mouseout', () => {
        buttonInner.style.backgroundColor = '#fff';
        buttonInner.style.borderColor = '#dadce0';
      });

      // Add click handler
      button.addEventListener('click', () => {
        this.updateCurrentEmail(); // Ensure we have the latest email
        this.sidebar.classList.add('active');
        console.log('Sidebar opened');
      });

      // Insert into the reaction area
      reactionArea.appendChild(button);
      console.log('Tag button added to reaction area');
      return;
    }

    console.log('Could not find suitable location for tag button');
  }

  async handleTagging() {
    const tagInput = this.sidebar.querySelector('.tag-input');
    const noteInput = this.sidebar.querySelector('.note-input');
    const tagButton = this.sidebar.querySelector('.tag-button');
    const taggedPeople = tagInput.value.split(',').map(email => email.trim()).filter(email => email);
    const note = noteInput.value.trim();

    if (!taggedPeople.length) {
      alert('Please enter at least one email address');
      return;
    }

    if (!this.currentEmail) {
      alert('No email selected');
      return;
    }

    console.log('Tagging people:', taggedPeople);
    
    try {
      // Show loading state
      tagButton.classList.add('loading');
      tagButton.disabled = true;

      // Send message to background script
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'TAG_EMAIL',
          data: {
            emailData: this.currentEmail,
            taggedPeople,
            note
          }
        }, response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      if (response.success) {
        alert('Help request sent successfully!');
        this.sidebar.classList.remove('active');
        tagInput.value = '';
        noteInput.value = '';
      } else {
        alert('Error sending help request: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error handling response:', error);
      alert('Error sending help request: ' + error.message);
    } finally {
      // Remove loading state
      tagButton.classList.remove('loading');
      tagButton.disabled = false;
    }
  }
}

// Initialize the helper when Gmail is loaded
console.log('Email Reply Helper script loaded');
const gmailHelper = new GmailHelper(); 