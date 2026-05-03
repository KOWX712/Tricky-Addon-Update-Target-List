import { wrapInputStream } from 'webuix';
import { exec, toast, listPackages, getPackagesInfo } from 'kernelsu-alt';
import { loadingIndicator, appsWithExclamation, appsWithQuestion, checkSukiSu } from './main.js';
import {
    getPolicy,
    getStoreInfo,
    getTarget,
    getTargetEntries,
    getTargetMode,
    loadConfig,
    parseTargetList,
    removePolicy,
    setPolicy,
    setTargetMode,
    writeConfig
} from './config.js';
import { getString } from './language.js';
import { showPrompt } from './main.js';
import fallbackIcon from '../icon.png';

const appTemplate = document.getElementById('app-template').content;
export const appListContainer = document.querySelector('.app-list');

let targetList = [];

function syncModeStateFromEntries(entries = getTargetEntries()) {
    appsWithExclamation.length = 0;
    appsWithQuestion.length = 0;

    for (const { packageName, mode } of entries) {
        if (mode === 'generate') {
            appsWithExclamation.push(packageName);
        } else if (mode === 'hack') {
            appsWithQuestion.push(packageName);
        }
    }
}

// Fetch and render applist
export async function fetchAppList() {
    try {
        await loadConfig();
        targetList = getTarget();
        syncModeStateFromEntries();
    } catch (error) {
        if (typeof ksu === 'undefined') {
            const targets = parseTargetList("com.example.one\ncom.example.two!\ncom.example.three?");
            targetList = targets.map(target => target.packageName);
            syncModeStateFromEntries(targets);
        } else {
            toast("Failed to read config!");
        }
    }

    // Get installed packages
    let appEntries = [];
    const systemApp = await exec('cat "/data/adb/tricky_store/system_app" || true');

    let installedPkgs = await listPackages('user').catch(() => []);
    const systemPkgs = await listPackages('system').catch(() => []);

    systemApp.stdout.split('\n').forEach((pkg) => {
        if (pkg && systemPkgs.includes(pkg)) {
            installedPkgs.push(pkg);
        }
    });

    if (import.meta.env.DEV) {
        installedPkgs = [
            "com.example.one",
            "com.example.two",
            "com.example.three",
            "com.example.four",
            "com.example.five",
            "com.example.six"
        ];
    }

    // appEntries object: { appName, packageName }
    try {
        if (typeof globalThis.ksu?.getPackagesInfo === 'undefined') {
            throw new Error('No pm api found, fallback to old method');
        }
        const infos = await getPackagesInfo(installedPkgs);
        appEntries = installedPkgs.map((packageName, index) => {
            return {
                appName: infos[index]?.appLabel || packageName,
                packageName
            };
        });
    } catch (error) {
        appEntries = installedPkgs.map(packageName => ({ appName: packageName, packageName }));
    }
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
    let showIcon = false;
    if (typeof globalThis.ksu?.listPackages === 'function') {
        showIcon = true;
    }

    // Append app
    const appendApps = (index) => {
        if (index >= sortedApps.length) {
            document.querySelector('.uninstall-container').style.display = "flex";
            toggleableCheckbox();
            setupModeMenu();
            updateCheckboxColor();
            checkSukiSu();
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
                <img class="app-icon" data-package="${packageName}" />
            </div>
            <div class="app-info">
                <div class="app-name">${appName}</div>
                <div class="package-name">${packageName}</div>
            </div>
        `;
        const checkbox = appElement.querySelector("md-checkbox");
        checkbox.id = `checkbox-${packageName}`;
        if (targetList.includes(packageName)) {
            checkbox.checked = true;
            appElement.querySelector('.card').classList.add('selected');
        }
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

/**
 * Load all app icons asynchronously after UI is rendered
 * @param {Array<string>} packageName - package names to load icons for
 */
function loadIcons(packageName) {
    const imgElement = document.querySelector(`.app-icon[data-package="${packageName}"]`);
    const loader = document.querySelector(`.loader[data-package="${packageName}"]`);

    imgElement.onload = () => {
        loader.style.display = 'none';
        imgElement.style.opacity = '1';
    }
    imgElement.onerror = () => {
        imgElement.src = fallbackIcon;
        loader.style.display = 'none';
        imgElement.style.opacity = '1';
    }

    if (typeof $packageManager !== 'undefined') {
        const stream = $packageManager.getApplicationIcon(packageName, 0, 0);
        wrapInputStream(stream)
            .then(r => r.arrayBuffer())
            .then(buffer => {
                const base64 = 'data:image/png;base64,' + arrayBufferToBase64(buffer);
                imgElement.src = base64;
                loader.style.display = 'none';
                imgElement.style.opacity = '1';
            })
    } else if (typeof globalThis.ksu?.getPackagesInfo === 'function') {
        imgElement.src = "ksu://icon/" + packageName;
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

function normalizePolicyInput(value) {
    return value.trim().replace(/-/g, '');
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
            card.classList.toggle('selected');
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
    const modePolicySection = document.getElementById('mode-policy-section');
    const modePolicyToggle = document.getElementById('mode-policy-toggle');
    const modePolicyFields = document.getElementById('mode-policy-fields');
    const modePolicyOs = document.getElementById('mode-policy-os');
    const modePolicyVendor = document.getElementById('mode-policy-vendor');
    const modePolicyBoot = document.getElementById('mode-policy-boot');
    let currentCard = null;
    let customPolicyEnabled = false;

    function updatePolicyToggleLabel() {
        modePolicyToggle.textContent = getString(customPolicyEnabled ? 'mode_use_default_policy' : 'mode_set_custom_policy');
    }

    function setCustomPolicyState(enabled) {
        customPolicyEnabled = enabled;
        modePolicyFields.classList.toggle('hidden', !enabled);
        updatePolicyToggleLabel();
        if (!enabled) {
            modePolicyOs.value = '';
            modePolicyVendor.value = '';
            modePolicyBoot.value = '';
        }
    }

    function openModeDialog(card) {
        currentCard = card;
        const packageName = card.getAttribute('data-package');
        const appNameEl = card.querySelector('.app-name');
        const appName = appNameEl ? appNameEl.textContent : packageName;
        modeAppName.innerHTML = `${appName}<br>${packageName}`;

        const isGenerate = appsWithExclamation.includes(packageName);
        const isHack = appsWithQuestion.includes(packageName);
        document.getElementById('mode-default').checked = !isGenerate && !isHack;
        document.getElementById('mode-generate').checked = isGenerate;
        document.getElementById('mode-hack').checked = isHack;

        const usesConfigIni = getStoreInfo().usesConfigIni;
        modePolicySection.classList.toggle('hidden', !usesConfigIni);
        const override = usesConfigIni ? getPolicy(packageName) : null;
        modePolicyOs.value = override?.os_patch || '';
        modePolicyVendor.value = override?.vendor_patch || '';
        modePolicyBoot.value = override?.boot_patch || '';
        setCustomPolicyState(Boolean(override));

        modeDialog.show();
    }

    async function closeDialog(shouldSave = false) {
        if (!currentCard || !shouldSave) {
            modeDialog.close();
            currentCard = null;
            return;
        }

        const packageName = currentCard.getAttribute('data-package');

        if (document.getElementById('mode-generate').checked) {
            setTargetMode(packageName, 'generate');
        } else if (document.getElementById('mode-hack').checked) {
            setTargetMode(packageName, 'hack');
        } else {
            setTargetMode(packageName, 'auto');
        }

        if (!modePolicySection.classList.contains('hidden')) {
            if (customPolicyEnabled) {
                setPolicy(packageName, {
                    os_patch: normalizePolicyInput(modePolicyOs.value),
                    vendor_patch: normalizePolicyInput(modePolicyVendor.value),
                    boot_patch: normalizePolicyInput(modePolicyBoot.value)
                });
            } else {
                removePolicy(packageName);
            }
        }

        syncModeStateFromEntries();
        updateCheckboxColor();
        const { errno } = await writeConfig();
        showPrompt(getString(errno === 0 ? 'prompt_saved_target' : 'prompt_save_error'), errno === 0);
        currentCard = null;
        modeDialog.close();
    }

    if (modeDialog.dataset.initialized !== 'true') {
        modePolicyToggle.addEventListener('click', () => {
            setCustomPolicyState(!customPolicyEnabled);
        });
        document.getElementById('mode-cancel').addEventListener('click', () => closeDialog(false));
        document.getElementById('mode-save').addEventListener('click', () => closeDialog(true));
        modeDialog.dataset.initialized = 'true';
    }

    const cards = appListContainer.querySelectorAll('.card');
    cards.forEach((card) => {
        card.addEventListener('contextmenu', (e) => {
            // only open menu when checkbox is checked
            const checkbox = card.querySelector('md-checkbox');
            if (checkbox && checkbox.checked) {
                e.preventDefault();
                openModeDialog(card);
            }
        });
    });
}

// Function to update card borders color
function updateCheckboxColor() {
    const cards = appListContainer.querySelectorAll(".card");
    cards.forEach((card) => {
        const packageName = card.getAttribute("data-package");
        const checkbox = card.querySelector("md-checkbox");
        checkbox.classList.remove("checkbox-checked-generate", "checkbox-checked-hack");
        if (getTargetMode(packageName) === 'generate') {
            checkbox.classList.add("checkbox-checked-generate");
        } else if (getTargetMode(packageName) === 'hack') {
            checkbox.classList.add("checkbox-checked-hack");
        } else if (checkbox.checked) {
            checkbox.classList.remove("checkbox-checked-generate", "checkbox-checked-hack");
        }
    });
}
