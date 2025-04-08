const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/email-reply-helper', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const TaggedEmailSchema = new mongoose.Schema({
  emailId: { type: String, required: true, unique: true },
  email: {
    subject: String,
    body: String,
    from: String,
    timestamp: Number
  },
  taggedPeople: [String],
  note: String,
  requester: String,
  timestamp: { type: Number, default: Date.now },
  status: { type: String, default: 'pending' },
  suggestions: [{
    text: String,
    author: String,
    timestamp: { type: Number, default: Date.now }
  }]
});

const TaggedEmail = mongoose.model('TaggedEmail', TaggedEmailSchema);

// Enable CORS for the extension
app.use(cors({
  origin: ['chrome-extension://*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// Add rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(bodyParser.json());

// Get all tagged emails for a user
app.get('/api/emails/:userEmail', async (req, res) => {
  try {
    const userEmail = req.params.userEmail.toLowerCase();
    
    // Find emails where user is tagged
    const emails = await TaggedEmail.find({
      taggedPeople: { $regex: new RegExp(userEmail, 'i') }
    });
    
    // Convert to the format expected by the extension
    const userEmails = {};
    emails.forEach(email => {
      userEmails[email.emailId] = email.toObject();
    });
    
    res.json({ success: true, emails: userEmails });
  } catch (error) {
    console.error('Error getting emails:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Add a new tagged email
app.post('/api/emails', async (req, res) => {
  try {
    console.log('=== SERVER: Received email data:', JSON.stringify(req.body, null, 2), '===');
    
    const { emailData, taggedPeople, note, requester } = req.body;
    const emailId = `${emailData.subject}-${Date.now()}`;
    
    const newEmail = new TaggedEmail({
      emailId,
      email: emailData,
      taggedPeople,
      note,
      requester,
      timestamp: Date.now(),
      status: 'pending',
      suggestions: []
    });
    
    console.log('=== SERVER: Created new email document:', JSON.stringify(newEmail, null, 2), '===');
    
    await newEmail.save();
    res.json({ success: true, emailId });
  } catch (error) {
    console.error('Error adding email:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Add a suggestion to an email
app.post('/api/emails/:emailId/suggestions', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { suggestion, author } = req.body;
    
    const email = await TaggedEmail.findOne({ emailId });
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    email.suggestions.push({
      text: suggestion,
      author,
      timestamp: Date.now()
    });
    
    await email.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding suggestion:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 