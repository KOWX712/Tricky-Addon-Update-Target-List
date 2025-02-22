import { basePath, execCommand, showPrompt, toast, applyRippleEffect } from './main.js';

// Function to check or uncheck all app
function toggleCheckboxes(shouldCheck) {
    document.querySelectorAll(".card").forEach(card => {
        if (card.style.display !== "none") {
            card.querySelector(".checkbox").checked = shouldCheck;
        }
    });
}

// Function to select all visible apps
document.getElementById("select-all").addEventListener("click", () => toggleCheckboxes(true));

// Function to deselect all visible apps
document.getElementById("deselect-all").addEventListener("click", () => toggleCheckboxes(false));

// Function to read the denylist and check corresponding apps
document.getElementById("select-denylist").addEventListener("click", async () => {
    try {
        const result = await execCommand(`magisk --denylist ls 2>/dev/null | awk -F'|' '{print $1}' | grep -v "isolated" | sort -u`);
        const denylistApps = result.split("\n").map(app => app.trim()).filter(Boolean);
        const apps = document.querySelectorAll(".card");
        apps.forEach(app => {
            const contentElement = app.querySelector(".content");
            const packageName = contentElement.getAttribute("data-package");
            const checkbox = app.querySelector(".checkbox");
            if (denylistApps.includes(packageName)) {
                checkbox.checked = true;
            }
        });
        await execCommand('touch "/data/adb/tricky_store/target_from_denylist"');
        console.log("Denylist apps selected successfully.");
    } catch (error) {
        toast("Failed to read DenyList!");
        console.error("Failed to select Denylist apps:", error);
    }
});

// Function to read the exclude list and uncheck corresponding apps
document.getElementById("deselect-unnecessary").addEventListener("click", async () => {
    try {
        const fileCheck = await execCommand(`[ -f ${basePath}common/tmp/exclude-list ] || echo "false"`);
        if (fileCheck.trim() === "false") {
            fetch("https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/more-exclude.json")
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const excludeList = data.data
                        .flatMap(category => category.apps)
                        .map(app => app['package-name'])
                        .join('\n');
                    return excludeList;
                })
                .then(async excludeList => {
                    await execCommand(`
                        echo "${excludeList}" > ${basePath}common/tmp/exclude-list
                        sh ${basePath}common/get_extra.sh --xposed
                    `);
                })
                .catch(error => {
                    toast("Failed to download unnecessary apps!");
                });
        } else {
            await execCommand(`sh ${basePath}common/get_extra.sh --xposed`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await execCommand(`cat ${basePath}common/tmp/exclude-list`);
        const UnnecessaryApps = result.split("\n").map(app => app.trim()).filter(Boolean);
        const apps = document.querySelectorAll(".card");
        apps.forEach(app => {
            const contentElement = app.querySelector(".content");
            const packageName = contentElement.getAttribute("data-package");
            const checkbox = app.querySelector(".checkbox");
            if (UnnecessaryApps.includes(packageName)) {
                checkbox.checked = false;
            }
        });
        console.log("Unnecessary apps deselected successfully.");
    } catch (error) {
        toast("Failed to get unnecessary apps!");
        console.error("Failed to get unnecessary apps:", error);
    }
});

// Function to backup previous keybox and set new keybox
async function setKeybox(content) {
    try {
        await execCommand(`
            mv -f /data/adb/tricky_store/keybox.xml /data/adb/tricky_store/keybox.xml.bak 2>/dev/null
            echo '${content}' > /data/adb/tricky_store/keybox.xml
            chmod 644 /data/adb/tricky_store/keybox.xml
            `);
        return true;
    } catch (error) {
        console.error("Failed to set keybox:", error);
        return false;
    }
}

// Function to replace aosp kb
export async function aospkb() {
    const source = await execCommand(`xxd -r -p ${basePath}common/.default | base64 -d`);
    const result = await setKeybox(source);
    if (result) {
        console.log("AOSP keybox copied successfully.");
        showPrompt("prompt.aosp_key_set");
    } else {
        showPrompt("prompt.key_set_error", false);
    }
}

