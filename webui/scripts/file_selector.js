import { exec } from 'kernelsu-alt';

let fileType;

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

    const result = await exec(`
        cd "${path}"
        find . -maxdepth 1 -type f -name "*.${fileType}" -o -type d ! -name ".*" -o -type l | sort
    `);
    if (result.errno === 0) {
        const items = result.stdout.split('\n').filter(Boolean).map(item => ({
            path: path + '/' + item.replace(/^\.\//, ''),
            name: item.split('/').pop(),
            isDirectory: !item.endsWith('.' + fileType),
        }));
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
            backItem.addEventListener('click', () => {
                fileSelectorDialog.querySelector('.back-button').click();
            });
            fileList.appendChild(backItem);
        }
        // Add folder and file file selector
        items.forEach(item => {
            if (item.path === path) return;
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item';
            itemElement.innerHTML = `
                <md-ripple></md-ripple>
                <md-icon>${item.isDirectory ? 'folder' : 'description'}</md-icon>
                <span>${item.name}</span>
            `;
            // Attach click event
            itemElement.addEventListener('click', async () => {
                if (item.isDirectory) {
                    // Go into directory
                    currentPath = item.path;
                    const currentPathElement = document.querySelector('.current-path');
                    currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
                    currentPathElement.scrollTo({
                        left: currentPathElement.scrollWidth,
                        behavior: 'smooth'
                    });
                    await listFiles(item.path);
                }
            });
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

fileSelectorDialog.querySelector('.current-path').addEventListener('click', async (event) => {
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
});

// Back button
fileSelectorDialog.querySelector('.back-button').addEventListener('click', async () => {
    if (currentPath === '/storage/emulated/0') return;
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    if (currentPath === '') currentPath = '/storage/emulated/0';
    const currentPathElement = fileSelectorDialog.querySelector('.current-path');
    currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
    currentPathElement.scrollTo({
        left: currentPathElement.scrollWidth,
        behavior: 'smooth'
    });
    await listFiles(currentPath);
});

// Close file selector overlay
fileSelectorDialog.querySelector('.close-selector').addEventListener('click', () => fileSelectorDialog.close());

/**
 * Open file selector overlay
 * @param {string} type - Type of file to display
 * @returns {Promise<string>} Resolves with the content of the selected file
 */
export async function openFileSelector(type) {
    fileType = type;
    currentPath = '/storage/emulated/0/Download';

    fileSelectorDialog.show();

    const currentPathElement = fileSelectorDialog.querySelector('.current-path');
    currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
    currentPathElement.scrollTo({
        left: currentPathElement.scrollWidth,
        behavior: 'smooth'
    });
    await listFiles(currentPath, true);

    // Return a promise that resolves with the selected file content
    return new Promise((resolve, reject) => {
        const fileList = fileSelectorDialog.querySelector('.file-list');
        fileList.addEventListener('click', (event) => {
            const item = event.target.closest('.file-item');
            if (item && item.querySelector('span').textContent.endsWith('.' + fileType)) {
                exec(`cat "${currentPath}/${item.querySelector('span').textContent}"`)
                    .then(({ errno, stdout, stderr }) => {
                        errno === 0 ? resolve(stdout) : reject(stderr);
                        fileSelectorDialog.close();
                    });
            }
        });
    });
}
