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