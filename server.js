const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for tagged emails
let taggedEmails = [];

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/emails', (req, res) => {
  const userEmail = req.query.userEmail;
  console.log('=== SERVER: GET /api/emails - User email:', userEmail);
  
  // Filter emails by user email
  const userEmails = taggedEmails.filter(email => 
    email.requester === userEmail || 
    email.taggedPeople.includes(userEmail)
  );
  
  console.log('=== SERVER: Found emails:', userEmails.length);
  res.json(userEmails);
});

app.post('/api/emails', (req, res) => {
  console.log('=== SERVER: POST /api/emails - Request body:', req.body);
  
  const { emailData, taggedPeople, note, requester, timestamp, status, suggestions } = req.body;
  
  const newEmail = {
    emailId: `${emailData.subject}-${timestamp}`,
    email: emailData,
    taggedPeople,
    note,
    requester,
    timestamp,
    status,
    suggestions: suggestions || []
  };
  
  taggedEmails.push(newEmail);
  console.log('=== SERVER: Added new email:', newEmail);
  res.status(201).json(newEmail);
});

app.post('/api/emails/:emailId/messages', (req, res) => {
  const { emailId } = req.params;
  const { message } = req.body;
  
  console.log('=== SERVER: POST /api/emails/:emailId/messages - Email ID:', emailId);
  console.log('=== SERVER: Message:', message);
  
  const email = taggedEmails.find(e => e.emailId === emailId);
  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  email.suggestions.push({
    message,
    timestamp: Date.now()
  });
  
  console.log('=== SERVER: Updated email with new suggestion:', email);
  res.json(email);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 