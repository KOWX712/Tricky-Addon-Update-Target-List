import { exec, spawn, toast } from './assets/kernelsu.js';
import { basePath, loadingIndicator, hideFloatingBtn, appsWithExclamation, appsWithQuestion, applyRippleEffect } from './main.js';

const appTemplate = document.getElementById('app-template').content;
const modeOverlay = document.querySelector('.mode-overlay');
export const appListContainer = document.getElementById('apps-list');
export const updateCard = document.getElementById('update-card');

let targetList = [];
let wrapInputStream;

if (typeof $packageManager !== 'undefined') {
    import("https://mui.kernelsu.org/internal/assets/ext/wrapInputStream.mjs")
        .then(module => {
            wrapInputStream = module.wrapInputStream;
        })
        .catch(err => {
            console.error("Failed to load wrapInputStream:", err);
        });
}

// Fetch and render applist
export async function fetchAppList() {
    // fetch target list
    await exec('cat /data/adb/tricky_store/target.txt')
        .then(({ errno, stdout }) => {
            if (errno === 0) {
                targetList = processTargetList(stdout);
            } else {
                toast("Failed to read target.txt!");
            }
        });

    // Fetch cached applist
    const response = await fetch('applist.json');
    const appList = await response.json();
    const appNameMap = appList.reduce((map, app) => {
        map[app.package_name] = app.app_name;
        return map;
    }, {});

    // Get installed packages
    let appEntries = [], installedPackages = [];
    const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--applist']);
    output.stdout.on('data', (data) => {
        if (data.trim() === "") return;
        installedPackages.push(data);
    });
    output.on('exit', async () => {
        // Create appEntries array contain { appName, packageName }
        appEntries = await Promise.all(installedPackages.map(async (packageName) => {
            if (appNameMap[packageName]) {
                return {
                    appName: appNameMap[packageName],
                    packageName
                };
            }
            if (typeof $packageManager !== 'undefined') {
                const info = $packageManager.getApplicationInfo(packageName, 0, 0);
                return {
                    appName: info.getLabel(),
                    packageName
                };
            }
            return new Promise((resolve) => {
                const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--appname', packageName],
                                { env: { PATH: `$PATH:${basePath}/common:/data/data/com.termux/files/usr/bin` } });
                output.stdout.on('data', (data) => {
                    resolve({
                        appName: data,
                        packageName
                    });
                });
            });
        }));
        renderAppList(appEntries);
    });
}

/**
 * Render processed app list to the UI
 * @param {Array} data - Array of objects containing appName and packageName
 * @returns {void}
 */
function renderAppList(data) {
    // Sort
    const sortedApps = data.sort((a, b) => {
        const aChecked = targetList.includes(a.packageName);
        const bChecked = targetList.includes(b.packageName);
        if (aChecked !== bChecked) {
            return aChecked ? -1 : 1;
        }
        return (a.appName || "").localeCompare(b.appName || "");
    });

    // Clear container
    appListContainer.innerHTML = "";
    loadingIndicator.style.display = "none";
    hideFloatingBtn(false);
    if (updateCard) appListContainer.appendChild(updateCard);

    // Append app
    const appendApps = (index) => {
        if (index >= sortedApps.length) {
            document.querySelector('.uninstall-container').classList.remove('hidden-uninstall');
            toggleableCheckbox();
            setupRadioButtonListeners();
            setupModeMenu();
            updateCheckboxColor();
            applyRippleEffect();
            if (typeof $packageManager !== 'undefined') {
                setupIconIntersectionObserver();
            }
            return;
        }

        const { appName, packageName } = sortedApps[index];
        const appElement = document.importNode(appTemplate, true);
        const contentElement = appElement.querySelector(".content");
        contentElement.setAttribute("data-package", packageName);

        // Set unique names for radio button groups
        const radioButtons = appElement.querySelectorAll('input[type="radio"]');
        radioButtons.forEach((radio) => {
            radio.name = `mode-radio-${packageName}`;
        });

        // Preselect the radio button based on the package name
        const generateRadio = appElement.querySelector('#generate-mode');
        const hackRadio = appElement.querySelector('#hack-mode');
        const normalRadio = appElement.querySelector('#normal-mode');

        if (appsWithExclamation.includes(packageName)) {
            generateRadio.checked = true;
        } else if (appsWithQuestion.includes(packageName)) {
            hackRadio.checked = true;
        } else {
            normalRadio.checked = true;
        }

        const nameElement = appElement.querySelector(".name");
        nameElement.innerHTML = `
            <div class="app-icon-container" style="display:${typeof $packageManager !== 'undefined' ? 'flex' : 'none'};">
                <div class="loader" data-package="${packageName}"></div>
                <img src="" class="app-icon" data-package="${packageName}" />
            </div>
            <div class="app-info">
                <div class="app-name"><strong>${appName}</strong></div>
                <div class="package-name">${packageName}</div>
            </div>
        `;
        const checkbox = appElement.querySelector(".checkbox");
        checkbox.checked = targetList.includes(packageName);
        appListContainer.appendChild(appElement);
        appendApps(index + 1);
    };

    appendApps(0);
}

