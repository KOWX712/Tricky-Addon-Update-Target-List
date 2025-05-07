/**
 * Imported from https://www.npmjs.com/package/kernelsu
 * Slightly modified version by KOWX712
 * Added full description
 * Simplified spawn function
 * Handle error on toast
 */

let callbackCounter = 0;
function getUniqueCallbackName(prefix) {
    return `${prefix}_callback_${Date.now()}_${callbackCounter++}`;
}

/**
 * Execute shell command with ksu.exec
 * @param {string} command - The command to execute
 * @param {Object} [options={}] - Options object containing:
 *   - cwd <string> - Current working directory of the child process
 *   - env {Object} - Environment key-value pairs
 * @returns {Promise<Object>} Resolves with:
 *   - errno {number} - Exit code of the command
 *   - stdout {string} - Standard output from the command
 *   - stderr {string} - Standard error from the command
 */
export function exec(command, options = {}) {
    return new Promise((resolve, reject) => {
        const callbackFuncName = getUniqueCallbackName("exec");
        window[callbackFuncName] = (errno, stdout, stderr) => {
            resolve({ errno, stdout, stderr });
            cleanup(callbackFuncName);
        };
        function cleanup(successName) {
            delete window[successName];
        }
        try {
            ksu.exec(command, JSON.stringify(options), callbackFuncName);
        } catch (error) {
            reject(error);
            cleanup(callbackFuncName);
        }
    });
}

/**
 * Standard I/O stream for a child process.
 * @class
 */
class Stdio {
    constructor() {
        this.listeners = {};
    }
    on(event, listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }
    emit(event, ...args) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(listener => listener(...args));
        }
    }
}

/**
 * Spawn shell process with ksu.spawn
 * @param {string} command - The command to execute
 * @param {string[]} [args=[]] - Array of arguments to pass to the command
 * @param {Object} [options={}] - Options object containing:
 *   - cwd <string> - Current working directory of the child process
 *   - env {Object} - Environment key-value pairs
 * @returns {Object} A child process object with:
 *   - stdout: Stream for standard output
 *   - stderr: Stream for standard error
 *   - stdin: Stream for standard input
 *   - on(event, listener): Attach event listener ('exit', 'error')
 *   - emit(event, ...args): Emit events internally
 */
export function spawn(command, args = [], options = {}) {
    const child = {
        listeners: {},
        stdout: new Stdio(),
        stderr: new Stdio(),
        stdin: new Stdio(),
        on(event, listener) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(listener);
        },
        emit(event, ...args) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(listener => listener(...args));
            }
        }
    };
    const callbackName = getUniqueCallbackName("spawn");
    window[callbackName] = child;
    child.on("exit", () => delete window[callbackName]);
    try {
        ksu.spawn(command, JSON.stringify(args), JSON.stringify(options), callbackName);
    } catch (error) {
        child.emit("error", error);
        delete window[callbackName];
    }
    return child;
}

/**
 * Show android toast message
 * @param {string} message - The message to display in toast
 * @returns {void}
 */
export function toast(message) {
    try {
        ksu.toast(message);
    } catch (error) {   
        console.error("Error displaying toast:", error);
    }
}
