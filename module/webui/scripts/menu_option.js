import { basePath, execCommand, showPrompt, toast, applyRippleEffect, refreshAppList } from './main.js';

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
        const excludeList = await fetch("https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/more-exclude.json")
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .catch(async () => {
                return fetch("https://raw.gitmirror.com/KOWX712/Tricky-Addon-Update-Target-List/main/more-exclude.json")
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        return response.json();
                    });
            })
            .then(data => {
                return data.data
                    .flatMap(category => category.apps)
                    .map(app => app['package-name'])
                    .join('\n');
            })
            .catch(error => {
                toast("Failed to download unnecessary apps!");
                throw error;
            });
        const xposed = await execCommand(`sh ${basePath}/common/get_extra.sh --xposed`);
        const UnnecessaryApps = excludeList.split("\n").map(app => app.trim()).filter(Boolean).concat(xposed.split("\n").map(app => app.trim()).filter(Boolean));
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

// Function to add system app
export async function setupSystemAppMenu() {
    document.getElementById("add-system-app").addEventListener("click", () => openSystemAppOverlay());
    document.getElementById("add-system-app-overlay").addEventListener("click", (event) => {
        if (event.target === event.currentTarget) closeSystemAppOverlay();
    });
    const systemAppOverlay = document.getElementById("add-system-app-overlay");
    const systemAppContent = document.querySelector('.add-system-app-card');
    const systemAppInput = document.getElementById("system-app-input");
    function openSystemAppOverlay() {
        renderSystemAppList();
        document.body.classList.add("no-scroll");
        systemAppOverlay.style.display = "flex";
        setTimeout(() => {
            systemAppOverlay.style.opacity = "1";
            systemAppContent.classList.add('open');
        }, 10);
        systemAppInput.value = "";
    }
    function closeSystemAppOverlay() {
        document.body.classList.remove("no-scroll");
        systemAppOverlay.style.opacity = "0";
        systemAppContent.classList.remove('open');
        setTimeout(() => {
            systemAppOverlay.style.display = "none";
        }, 300);
    }

    // Add system app button
    document.getElementById("add-system-app-button").addEventListener("click", async () => {
        const input = document.getElementById("system-app-input");
        const packageName = input.value.trim();
        if (packageName) {
            try {
                const result = await execCommand(`pm list packages -s | grep -q ${packageName} || echo "false"`);
                if (result.includes("false")) {
                    showPrompt("prompt.system_app_not_found", false);
                } else {
                    await execCommand(`
                        touch "/data/adb/tricky_store/system_app"
                        echo "${packageName}" >> "/data/adb/tricky_store/system_app"
                        echo "${packageName}" >> "/data/adb/tricky_store/target.txt"
                    `);
                    systemAppInput.value = "";
                    closeSystemAppOverlay();
                    refreshAppList();
                }
            } catch (error) {
                console.error("Error adding system app:", error);
                showPrompt("prompt.add_system_app_error", false);
            }
        }
    });

    // Display current system app list and remove button
    async function renderSystemAppList() {
        const currentSystemAppList = document.querySelector(".current-system-app-list");
        const currentSystemAppListContent = document.querySelector(".current-system-app-list-content");
        currentSystemAppListContent.innerHTML = "";
        try {
            const systemAppList = await execCommand(`[ -f "/data/adb/tricky_store/system_app" ] && cat "/data/adb/tricky_store/system_app" | sed '/^$/d' || echo "false"`);
            if (systemAppList.trim() === 'false' || systemAppList.trim() === '') {
                currentSystemAppList.style.display = "none";
            } else {
                systemAppList.split("\n").forEach(app => {
                    currentSystemAppListContent.innerHTML += `
                    <div class="system-app-item">
                        <span>${app}</span>
                        <button class="remove-system-app-button ripple-element">
                            <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="#FFFFFF"><path d="M154-412v-136h652v136H154Z"/></svg>
                        </button>
                    </div>
                `;
                });
            }
        } catch (error) {
            currentSystemAppList.style.display = "none";
            console.error("Error displaying system app list:", error);
        }

        const removeSystemAppButtons = document.querySelectorAll(".remove-system-app-button");
        removeSystemAppButtons.forEach(button => {
            button.addEventListener("click", async () => {
                const app = button.closest(".system-app-item").querySelector("span").textContent;
                try {
                    await execCommand(`
                        sed -i "/${app}/d" "/data/adb/tricky_store/system_app" || true
                        sed -i "/${app}/d" "/data/adb/tricky_store/target.txt" || true
                    `);
                    closeSystemAppOverlay();
                    refreshAppList();
                } catch (error) {
                    console.error("Error removing system app:", error);
                }
            });
        });
    }
}

