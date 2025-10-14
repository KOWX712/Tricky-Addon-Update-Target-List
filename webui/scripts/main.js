import '@material/web/icon/icon.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/dialog/dialog.js';
import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/filled-icon-button.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import '@material/web/menu/sub-menu.js';
import '@material/web/radio/radio.js';
import '@material/web/ripple/ripple.js';
import '@material/web/textfield/outlined-text-field.js';
import { exec, toast } from 'kernelsu-alt';
import { WXEventHandler } from 'webuix';
import { appListContainer, fetchAppList } from './applist.js';
import { loadTranslations, translations } from './language.js';
import { setupSystemAppMenu } from './menu_option.js';
import { searchInput } from './search_menu.js';
import { updateCheck, connection } from './update.js';
import { securityPatch } from './security_patch.js';

// Loading, Save and Prompt Elements
export const loadingIndicator = document.querySelector('.loading');
const prompt = document.getElementById('prompt');
const floatingBtn = document.querySelector('.floating-btn');

export let basePath;
export const appsWithExclamation = [];
export const appsWithQuestion = [];
const ADDITIONAL_APPS = []; // Deprecated

// Variables
let isRefreshing = false;

window.wx = new WXEventHandler();

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
    floatingBtn.classList.add('hide');
    searchInput.value = '';
    appListContainer.innerHTML = '';
    loadingIndicator.style.display = 'flex';
    document.querySelector('.uninstall-container').style.display = 'none';
    window.scrollTo(0, 0);
    if (connection === false) {
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
        if grep -qE "James|beakthoven" "/data/adb/modules/tricky_store/module.prop"; then
            echo 0
        elif [ "$TS_version" -ge 158 ]; then
            echo 0
        else
            echo $TS_version
        fi
    `).then(({ stdout }) => {
        if (stdout.trim() === "0" || typeof ksu === 'undefined') {
            securityPatchElement.style.display = "flex";
        } else {
            console.log("Tricky Store version:", stdout.trim());
        }
    }).catch(error => {
        // debug usage
        console.error("Error checking Tricky Store version:", error);
        securityPatchElement.style.display = "flex";
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
    prompt.classList.add('show');
    if (window.promptTimeout) {
        clearTimeout(window.promptTimeout);
    }
    window.promptTimeout = setTimeout(() => {
        prompt.classList.remove('show');
    }, duration);
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
    }, 100);
}

// Save configure and preserve ! and ? in target.txt
document.getElementById("save").onclick = () => {
    const selectedApps = Array.from(appListContainer.querySelectorAll("md-checkbox"))
        .filter(cb => cb.checked)
        .map(checkbox => checkbox.closest(".card").getAttribute("data-package"));
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
}

// Uninstall WebUI
document.querySelector(".uninstall-container").onclick = () => {
    const uninstallDialog = document.getElementById("uninstall-confirmation-dialog");
    uninstallDialog.show();

    document.getElementById("cancel-uninstall").onclick = () => {
        uninstallDialog.close();
    }

    document.getElementById('confirm-uninstall').onclick = () => {
        exec(`sh ${basePath}/common/get_extra.sh --uninstall`)
            .then(({ errno }) => {
                if (errno === 0) {
                    showPrompt("prompt_uninstall_prompt");
                } else {
                    showPrompt("prompt_uninstall_failed", false);
                }
            });
        uninstallDialog.close();
    }
}

// Function to check if running in MMRL
function checkMMRL() {
    if (window.$tricky_store && Object.keys($tricky_store).length > 0) {
        // Set status bars theme based on device theme
        $tricky_store.setLightStatusBars(!window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
}

// Prevent page scrolling when dialog is open.
function monitorDialogsAndLockScroll() {
    const setLocked = (locked) => {
        document.documentElement.classList.toggle('dialog-open', locked);
        document.body.style.overflow = locked ? 'hidden' : '';
        document.documentElement.style.touchAction = locked ? 'none' : '';
    };

    const attachToDialog = (dialog) => {
        setLocked(!!dialog.open);
        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'open') {
                    setLocked(!!dialog.open);
                }
            }
        });
        mo.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    };

    document.querySelectorAll('md-dialog').forEach(attachToDialog);

    const bodyObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const el = (node);
                if (el.tagName && el.tagName.toLowerCase() === 'md-dialog') {
                    attachToDialog(el);
                } else if (el.querySelectorAll) {
                    el.querySelectorAll('md-dialog').forEach(attachToDialog);
                }
            }
            if (m.removedNodes && m.removedNodes.length) {
                const anyOpen = document.querySelectorAll('md-dialog[open]').length > 0;
                if (!anyOpen) setLocked(false);
            }
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
}

// Scroll event
let lastScrollY = window.scrollY;
window.addEventListener('scroll', () => {
    document.querySelectorAll('md-menu').forEach(menu => menu.close());

    if (isRefreshing) return;

    const shouldHide = window.scrollY > lastScrollY && window.scrollY > 40;
    floatingBtn.classList.toggle('hide', shouldHide);

    document.querySelectorAll('.header-bg').forEach(header => {
        header.classList.toggle('scroll', window.scrollY > 10);
    });

    lastScrollY = window.scrollY;
});

wx.on(window, 'back', () => {
    for (const dialog of document.querySelectorAll('md-dialog')) {
        if (dialog.open) {
            dialog.close();
            return;
        }
    }
    webui.exit();
});

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTranslations();
    await getBasePath();
    checkMMRL();
    getModuleVersion();
    setupSystemAppMenu();
    fetchAppList();
    checkTrickyStoreVersion();
    checkMagisk();
    updateCheck();
    securityPatch();
    monitorDialogsAndLockScroll();
    document.getElementById("refresh").onclick = refreshAppList;
});