import { exec, toast } from './assets/kernelsu.js';
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
export const loadingIndicator = document.querySelector('.loading');
const prompt = document.getElementById('prompt');
const floatingCard = document.querySelector('.floating-card');
const floatingBtn = document.querySelector('.floating-btn');

export let basePath;
export const appsWithExclamation = [];
export const appsWithQuestion = [];
const ADDITIONAL_APPS = []; // Deprecated

// Variables
let e = 0;
let isRefreshing = false;

// Function to set basePath
async function getBasePath() {
    try {
        const { errno } = await exec('[ -d /data/adb/modules/.TA_utl ]');
        basePath = errno === 0 ? "/data/adb/modules/.TA_utl" : "/data/adb/modules/TA_utl";
    } catch (error) {
        console.error("Error getting base path:", error);
    }
}

// Function to load the version from module.prop
function getModuleVersion() {
    exec(`grep '^version=' ${basePath}/common/update/module.prop | cut -d'=' -f2`)
        .then(({ stdout }) => {
            document.getElementById('module-version').textContent = stdout;
        });
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
    window.scrollTo(0, 0);
    if (noConnection.style.display === "flex") {
        updateCheck();
        exec(`rm -f "${basePath}/common/tmp/exclude-list"`);
    }
    fetchAppList();
    isRefreshing = false;
}

// Function to check tricky store version
function checkTrickyStoreVersion() {
    const securityPatchElement = document.getElementById('security-patch');
    exec(`
        TS_version=$(grep "versionCode=" "/data/adb/modules/tricky_store/module.prop" | cut -d'=' -f2)
        [ "$TS_version" -ge 158 ]
    `).then(({ errno }) => {
        if (errno === 0) {
            securityPatchElement.style.display = "flex";
        } else {
            console.log("Tricky Store version is lower than 158, or fail to check Tricky store version.");
        }
    });
}

// Function to check if Magisk
function checkMagisk() {
    const selectDenylistElement = document.getElementById('select-denylist');
    exec('command -v magisk')
        .then(({ errno }) => {
            if (errno === 0) selectDenylistElement.style.display = "flex";
        });
}

// Function to show the prompt with a success or error message
export function showPrompt(key, isSuccess = true, duration = 3000) {
    prompt.textContent = translations[key];
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

/**
 * Redirect to a link with am command
 * @param {string} link - The link to redirect in browser
 */
export function linkRedirect(link) {
    toast("Redirecting to " + link);
    setTimeout(() => {
        exec(`am start -a android.intent.action.VIEW -d ${link}`)
            .then(({ errno }) => {
                if (errno !== 0) toast("Failed to open link");
            });
    },100);
}

// Save configure and preserve ! and ? in target.txt
document.getElementById("save").addEventListener("click", () => {
    const selectedApps = Array.from(appListContainer.querySelectorAll(".checkbox:checked"))
        .map(checkbox => checkbox.closest(".card").querySelector(".content").getAttribute("data-package"));
    let finalAppsList = new Set(selectedApps);
    ADDITIONAL_APPS.forEach(app => {
        finalAppsList.add(app);
    });
    finalAppsList = Array.from(finalAppsList);
    const modifiedAppsList = finalAppsList.map(app => {
        if (appsWithExclamation.includes(app)) {
            return `${app}!`;
        } else if (appsWithQuestion.includes(app)) {
            return `${app}?`;
        }
        return app;
    });
    const updatedTargetContent = modifiedAppsList.join("\n");
    exec(`echo "${updatedTargetContent}" | sort -u > /data/adb/tricky_store/target.txt`)
        .then(({ errno }) => {
            if (errno === 0) {
                for (const app of appsWithExclamation) {
                    exec(`sed -i 's/^${app}$/${app}!/' /data/adb/tricky_store/target.txt`);
                }
                for (const app of appsWithQuestion) {
                    exec(`sed -i 's/^${app}$/${app}?/' /data/adb/tricky_store/target.txt`);
                }
                showPrompt("prompt_saved_target");
                refreshAppList();
            } else {
                showPrompt("prompt_save_error", false);
            }
        });
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
        exec(`sh ${basePath}/common/get_extra.sh --uninstall`)
            .then(({ errno }) => {
                if (errno === 0) {
                    showPrompt("prompt_uninstall_prompt");
                } else {
                    showPrompt("prompt_uninstall_failed", false);
                }
            });
    })
});

// Function to check if running in MMRL
function checkMMRL() {
    if (window.$tricky_store && Object.keys($tricky_store).length > 0) {
        // Set status bars theme based on device theme
        $tricky_store.setLightStatusBars(!window.matchMedia('(prefers-color-scheme: dark)').matches)

        // Create home screen shortcut
        const shortcutButton = document.getElementById('shortcut');
        shortcutButton.style.display = 'flex';
        shortcutButton.addEventListener('click', () => {
            $tricky_store.createShortcut();
            showPrompt("prompt_shortcut_created", true);
        });
    }
}

// Funtion to adapt floating button hide in MMRL
export function hideFloatingBtn(hide = true) {
    if (!hide) {
        floatingCard.style.transform = 'translateY(0)';
        floatingBtn.style.display = 'block';
    }
    else floatingCard.style.transform = 'translateY(calc(var(--window-inset-bottom, 0px) + 120px))';
}

/**
 * Simulate MD3 ripple animation
 * Usage: class="ripple-element" style="position: relative; overflow: hidden;"
 * Note: Require background-color to work properly
 * @return {void}
 */
export function applyRippleEffect() {
    document.querySelectorAll('.ripple-element').forEach(element => {
        if (element.dataset.rippleListener !== "true") {
            element.addEventListener("pointerdown", async (event) => {
                // Pointer up event
                const handlePointerUp = () => {
                    ripple.classList.add("end");
                    setTimeout(() => {
                        ripple.classList.remove("end");
                        ripple.remove();
                    }, duration * 1000);
                    element.removeEventListener("pointerup", handlePointerUp);
                    element.removeEventListener("pointercancel", handlePointerUp);
                };
                element.addEventListener("pointerup", () => setTimeout(handlePointerUp, 80));
                element.addEventListener("pointercancel", () => setTimeout(handlePointerUp, 80));

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

                // Get effective background color (traverse up if transparent)
                const getEffectiveBackgroundColor = (el) => {
                    while (el && el !== document.documentElement) {
                        const bg = window.getComputedStyle(el).backgroundColor;
                        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
                            return bg;
                        }
                        el = el.parentElement;
                    }
                    return "rgba(255, 255, 255, 1)";
                };

                const bgColor = getEffectiveBackgroundColor(element);
                const isDarkColor = (color) => {
                    const rgb = color.match(/\d+/g);
                    if (!rgb) return false;
                    const [r, g, b] = rgb.map(Number);
                    return (r * 0.299 + g * 0.587 + b * 0.114) < 96; // Luma formula
                };
                ripple.style.backgroundColor = isDarkColor(bgColor) ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";

                // Append ripple if not scrolling
                await new Promise(resolve => setTimeout(resolve, 80));
                if (isScrolling) return;
                element.appendChild(ripple);
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
    await getBasePath();
    checkMMRL();
    hideFloatingBtn();
    getModuleVersion();
    setupMenuToggle();
    setupLanguageMenu();
    setupSystemAppMenu();
    fetchAppList();
    checkTrickyStoreVersion();
    checkMagisk();
    updateCheck();
    securityPatch();
    document.getElementById("refresh").addEventListener("click", refreshAppList);
});