/**
 * Sets up an IntersectionObserver to load app icons when they enter the viewport
 */
function setupIconIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const container = entry.target;
                const packageName = container.querySelector('.app-icon').getAttribute('data-package');
                if (packageName) {
                    loadIcons(packageName);
                    observer.unobserve(container);
                }
            }
        });
    }, {
        rootMargin: '100px',
        threshold: 0.1
    });

    const iconContainers = document.querySelectorAll('.app-icon-container');
    iconContainers.forEach(container => {
        observer.observe(container);
    });
}

const iconCache = new Map();

/**
 * Load all app icons asynchronously after UI is rendered
 * @param {Array<string>} packageName - package names to load icons for
 */
function loadIcons(packageName) {
    const imgElement = document.querySelector(`.app-icon[data-package="${packageName}"]`);
    const loader = document.querySelector(`.loader[data-package="${packageName}"]`);

    if (iconCache.has(packageName)) {
        imgElement.src = iconCache.get(packageName);
        loader.style.display = 'none';
        imgElement.style.opacity = '1';
    } else {
        const stream = $packageManager.getApplicationIcon(packageName, 0, 0);
        wrapInputStream(stream)
            .then(r =>  r.arrayBuffer())
            .then(buffer => {
                const base64 = 'data:image/png;base64,' + arrayBufferToBase64(buffer);
                iconCache.set(packageName, base64);
                imgElement.src = base64;
                loader.style.display = 'none';
                imgElement.style.opacity = '1';
            })
    }
}

