const { spawn } = require('child_process');

async function runGame() {
    let serverProcess;
    try {
        // Start live-server as a child process
        serverProcess = spawn('npx', ['live-server', '.', '--port=8080', '--no-browser']);

        console.log("Live-server started on http://localhost:8080. Please open this URL in your browser for manual testing.");
        console.log("Press Ctrl+C to stop the server.");

        // Keep the process alive until manually terminated
        await new Promise(resolve => {});

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        if (serverProcess) {
            serverProcess.kill(); // Terminate the live-server process
        }
    }
}

runGame();