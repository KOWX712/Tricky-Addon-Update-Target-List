import { appListContainer, fetchAppList } from './applist.js';
import { loadTranslations, setupLanguageMenu, translations } from './language.js';
import { setupSystemAppMenu } from './menu_option.js';
import { searchMenuContainer, searchInput, clearBtn, setupMenuToggle } from './search_menu.js';
import { updateCheck } from './update.js';
import { securityPatch } from './security_patch.js';

// Header Elements
const title = document.querySelector('.header');
export const noConnection = document.querySelector('.no-connection');

// Loading, Save and Prompt Elements
const permissionPopup = document.getElementById('permission-popup');
const loadingIndicator = document.querySelector('.loading');
const prompt = document.getElementById('prompt');
const floatingCard = document.querySelector('.floating-card');
const floatingBtn = document.querySelector('.floating-btn');

export let basePath;
export const appsWithExclamation = [];
export const appsWithQuestion = [];
const ADDITIONAL_APPS = [ "android", "com.google.android.gms", "io.github.vvb2060.keyattestation", "io.github.vvb2060.mahoshojo", "icu.nullptr.nativetest" ]; // Always keep default apps in target.txt

// Variables
let e = 0;
let isRefreshing = false;
let MMRL_API = true;

// Function to set basePath
async function getBasePath() {
    try {
        await execCommand('[ -d /data/adb/modules/.TA_utl ]');
        basePath = "/data/adb/modules/.TA_utl"
    } catch (error) {
        basePath = "/data/adb/modules/TA_utl"
    }
}

// Function to load the version from module.prop
async function getModuleVersion() {
    const moduleVersion = document.getElementById('module-version');
    try {
        const version = await execCommand(`grep '^version=' ${basePath}/common/update/module.prop | cut -d'=' -f2`);
        moduleVersion.textContent = version;
    } catch (error) {
        console.error("Failed to read version from module.prop:", error);
    }
}

// Function to refresh app list
export async function refreshAppList() {
    isRefreshing = true;
    title.style.transform = 'translateY(0)';
    searchMenuContainer.style.transform = 'translateY(0)';
    hideFloatingBtn();
    searchInput.value = '';
    clearBtn.style.display = "none";
    appListContainer.innerHTML = '';
    loadingIndicator.style.display = 'flex';
    document.querySelector('.uninstall-container').classList.add('hidden-uninstall');
    await new Promise(resolve => setTimeout(resolve, 500));
    window.scrollTo(0, 0);
    if (noConnection.style.display === "flex") {
        try {
            updateCheck();
            await execCommand(`[ -f ${basePath}/common/tmp/exclude-list ] && rm -f "${basePath}/common/tmp/exclude-list"`);
        } catch (error) {
            toast("Failed!");
            console.error("Error occurred:", error);
        }
    }
    await fetchAppList();
    applyRippleEffect();
    loadingIndicator.style.display = 'none';
    document.querySelector('.uninstall-container').classList.remove('hidden-uninstall');
    isRefreshing = false;
}

// Function to check tricky store version
async function checkTrickyStoreVersion() {
    const securityPatchElement = document.getElementById('security-patch');
    try {
        const version = await execCommand(`
            TS_version=$(grep "versionCode=" "/data/adb/modules/tricky_store/module.prop" | cut -d'=' -f2)
            [ "$TS_version" -ge 158 ] || echo "NO"
        `);
        if (version.trim() !== "NO") securityPatchElement.style.display = "flex";
    } catch (error) {
        toast("Failed to check Tricky Store version!");
        console.error("Error while checking Tricky Store version:", error);
    }
}

// Function to check if Magisk
async function checkMagisk() {
    const selectDenylistElement = document.getElementById('select-denylist');
    try {
        const magiskEnv = await execCommand(`command -v magisk >/dev/null 2>&1 || echo "NO"`);
        if (magiskEnv.trim() !== "NO") selectDenylistElement.style.display = "flex";
    } catch (error) {
        toast("Failed to check Magisk!");
        console.error("Error while checking denylist conditions:", error);
    }
}

// Function to show the prompt with a success or error message
export function showPrompt(key, isSuccess = true, duration = 3000) {
    const message = key.split('.').reduce((acc, k) => acc && acc[k], translations) || key;
    prompt.textContent = message;
    prompt.classList.toggle('error', !isSuccess);
    if (window.promptTimeout) {
        clearTimeout(window.promptTimeout);
    }
    setTimeout(() => {
        prompt.style.transform = 'translateY(calc((var(--window-inset-bottom, 0px) + 60%) * -1))';
        window.promptTimeout = setTimeout(() => {
            prompt.style.transform = 'translateY(100%)';
        }, duration);
    }, 100);
}