/**
 * convert array buffer to base 64
 * @param {string} buffer 
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    uint8Array.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
}

// Function to save app with ! and ? then process target list
function processTargetList(targetFileContent) {
    appsWithExclamation.length = 0;
    appsWithQuestion.length = 0;
    const targetList = targetFileContent
        .split("\n")
        .map(app => {
            const trimmedApp = app.trim();
            if (trimmedApp.endsWith('!')) {
                appsWithExclamation.push(trimmedApp.slice(0, -1));
            } else if (trimmedApp.endsWith('?')) {
                appsWithQuestion.push(trimmedApp.slice(0, -1));
            }
            return trimmedApp.replace(/[!?]/g, '');
        })
        .filter(app => app.trim() !== '');
    return targetList;
}

// Make checkboxes toggleable
function toggleableCheckbox() {
    const appElements = appListContainer.querySelectorAll(".card");
    appElements.forEach(card => {
        const content = card.querySelector(".content");
        const checkbox = content.querySelector(".checkbox");
        content.addEventListener("click", (event) => {
            checkbox.checked = !checkbox.checked;
        });
    });
}

// Add eventlistener to mode button
function setupRadioButtonListeners() {
    const radioButtons = appListContainer.querySelectorAll('input[type="radio"]');
    radioButtons.forEach((radioButton) => {
        radioButton.addEventListener('change', (event) => {
            const card = radioButton.closest(".card");
            const packageName = card.querySelector(".content").getAttribute("data-package");
            if (radioButton.id === 'generate-mode') {
                if (!appsWithExclamation.includes(packageName)) {
                    appsWithExclamation.push(packageName);
                }
                const indexInQuestion = appsWithQuestion.indexOf(packageName);
                if (indexInQuestion > -1) {
                    appsWithQuestion.splice(indexInQuestion, 1);
                }
            } else if (radioButton.id === 'hack-mode') {
                if (!appsWithQuestion.includes(packageName)) {
                    appsWithQuestion.push(packageName);
                }
                const indexInExclamation = appsWithExclamation.indexOf(packageName);
                if (indexInExclamation > -1) {
                    appsWithExclamation.splice(indexInExclamation, 1);
                }
            } else if (radioButton.id === 'normal-mode') {
                const indexInExclamation = appsWithExclamation.indexOf(packageName);
                if (indexInExclamation > -1) {
                    appsWithExclamation.splice(indexInExclamation, 1);
                }
                const indexInQuestion = appsWithQuestion.indexOf(packageName);
                if (indexInQuestion > -1) {
                    appsWithQuestion.splice(indexInQuestion, 1);
                }
            }
            updateCheckboxColor();
            console.log("Updated appsWithExclamation:", appsWithExclamation);
            console.log("Updated appsWithQuestion:", appsWithQuestion);
        });
    });
}

// Hold to open menu
function setupModeMenu() {
    let holdTimeout;
    function showMode(card) {
        const modeElement = card.querySelector(".mode");
        if (modeElement) {
            modeElement.style.display = "flex";
            modeOverlay.style.display = "flex";
            setTimeout(() => {
                modeElement.classList.add('show');
            }, 10);
        }
    }
    function hideAllModes() {
        const allModeElements = appListContainer.querySelectorAll(".mode");
        allModeElements.forEach((modeElement) => {
            modeElement.classList.remove('show');
            modeOverlay.style.display = "none";
            setTimeout(() => {
                modeElement.style.display = "none";
            }, 200);
        });
    }

    const cards = appListContainer.querySelectorAll(".card");
    cards.forEach((card) => {
        card.addEventListener("pointerdown", () => {
            const checkbox = card.querySelector(".checkbox");
            if (checkbox && checkbox.checked) {
                holdTimeout = setTimeout(() => {
                    showMode(card);
                }, 500);
            }
        });
        card.addEventListener("pointerup", () => clearTimeout(holdTimeout));
        card.addEventListener("pointercancel", () => clearTimeout(holdTimeout));
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".mode") || modeOverlay.contains(event.target)) {
            hideAllModes();
        } else if (event.target.closest(".status-indicator")) {
            setTimeout(() => {
                hideAllModes();
            }, 300);
        }
    });
    window.addEventListener("scroll", hideAllModes);
}

// Function to update card borders color
function updateCheckboxColor() {
    const cards = appListContainer.querySelectorAll(".card");
    cards.forEach((card) => {
        const packageName = card.querySelector(".content").getAttribute("data-package");
        const checkbox = card.querySelector(".checkbox");
        checkbox.classList.remove("checkbox-checked-generate", "checkbox-checked-hack");
        if (appsWithExclamation.includes(packageName)) {
            checkbox.classList.add("checkbox-checked-generate");
        } else if (appsWithQuestion.includes(packageName)) {
            checkbox.classList.add("checkbox-checked-hack");
        } else if (checkbox.checked) {
            checkbox.classList.remove("checkbox-checked-generate", "checkbox-checked-hack");
        }
    });
}
