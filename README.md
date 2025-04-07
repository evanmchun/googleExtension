# Email Reply Helper Chrome Extension

A Chrome extension that helps users manage email replies and collaborate with team members.

## Features

- Tag emails for help requests
- Add notes to emails
- Share emails with team members
- Get suggestions from team members
- Real-time updates via local server

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the local server:
```bash
node start-local-test.js
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this directory

4. Configure the extension:
   - The extension will automatically use `http://localhost:3001` as the server
   - Make sure to grant the necessary permissions when prompted

## Development

- `background.js`: Handles background tasks and server communication
- `content.js`: Manages Gmail interface integration
- `popup.js`: Controls the extension popup UI
- `start-local-test.js`: Local development server

## Notes

- The server stores data in memory (cleared on restart)
- Emails are cached locally in Chrome storage
- Old data is automatically cleaned up after one week

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