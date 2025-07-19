# Gumtree Property Scraper

A Node.js web scraper for extracting property listings from Gumtree with proxy rotation, authentication handling, and multi-page scraping capabilities.

## Features

- Multi-page scraping with automatic pagination
- Proxy rotation with authentication
- Cookie-based authentication with backup login credentials
- Incremental data saving
- Human-like browsing patterns with random delays
- Anti-detection measures including user agent rotation
- Error handling and retry mechanisms
- CSV and JSON export formats

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gumtree-scraper.git
cd gumtree-scraper
```

2. Install dependencies:
```bash
npm install playwright fs path
```

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

## Configuration

### Update URLs

Edit the main configuration in the constructor:

```javascript
// UPDATE THIS URL FOR EACH SCRAPING SESSION
this.mainUrl = 'https://www.gumtree.com/your-search-url-here';
this.secondUrl = 'https://www.gumtree.com/your-search-url-here/page{n}';
```

### Proxy Configuration (Optional)

Create a `proxies.txt` file in the project root:
```
proxy1.example.com:8080
proxy2.example.com:8080
proxy3.example.com:8080
```

Update proxy credentials:
```javascript
this.proxyConfig = {
    enabled: true,
    username: 'your_webshare_username',
    password: 'your_webshare_password'
};
```

### Authentication Setup

**Cookie-based (Recommended)**
```bash
node scraper.js --export-cookies
```

**Auto-login**
```javascript
this.loginConfig = {
    autoLogin: true,
    email: 'your_email@example.com',
    password: 'your_password'
};
```

## Usage

### Basic Scraping
```bash
node scraper.js
```

### Export Cookies (First-time setup)
```bash
node scraper.js --export-cookies
```

### Test All Proxies
```bash
node scraper.js --test-proxies
```

## Data Output

### JSON Format
```json
{
  "scrapedAt": "2024-01-15T10:30:00.000Z",
  "totalResults": 150,
  "sourceUrl": "https://www.gumtree.com/...",
  "results": [
    {
      "url": "https://www.gumtree.com/ad/...",
      "title": "Property Title",
      "location": "Manchester, Greater Manchester",
      "phoneNumber": "+44 123 456 7890",
      "scrapedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### CSV Format
```csv
Title,Location,Phone Number,URL,Scraped At
"Property Title","Manchester, Greater Manchester","+44 123 456 7890","https://www.gumtree.com/ad/...","2024-01-15T10:30:00.000Z"
```

## Anti-Detection Features

- User Agent Rotation: Cycles through realistic browser user agents
- Random Delays: Human-like timing between actions
- Proxy Rotation: Automatic IP switching
- Human Scrolling: Simulates natural scrolling patterns
- Resource Blocking: Blocks images, fonts, and stylesheets for faster loading
- Session Management: Creates new browser contexts to avoid tracking

## File Structure

```
gumtree-scraper/
├── scraper.js                 # Main scraper file
├── package.json              # Project dependencies
├── proxies.txt               # Proxy list (optional)
├── gumtree_cookies.json      # Exported cookies (auto-generated)
├── working_proxies.txt       # Tested working proxies (auto-generated)
├── gumtree_results_*.json    # Scraped data in JSON format
├── gumtree_results_*.csv     # Scraped data in CSV format
└── README.md                 # This file
```

## Troubleshooting

### Common Issues

**No cards found on page**
- Verify the URL is correct
- Check if the page structure has changed
- Ensure you're not being blocked

**Proxy connection failed**
- Test proxies using `--test-proxies` flag
- Verify proxy credentials are correct

**Authentication failed**
- Re-export cookies using `--export-cookies`
- Check login credentials if using auto-login

**Extraction issues**
- Only extracts the phone number & link to owners "see all ads"
- Doesn't pick the name of the owner

## Performance Tips

- Use headless mode for faster execution in production
- Enable proxy rotation to avoid rate limits
- Adjust save intervals based on your needs
- Use working proxies only by testing them first

## ⚠️ Disclaimer

This tool is for educational and research purposes only. Users are responsible for ensuring their use complies with Gumtree's Terms of Service and applicable laws. The authors are not responsible for any misuse of this software.