// Function to redirect link on external browser
export async function linkRedirect(link) {
    try {
        await execCommand(`am start -a android.intent.action.VIEW -d ${link}`);
    } catch (error) {
        toast("Failed!");
        console.error('Error redirect link:', error);
    }
}

// Save configure and preserve ! and ? in target.txt
document.getElementById("save").addEventListener("click", async () => {
    const selectedApps = Array.from(appListContainer.querySelectorAll(".checkbox:checked"))
        .map(checkbox => checkbox.closest(".card").querySelector(".content").getAttribute("data-package"));
    let finalAppsList = new Set(selectedApps);
    ADDITIONAL_APPS.forEach(app => {
        finalAppsList.add(app);
    });
    finalAppsList = Array.from(finalAppsList);
    try {
        const modifiedAppsList = finalAppsList.map(app => {
            if (appsWithExclamation.includes(app)) {
                return `${app}!`;
            } else if (appsWithQuestion.includes(app)) {
                return `${app}?`;
            }
            return app;
        });
        const updatedTargetContent = modifiedAppsList.join("\n");
        await execCommand(`echo "${updatedTargetContent}" | sort -u > /data/adb/tricky_store/target.txt`);
        showPrompt("prompt.saved_target");
        for (const app of appsWithExclamation) {
            await execCommand(`sed -i 's/^${app}$/${app}!/' /data/adb/tricky_store/target.txt`);
        }
        for (const app of appsWithQuestion) {
            await execCommand(`sed -i 's/^${app}$/${app}?/' /data/adb/tricky_store/target.txt`);
        }
    } catch (error) {
        console.error("Failed to update target.txt:", error);
        showPrompt("prompt.save_error", false);
    }
    await refreshAppList();
});

// Uninstall WebUI
document.querySelector(".uninstall-container").addEventListener("click", () => {
    const uninstallOverlay = document.getElementById("uninstall-confirmation-overlay");
    const uninstallContent = document.querySelector('.uninstall-confirmation');
    const cancelButton = document.getElementById("cancel-uninstall");
    const confirmButton = document.getElementById("confirm-uninstall")

    uninstallOverlay.style.display = 'flex';
    document.body.classList.add('no-scroll');
    setTimeout(() => {
        uninstallOverlay.style.opacity = 1;
        uninstallContent.classList.add('open');
    }, 10)

    const closeuninstallOverlay = () => {
        document.body.classList.remove('no-scroll');
        uninstallOverlay.style.opacity = 0;
        uninstallContent.classList.remove('open');
        setTimeout(() => {
            uninstallOverlay.style.display = 'none';
        }, 200)
    }
    cancelButton.addEventListener('click', () => closeuninstallOverlay());
    uninstallOverlay.addEventListener('click', (e) => {
        if (e.target === uninstallOverlay) closeuninstallOverlay();
    })
    confirmButton.addEventListener('click', () => {
        closeuninstallOverlay();
        uninstallWebUI();
    })
});
async function uninstallWebUI() {
    try {
        await execCommand(`sh ${basePath}/common/get_extra.sh --uninstall`);
        showPrompt("prompt.uninstall_prompt");
    } catch (error) {
        console.error("Failed to execute uninstall command:", error);
        showPrompt("prompt.uninstall_failed", false);
    }
}

// Function to check if running in MMRL
async function checkMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        // Set status bars theme based on device theme
        try {
            $tricky_store.setLightStatusBars(!window.matchMedia('(prefers-color-scheme: dark)').matches)
        } catch (error) {
            console.error("Error setting status bars theme:", error)
        }

        // Request API permission, supported version: 33045+
        try {
            $tricky_store.requestAdvancedKernelSUAPI();
        } catch (error) {
            console.error("Error requesting API:", error);
        }

        // Check permissions
        try {
            await execCommand('ls /data/adb/modules');
            MMRL_API = true;
        } catch (error) {
            console.error('Permission check failed:', error);
            permissionPopup.style.display = 'flex';
            MMRL_API = false;
        }
    }
}

