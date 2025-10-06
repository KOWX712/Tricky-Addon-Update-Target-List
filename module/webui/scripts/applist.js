import { exec, spawn, toast, listPackages, getPackagesInfo, getPackagesIcon } from './assets/kernelsu.js';
import { basePath, loadingIndicator, appsWithExclamation, appsWithQuestion } from './main.js';

const appTemplate = document.getElementById('app-template').content;
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
            } else if (typeof ksu === 'undefined') {
                targetList = processTargetList("com.example.one\ncom.example.two!\ncom.example.three?");
            } else {
                toast("Failed to read target.txt!");
            }
        });

    // Fetch cached applist
    let appNameMap = {};
    try {
        const response = await fetch('applist.json');
        const appList = await response.json();
        appNameMap = appList.reduce((map, app) => {
            map[app.package_name] = app.app_name;
            return map;
        }, {});
    } catch (error) {
        if (typeof ksu === 'undefined') {
            appNameMap = {
                "com.example.one": "One",
                "com.example.two": "Two",
                "com.example.three": "Three"
            };
        } else {
            console.warn("Failed to fetch applist.json:", error);
            appNameMap = {};
        }
    }

    // Get installed packages
    let appEntries = [], installedPackages = [];
    const systemApp = await exec('cat "/data/adb/tricky_store/system_app" || true');

    const [userPkgs, systemPkgs] = await Promise.all([
        listPackages('user').catch(() => { return [] }),
        listPackages('system').catch(() => { return [] })
    ]);

    installedPackages.push(...userPkgs);
    systemApp.stdout.split('\n').forEach((pkg) => {
        if (pkg && systemPkgs.includes(pkg)) {
            installedPackages.push(pkg);
        }
    });

    installedPackages = Array.from(new Set(installedPackages));

    if (typeof ksu === 'undefined') {
        installedPackages = [
            "com.example.one",
            "com.example.two",
            "com.example.three",
            "com.example.four",
            "com.example.five",
            "com.example.six"
        ];
    }

    // Create appEntries array contain { appName, packageName }
    appEntries = await Promise.all(installedPackages.map(async (packageName) => {
        // Look from cached result
        if (appNameMap[packageName] && appNameMap[packageName].trim() !== '') {
            return {
                appName: appNameMap[packageName].trim(),
                packageName
            };
        }

        try {
            // KernelSU-Next package manager API
            const info = await getPackagesInfo(packageName);
            return {
                appName: info.appLabel,
                packageName
            };
        } catch (error) {
            // WebUI-X package manager API
            if (typeof $packageManager !== 'undefined') {
                const info = $packageManager.getApplicationInfo(packageName, 0, 0);
                return {
                    appName: info.getLabel(),
                    packageName
                };
            }
            // Fallback with aapt
            return new Promise((resolve) => {
                const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--appname', packageName],
                                { env: { PATH: `$PATH:${basePath}/common/bin:/data/data/com.termux/files/usr/bin` } });
                output.stdout.on('data', (data) => {
                    resolve({
                        appName: data.trim() === '' ? packageName : data.trim(),
                        packageName
                    });
                });
                output.on('exit', (code) => {
                    if (code !== 0) {
                        resolve({ appName: packageName, packageName });
                    }
                });
            });
        }
    }));
    renderAppList(appEntries);
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
    document.querySelector('.floating-btn').classList.remove('hide');
    if (updateCard) appListContainer.appendChild(updateCard);
    let showIcon = false;
    if (typeof $packageManager !== 'undefined' ||(typeof ksu !== 'undefined' && typeof ksu.getPackagesIcons === 'function')) {
        showIcon = true;
    }

    // Append app
    const appendApps = (index) => {
        if (index >= sortedApps.length) {
            document.querySelector('.uninstall-container').style.display = "flex";
            toggleableCheckbox();
            setupModeMenu();
            updateCheckboxColor();
            if (showIcon) setupIconIntersectionObserver();
            return;
        }

        const { appName, packageName } = sortedApps[index];
        const appElement = document.importNode(appTemplate, true);
        const contentElement = appElement.querySelector(".content");
        contentElement.setAttribute("data-package", packageName);
        const nameElement = appElement.querySelector(".name");
        nameElement.setAttribute("for", `checkbox-${packageName}`)
        nameElement.innerHTML = `
            <div class="app-icon-container" style="display:${showIcon ? 'flex' : 'none'};">
                <div class="loader" data-package="${packageName}"></div>
                <img src="" class="app-icon" data-package="${packageName}" />
            </div>
            <div class="app-info">
                <div class="app-name"><strong>${appName}</strong></div>
                <div class="package-name">${packageName}</div>
            </div>
        `;
        const checkbox = appElement.querySelector("md-checkbox");
        checkbox.id = `checkbox-${packageName}`;
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
    } else if (typeof ksu.getPackagesIcons === 'function') {
        getPackagesIcon(packageName, 100).then(app => {
            iconCache.set(packageName, app.icon);
            imgElement.src = app.icon;
            loader.style.display = 'none';
            imgElement.style.opacity = '1';
        }).catch(error => {
            console.error('Failed to load icon:', error);
            loader.style.display = 'none';
        });
    } else if (typeof $packageManager !== 'undefined') {
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

let menuOpen = false;

// Make checkboxes toggleable
function toggleableCheckbox() {
    const appElements = appListContainer.querySelectorAll(".card");
    appElements.forEach(card => {
        const checkbox = card.querySelector(".checkbox");
        card.onclick = () => {
            if (menuOpen) return;
            checkbox.checked = !checkbox.checked;
        };
    });

    // Skip when menu is open
    document.querySelectorAll('md-menu').forEach(menu => {
        if (!menu.dataset.closeListener) { 
            menu.addEventListener('closing', () => menuOpen = true);
            menu.addEventListener('closed', () => menuOpen = false);
            menu.dataset.closeListener = 'true';
        }
    });
}

// Hold to open menu
function setupModeMenu() {
    const modeDialog = document.getElementById('mode-dialog');
    const modeAppName = document.getElementById('mode-dialog-appname');
    let holdTimeout;
    let currentCard = null;

    function openModeDialog(card) {
        currentCard = card;
        const packageName = card.getAttribute('data-package');
        const appNameEl = card.querySelector('.app-name strong');
        const appName = appNameEl ? appNameEl.textContent : packageName;
        modeAppName.innerHTML = `${appName}<br>${packageName}`;

        const isGenerate = appsWithExclamation.includes(packageName);
        const isHack = appsWithQuestion.includes(packageName);
        document.getElementById('mode-default').checked = !isGenerate && !isHack;
        document.getElementById('mode-generate').checked = isGenerate;
        document.getElementById('mode-hack').checked = isHack;

        modeDialog.show();
    }

    function closeDialog(mode) {
        if (!currentCard || !mode) {
            modeDialog.close();
            currentCard = null;
            return;
        }
        const packageName = currentCard.getAttribute('data-package');
        const exIndex = appsWithExclamation.indexOf(packageName);
        if (exIndex > -1) appsWithExclamation.splice(exIndex, 1);
        const qIndex = appsWithQuestion.indexOf(packageName);
        if (qIndex > -1) appsWithQuestion.splice(qIndex, 1);

        if (mode === 'generate') {
            appsWithExclamation.push(packageName);
        } else if (mode === 'hack') {
            appsWithQuestion.push(packageName);
        }
        updateCheckboxColor();
        currentCard = null;
        setTimeout(() => modeDialog.close(), 200);
    }

    // Wire dialog item clicks
    const defaultItem = document.getElementById('mode-default');
    const genItem = document.getElementById('mode-generate');
    const hackItem = document.getElementById('mode-hack');
    defaultItem.addEventListener('click', () => closeDialog('normal'));
    genItem.addEventListener('click', () => closeDialog('generate'));
    hackItem.addEventListener('click', () => closeDialog('hack'));
    document.getElementById('mode-cancel').addEventListener('click', () => closeDialog());

    const cards = appListContainer.querySelectorAll('.card');
    cards.forEach((card) => {
        card.addEventListener('pointerdown', (e) => {
            // only start hold when checkbox is checked
            const checkbox = card.querySelector('md-checkbox');
            if (checkbox && checkbox.checked) {
                holdTimeout = setTimeout(() => openModeDialog(card), 500);
            }
        });
        card.addEventListener('pointerup', () => clearTimeout(holdTimeout));
        card.addEventListener('pointercancel', () => clearTimeout(holdTimeout));
    });
}

// Function to update card borders color
function updateCheckboxColor() {
    const cards = appListContainer.querySelectorAll(".card");
    cards.forEach((card) => {
        const packageName = card.getAttribute("data-package");
        const checkbox = card.querySelector("md-checkbox");
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