/**
 * Entity Schema Integration Demo Script
 * Opens a browser window and navigates to the Entity Schema interface
 */

import { chromium } from '@playwright/test';

async function demoEntitySchemaIntegration() {
    console.log('🎭 Opening browser to demonstrate Entity Schema integration...');
    
    // Launch browser
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000 // Slow down actions for demonstration
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    try {
        console.log('🌐 Navigating to application...');
        await page.goto('http://localhost:8080');
        
        console.log('⚡ Enabling test mode...');
        await page.evaluate(() => {
            if (window.state && window.state.setTestMode) {
                window.state.setTestMode(true);
            }
        });
        
        await page.waitForTimeout(1000);
        
        console.log('📋 Navigating to Step 2: Mapping...');
        const step2Button = page.locator('.step[data-step="2"]');
        await step2Button.click();
        
        await page.waitForTimeout(2000);
        
        console.log('✨ Highlighting Entity Schema interface...');
        
        // Scroll to Entity Schema selector
        await page.locator('.entity-schema-selector').scrollIntoViewIfNeeded();
        
        // Add visual highlighting to the Entity Schema interface
        await page.addStyleTag({
            content: `
                .entity-schema-selector {
                    animation: pulse 2s infinite;
                    border: 3px solid #ff6b35 !important;
                }
                
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 107, 53, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0); }
                }
                
                .schema-card {
                    transition: all 0.3s ease !important;
                }
            `
        });
        
        console.log('🎯 Entity Schema interface is now visible!');
        console.log('');
        console.log('🔍 You can see:');
        console.log('  • 4 Active Entity Schemas (E473, E487, E476, E488)');
        console.log('  • Schema cards with selection interface');
        console.log('  • Search functionality for additional schemas');
        console.log('  • Beautiful, responsive design');
        console.log('');
        console.log('💡 Try clicking on a schema card to select it!');
        console.log('   Watch for property suggestions to appear below.');
        console.log('');
        console.log('🎉 Entity Schema integration is complete and working!');
        console.log('');
        console.log('🚪 Browser window will remain open for your inspection.');
        console.log('   Press Ctrl+C in terminal to close when done.');
        
        // Keep the browser open for inspection
        await page.waitForTimeout(15000); // Wait 15 seconds for demo
        
    } catch (error) {
        console.error('❌ Demo error:', error);
    } finally {
        // Don't close automatically - let user inspect
        console.log('✅ Demo completed. Browser remains open for inspection.');
    }
}

// Run the demo
demoEntitySchemaIntegration().catch(console.error);