// Funtion to adapt floating button hide in MMRL
export function hideFloatingBtn(hide = true) {
    if (!hide) floatingCard.style.transform = 'translateY(0)';
    else floatingCard.style.transform = 'translateY(calc(var(--window-inset-bottom, 0px) + 120px))';
}

// Function to apply ripple effect
export function applyRippleEffect() {
    document.querySelectorAll('.ripple-element').forEach(element => {
        if (element.dataset.rippleListener !== "true") {
            element.addEventListener("pointerdown", function (event) {
                if (isScrolling) return;
                const ripple = document.createElement("span");
                ripple.classList.add("ripple");

                // Calculate ripple size and position
                const rect = element.getBoundingClientRect();
                const width = rect.width;
                const size = Math.max(rect.width, rect.height);
                const x = event.clientX - rect.left - size / 2;
                const y = event.clientY - rect.top - size / 2;

                // Determine animation duration
                let duration = 0.2 + (width / 800) * 0.4;
                duration = Math.min(0.8, Math.max(0.2, duration));

                // Set ripple styles
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;
                ripple.style.animationDuration = `${duration}s`;
                ripple.style.transition = `opacity ${duration}s ease`;

                // Adaptive color
                const computedStyle = window.getComputedStyle(element);
                const bgColor = computedStyle.backgroundColor || "rgba(0, 0, 0, 0)";
                const textColor = computedStyle.color;
                const isDarkColor = (color) => {
                    const rgb = color.match(/\d+/g);
                    if (!rgb) return false;
                    const [r, g, b] = rgb.map(Number);
                    return (r * 0.299 + g * 0.587 + b * 0.114) < 96; // Luma formula
                };
                ripple.style.backgroundColor = isDarkColor(bgColor) ? "rgba(255, 255, 255, 0.2)" : "";

                // Append ripple and handle cleanup
                element.appendChild(ripple);
                const handlePointerUp = () => {
                    ripple.classList.add("end");
                    setTimeout(() => {
                        ripple.classList.remove("end");
                        ripple.remove();
                    }, duration * 1000);
                    element.removeEventListener("pointerup", handlePointerUp);
                    element.removeEventListener("pointercancel", handlePointerUp);
                };
                element.addEventListener("pointerup", handlePointerUp);
                element.addEventListener("pointercancel", handlePointerUp);
            });
            element.dataset.rippleListener = "true";
        }
    });
}

// Scroll event
let lastScrollY = window.scrollY;
let isScrolling = false;
let scrollTimeout;
const scrollThreshold = 40;
window.addEventListener('scroll', () => {
    isScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
    }, 200);
    if (isRefreshing) return;
    if (window.scrollY > lastScrollY && window.scrollY > scrollThreshold) {
        title.style.transform = 'translateY(-100%)';
        searchMenuContainer.style.transform = 'translateY(-40px)';
        hideFloatingBtn();
    } else if (window.scrollY < lastScrollY) {
        title.style.transform = 'translateY(0)';
        searchMenuContainer.style.transform = 'translateY(0)';
        hideFloatingBtn(false);
    }
    lastScrollY = window.scrollY;
});

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTranslations();
    await checkMMRL();
    if (!MMRL_API) return;
    await getBasePath();
    hideFloatingBtn();
    getModuleVersion();
    setupMenuToggle();
    setupLanguageMenu();
    setupSystemAppMenu();
    await fetchAppList();
    applyRippleEffect();
    checkTrickyStoreVersion();
    checkMagisk();
    updateCheck();
    securityPatch();
    loadingIndicator.style.display = "none";
    floatingBtn.style.display = 'block';
    hideFloatingBtn(false);
    document.getElementById("refresh").addEventListener("click", refreshAppList);
    document.querySelector('.uninstall-container').classList.remove('hidden-uninstall');
});

// Function to execute shell commands
export async function execCommand(command) {
    return new Promise((resolve, reject) => {
        const callbackName = `exec_callback_${Date.now()}_${e++}`;
        window[callbackName] = (errno, stdout, stderr) => {
            delete window[callbackName];
            if (errno === 0) {
                resolve(stdout);
            } else {
                console.error(`Error executing command: ${stderr}`);
                reject(stderr);
            }
        };
        try {
            ksu.exec(command, "{}", callbackName);
        } catch (error) {
            console.error(`Execution error: ${error}`);
            reject(error);
        }
    });
}

// Function to toast message
export function toast(message) {
    try {
        ksu.toast(message);
    } catch (error) {
        console.error("Failed to show toast:", error);
    }
}