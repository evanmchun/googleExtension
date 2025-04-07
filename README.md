# Email Reply Helper Chrome Extension

A Chrome extension that helps you get internal help on email replies in Gmail. When you receive an email and need help crafting a response, you can tag colleagues for their input. They can provide suggested replies that are only visible to you.

## Features

- Tag colleagues for help on specific emails
- Receive private suggestions for email replies
- Clean, intuitive interface integrated into Gmail
- No forwarding or replying involved - all suggestions are private
- Simple sidebar interface for easy access

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Open Gmail in Chrome
2. When viewing an email you need help with, click the "Get Help" button in the toolbar
3. Enter the email addresses of colleagues you want to tag (comma-separated)
4. Tagged colleagues will be notified and can provide suggestions
5. View all suggestions in the sidebar
6. Use the suggestions to craft your reply

## Development

The extension is built with vanilla JavaScript and uses Chrome's Extension APIs. Key files:

- `manifest.json` - Extension configuration
- `content.js` - Gmail integration and UI
- `background.js` - Background processes and data management
- `popup.html/js` - Extension popup interface
- `styles.css` - Styling

## Security

- All data is stored locally in Chrome's storage
- No data is sent to external servers
- Suggestions are only visible to the original tagger
- Data is automatically cleaned up after one week

## License

MIT License

# Email Reply Helper Server

Backend server for the Email Reply Helper Chrome extension.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

## Deployment

### Option 1: Heroku

1. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Login to Heroku:
```bash
heroku login
```

3. Create a new Heroku app:
```bash
heroku create email-reply-helper-server
```

4. Add MongoDB add-on:
```bash
heroku addons:create mongolab
```

5. Set environment variables:
```bash
heroku config:set NODE_ENV=production
```

6. Deploy:
```bash
git push heroku main
```

### Option 2: Render

1. Create an account at [Render](https://render.com/)
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Add environment variables from `.env.example`

### Option 3: DigitalOcean App Platform

1. Create an account at [DigitalOcean](https://www.digitalocean.com/)
2. Create a new app
3. Connect your GitHub repository
4. Configure the app to use Node.js
5. Add environment variables from `.env.example`

## Updating the Extension

After deploying the server, update the extension:

1. Update `background.js` with your server URL:
```javascript
const SERVER_URL = 'https://your-deployed-server-url.com';
```

2. Update `manifest.json` with your server URL:
```json
"host_permissions": [
  "https://www.googleapis.com/*",
  "https://your-deployed-server-url.com/*"
]
```

3. Reload the extension in Chrome

## Security Considerations

- The server uses CORS to only allow requests from Chrome extensions
- Rate limiting is implemented to prevent abuse
- MongoDB is used for persistent storage
- Environment variables are used for sensitive configuration 