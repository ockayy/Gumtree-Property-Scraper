const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class GumtreeScraper {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.results = [];
        this.saveInterval = 5; // Save every 5 ads
        this.saveCounter = 0;
        this.outputFilename = null;
        this.csvFilename = null;
        
        // Proxy configuration
        this.proxyConfig = {
            enabled: true,
            proxiesFile: './proxies.txt', // Path to your proxies file
            username: ' ', // <-- UPDATE WITH YOUR WEBSHARE USERNAME
            password: ' ', // <-- UPDATE WITH YOUR WEBSHARE PASSWORD
            currentProxyIndex: 0,
            proxies: []
        };
        
        // UPDATE THIS URL FOR EACH SCRAPING SESSION
        this.mainUrl = 'https://www.gumtree.com/flats-houses/commercial/commercial-property-to-rent/uk/manchester/page5?seller_type=private'; // <-- PASTE YOUR MAIN GUMTREE LINK HERE
        this.secondUrl = 'https://www.gumtree.com/flats-houses/commercial/commercial-property-to-rent/uk/manchester/page{n}?seller_type=private'; // <-- PASTE YOUR SECOND PAGE URL HERE (use page{n} for page number)        
        
        // LOGIN CONFIGURATION
        this.loginConfig = {
            useCookies: true, // Set to true to use exported cookies
            cookiesFile: './gumtree_cookies.json', // Path to your cookies file
            
            // Backup login credentials (only used if cookies fail)
            autoLogin: false, // Set to true to enable auto-login
            email: '', // <-- UPDATE WITH YOUR EMAIL
            password: '' // <-- UPDATE WITH YOUR PASSWORD
        };
        
        // Enhanced user agents pool
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
        ];
    }

    async loadProxies() {
        try {
            if (fs.existsSync(this.proxyConfig.proxiesFile)) {
                const proxyData = fs.readFileSync(this.proxyConfig.proxiesFile, 'utf8');
                const lines = proxyData.split('\n').filter(line => line.trim());
                
                this.proxyConfig.proxies = lines.map(line => {
                    const [host, port] = line.trim().split(':');
                    return { host, port: parseInt(port) };
                });
                
                console.log(`🌐 Loaded ${this.proxyConfig.proxies.length} proxies`);
                return true;
            } else {
                console.log('⚠️  Proxies file not found, proceeding without proxy');
                this.proxyConfig.enabled = false;
                return false;
            }
        } catch (error) {
            console.log(`❌ Error loading proxies: ${error.message}`);
            this.proxyConfig.enabled = false;
            return false;
        }
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    getCurrentProxy() {
        if (!this.proxyConfig.enabled || this.proxyConfig.proxies.length === 0) {
            return null;
        }
        
        const proxy = this.proxyConfig.proxies[this.proxyConfig.currentProxyIndex];
        return {
            server: `http://${proxy.host}:${proxy.port}`,
            username: this.proxyConfig.username,
            password: this.proxyConfig.password
        };
    }

    rotateProxy() {
        if (!this.proxyConfig.enabled || this.proxyConfig.proxies.length === 0) {
            return null;
        }
        
        this.proxyConfig.currentProxyIndex = (this.proxyConfig.currentProxyIndex + 1) % this.proxyConfig.proxies.length;
        const newProxy = this.getCurrentProxy();
        console.log(`🔄 Rotated to proxy: ${newProxy.server}`);
        return newProxy;
    }

    isMultiPageScraping() {
        return this.secondUrl && this.secondUrl.includes('{n}');
    }

    generatePageUrl(pageNumber) {
        if (pageNumber === 1) {
            return this.mainUrl;
        }
        
        if (this.isMultiPageScraping()) {
            return this.secondUrl.replace('{n}', pageNumber);
        }
        
        return this.mainUrl;
    }

    async createNewContext() {
        const userAgent = this.getRandomUserAgent();
        const proxy = this.getCurrentProxy();
        
        console.log(`🔄 Creating new context with User-Agent: ${userAgent.substring(0, 50)}...`);
        if (proxy) {
            console.log(`🌐 Using proxy: ${proxy.server}`);
        }
        
        const contextOptions = {
            userAgent: userAgent,
            viewport: { width: 1920, height: 1080 },
            locale: 'en-GB',
            timezoneId: 'Europe/London',
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-GB,en-US;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        };
        
        if (proxy) {
            contextOptions.proxy = proxy;
        }
        
        // Close existing context if it exists
        if (this.context) {
            await this.context.close();
        }
        
        this.context = await this.browser.newContext(contextOptions);
        
        // Create new page
        if (this.page) {
            await this.page.close();
        }
        
        this.page = await this.context.newPage();
        
        // Block unnecessary resources for faster loading
        await this.page.route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            if (['image', 'font', 'stylesheet'].includes(resourceType)) {
                route.abort();
            } else {
                route.continue();
            }
        });
        
        return this.context;
    }

    async testProxyConnection() {
        try {
            console.log('🧪 Testing proxy connection...');
            await this.page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle', timeout: 10000 });
            const content = await this.page.content();
            console.log('✅ Proxy test successful');
            console.log('🔍 Current IP info:', content.substring(0, 200));
            return true;
        } catch (error) {
            console.log(`❌ Proxy test failed: ${error.message}`);
            return false;
        }
    }

    async init() {
        console.log('🚀 Initializing Gumtree scraper...');
        
        // Load proxies
        if (this.proxyConfig.enabled) {
            await this.loadProxies();
        }
        
        // Initialize output filenames
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.outputFilename = `gumtree_results_${timestamp}.json`;
        this.csvFilename = `gumtree_results_${timestamp}.csv`;
        
        // Create initial empty files
        this.initializeOutputFiles();
        
        this.browser = await chromium.launch({
            headless: false, // Set to true for production
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        // Create initial context
        await this.createNewContext();
        
        // Test proxy connection if enabled
        if (this.proxyConfig.enabled) {
            const proxyWorking = await this.testProxyConnection();
            if (!proxyWorking) {
                console.log('⚠️  Proxy not working, rotating...');
                this.rotateProxy();
                await this.createNewContext();
            }
        }

        // Handle login/authentication
        await this.handleAuthentication();

        console.log('✅ Browser initialized successfully');
    }

    async handleProxyRotation() {
        console.log('🔄 Rotating proxy and creating new session...');
        
        this.rotateProxy();
        await this.createNewContext();
        
        // Test new proxy
        if (this.proxyConfig.enabled) {
            const proxyWorking = await this.testProxyConnection();
            if (!proxyWorking) {
                console.log('⚠️  New proxy not working, trying next one...');
                this.rotateProxy();
                await this.createNewContext();
            }
        }
        
        // Re-authenticate if needed
        await this.handleAuthentication();
        
        console.log('✅ Proxy rotation complete');
    }

    initializeOutputFiles() {
        // Initialize JSON file
        const initialData = {
            scrapedAt: new Date().toISOString(),
            totalResults: 0,
            sourceUrl: this.mainUrl,
            results: []
        };
        fs.writeFileSync(this.outputFilename, JSON.stringify(initialData, null, 2));
        
        // Initialize CSV file
        const csvHeaders = 'Title,Location,Phone Number,URL,Scraped At\n';
        fs.writeFileSync(this.csvFilename, csvHeaders);
        
        console.log(`📁 Initialized output files: ${this.outputFilename} and ${this.csvFilename}`);
    }

    async saveResultsIncremental() {
        try {
            // Update JSON file
            const outputData = {
                scrapedAt: new Date().toISOString(),
                totalResults: this.results.length,
                sourceUrl: this.mainUrl,
                results: this.results
            };
            
            fs.writeFileSync(this.outputFilename, JSON.stringify(outputData, null, 2));
            
            // Update CSV file (rewrite entire file for simplicity)
            const csvContent = this.convertToCSV(this.results);
            fs.writeFileSync(this.csvFilename, csvContent);
            
            console.log(`💾 Incremental save complete: ${this.results.length} total results`);
        } catch (error) {
            console.log(`❌ Error during incremental save: ${error.message}`);
        }
    }

    async loadCookies() {
        try {
            if (fs.existsSync(this.loginConfig.cookiesFile)) {
                const cookies = JSON.parse(fs.readFileSync(this.loginConfig.cookiesFile, 'utf8'));
                await this.context.addCookies(cookies);
                console.log('🍪 Cookies loaded successfully');
                return true;
            } else {
                console.log('⚠️  Cookies file not found');
                return false;
            }
        } catch (error) {
            console.log(`❌ Error loading cookies: ${error.message}`);
            return false;
        }
    }

    async saveCookies() {
        try {
            const cookies = await this.context.cookies();
            fs.writeFileSync(this.loginConfig.cookiesFile, JSON.stringify(cookies, null, 2));
            console.log('💾 Cookies saved successfully');
        } catch (error) {
            console.log(`❌ Error saving cookies: ${error.message}`);
        }
    }

    async checkIfLoggedIn() {
        try {
            await this.page.goto('https://www.gumtree.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
            
            // Check for login indicators (adjust selectors as needed)
            const loginButton = await this.page.locator('a[href*="login"], button:has-text("Sign in")').first();
            const userMenu = await this.page.locator('[data-testid="user-menu"], .user-menu, a:has-text("My Gumtree")').first();
            
            if (await userMenu.count() > 0) {
                console.log('✅ Already logged in');
                return true;
            } else if (await loginButton.count() > 0) {
                console.log('❌ Not logged in');
                return false;
            } else {
                console.log('⚠️  Cannot determine login status');
                return false;
            }
        } catch (error) {
            console.log(`❌ Error checking login status: ${error.message}`);
            return false;
        }
    }

    async performLogin() {
        try {
            console.log('🔐 Attempting to log in...');
            
            // Go to login page
            await this.page.goto('https://www.gumtree.com/login', { waitUntil: 'networkidle' });
            await this.randomWait(2000, 3000);
            
            // Fill email
            const emailField = await this.page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first();
            if (await emailField.count() > 0) {
                await emailField.fill(this.loginConfig.email);
                await this.randomWait(500, 1000);
            } else {
                throw new Error('Email field not found');
            }
            
            // Fill password
            const passwordField = await this.page.locator('input[type="password"], input[name="password"]').first();
            if (await passwordField.count() > 0) {
                await passwordField.fill(this.loginConfig.password);
                await this.randomWait(500, 1000);
            } else {
                throw new Error('Password field not found');
            }
            
            // Submit login form
            const submitButton = await this.page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign in")').first();
            if (await submitButton.count() > 0) {
                await submitButton.click();
                await this.page.waitForLoadState('networkidle');
                await this.randomWait(3000, 5000);
            } else {
                throw new Error('Submit button not found');
            }
            
            // Verify login success
            const isLoggedIn = await this.checkIfLoggedIn();
            if (isLoggedIn) {
                console.log('✅ Login successful');
                await this.saveCookies(); // Save cookies for future use
                return true;
            } else {
                console.log('❌ Login failed');
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Login error: ${error.message}`);
            return false;
        }
    }

    async handleAuthentication() {
        console.log('🔐 Handling authentication...');
        
        // Try to load cookies first
        if (this.loginConfig.useCookies) {
            const cookiesLoaded = await this.loadCookies();
            if (cookiesLoaded) {
                const isLoggedIn = await this.checkIfLoggedIn();
                if (isLoggedIn) {
                    console.log('✅ Authentication successful using cookies');
                    return true;
                } else {
                    console.log('⚠️  Cookies exist but login failed, trying alternative methods...');
                }
            }
        }
        
        // Fallback to auto-login if enabled
        if (this.loginConfig.autoLogin) {
            const loginSuccess = await this.performLogin();
            if (loginSuccess) {
                return true;
            }
        }
        
        // If all else fails, continue without login (may have limited access)
        console.log('⚠️  Continuing without authentication - some features may be limited');
        return false;
    }

    async humanScroll(page, scrolls = 3) {
        console.log('📜 Performing human-like scrolling...');
        
        for (let i = 0; i < scrolls; i++) {
            // Random scroll amount
            const scrollAmount = Math.floor(Math.random() * 800) + 300;
            
            await page.evaluate((amount) => {
                window.scrollBy(0, amount);
            }, scrollAmount);
            
            // Random wait time between scrolls
            await this.randomWait(800, 1500);
        }
    }

    async randomWait(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async getCardLinks(page) {
        console.log('🔍 Extracting card links...');
        
        const cardLinks = [];
        let cardIndex = 1;
        
        while (true) {
            try {
                const cardXPath = `/html/body/div[2]/div[1]/div[1]/div[2]/div[3]/div[2]/div/div[${cardIndex}]`;
                const cardElement = await page.locator(`xpath=${cardXPath}`).first();
                
                if (await cardElement.count() === 0) {
                    console.log(`📝 Found ${cardIndex - 1} cards on this page`);
                    break;
                }
                
                // Look for link within the card
                const linkElement = cardElement.locator('a').first();
                if (await linkElement.count() > 0) {
                    const href = await linkElement.getAttribute('href');
                    if (href) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.gumtree.com${href}`;
                        cardLinks.push(fullUrl);
                        console.log(`📌 Card ${cardIndex}: ${fullUrl}`);
                    }
                }
                
                cardIndex++;
                await this.randomWait(100, 300);
                
            } catch (error) {
                console.log(`⚠️  Error processing card ${cardIndex}: ${error.message}`);
                break;
            }
        }
        
        return cardLinks;
    }

    async scrapeAdPage(url) {
        console.log(`🔍 Scraping ad: ${url}`);
        
        // Open new tab for the ad
        const adPage = await this.context.newPage();
        
        try {
            await adPage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await this.randomWait(1000, 2000);
            
            // Scroll to load content
            await this.humanScroll(adPage, 2);
            
            const adData = {
                url: url,
                title: null,
                location: null,
                phoneNumber: null,
                scrapedAt: new Date().toISOString()
            };
            
            // Extract title
            try {
                const titleElement = await adPage.locator('xpath=/html/body/div[2]/div[1]/div/main/div[3]/div[1]/div/h1').first();
                if (await titleElement.count() > 0) {
                    adData.title = await titleElement.textContent();
                    console.log(`📝 Title: ${adData.title}`);
                }
            } catch (error) {
                console.log(`⚠️  Could not extract title: ${error.message}`);
            }
            
            // Extract location
            try {
                const locationElement = await adPage.locator('xpath=/html/body/div[2]/div[1]/div/main/div[3]/div[1]/div/div/span[1]/h4').first();
                if (await locationElement.count() > 0) {
                    adData.location = await locationElement.textContent();
                    console.log(`📍 Location: ${adData.location}`);
                }
            } catch (error) {
                console.log(`⚠️  Could not extract location: ${error.message}`);
            }
            
            // Extract phone number using the provided XPath
            // Extract phone number using the provided XPath
try {
    const phoneButtonXPath = '/html/body/div[2]/div[1]/div/main/div[4]/div[1]/div[2]/div[1]/div[1]/div/div/a/button';
    const phoneButton = await adPage.locator(`xpath=${phoneButtonXPath}`).first();
    
    if (await phoneButton.count() > 0) {
        const buttonText = await phoneButton.textContent();
        console.log(`📞 Phone button found: ${buttonText}`);
        
        // Click the button to reveal phone number
        await phoneButton.click();
        await this.randomWait(2000, 3000);
        
        // Extract phone number from the new XPath after clicking
        const phoneNumberXPath = '/html/body/div[2]/div[1]/div/main/div[4]/div[1]/div[2]/div[1]/div[1]/div/div/div/h2';
        const phoneElement = await adPage.locator(`xpath=${phoneNumberXPath}`).first();
        
        if (await phoneElement.count() > 0) {
            const phoneText = await phoneElement.textContent();
            console.log(`📞 Phone element found: ${phoneText}`);
            
            // Extract phone number using regex
            const phoneRegex = /(\+?[\d\s\-\(\)]{10,})/;
            const phoneMatch = phoneText.match(phoneRegex);
            
            if (phoneMatch) {
                adData.phoneNumber = phoneMatch[1].trim();
                console.log(`📞 Phone extracted: ${adData.phoneNumber}`);
            } else {
                // If no regex match, use the full text content
                adData.phoneNumber = phoneText.trim();
                console.log(`📞 Phone extracted (full text): ${adData.phoneNumber}`);
            }
        } else {
            console.log('⚠️  Phone number element not found after clicking');
            
            // Fallback: try to find phone number in the button itself
            const updatedButtonText = await phoneButton.textContent();
            console.log(`📞 Fallback - checking button text: ${updatedButtonText}`);
            
            const phoneRegex = /(\+?[\d\s\-\(\)]{10,})/;
            const phoneMatch = updatedButtonText.match(phoneRegex);
            
            if (phoneMatch) {
                adData.phoneNumber = phoneMatch[1].trim();
                console.log(`📞 Phone extracted from button: ${adData.phoneNumber}`);
            }
        }
    } else {
        console.log('⚠️  Phone button not found with provided XPath');
    }
    
    // NEW: Check for additional phone number location
    try {
        const altPhoneXPath = '/html/body/div[2]/div[1]/div/main/div[4]/div[1]/div[1]/div/div/div/h2';
        const altPhoneElement = await adPage.locator(`xpath=${altPhoneXPath}`).first();
        
        if (await altPhoneElement.count() > 0) {
            const altPhoneText = await altPhoneElement.textContent();
            console.log(`📞 Alternative phone element found: ${altPhoneText}`);
            
            // Only use this if we didn't find a phone number above
            if (!adData.phoneNumber) {
                const phoneRegex = /(\+?[\d\s\-\(\)]{10,})/;
                const phoneMatch = altPhoneText.match(phoneRegex);
                
                if (phoneMatch) {
                    adData.phoneNumber = phoneMatch[1].trim();
                    console.log(`📞 Phone extracted from alternative location: ${adData.phoneNumber}`);
                } else {
                    adData.phoneNumber = altPhoneText.trim();
                    console.log(`📞 Phone extracted from alternative location (full text): ${adData.phoneNumber}`);
                }
            }
        }
    } catch (altError) {
        console.log(`⚠️  Alternative phone extraction failed: ${altError.message}`);
    }
    
} catch (error) {
    console.log(`⚠️  Could not extract phone number: ${error.message}`);
}
            
            await adPage.close();
            return adData;
            
        } catch (error) {
            console.log(`❌ Error scraping ad ${url}: ${error.message}`);
            await adPage.close();
            return null;
        }
    }

    // Enhanced pagination methods for GumtreeScraper class
    async hasNextPage(page) {
        try {
            console.log('🔍 Checking for next page...');
            
            const paginationXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/div[3]/div[2]/nav/ol';
            const paginationList = await page.locator(`xpath=${paginationXPath}`).first();
            
            if (await paginationList.count() === 0) {
                console.log('❌ Pagination list not found');
                return false;
            }
            
            const listItems = await paginationList.locator('li').all();
            console.log(`📊 Found ${listItems.length} pagination items`);
            
            if (listItems.length < 3) {
                console.log('❌ Not enough pagination items (need at least 3)');
                return false;
            }
            
            // Get current page number from URL or active element
            let currentPageNumber = await this.getCurrentPageNumber(page, listItems);
            console.log(`📍 Current page number: ${currentPageNumber}`);
            
            // Method 1: Check if third li (index 2) has a valid next page
            try {
                const thirdLi = listItems[2];
                const thirdLink = await thirdLi.locator('a').first();
                
                if (await thirdLink.count() > 0) {
                    const thirdPageNumber = await thirdLink.getAttribute('data-page-number');
                    const thirdHref = await thirdLink.getAttribute('href');
                    
                    if (thirdPageNumber && thirdHref) {
                        const thirdPageNum = parseInt(thirdPageNumber);
                        if (thirdPageNum > currentPageNumber) {
                            console.log(`✅ Next page available via third li: page ${thirdPageNum}`);
                            return true;
                        }
                    }
                }
            } catch (error) {
                console.log(`⚠️  Third li check failed: ${error.message}`);
            }
            
            // Method 2: Look for any page number higher than current
            for (let i = 0; i < listItems.length; i++) {
                try {
                    const li = listItems[i];
                    const link = await li.locator('a').first();
                    
                    if (await link.count() > 0) {
                        const pageNumber = await link.getAttribute('data-page-number');
                        const href = await link.getAttribute('href');
                        
                        if (pageNumber && href) {
                            const pageNum = parseInt(pageNumber);
                            if (pageNum > currentPageNumber) {
                                console.log(`✅ Next page available: page ${pageNum} at index ${i}`);
                                return true;
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
            
            console.log('❌ No next page found');
            return false;
            
        } catch (error) {
            console.log(`❌ Error checking for next page: ${error.message}`);
            return false;
        }
    }

    async getCurrentPageNumber(page, listItems) {
        let currentPageNumber = 5; // Default to page 1
        
        // Method 1: Check for aria-current="page"
        try {
            for (const li of listItems) {
                const link = await li.locator('a').first();
                if (await link.count() > 0) {
                    const ariaCurrent = await link.getAttribute('aria-current');
                    const pageNumber = await link.getAttribute('data-page-number');
                    
                    if (ariaCurrent === 'page' && pageNumber) {
                        currentPageNumber = parseInt(pageNumber);
                        console.log(`📍 Found current page via aria-current: ${currentPageNumber}`);
                        return currentPageNumber;
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️  Error finding current page via aria-current: ${error.message}`);
        }
        
        // Method 2: Check URL for page number
        try {
            const currentUrl = page.url();
            const pageMatch = currentUrl.match(/page(\d+)/i);
            if (pageMatch) {
                currentPageNumber = parseInt(pageMatch[1]);
                console.log(`📍 Found current page via URL: ${currentPageNumber}`);
                return currentPageNumber;
            }
        } catch (error) {
            console.log(`⚠️  Error finding current page via URL: ${error.message}`);
        }
        
        // Method 3: Look for disabled or active styling
        try {
            for (const li of listItems) {
                const link = await li.locator('a').first();
                if (await link.count() > 0) {
                    const classes = await link.getAttribute('class');
                    const pageNumber = await link.getAttribute('data-page-number');
                    
                    if (classes && pageNumber && (classes.includes('active') || classes.includes('current'))) {
                        currentPageNumber = parseInt(pageNumber);
                        console.log(`📍 Found current page via classes: ${currentPageNumber}`);
                        return currentPageNumber;
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️  Error finding current page via classes: ${error.message}`);
        }
        
        console.log(`📍 Using default current page: ${currentPageNumber}`);
        return currentPageNumber;
    }

    async goToNextPage(page) {
        try {
            console.log('➡️  Navigating to next page...');
            
            const currentUrl = page.url();
            console.log(`🔄 Current URL: ${currentUrl}`);
            
            const paginationXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/div[3]/div[2]/nav/ol';
            const paginationList = await page.locator(`xpath=${paginationXPath}`).first();
            
            if (await paginationList.count() === 0) {
                console.log('❌ Pagination list not found');
                return false;
            }
            
            const listItems = await paginationList.locator('li').all();
            let nextPageLink = null;
            let targetPageNumber = null;
            
            // Get current page number
            const currentPageNumber = await this.getCurrentPageNumber(page, listItems);
            const expectedNextPage = currentPageNumber + 1;
            
            console.log(`🎯 Looking for page ${expectedNextPage} (current: ${currentPageNumber})`);
            
            // APPROACH 1: Try third li element first (your preferred method)
            if (listItems.length >= 3) {
                try {
                    console.log('🔍 Method 1: Checking third li element...');
                    const thirdLi = listItems[2];
                    const thirdLink = await thirdLi.locator('a').first();
                    
                    if (await thirdLink.count() > 0) {
                        const thirdPageNumber = await thirdLink.getAttribute('data-page-number');
                        const thirdHref = await thirdLink.getAttribute('href');
                        
                        if (thirdPageNumber && thirdHref) {
                            const thirdPageNum = parseInt(thirdPageNumber);
                            
                            // Check if this is the next page we want
                            if (thirdPageNum === expectedNextPage) {
                                nextPageLink = thirdLink;
                                targetPageNumber = thirdPageNum;
                                console.log(`✅ Found next page via third li: page ${targetPageNumber}`);
                            } else {
                                console.log(`⚠️  Third li has page ${thirdPageNum}, but we want page ${expectedNextPage}`);
                            }
                        }
                    }
                } catch (error) {
                    console.log(`⚠️  Third li approach failed: ${error.message}`);
                }
            }
            
            // APPROACH 2: Search by data-page-number increment
            if (!nextPageLink) {
                console.log('🔍 Method 2: Searching by data-page-number...');
                
                for (let i = 0; i < listItems.length; i++) {
                    try {
                        const li = listItems[i];
                        const link = await li.locator('a').first();
                        
                        if (await link.count() > 0) {
                            const pageNumber = await link.getAttribute('data-page-number');
                            const href = await link.getAttribute('href');
                            
                            if (pageNumber && href) {
                                const pageNum = parseInt(pageNumber);
                                
                                if (pageNum === expectedNextPage) {
                                    nextPageLink = link;
                                    targetPageNumber = pageNum;
                                    console.log(`✅ Found next page via data-page-number: page ${targetPageNumber} at index ${i}`);
                                    break;
                                }
                            }
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            // APPROACH 3: Look for "next page" button or arrow
            if (!nextPageLink) {
                console.log('🔍 Method 3: Looking for next page button...');
                
                for (let i = 0; i < listItems.length; i++) {
                    try {
                        const li = listItems[i];
                        const link = await li.locator('a').first();
                        
                        if (await link.count() > 0) {
                            const ariaLabel = await link.getAttribute('aria-label');
                            const text = await link.textContent();
                            
                            if (ariaLabel && ariaLabel.toLowerCase().includes('next')) {
                                nextPageLink = link;
                                console.log(`✅ Found next page button via aria-label: ${ariaLabel}`);
                                break;
                            }
                            
                            if (text && (text.includes('›') || text.includes('Next') || text.includes('>'))) {
                                nextPageLink = link;
                                console.log(`✅ Found next page button via text: ${text}`);
                                break;
                            }
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            // Execute the navigation
            if (nextPageLink) {
                try {
                    const href = await nextPageLink.getAttribute('href');
                    const pageNumber = await nextPageLink.getAttribute('data-page-number');
                    
                    console.log(`🔗 Navigating to: href=${href}, page=${pageNumber}`);
                    
                    // Ensure the pagination element is visible
                    await paginationList.scrollIntoViewIfNeeded();
                    await this.randomWait(1000, 2000);
                    
                    // Take a screenshot before clicking (for debugging)
                    // await page.screenshot({ path: `debug_before_click_page_${currentPageNumber}.png` });
                    
                    // Click the next page link
                    await nextPageLink.click();
                    
                    // Wait for navigation with multiple strategies
                    let navigationSuccess = false;
                    
                    // Strategy 1: Wait for URL change
                    try {
                        await page.waitForURL(url => url !== currentUrl, { timeout: 15000 });
                        navigationSuccess = true;
                        console.log('✅ Navigation detected via URL change');
                    } catch (urlError) {
                        console.log(`⚠️  URL change timeout: ${urlError.message}`);
                    }
                    
                    // Strategy 2: Wait for network idle
                    if (!navigationSuccess) {
                        try {
                            await page.waitForLoadState('networkidle', { timeout: 10000 });
                            navigationSuccess = true;
                            console.log('✅ Navigation detected via network idle');
                        } catch (networkError) {
                            console.log(`⚠️  Network idle timeout: ${networkError.message}`);
                        }
                    }
                    
                    // Strategy 3: Wait for pagination list to reload
                    if (!navigationSuccess) {
                        try {
                            await page.waitForFunction(() => {
                                const nav = document.querySelector('/html/body/div[2]/div[1]/div[1]/div[2]/div[3]/div[2]/nav/ol');
                                return nav !== null;
                            }, { timeout: 10000 });
                            navigationSuccess = true;
                            console.log('✅ Navigation detected via pagination reload');
                        } catch (paginationError) {
                            console.log(`⚠️  Pagination reload timeout: ${paginationError.message}`);
                        }
                    }
                    
                    // Fallback: Just wait and assume success
                    if (!navigationSuccess) {
                        await this.randomWait(5000, 8000);
                        navigationSuccess = true;
                        console.log('✅ Using fallback timing');
                    }
                    
                    if (navigationSuccess) {
                        const newUrl = page.url();
                        console.log(`🔄 New URL: ${newUrl}`);
                        
                        // Verify we're on the expected page
                        if (targetPageNumber) {
                            const newPageMatch = newUrl.match(/page(\d+)/i);
                            if (newPageMatch && parseInt(newPageMatch[1]) === targetPageNumber) {
                                console.log(`✅ Successfully navigated to page ${targetPageNumber}`);
                            } else {
                                console.log(`⚠️  URL doesn't match expected page ${targetPageNumber}`);
                            }
                        }
                        
                        // Scroll to top and wait a bit
                        await this.randomWait(3000, 5000);
                        await page.evaluate(() => window.scrollTo(0, 0));
                        await this.randomWait(2000, 3000);
                        
                        return true;
                    } else {
                        console.log('❌ Navigation failed - no changes detected');
                        return false;
                    }
                    
                } catch (clickError) {
                    console.log(`❌ Error clicking next page link: ${clickError.message}`);
                    return false;
                }
            } else {
                console.log('❌ No next page link found');
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Error navigating to next page: ${error.message}`);
            return false;
        }
    }

    // Enhanced debug method for pagination analysis
    async debugPaginationStructure(page) {
        try {
            console.log('🔍 Debugging pagination structure...');
            
            const paginationXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/div[3]/div[2]/nav/ol';
            const paginationList = await page.locator(`xpath=${paginationXPath}`).first();
            
            if (await paginationList.count() === 0) {
                console.log('❌ Pagination list not found');
                return;
            }
            
            const listItems = await paginationList.locator('li').all();
            console.log(`📊 Found ${listItems.length} pagination items`);
            
            // Get current page info
            const currentPageNumber = await this.getCurrentPageNumber(page, listItems);
            const currentUrl = page.url();
            
            console.log(`📍 Current page: ${currentPageNumber}`);
            console.log(`🔗 Current URL: ${currentUrl}`);
            
            // Analyze each li element
            for (let i = 0; i < listItems.length; i++) {
                const li = listItems[i];
                const link = await li.locator('a').first();
                
                console.log(`\n--- Li ${i + 1} ---`);
                
                if (await link.count() > 0) {
                    const text = await link.textContent();
                    const href = await link.getAttribute('href');
                    const pageNumber = await link.getAttribute('data-page-number');
                    const ariaCurrent = await link.getAttribute('aria-current');
                    const ariaLabel = await link.getAttribute('aria-label');
                    const classes = await link.getAttribute('class');
                    
                    console.log(`Text: "${text?.trim()}"`);
                    console.log(`Href: ${href}`);
                    console.log(`Page Number: ${pageNumber}`);
                    console.log(`Aria Current: ${ariaCurrent}`);
                    console.log(`Aria Label: ${ariaLabel}`);
                    console.log(`Classes: ${classes}`);
                    
                    if (ariaCurrent === 'page' || ariaCurrent === 'true') {
                        console.log(`🎯 THIS IS THE CURRENT PAGE`);
                    }
                    
                    if (i === 2) {
                        console.log(`🔍 THIS IS THE THIRD LI (your preferred method)`);
                    }
                } else {
                    console.log('No link found in this li element');
                }
            }
            
            // Test next page detection
            console.log('\n🧪 Testing next page detection...');
            const hasNext = await this.hasNextPage(page);
            console.log(`Next page available: ${hasNext}`);
            
        } catch (error) {
            console.log(`❌ Error debugging pagination: ${error.message}`);
        }
    }

    // Optional: Add a debug method to analyze pagination structure
    async debugPagination(page) {
        try {
            console.log('🔍 Debugging pagination structure...');
            
            // Find all nav elements
            const navElements = await page.locator('nav').all();
            
            for (let i = 0; i < navElements.length; i++) {
                const nav = navElements[i];
                const navText = await nav.textContent();
                const navHTML = await nav.innerHTML();
                
                console.log(`\n--- Nav Element ${i + 1} ---`);
                console.log(`Text: ${navText?.substring(0, 200)}...`);
                console.log(`HTML: ${navHTML?.substring(0, 300)}...`);
                
                // Look for pagination-related attributes
                const ariaLabel = await nav.getAttribute('aria-label');
                const className = await nav.getAttribute('class');
                const role = await nav.getAttribute('role');
                
                console.log(`Attributes: aria-label="${ariaLabel}", class="${className}", role="${role}"`);
                
                // Find all links in this nav
                const links = await nav.locator('a').all();
                console.log(`Found ${links.length} links in this nav`);
                
                for (let j = 0; j < Math.min(links.length, 5); j++) {
                    const link = links[j];
                    const linkText = await link.textContent();
                    const href = await link.getAttribute('href');
                    const ariaDisabled = await link.getAttribute('aria-disabled');
                    const classes = await link.getAttribute('class');
                    
                    console.log(`  Link ${j + 1}: text="${linkText}", href="${href}", disabled="${ariaDisabled}", classes="${classes}"`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Error debugging pagination: ${error.message}`);
        }
    }

    async scrapeAllPages() {
        console.log('🎯 Starting comprehensive scraping...');
        
        let pageNumber = 1;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 3;
        
        while (true) {
            try {
                console.log(`\n📄 Processing page ${pageNumber}...`);
                
                // Generate URL for current page
                const currentUrl = this.generatePageUrl(pageNumber);
                console.log(`🔗 Navigating to: ${currentUrl}`);
                
                let retryCount = 0;
                const maxRetries = 3;
                
                while (retryCount < maxRetries) {
                    try {
                        await this.page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
                        await this.randomWait(2000, 4000);
                        break;
                    } catch (error) {
                        retryCount++;
                        console.log(`⚠️  Failed to load page ${pageNumber} (attempt ${retryCount}/${maxRetries}): ${error.message}`);
                        if (retryCount < maxRetries) {
                            await this.handleProxyRotation();
                        } else {
                            throw error;
                        }
                    }
                }
                
                // Check if we got redirected to main URL (indicates no more pages)
                const finalUrl = this.page.url();
                if (pageNumber > 1 && this.isMultiPageScraping() && finalUrl.includes(this.mainUrl.split('?')[0]) && !finalUrl.includes('page')) {
                    console.log('🔄 Redirected to main URL - no more pages');
                    break;
                }
                
                // Scroll to load content
                await this.humanScroll(this.page, 3);
                
                // Get all card links on current page
                const cardLinks = await this.getCardLinks(this.page);
                
                if (cardLinks.length === 0) {
                    console.log('❌ No cards found on this page');
                    
                    // If this is multi-page scraping and no cards found, might be end of pages
                    if (this.isMultiPageScraping()) {
                        console.log('🏁 No more pages to scrape (multi-page mode)');
                        break;
                    } else {
                        // For single page, this means we're done
                        break;
                    }
                }
                
                // Reset consecutive failures on successful page load
                consecutiveFailures = 0;
                
                // Scrape each ad
                for (let i = 0; i < cardLinks.length; i++) {
                    console.log(`\n🔍 Processing ad ${i + 1}/${cardLinks.length} on page ${pageNumber}`);
                    
                    // Rotate proxy every 3 ads to avoid rate limiting
                    if (this.proxyConfig.enabled && (i + 1) % 3 === 0) {
                        console.log('🔄 Rotating proxy for anti-detection...');
                        await this.handleProxyRotation();
                    }
                    
                    const adData = await this.scrapeAdPage(cardLinks[i]);
                    if (adData) {
                        this.results.push(adData);
                        this.saveCounter++;
                        console.log(`✅ Successfully scraped ad ${this.results.length}`);
                        
                        // Incremental save every N ads
                        if (this.saveCounter >= this.saveInterval) {
                            await this.saveResultsIncremental();
                            this.saveCounter = 0;
                        }
                    }
                    
                    // Random delay between ads
                    await this.randomWait(2000, 5000);
                }
                
                // If this is single page scraping, we're done after first page
                if (!this.isMultiPageScraping()) {
                    console.log('🏁 Single page scraping complete');
                    break;
                }
                
                // For multi-page scraping, continue to next page
                pageNumber++;
                
                // Rotate proxy every 2 pages
                if (this.proxyConfig.enabled && pageNumber % 2 === 0) {
                    console.log('🔄 Rotating proxy between pages...');
                    await this.handleProxyRotation();
                }
                
                // Safety limit to prevent infinite loops
                if (pageNumber > 50) {
                    console.log('⚠️  Safety limit reached (50 pages)');
                    break;
                }
                
            } catch (error) {
                consecutiveFailures++;
                console.log(`❌ Error on page ${pageNumber} (failure ${consecutiveFailures}/${maxConsecutiveFailures}): ${error.message}`);
                
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    console.log('❌ Too many consecutive failures, stopping scraper');
                    break;
                }
                
                // Try rotating proxy and retrying
                if (this.proxyConfig.enabled) {
                    console.log('🔄 Rotating proxy due to error...');
                    await this.handleProxyRotation();
                    await this.randomWait(5000, 10000);
                } else {
                    await this.randomWait(10000, 15000);
                }
            }
        }
        
        // Final save
        await this.saveResultsIncremental();
        console.log(`\n🎉 Scraping complete! Total ads scraped: ${this.results.length}`);
    }

    async saveResults() {
        // This method is now mainly for compatibility
        await this.saveResultsIncremental();
    }

    convertToCSV(data) {
        if (data.length === 0) return 'Title,Location,Phone Number,URL,Scraped At\n';
        
        const headers = ['Title', 'Location', 'Phone Number', 'URL', 'Scraped At'];
        const csvRows = [headers.join(',')];
        
        data.forEach(item => {
            const row = [
                `"${(item.title || '').replace(/"/g, '""')}"`,
                `"${(item.location || '').replace(/"/g, '""')}"`,
                `"${(item.phoneNumber || '').replace(/"/g, '""')}"`,
                `"${(item.url || '').replace(/"/g, '""')}"`,
                `"${(item.scrapedAt || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }

    async run() {
        try {
            await this.init();
            await this.scrapeAllPages();
            await this.saveResults();
        } catch (error) {
            console.error('❌ Fatal error:', error);
            // Save whatever results we have
            if (this.results.length > 0) {
                await this.saveResultsIncremental();
            }
        } finally {
            await this.cleanup();
        }
    }
}

// Usage
async function main() {
    const scraper = new GumtreeScraper();
    await scraper.run();
}

// Helper function to export cookies manually
async function exportCookies() {
    console.log('🍪 Starting cookie export process...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('👆 Please log in to Gumtree manually in the browser window that opened');
    console.log('📝 After logging in, press Enter in this terminal to export cookies...');
    
    // Go to Gumtree
    await page.goto('https://www.gumtree.com/login');
    
    // Wait for user input
    await new Promise(resolve => {
        process.stdin.once('data', () => {
            resolve();
        });
    });
    
    // Export cookies
    const cookies = await context.cookies();
    fs.writeFileSync('./gumtree_cookies.json', JSON.stringify(cookies, null, 2));
    
    console.log('✅ Cookies exported to gumtree_cookies.json');
    await browser.close();
}

// Helper function to test all proxies
async function testAllProxies() {
    console.log('🧪 Testing all proxies...');
    
    const proxyConfig = {
        proxiesFile: './proxies.txt',
        username: ' ', // <-- UPDATE WITH YOUR WEBSHARE USERNAME
        password: ' '  // <-- UPDATE WITH YOUR WEBSHARE PASSWORD
    };
    
    if (!fs.existsSync(proxyConfig.proxiesFile)) {
        console.log('❌ Proxies file not found');
        return;
    }
    
    const proxyData = fs.readFileSync(proxyConfig.proxiesFile, 'utf8');
    const lines = proxyData.split('\n').filter(line => line.trim());
    
    const proxies = lines.map(line => {
        const [host, port] = line.trim().split(':');
        return { host, port: parseInt(port) };
    });
    
    console.log(`Found ${proxies.length} proxies to test`);
    
    const browser = await chromium.launch({ headless: true });
    const workingProxies = [];
    
    for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        console.log(`\n🔍 Testing proxy ${i + 1}/${proxies.length}: ${proxy.host}:${proxy.port}`);
        
        try {
            const context = await browser.newContext({
                proxy: {
                    server: `http://${proxy.host}:${proxy.port}`,
                    username: proxyConfig.username,
                    password: proxyConfig.password
                }
            });
            
            const page = await context.newPage();
            await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle', timeout: 10000 });
            
            const content = await page.content();
            const ipMatch = content.match(/"origin":\s*"([^"]+)"/);
            
            if (ipMatch) {
                console.log(`✅ Proxy working - IP: ${ipMatch[1]}`);
                workingProxies.push(proxy);
            } else {
                console.log('❌ Proxy failed - no IP detected');
            }
            
            await context.close();
            
        } catch (error) {
            console.log(`❌ Proxy failed - ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await browser.close();
    
    console.log(`\n📊 Test Results:`);
    console.log(`Total proxies tested: ${proxies.length}`);
    console.log(`Working proxies: ${workingProxies.length}`);
    console.log(`Failed proxies: ${proxies.length - workingProxies.length}`);
    
    if (workingProxies.length > 0) {
        console.log('\n✅ Working proxies:');
        workingProxies.forEach((proxy, index) => {
            console.log(`${index + 1}. ${proxy.host}:${proxy.port}`);
        });
        
        // Save working proxies to a separate file
        const workingProxiesContent = workingProxies.map(p => `${p.host}:${p.port}`).join('\n');
        fs.writeFileSync('./working_proxies.txt', workingProxiesContent);
        console.log('\n💾 Working proxies saved to working_proxies.txt');
    }
}

// Run if this file is executed directly
if (require.main === module) {
    // Check command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--export-cookies')) {
        exportCookies().catch(console.error);
    } else if (args.includes('--test-proxies')) {
        testAllProxies().catch(console.error);
    } else {
        main().catch(console.error);
    }
}

module.exports = GumtreeScraper;