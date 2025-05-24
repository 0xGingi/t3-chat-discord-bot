import puppeteer from 'puppeteer';
import { Model } from '../types/index.js';

export class T3ChatService {
  private accessToken: string;
  private useBetaDomain: boolean;
  private browser: any = null;

  constructor(accessToken: string, useBetaDomain: boolean = true) {
    this.accessToken = accessToken;
    this.useBetaDomain = useBetaDomain;
  }

  private getBaseUrl(): string {
    return this.useBetaDomain ? 'https://beta.t3.chat' : 'https://t3.chat';
  }

  private buildModelUrl(model: Model, query: string, useSearch: boolean = false): string {
    let url = model.url.replace('https://beta.t3.chat', this.getBaseUrl());
    url = url.replace('%s', encodeURIComponent(query));
    
    if (useSearch && model.features.search) {
      url += '&search=true';
    }
    
    return url;
  }

  private async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  async askModel(model: Model, question: string, useSearch: boolean = false, imageUrl?: string, pdfUrl?: string): Promise<string | { type: 'image', url: string, buffer?: Buffer }> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    const isImageGen = model.features.imageGen && model.name.includes('Imagegen');
    const baseTimeout = isImageGen ? 120000 : 60000;
    const navigationTimeout = isImageGen ? 90000 : 45000;
    
    console.log(`Starting ${isImageGen ? 'image generation' : 'text'} request with model: ${model.name}`);
    console.log(`Timeouts - Navigation: ${navigationTimeout}ms, Base: ${baseTimeout}ms`);
    
