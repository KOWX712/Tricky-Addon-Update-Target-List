import { basePath, execCommand, floatingBtn, appsWithExclamation, appsWithQuestion, toast } from './main.js';

const appTemplate = document.getElementById('app-template').content;
const modeOverlay = document.querySelector('.mode-overlay');
export const appListContainer = document.getElementById('apps-list');
export const updateCard = document.getElementById('update-card');
export let modeActive = false;

// Fetch and render applist
export async function fetchAppList() {
    try {
        let targetList = [];
        try {
            const targetFileContent = await execCommand('cat /data/adb/tricky_store/target.txt');
            targetList = processTargetList(targetFileContent);
            console.log("Current target list:", targetList);
        } catch (error) {
            toast("Failed to read target.txt!");
            console.error("Failed to read target.txt file:", error);
        }

        let applistMap = {};
        try {
            const applistResult = await execCommand(`cat ${basePath}common/tmp/applist`);
            applistMap = applistResult
                .split("\n")
                .reduce((map, line) => {
                    const match = line.match(/app-name:\s*(.+),\s*package-name:\s*(.+)/);
                    if (match) {
                        const appName = match[1].trim();
                        const packageName = match[2].trim();
                        map[packageName] = appName;
                    }
                    return map;
                }, {});
            console.log("Applist loaded successfully.");
        } catch (error) {
            console.warn("Applist file not found or could not be loaded. Skipping applist lookup.");
        }

        const result = await execCommand('pm list packages -3; pm path com.google.android.gms; pm path com.google.android.gsf; pm path com.android.vending >/dev/null 2>&1 && echo "package:com.google.android.gms" && echo "package:com.google.android.gsf" && echo "package:com.android.vending" || true');
        const appEntries = result
            .split("\n")
            .map(line => {
                const packageName = line.replace("package:", "").trim();
                const appName = applistMap[packageName] || null;
                return { appName, packageName };
            })
            .filter(entry => entry.packageName);
        for (const entry of appEntries) {
            if (!entry.appName) {
                try {
                    const apkPath = await execCommand(`pm path ${entry.packageName} | grep "base.apk" | awk -F: '{print $2}' | tr -d '\\r'`);
                    if (apkPath) {
                        const appName = await execCommand(`${basePath}common/aapt dump badging ${apkPath.trim()} 2>/dev/null | grep "application-label:" | sed "s/application-label://; s/'//g"`);
                        entry.appName = appName.trim() || "Unknown App";
                    } else {
                        entry.appName = "Unknown App";
                    }
                } catch (error) {
                    entry.appName = "Unknown App";
                }
            }
        }

        // Sort
        const sortedApps = appEntries.sort((a, b) => {
            const aChecked = targetList.includes(a.packageName);
            const bChecked = targetList.includes(b.packageName);
            if (aChecked !== bChecked) {
                return aChecked ? -1 : 1;
            }
            return (a.appName || "").localeCompare(b.appName || "");
        });

        // Render
        appListContainer.innerHTML = "";
        sortedApps.forEach(({ appName, packageName }) => {
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
            nameElement.innerHTML = `<strong>${appName || "Unknown App"}</strong><br>${packageName}`;
            const checkbox = appElement.querySelector(".checkbox");
            checkbox.checked = targetList.includes(packageName);
            appListContainer.appendChild(appElement);
        });
        console.log("App list with names and packages rendered successfully.");
    } catch (error) {
        toast("Failed to fetch app list!");
        console.error("Failed to fetch or render app list with names:", error);
    }
    floatingBtn.style.transform = 'translateY(0)';
    toggleableCheckbox();
    if (appListContainer.firstChild !== updateCard) {
        appListContainer.insertBefore(updateCard, appListContainer.firstChild);
    }
    const checkboxes = appListContainer.querySelectorAll(".checkbox");
    setupRadioButtonListeners();
    setupModeMenu();
    updateCheckboxColor();
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
            modeActive = true;
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
            modeActive = false;
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