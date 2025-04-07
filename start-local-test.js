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
  origin: ['chrome-extension://*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

// Get all tagged emails for a user
app.get('/api/emails/:userEmail', (req, res) => {
  try {
    const userEmail = req.params.userEmail.toLowerCase();
    console.log(`Getting emails for user: ${userEmail}`);
    
    // Find emails where user is requester or tagged
    const userEmails = {};
    
    Object.entries(taggedEmails).forEach(([emailId, email]) => {
      const isRequester = email.requester && email.requester.toLowerCase() === userEmail;
      const isTagged = email.taggedPeople && 
                      email.taggedPeople.some(person => person.toLowerCase() === userEmail);
      
      if (isRequester || isTagged) {
        userEmails[emailId] = email;
      }
    });
    
    console.log(`Found ${Object.keys(userEmails).length} emails for user ${userEmail}`);
    res.json({ success: true, emails: userEmails });
  } catch (error) {
    console.error('Error getting emails:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Add a new tagged email
app.post('/api/emails', (req, res) => {
  try {
    const { emailData, taggedPeople, note, requester } = req.body;
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
    
    taggedEmails[emailId] = newEmail;
    console.log(`Added new email with ID: ${emailId}`);
    console.log(`Total emails in storage: ${Object.keys(taggedEmails).length}`);
    
    res.json({ success: true, emailId });
  } catch (error) {
    console.error('Error adding email:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Add a suggestion to an email
app.post('/api/emails/:emailId/suggestions', (req, res) => {
  try {
    const { emailId } = req.params;
    const { suggestion, author } = req.body;
    
    if (!taggedEmails[emailId]) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    taggedEmails[emailId].suggestions = taggedEmails[emailId].suggestions || [];
    taggedEmails[emailId].suggestions.push({
      text: suggestion,
      author,
      timestamp: Date.now()
    });
    
    console.log(`Added suggestion to email: ${emailId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding suggestion:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Start the server
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