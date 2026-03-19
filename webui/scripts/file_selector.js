import { exec } from 'kernelsu-alt';

let fileType;
let fileSelectorMode;

const fileSelectorDialog = document.getElementById('file-selector-dialog');
let currentPath = '/storage/emulated/0/Download';

/**
 * Display the current path in the headeer of file selector
 * @returns {void}
 */
function updateCurrentPath() {
    const currentPathElement = fileSelectorDialog.querySelector('.current-path');
    const segments = currentPath.split('/').filter(Boolean);

    // Create spans with data-path attribute for each segment
    const pathHTML = segments.map((segment, index) => {
        const fullPath = '/' + segments.slice(0, index + 1).join('/');
        return `<span class="path-segment" data-path="${fullPath}">${segment}</span>`;
    }).join('<span class="separator">›</span>');

    currentPathElement.innerHTML = pathHTML;
    currentPathElement.scrollTo({
        left: currentPathElement.scrollWidth,
        behavior: 'smooth'
    });
}

/**
 * List files in the specified directory
 * @param {string} path - Directory path to list files from
 * @param {boolean} skipAnimation - Whether to skip the animation
 * @returns {Promise<void>}
 */
async function listFiles(path, skipAnimation = false) {
    const fileList = fileSelectorDialog.querySelector('.file-list');
    if (!skipAnimation) {
        fileList.classList.add('switching');
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    // List files and directories
    const result = await exec(`
        cd "${path}"
        # List directories and filtered files
        for f in *; do
            [ -d "$f" ] && echo "d|$f" || { [[ "$f" == *.${fileType} ]] && echo "f|$f"; }
        done | sort
    `);

    if (result.errno === 0) {
        fileList.innerHTML = '';

        // Add back button item if not in root directory
        if (currentPath !== '/storage/emulated/0') {
            const backItem = document.createElement('div');
            backItem.className = 'file-item';
            backItem.innerHTML = `
                <md-ripple></md-ripple>
                <md-icon>folder</md-icon>
                <span>..</span>
            `;
            backItem.onclick = () => {
                fileSelectorDialog.querySelector('.back-button').click();
            };
            fileList.appendChild(backItem);
        }

        const processedItems = result.stdout.split('\n').filter(Boolean).map(line => {
            const [type, name] = [line.slice(0, 1), line.slice(2)];
            return {
                name,
                path: path + '/' + name,
                isDirectory: type === 'd'
            };
        });

        processedItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item';
            itemElement.innerHTML = `
                <md-ripple></md-ripple>
                <md-icon>${item.isDirectory ? 'folder' : 'description'}</md-icon>
                <span>${item.name}</span>
            `;
            itemElement.onclick = async () => {
                if (item.isDirectory) {
                    currentPath = item.path;
                    updateCurrentPath();
                    await listFiles(item.path);
                } else {
                    if (window.fileSelectorResolve) {
                        window.fileSelectorResolve(item.path);
                        window.fileSelectorResolve = null;
                        closeFileSelector();
                    }
                }
            };
            fileList.appendChild(itemElement);
        });

        if (!skipAnimation) {
            fileList.classList.remove('switching');
        }
    } else {
        console.error('Error listing files:', result.stderr);
        if (!skipAnimation) {
            fileList.classList.remove('switching');
        }
    }
    updateCurrentPath();
}

let listenersSetup = false;

/**
 * Setup init listener
 * @returns {void}
 */
function setupListeners() {
    if (listenersSetup) return;
    listenersSetup = true;

    const currentPathElement = fileSelectorDialog.querySelector('.current-path');
    currentPathElement.onclick = async (event) => {
        const segment = event.target.closest('.path-segment');
        if (!segment) return;

        const targetPath = segment.dataset.path;
        if (!targetPath || targetPath === currentPath) return;

        // Return if already at /storage/emulated/0
        const clickedSegment = segment.textContent;
        if ((clickedSegment === 'storage' || clickedSegment === 'emulated') && 
            currentPath === '/storage/emulated/0') {
            return;
        }

        // Always stay within /storage/emulated/0
        if (targetPath.split('/').length <= 3) {
            currentPath = '/storage/emulated/0';
        } else {
            currentPath = targetPath;
        }
        updateCurrentPath();
        await listFiles(currentPath);
    };

    // Back button
    fileSelectorDialog.querySelector('.back-button').onclick = async () => {
        if (currentPath === '/storage/emulated/0') return;
        currentPath = currentPath.split('/').slice(0, -1).join('/');
        if (currentPath === '') currentPath = '/storage/emulated/0';
        const currentPathElement = document.querySelector('.current-path');
        if (currentPathElement) {
            currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
            currentPathElement.scrollTo({ 
                left: currentPathElement.scrollWidth,
                behavior: 'smooth'
            });
        }
        await listFiles(currentPath);
    };

    // Close button
    fileSelectorDialog.querySelector('.close-selector').onclick = () => closeFileSelector();

    fileSelectorDialog.querySelector('.open-system-file').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file || !window.fileSelectorResolve) return;
            if (!file.name.endsWith(`.${fileType}`)) return;

            window.fileSelectorResolve(file);
            window.fileSelectorResolve = null;
            closeFileSelector();
        };
        input.click();
    };
}

/**
 * Function to close file selector
 * @returns {void}
 */
function closeFileSelector() {
    fileSelectorDialog.close();
    if (window.fileSelectorResolve) {
        window.fileSelectorResolve(null);
        window.fileSelectorResolve = null;
    }
}

/**
 * FileSelector namespace for handling file selection tasks.
 * @namespace
 */
export const FileSelector = {
    /**
     * Open file selector overlay and return the selected file path.
     * @param {string} type - Type of file to display (e.g., "json", "txt").
     * @returns {Promise<string|null>} Resolves with the selected file path or null if closed.
     */
    getFilePath: async function (type) {
        fileType = type;
        fileSelectorMode = 'path';
        currentPath = '/storage/emulated/0/Download';

        fileSelectorDialog.querySelector('.open-system-file').classList.add('hidden');
        fileSelectorDialog.show();
        setupListeners();

        const currentPathElement = document.querySelector('.current-path');
        currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
        currentPathElement.scrollTo({
            left: currentPathElement.scrollWidth,
            behavior: 'smooth'
        });
        await listFiles(currentPath, true);

        return new Promise((resolve) => {
            window.fileSelectorResolve = resolve;
        });
    },

    /**
     * Open file selector overlay and return the content of the selected file.
     * @param {string} type - Type of file to display (e.g., "json", "txt").
     * @returns {Promise<string|null>} Resolves with the file content or null if closed/failed.
     */
    getFileContent: async function (type) {
        fileType = type;
        fileSelectorMode = 'content';
        currentPath = '/storage/emulated/0/Download';

        fileSelectorDialog.querySelector('.open-system-file').classList.remove('hidden');
        fileSelectorDialog.show();
        setupListeners();

        const currentPathElement = document.querySelector('.current-path');
        currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
        currentPathElement.scrollTo({
            left: currentPathElement.scrollWidth,
            behavior: 'smooth'
        });
        await listFiles(currentPath, true);

        return new Promise((resolve) => {
            window.fileSelectorResolve = async (result) => {
                if (result instanceof File) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsText(result);
                } else if (typeof result === 'string' && result !== null) {
                    const execResult = await exec(`cat "${result}"`);
                    if (execResult.errno === 0) {
                        resolve(execResult.stdout);
                    } else {
                        console.error(`Failed to read file content: ${execResult.stderr}`);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
        });
    }
};
