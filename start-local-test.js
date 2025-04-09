const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Create Express app
const app = express();
const PORT = 3001;

// In-memory storage for tagged emails
let taggedEmails = {};

// Enable CORS for the extension
app.use(cors({
  origin: true, // Allow all origins during development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Increase payload size limit to 50mb
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Get all tagged emails for a user
app.get('/api/emails', (req, res) => {
  try {
    const userEmail = req.query.userEmail;
    console.log('=== SERVER: GET /api/emails - User email:', userEmail);
    
    // Find emails where user is tagged
    const userEmails = {};
    
    Object.entries(taggedEmails).forEach(([emailId, email]) => {
      const isTagged = email.taggedPeople && 
                      email.taggedPeople.some(person => person.toLowerCase() === userEmail.toLowerCase());
      
      if (isTagged) {
        userEmails[emailId] = email;
      }
    });
    
    console.log(`Found ${Object.keys(userEmails).length} emails for user ${userEmail}`);
    res.json(userEmails);
  } catch (error) {
    console.error('Error getting emails:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Add a new tagged email
app.post('/api/emails', (req, res) => {
  try {
    console.log('=== LOCAL SERVER: Received email data:', JSON.stringify(req.body, null, 2), '===');
    
    const { emailData, taggedPeople, note, requester } = req.body;
    
    if (!emailData || !taggedPeople || !note) {
      console.error('Missing required fields');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields',
        received: { hasEmailData: !!emailData, hasTaggedPeople: !!taggedPeople, hasNote: !!note }
      });
    }
    
    const emailId = `${emailData.subject}-${Date.now()}`;
    
    const newEmail = {
      emailId,
      email: emailData,
      taggedPeople,
      note,
      requester,
      timestamp: Date.now(),
      status: 'pending',
      suggestions: []
    };
    
    console.log('=== LOCAL SERVER: Created new email object:', JSON.stringify(newEmail, null, 2), '===');
    
    taggedEmails[emailId] = newEmail;
    console.log(`Added new email with ID: ${emailId}`);
    console.log(`Total emails in storage: ${Object.keys(taggedEmails).length}`);
    console.log('New email data:', JSON.stringify(newEmail, null, 2));
    
    res.json({ success: true, emailId });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: error.message,
      stack: error.stack
    });
  }
});

// Add message to an email
app.post('/api/emails/:emailId/messages', (req, res) => {
  console.log('=== SERVER: Adding message to email:', req.params.emailId, '===');
  console.log('=== SERVER: Message data:', req.body, '===');
  
  try {
    const emailId = decodeURIComponent(req.params.emailId);
    const { message } = req.body;

    if (!emailId || !message || !message.text || !message.author) {
      console.error('=== SERVER: Invalid message data ===');
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid message data' 
      });
    }

    // Find the email
    const email = taggedEmails[emailId];
    if (!email) {
      console.error('=== SERVER: Email not found:', emailId, '===');
      return res.status(404).json({ 
        success: false, 
        error: 'Email not found' 
      });
    }

    // Initialize suggestions array if it doesn't exist
    if (!email.suggestions) {
      email.suggestions = [];
    }

    // Add the message
    email.suggestions.push(message);
    console.log('=== SERVER: Message added successfully ===');
    
    return res.json({ 
      success: true, 
      messageId: message.id 
    });
  } catch (error) {
    console.error('=== SERVER: Error adding message:', error, '===');
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get messages for an email
app.get('/api/emails/:emailId/messages', (req, res) => {
  console.log('=== SERVER: Getting messages for email:', req.params.emailId, '===');
  
  try {
    const emailId = decodeURIComponent(req.params.emailId);
    const email = taggedEmails[emailId];

    if (!email) {
      console.error('=== SERVER: Email not found:', emailId, '===');
      return res.status(404).json({ 
        success: false, 
        error: 'Email not found' 
      });
    }

    return res.json({ 
      success: true, 
      messages: email.suggestions || [] 
    });
  } catch (error) {
    console.error('=== SERVER: Error getting messages:', error, '===');
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('\n=== LOCAL TEST INSTRUCTIONS ===');
  console.log('1. Update your extension\'s background.js with:');
  console.log('   const SERVER_URL = "http://localhost:3001";');
  console.log('\n2. Update your manifest.json with:');
  console.log('   "host_permissions": [');
  console.log('     "https://www.googleapis.com/*",');
  console.log('     "http://localhost:3001/*"');
  console.log('   ]');
  console.log('\n3. Reload your extension in Chrome');
  console.log('\n4. Test the extension with Gmail');
  console.log('\nServer is running. Press Ctrl+C to stop.');
}); 