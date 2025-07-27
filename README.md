# Google Forms AI Filler

A simple Chrome extension that auto-fills Google Forms MCQs by querying a free AI API (Hugging Face) to match and select correct options with one click.

## Features

- One-click form filling
- AI-powered answer matching
- Supports multiple-choice and checkbox questions
- Real-time progress tracking
- Secure API key configuration

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the extension folder

## Setup

1. Get a free Hugging Face API key:
   - Sign up at [huggingface.co](https://huggingface.co/join)
   - Go to Settings > Access Tokens
   - Create a "Read" token
2. Click the extension icon > Settings
3. Paste your API key and save

## Usage

1. Open any Google Forms page
2. Click the extension icon
3. Click "Fill with AI"
4. The extension will analyze and fill questions

## Limitations

- Works best with multiple-choice questions
- Free API has rate limits
- For educational/testing purposes only
- May not work on all form layouts

## Development

- `manifest.json`: Extension configuration
- `popup.html/js/css`: User interface
- `content.js`: Form analysis and filling logic
- `options.html/js/css`: Settings page

## License

MIT License - feel free to modify and use!
