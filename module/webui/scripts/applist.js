import { basePath, execCommand, hideFloatingBtn, appsWithExclamation, appsWithQuestion, toast } from './main.js';

const appTemplate = document.getElementById('app-template').content;
const modeOverlay = document.querySelector('.mode-overlay');
export const appListContainer = document.getElementById('apps-list');
export const updateCard = document.getElementById('update-card');

// Fetch and render applist
export async function fetchAppList() {
    try {
        // fetch target list
        let targetList = [];
        try {
            const targetFileContent = await execCommand('cat /data/adb/tricky_store/target.txt');
            targetList = processTargetList(targetFileContent);
        } catch (error) {
            toast("Failed to read target.txt!");
            console.error("Failed to read target.txt file:", error);
        }

        // fetch applist
        const response = await fetch('applist.json');
        const appList = await response.json();
        const appNameMap = appList.reduce((map, app) => {
            map[app.package_name] = app.app_name;
            return map;
        }, {});

        // Get installed packages first
        let appEntries = [], installedPackages = [];
        try {
            installedPackages = await execCommand(`
                pm list packages -3 | awk -F: '{print $2}'
                [ -s "/data/adb/tricky_store/system_app" ] && SYSTEM_APP=$(cat "/data/adb/tricky_store/system_app" | tr '\n' '|' | sed 's/|*$//') || SYSTEM_APP=""
                [ -z "$SYSTEM_APP" ] || pm list packages -s | awk -F: '{print $2}' | grep -Ex "$SYSTEM_APP" 2>/dev/null || true
            `)
            installedPackages = installedPackages.split("\n").map(line => line.trim()).filter(Boolean);
            appEntries = await Promise.all(installedPackages.map(async packageName => {
                if (appNameMap[packageName]) {
                    return {
                        appName: appNameMap[packageName],
                        packageName
                    };
                }
                const appName = await execCommand(`
                    base_apk=$(pm path ${packageName} | grep "base.apk" | awk -F: '{print $2}')
                    [ -n "$base_apk" ] || base_apk=$(pm path ${packageName} | grep ".apk" | awk -F: '{print $2}')
                    ${basePath}/common/aapt dump badging $base_apk 2>/dev/null | grep "application-label:" | sed "s/application-label://; s/'//g"
                `);
                return {
                    appName: appName.trim() || packageName,
                    packageName
                };
            }));
        } catch (error) {
            appEntries = appList.map(app => ({
                appName: app.app_name,
                packageName: app.package_name
            }));
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
            nameElement.innerHTML = `
                <div class="app-info">
                    <div class="app-name"><strong>${appName}</strong></div>
                    <div class="package-name">${packageName}</div>
                </div>
            `;
            const checkbox = appElement.querySelector(".checkbox");
            checkbox.checked = targetList.includes(packageName);
            appListContainer.appendChild(appElement);
        });
    } catch (error) {
        toast("Failed to fetch app list!");
        console.error("Failed to fetch or render app list with names:", error);
    }
    hideFloatingBtn(false);
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