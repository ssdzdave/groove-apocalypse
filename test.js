const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

async function runTests() {
    let serverProcess;
    let browser;
    try {
        // Start live-server as a child process
        serverProcess = spawn('npx', ['live-server', '.', '--port=8080', '--no-browser', '--quiet']);

        // Wait for server to start (give it a moment)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Launch headless browser
        browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Listen for console messages and errors
        page.on('console', msg => {
            for (let i = 0; i < msg.args().length; ++i) {
                console.log(`CONSOLE: ${msg.args()[i]}`);
            }
        });
        page.on('pageerror', error => {
            console.error(`PAGE ERROR: ${error.message}`);
        });

        // Navigate to the game
        await page.goto('http://localhost:8080');

        // Give it some time to run and potentially log errors
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log("Tests finished. Check console output for errors.");

    } catch (error) {
        console.error('An error occurred during testing:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
        if (serverProcess) {
            serverProcess.kill(); // Terminate the live-server process
        }
    }
}

runTests();