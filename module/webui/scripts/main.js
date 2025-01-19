import { appListContainer, fetchAppList, modeActive } from './applist.js';
import { initializeAvailableLanguages, detectUserLanguage, loadTranslations, setupLanguageMenu, translations } from './language.js';
import { aospkb } from './menu_option.js';
import { searchMenuContainer, searchInput, clearBtn, setupMenuToggle } from './search_menu.js';
import { updateCheck } from './update.js';

// Header Elements
const headerBlock = document.querySelector('.header-block');
const title = document.querySelector('.header');
export const noConnection = document.querySelector('.no-connection');

// Loading, Save and Prompt Elements
const loadingIndicator = document.querySelector('.loading');
const prompt = document.getElementById('prompt');
const floatingCard = document.querySelector('.floating-card');
export const floatingBtn = document.querySelector('.floating-btn');

export const basePath = "set-path";
export const appsWithExclamation = [];
export const appsWithQuestion = [];
const ADDITIONAL_APPS = [ "com.google.android.gms", "com.android.vending", "com.google.android.gsf", "io.github.vvb2060.keyattestation", "io.github.vvb2060.mahoshojo", "icu.nullptr.nativetest" ];
const rippleClasses = ['.language-option', '.menu-button', '.menu-options li', '.search-card', '.card', '.update-card', '.link-icon', '.floating-btn', '.uninstall-container', '.boot-hash-save-button', '.boot-hash-value', '.reboot', '.install'];

// Variables
let e = 0;
let isRefreshing = false;

// Function to load the version from module.prop
async function getModuleVersion() {
    const moduleVersion = document.getElementById('module-version');
    try {
        const version = await execCommand(`grep '^version=' ${basePath}common/update/module.prop | cut -d'=' -f2`);
        moduleVersion.textContent = version;
    } catch (error) {
        console.error("Failed to read version from module.prop:", error);
        updateVersion("Error");
    }
}

// Function to refresh app list
async function refreshAppList() {
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
            await execCommand(`[ -f ${basePath}common/tmp/exclude-list ] && rm -f "${basePath}common/tmp/exclude-list"`);
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

// Function to check if Magisk
async function checkMagisk() {
    const selectDenylistElement = document.getElementById('select-denylist');
    try {
        const magiskEnv = await execCommand(`command -v magisk >/dev/null 2>&1 || echo "NO"`);
        if (magiskEnv.trim() !== "NO") {
            console.log("Denylist conditions met, displaying element.");
            selectDenylistElement.style.display = "flex";
        } else {
            console.log("not running on Magisk, leaving denylist element hidden.");
        }
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
        if (typeof ksu !== 'undefined' && ksu.mmrl) {
            prompt.style.transform = 'translateY(calc((var(--window-inset-bottom) + 60%) * -1))';
        } else {
            prompt.style.transform = 'translateY(-60%)';
        }
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
        await execCommand(`echo "${updatedTargetContent}" > /data/adb/tricky_store/target.txt`);
        console.log("target.txt updated successfully.");
        showPrompt("prompt.saved_target");
        for (const app of appsWithExclamation) {
            await execCommand(`sed -i 's/^${app}$/${app}!/' /data/adb/tricky_store/target.txt`);
        }
        for (const app of appsWithQuestion) {
            await execCommand(`sed -i 's/^${app}$/${app}?/' /data/adb/tricky_store/target.txt`);
        }
        console.log("App names modified in target.txt.");
    } catch (error) {
        console.error("Failed to update target.txt:", error);
        showPrompt("prompt.save_error", false);
    }
    await refreshAppList();
});

// Uninstall WebUI
document.querySelector(".uninstall-container").addEventListener("click", async () => {
    try {
        await execCommand(`sh ${basePath}common/get_extra.sh --uninstall`);
        console.log("uninstall script executed successfully.");
        showPrompt("prompt.uninstall_prompt");
    } catch (error) {
        console.error("Failed to execute uninstall command:", error);
        showPrompt("prompt.uninstall_failed", false);
    }
});

// Function to check if running in MMRL
function adjustHeaderForMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        console.log("Running in MMRL");
        title.style.top = 'var(--window-inset-top)';
        const insetTop = getComputedStyle(document.documentElement).getPropertyValue('--window-inset-top');
        const insetTopValue = parseInt(insetTop, 10);
        searchMenuContainer.style.top = `${insetTopValue + 40}px`;
        headerBlock.style.display = 'block';
        floatingCard.style.bottom = 'calc(var(--window-inset-bottom) + 50px)';
    }
}

// Funtion to adapt floating button hide in MMRL
function hideFloatingBtn() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        floatingBtn.style.transform = 'translateY(calc(var(--window-inset-bottom) + 120px))';
    } else {
        floatingBtn.style.transform = 'translateY(120px)';
    }
}

// Function to apply ripple effect
function applyRippleEffect() {
    rippleClasses.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            if (element.dataset.rippleListener !== "true") {
                element.addEventListener("pointerdown", function (event) {
                    if (isScrolling) return;
                    if (modeActive) return;
                    
                    const ripple = document.createElement("span");
                    ripple.classList.add("ripple");
    
                    // Calculate ripple size and position
                    const rect = element.getBoundingClientRect();
                    const width = rect.width;
                    const size = Math.max(rect.width, rect.height);
                    const x = event.clientX - rect.left - size / 2;
                    const y = event.clientY - rect.top - size / 2;
    
                    // Determine animation duration
                    let duration = 0.3 + (width / 800) * 0.3;
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
        title.style.transform = 'translateY(-80px)';
        headerBlock.style.transform = 'translateY(-80px)';
        searchMenuContainer.style.transform = 'translateY(-40px)';
        hideFloatingBtn();
    } else if (window.scrollY < lastScrollY) {
        headerBlock.style.transform = 'translateY(0)';
        title.style.transform = 'translateY(0)';
        searchMenuContainer.style.transform = 'translateY(0)';
        floatingBtn.style.transform = 'translateY(0)';
    }
    lastScrollY = window.scrollY;
});

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    hideFloatingBtn();
    adjustHeaderForMMRL();
    getModuleVersion();
    await initializeAvailableLanguages();
    const userLang = detectUserLanguage();
    await loadTranslations(userLang);
    setupMenuToggle();
    setupLanguageMenu();
    await fetchAppList();
    applyRippleEffect();
    checkMagisk();
    updateCheck();
    loadingIndicator.style.display = "none";
    floatingBtn.style.opacity = '1';
    setTimeout(() => {
        floatingBtn.style.transform = 'translateY(0)';
    }, 10);
    document.getElementById("refresh").addEventListener("click", refreshAppList);
    document.getElementById("aospkb").addEventListener("click", aospkb);
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
    ksu.toast(message);
}