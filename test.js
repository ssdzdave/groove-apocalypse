const { spawn } = require('child_process');

async function runGame() {
    let serverProcess;
    try {
        // Start live-server as a child process
        const args = process.argv.slice(2);
        let port = 8080;
        for (const arg of args) {
            if (arg.startsWith('--port=')) {
                port = parseInt(arg.split('=')[1]);
                break;
            }
        }

        serverProcess = spawn('npx', ['live-server', '.', `--port=${port}`, '--no-browser']);

        console.log(`Live-server started on http://localhost:${port}. Please open this URL in your browser for manual testing.`);
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