// Function to replace valid kb
document.getElementById("validkb").addEventListener("click", async () => {
    fetch("https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/.extra")
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(async data => {
        if (!data.trim()) {
            await aospkb();
            showPrompt("prompt.no_valid_fallback", false);
            return;
        }
        try {
            const hexBytes = new Uint8Array(data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const decodedHex = new TextDecoder().decode(hexBytes);
            const source = atob(decodedHex);
            const result = await setKeybox(source);
            if (result) {
                showPrompt("prompt.valid_key_set");
            } else {
                throw new Error("Failed to copy valid keybox");
            }
        } catch (error) {
            throw new Error("Failed to decode keybox data");
        }
    })
    .catch(async error => {
        showPrompt("prompt.no_internet", false);
    });
});

// Add file selector dialog elements dynamically
const fileSelector = document.createElement('div');
fileSelector.className = 'file-selector-overlay';
fileSelector.innerHTML = `
    <div class="file-selector">
        <div class="file-selector-header">
            <button class="back-button">
                <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M400-80 0-480l400-400 56 57-343 343 343 343-56 57Z"/></svg>
            </button>
            <div class="current-path">/storage/emulated/0/Download</div>
            <button class="close-selector">&#x2715;</button>
        </div>
        <div class="file-list"></div>
    </div>
`;
document.body.appendChild(fileSelector);

// Add styles for animations
const style = document.createElement('style');
style.textContent = `
    .file-selector-overlay {
        transition: opacity 0.3s ease;
        opacity: 0;
    }
    .file-selector-overlay.visible {
        opacity: 1;
    }
    .file-list {
        transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .file-list.switching {
        transform: scale(0.95);
        opacity: 0;
    }
`;
document.head.appendChild(style);

let currentPath = '/storage/emulated/0/Download';

function updateCurrentPath() {
    const currentPathElement = document.querySelector('.current-path');
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

// Function to list files in directory
async function listFiles(path, skipAnimation = false) {
    const fileList = document.querySelector('.file-list');
    if (!skipAnimation) {
        fileList.classList.add('switching');
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    try {
        const result = await execCommand(`find "${path}" -maxdepth 1 -type f -name "*.xml" -o -type d ! -name ".*" | sort`);
        const items = result.split('\n').filter(Boolean).map(item => ({
            path: item,
            name: item.split('/').pop(),
            isDirectory: !item.endsWith('.xml')
        }));
        fileList.innerHTML = '';

        // Add back button item if not in root directory
        if (currentPath !== '/storage/emulated/0') {
            const backItem = document.createElement('div');
            backItem.className = 'file-item';
            backItem.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                    <path d="M141-160q-24 0-42-18.5T81-220v-520q0-23 18-41.5t42-18.5h280l60 60h340q23 0 41.5 18.5T881-680v460q0 23-18.5 41.5T821-160H141Z"/>
                </svg>
                <span>..</span>
            `;
            backItem.addEventListener('click', async () => {
                currentPath = currentPath.split('/').slice(0, -1).join('/');
                if (currentPath === '') currentPath = '/storage/emulated/0';
                const currentPathElement = document.querySelector('.current-path');
                currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
                currentPathElement.scrollTo({ 
                    left: currentPathElement.scrollWidth,
                    behavior: 'smooth'
                });
                await listFiles(currentPath);
            });
            
            fileList.appendChild(backItem);
        }
        items.forEach(item => {
            if (item.path === path) return;
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item';
            itemElement.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                    ${item.isDirectory ? 
                        '<path d="M141-160q-24 0-42-18.5T81-220v-520q0-23 18-41.5t42-18.5h280l60 60h340q23 0 41.5 18.5T881-680v460q0 23-18.5 41.5T821-160H141Z"/>' :
                        '<path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/>'}
                </svg>
                <span>${item.name}</span>
            `;
            itemElement.addEventListener('click', async () => {
                if (item.isDirectory) {
                    currentPath = item.path;
                    const currentPathElement = document.querySelector('.current-path');
                    currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
                    currentPathElement.scrollTo({ 
                        left: currentPathElement.scrollWidth,
                        behavior: 'smooth'
                    });
                    await listFiles(item.path);
                } else {
                    const source = await execCommand(`cat "${item.path}"`);
                    const result = await setKeybox(source);
                    if (result) {
                        fileSelector.style.display = 'none';
                        showPrompt('prompt.custom_key_set');
                    } else {
                        showPrompt('prompt.custom_key_set_error');
                    }
                }
            });
            fileList.appendChild(itemElement);
        });
        
        if (!skipAnimation) {
            fileList.classList.remove('switching');
        }
    } catch (error) {
        console.error('Error listing files:', error);
        if (!skipAnimation) {
            fileList.classList.remove('switching');
        }
    }
    applyRippleEffect();
    updateCurrentPath();
}

// Update click handler to use data-path attribute
document.querySelector('.current-path').addEventListener('click', async (event) => {
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

// Back button handler
document.querySelector('.back-button').addEventListener('click', async () => {
    if (currentPath === '/storage/emulated/0') return;
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    if (currentPath === '') currentPath = '/storage/emulated/0';
    const currentPathElement = document.querySelector('.current-path');
    currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
    currentPathElement.scrollTo({ 
        left: currentPathElement.scrollWidth,
        behavior: 'smooth'
    });
    await listFiles(currentPath);
});

// Close custom keybox selector
document.querySelector('.close-selector').addEventListener('click', () => {
    fileSelector.classList.remove('visible');
    document.body.classList.remove("no-scroll");
    setTimeout(() => {
        fileSelector.style.display = 'none';
    }, 300);
});
fileSelector.addEventListener('click', (event) => {
    if (event.target === fileSelector) {
        fileSelector.classList.remove('visible');
        document.body.classList.remove("no-scroll");
        setTimeout(() => {
            fileSelector.style.display = 'none';
        }, 300);
    }
});

// Open custom keybox selector
document.getElementById('customkb').addEventListener('click', async () => {
    fileSelector.style.display = 'flex';
    document.body.classList.add("no-scroll");
    fileSelector.offsetHeight;
    fileSelector.classList.add('visible');
    currentPath = '/storage/emulated/0/Download';
    const currentPathElement = document.querySelector('.current-path');
    currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
    currentPathElement.scrollTo({ 
        left: currentPathElement.scrollWidth,
        behavior: 'smooth'
    });
    await listFiles(currentPath, true);
});