// Function to backup previous keybox and set new keybox
async function setKeybox(content) {
    const sanitizedContent = content.replace(/'/g, "'\\''");
    try {
        await execCommand(`
            mv -f /data/adb/tricky_store/keybox.xml /data/adb/tricky_store/keybox.xml.bak 2>/dev/null
            echo '${sanitizedContent}' > /data/adb/tricky_store/keybox.xml
            chmod 644 /data/adb/tricky_store/keybox.xml
            `);
        return true;
    } catch (error) {
        console.error("Failed to set keybox:", error);
        return false;
    }
}

// Function to replace aosp kb
document.getElementById("aospkb").addEventListener("click", async () => {
    const source = await execCommand(`xxd -r -p ${basePath}/common/.default | base64 -d`);
    const result = await setKeybox(source);
    if (result) {
        console.log("AOSP keybox copied successfully.");
        showPrompt("prompt.aosp_key_set");
    } else {
        showPrompt("prompt.key_set_error", false);
    }
});

// Function to replace valid kb
document.getElementById("validkb").addEventListener("click", async () => {
    fetch("https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/.extra")
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .catch(async () => {
            return fetch("https://raw.gitmirror.com/KOWX712/Tricky-Addon-Update-Target-List/main/.extra")
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.text();
                });
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

// File selector
const fileSelector = document.querySelector('.file-selector-overlay');
const fileSelectorContent = document.querySelector('.file-selector');
let currentPath = '/storage/emulated/0/Download';

// Function to display file in current path
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
            backItem.className = 'file-item ripple-element';
            backItem.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                    <path d="M141-160q-24 0-42-18.5T81-220v-520q0-23 18-41.5t42-18.5h280l60 60h340q23 0 41.5 18.5T881-680v460q0 23-18.5 41.5T821-160H141Z"/>
                </svg>
                <span>..</span>
            `;
            backItem.addEventListener('click', async () => {
                document.querySelector('.back-button').click();
            });
            fileList.appendChild(backItem);
        }
        items.forEach(item => {
            if (item.path === path) return;
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item ripple-element';
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
                        closeCustomKeyboxSelector();
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
    closeCustomKeyboxSelector();
});
fileSelector.addEventListener('click', (event) => {
    if (event.target === fileSelector) {
        closeCustomKeyboxSelector();
    }
});

// Function to close custom keybox selector
function closeCustomKeyboxSelector() {
    fileSelector.style.opacity = '0';
    fileSelectorContent.classList.remove('open');
    document.body.classList.remove("no-scroll");
    setTimeout(() => {
        fileSelector.style.display = 'none';
    }, 300);
}

// Open custom keybox selector
document.getElementById('customkb').addEventListener('click', async () => {
    fileSelector.style.display = 'flex';
    document.body.classList.add("no-scroll");
    setTimeout(() => {
        fileSelector.style.opacity = '1';
        fileSelectorContent.classList.add('open');
    }, 10)
    currentPath = '/storage/emulated/0/Download';
    const currentPathElement = document.querySelector('.current-path');
    currentPathElement.innerHTML = currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>');
    currentPathElement.scrollTo({ 
        left: currentPathElement.scrollWidth,
        behavior: 'smooth'
    });
    await listFiles(currentPath, true);
});