    let finalQuestion = question;
    if (imageUrl || pdfUrl) {
      console.log('Adding URL references to question...');
      let urlPart = '';
      if (imageUrl) {
        urlPart += `${imageUrl}\n`;
      }
      if (pdfUrl) {
        urlPart += `${pdfUrl}\n`;
      }
      finalQuestion = `${urlPart}\n${question}`;
    }
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Authorization': `Bearer ${this.accessToken}`
      });

      console.log('Setting access token in multiple ways...');
      
      await page.goto(this.getBaseUrl(), { 
        waitUntil: 'networkidle0',
        timeout: navigationTimeout 
      });

      await page.evaluate((token: string) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('accessToken', token);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('token', token);
        
        document.cookie = `access_token=${token}; path=/; domain=.t3.chat`;
        document.cookie = `accessToken=${token}; path=/; domain=.t3.chat`;
        document.cookie = `auth_token=${token}; path=/; domain=.t3.chat`;
        document.cookie = `token=${token}; path=/; domain=.t3.chat`;
      }, this.accessToken);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const authCheck = await page.evaluate(() => {
        return {
          localStorage: {
            access_token: localStorage.getItem('access_token'),
            accessToken: localStorage.getItem('accessToken'),
            auth_token: localStorage.getItem('auth_token'),
            token: localStorage.getItem('token')
          },
          cookies: document.cookie,
          currentUrl: window.location.href,
          isLoggedIn: !document.body.textContent?.includes('Upgrade to Pro') && 
                     !document.body.textContent?.includes('Sign in')
        };
      });
      
      console.log('Auth check:', authCheck);

      const url = this.buildModelUrl(model, finalQuestion, useSearch);
      console.log(`Navigating to: ${url}`);

      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: navigationTimeout 
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const authCheckAfterNav = await page.evaluate(() => {
        return {
          currentUrl: window.location.href,
          pageTitle: document.title,
          hasUpgradeText: document.body.textContent?.includes('Upgrade to Pro'),
          hasSignInText: document.body.textContent?.includes('Sign in'),
          hasTermsText: document.body.textContent?.includes('Terms and our Privacy Policy'),
          bodyStart: document.body.textContent?.substring(0, 500)
        };
      });
      
      console.log('Auth check after navigation:', authCheckAfterNav);

      if (authCheckAfterNav.hasUpgradeText || authCheckAfterNav.hasSignInText || authCheckAfterNav.hasTermsText) {
        console.log('Not properly authenticated - hitting login/upgrade page');
        
        const loginAttempt = await page.evaluate((token: string) => {
          const inputs = document.querySelectorAll('input[type="password"], input[name="token"], input[placeholder*="token"], input[placeholder*="key"]');
          for (const input of inputs) {
            (input as HTMLInputElement).value = token;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          
          const loginButtons = document.querySelectorAll('button[type="submit"], button:contains("Sign in"), button:contains("Login"), button:contains("Continue")');
          if (loginButtons.length > 0) {
            (loginButtons[0] as HTMLElement).click();
            return true;
          }
          return false;
        }, this.accessToken);
        
        if (loginAttempt) {
          console.log('Attempted login, waiting for redirect...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: navigationTimeout 
          });
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      const textareaSelector = 'textarea, input[type="text"], [contenteditable="true"]';
      const submitButtonSelector = 'button[type="submit"], [data-testid="send-button"], .send-button, button[class*="send"], button[class*="submit"]';

      const textarea = await page.$(textareaSelector);
      if (textarea) {
        await textarea.click();
        await textarea.focus();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await textarea.evaluate((el: any) => {
          el.value = '';
          el.textContent = '';
        });

        await textarea.type(finalQuestion, { delay: 50 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const submitButton = await page.$(submitButtonSelector);
        if (submitButton) {
          console.log('Clicking submit button');
          await submitButton.click();
        } else {
          console.log('No submit button found, pressing Enter');
          await page.keyboard.press('Enter');
        }
      } else {
        console.log('No textarea found, the query might already be in the URL');
      }

      if (model.features.imageGen && model.name.includes('Imagegen')) {
        console.log('Waiting for image generation...');
        await new Promise(resolve => setTimeout(resolve, isImageGen ? 30000 : 10000));
        
        const imageSelectors = [
          'img[src*="utfs.io"]',
          'img[src*="uploadthing"]',
          'img[src*="generated"]',
          'img[src*="blob:"]',
          'img[src*="data:image"]',
          'img[src*="cdn"]',
          'img[src*="image"]',
          'img[alt*="generated"]',
          'img[alt*="image"]',
          '[data-testid="generated-image"] img',
          '.generated-image img',
          '.ai-image img',
          'img:not([src*="avatar"]):not([src*="logo"]):not([src*="icon"])'
        ];
        
        let imageAttempts = 0;
        const maxImageAttempts = isImageGen ? 60 : 20;
        
        while (imageAttempts < maxImageAttempts) {
          for (const selector of imageSelectors) {
            try {
              const images = await page.$$(selector);
              for (const imgElement of images) {
                const src = await imgElement.evaluate((img: HTMLImageElement) => img.src);
                const alt = await imgElement.evaluate((img: HTMLImageElement) => img.alt || '');
                
                const isGeneratedImage = src && (
                  src.includes('utfs.io') ||
                  src.includes('uploadthing') ||
                  (src.length > 50 && !src.includes('avatar') && !src.includes('logo') && !src.includes('icon') && !src.includes('favicon'))
                );
                
                if (isGeneratedImage) {
                  console.log(`Found generated image: ${src}`);
                  
                  try {
                    if (src.startsWith('blob:') || src.startsWith('data:')) {
                      const buffer = await imgElement.screenshot();
                      return {
                        type: 'image' as const,
                        url: src,
                        buffer: buffer
                      };
                    } else {
                      console.log(`Downloading image from: ${src}`);
                      const imageResponse = await fetch(src);
                      if (imageResponse.ok) {
                        const buffer = Buffer.from(await imageResponse.arrayBuffer());
                        console.log(`Successfully downloaded image, size: ${buffer.length} bytes`);
                        return {
                          type: 'image' as const,
                          url: src,
                          buffer: buffer
                        };
                      } else {
                        console.log(`Failed to download image, status: ${imageResponse.status}`);
                      }
                    }
                  } catch (error) {
                    console.log('Error downloading image:', error);
                  }
                }
              }
            } catch (error) {
              console.log(`Error with image selector ${selector}:`, error);
            }
          }
          
          imageAttempts++;
          console.log(`Image detection attempt ${imageAttempts}/${maxImageAttempts}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('Standard image selectors failed, trying URL extraction...');
        
        try {
          const imageUrls = await page.evaluate(() => {
            const urls: string[] = [];
            
            const allText = document.body.textContent || '';
            const utfsMatches = allText.match(/https:\/\/utfs\.io\/f\/[A-Za-z0-9]+/g);
            if (utfsMatches) {
              urls.push(...utfsMatches);
            }
            
            const links = Array.from(document.querySelectorAll('a[href*="utfs.io"]'));
            for (const link of links) {
              const href = (link as HTMLAnchorElement).href;
              if (href && href.includes('utfs.io')) {
                urls.push(href);
              }
            }
            
            const elements = Array.from(document.querySelectorAll('*'));
            for (const element of elements) {
              for (const attr of element.getAttributeNames()) {
                const value = element.getAttribute(attr);
                if (value && value.includes('utfs.io')) {
                  const match = value.match(/https:\/\/utfs\.io\/f\/[A-Za-z0-9]+/);
                  if (match) {
                    urls.push(match[0]);
                  }
                }
              }
            }
            
            return [...new Set(urls)];
          });
          
          console.log(`Found ${imageUrls.length} potential image URLs:`, imageUrls);
          
          for (const url of imageUrls) {
            try {
              console.log(`Attempting to download image from extracted URL: ${url}`);
              const imageResponse = await fetch(url);
              if (imageResponse.ok) {
                const buffer = Buffer.from(await imageResponse.arrayBuffer());
                console.log(`Successfully downloaded image from extracted URL, size: ${buffer.length} bytes`);
                return {
                  type: 'image' as const,
                  url: url,
                  buffer: buffer
                };
              } else {
                console.log(`Failed to download from extracted URL, status: ${imageResponse.status}`);
              }
            } catch (error) {
              console.log(`Error downloading from extracted URL ${url}:`, error);
            }
          }
        } catch (error) {
          console.log('Error during URL extraction:', error);
        }
        
        console.log('Could not extract generated image, falling back to link');
      }

      const responseSelectors = [
        '[data-testid="message-content"]',
        '.message-content',
        '.response',
        '.ai-response',
        '.chat-message',
        '.prose',
        '[role="main"] > div:last-child',
        'main > div:last-child',
        '.conversation-item:last-child',
        '.chat-bubble:last-child'
      ];

      let response = '';
      let attempts = 0;
      const maxAttempts = isImageGen ? 60 : 30;

      while (!response && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, isImageGen ? 3000 : 2000));
        
        for (const selector of responseSelectors) {
          try {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              const lastElement = elements[elements.length - 1];
              const text = await lastElement.evaluate((el: Element) => {
                const textContent = el.textContent || '';
                return textContent.trim();
              });
              
              if (text && 
                  text.length > 20 && 
                  text.trim() !== question &&
                  !text.includes('window.plausible') &&
                  !text.includes('function()') &&
                  !text.includes('analytics') &&
                  !text.startsWith('window.') &&
                  !text.includes('.push(arguments)') &&
                  !text.includes('Upgrade to Pro') &&
                  !text.includes('Terms and our Privacy Policy')) {
                response = text.trim();
                console.log(`Found response with selector ${selector}: ${response.substring(0, 100)}...`);
                break;
              }
            }
          } catch (error) {
            console.log(`Error with selector ${selector}:`, error);
          }
        }
        
        if (!response) {
          try {
            const allText = await page.evaluate(() => {
              const excludeSelectors = ['script', 'style', 'nav', 'header', 'footer', '.analytics'];
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                  acceptNode: function(node: any) {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    
                    const tagName = parent.tagName.toLowerCase();
                    if (excludeSelectors.includes(tagName)) return NodeFilter.FILTER_REJECT;
                    
                    for (const selector of excludeSelectors) {
                      if (selector.startsWith('.') && parent.classList.contains(selector.substring(1))) {
                        return NodeFilter.FILTER_REJECT;
                      }
                    }
                    
                    const text = node.textContent || '';
                    if (text.includes('window.plausible') || 
                        text.includes('function()') || 
                        text.includes('analytics') ||
                        text.startsWith('window.') ||
                        text.includes('.push(arguments)') ||
                        text.includes('Upgrade to Pro') ||
                        text.includes('Terms and our Privacy Policy')) {
                      return NodeFilter.FILTER_REJECT;
                    }
                    
                    return NodeFilter.FILTER_ACCEPT;
                  }
                }
              );
              
              let textNodes: string[] = [];
              let node;
              while (node = walker.nextNode()) {
                const text = node.textContent;
                if (text && text.trim().length > 50) {
                  textNodes.push(text.trim());
                }
              }
              
              return textNodes.filter(text => 
                !text.includes('window.plausible') && 
                !text.includes('function()') &&
                !text.includes('analytics') &&
                !text.startsWith('window.') &&
                !text.includes('.push(arguments)') &&
                !text.includes('Upgrade to Pro') &&
                !text.includes('Terms and our Privacy Policy')
              );
            });
            
            const lastText = allText[allText.length - 1];
            if (lastText && lastText !== question && lastText.length > 20) {
              response = lastText;
              console.log(`Found response from text walker: ${response.substring(0, 100)}...`);
            }
          } catch (error) {
            console.log('Error with text walker:', error);
          }
        }
        
        attempts++;
        console.log(`Attempt ${attempts}/${maxAttempts} - Response length: ${response.length}`);
      }

      if (!response) {
        const pageContent = await page.content();
        console.log('Page content sample:', pageContent.substring(0, 1000));
        return `I couldn't extract the response from T3.CHAT automatically. Please visit this link to see the response: ${url}`;
      }

      return response;

    } catch (error) {
      console.error('Error scraping T3.CHAT:', error);
      const fallbackUrl = this.buildModelUrl(model, question, useSearch);
      return `An error occurred while getting the response. Please visit this link: ${fallbackUrl}`;
    } finally {
      await page.close();
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing T3.CHAT connection...');
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      await page.goto(this.getBaseUrl(), { timeout: 30000 });
      console.log('T3.CHAT connection test successful');
      await page.close();
      return true;
    } catch (error) {
      console.error('T3.CHAT connection test failed:', error);
      return false;
    }
  }

  setUseBetaDomain(useBeta: boolean): void {
    this.useBetaDomain = useBeta;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
} 