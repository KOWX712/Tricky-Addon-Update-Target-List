import { exec } from 'kernelsu-alt';
import { showPrompt } from './main.js';
import { setKeybox } from './menu_option.js';
import { FileSelector } from './file_selector.js';
import { getString } from './language.js';

/**
 * Custom keybox provider
 */

const STORAGE_KEY = 'trickyAddonCustomkb';
const CONFIG_METADATA = 'tricky_addon_custom_keybox_config';
const BLOCKED_PATTERNS = /\b(dd|rm|rmdir|eval|chmod|chown|mv|cp|ln|passwd|shutdown|reboot|poweroff)\b/i;
const customkbDialog = document.getElementById('customkb-dialog');
const defaultEntries = [
    {
        name: "Addon",
        link: "https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/keybox/.extra",
        script: "xxd -r -p | base64 -d"
    }
];

function getCustomKeyboxEntries() {
    try {
        const entries = localStorage.getItem(STORAGE_KEY);
        if (!entries) throw new Error("No custom keybox entries found");
        return JSON.parse(entries);
    } catch {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultEntries));
        return defaultEntries;
    }
}

function saveCustomKeyboxEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function validateScript(script) {
    if (script && BLOCKED_PATTERNS.test(script)) {
        throw new Error("Blocked command detected");
    }
    return true;
}

let currentRemoveName = null;
let isRemoveAll = false;

function renderCustomKeyboxEntries() {
    const entries = getCustomKeyboxEntries();
    const customkb = document.getElementById('customkb');

    document.querySelectorAll('.customkb-entry').forEach(el => el.remove());

    if (entries.length === 0) return;

    entries.forEach(entry => {
        const menuItem = document.createElement('md-menu-item');
        menuItem.className = 'customkb-entry';
        menuItem.innerHTML = `<div slot="headline">${entry.name}</div>`;
        customkb.parentNode.insertBefore(menuItem, customkb);
        menuItem.onclick = () => fetchCustomKeybox(entry.link, entry.script);
        menuItem.oncontextmenu = (e) => {
            e.preventDefault();
            showRemoveDialog(false, entry.name);
        };
    });
}

async function fetchCustomKeybox(link, script) {
    try {
        validateScript(script);

        const response = await fetch(link);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.text();
        const execScript = script || "cat";
        const { stdout, errno } = await exec(
            `(${execScript}) << 'CUSTOMKB_EOF'
${data}
CUSTOMKB_EOF`,
            { cwd: "/data/local/tmp" }
        );

        if (errno !== 0 || !stdout.trim()) {
            showPrompt(getString("prompt_custom_fetch_error"), false);
            return;
        }

        const result = await setKeybox(stdout);
        showPrompt(getString(result ? "prompt_custom_key_set" : "prompt_key_set_error"), result);
    } catch (error) {
        console.error("Custom keybox fetch error:", error);
        showPrompt(getString("prompt_custom_fetch_error"), false);
    }
}

function saveCustomKeyboxEntry() {
    const nameInput = document.getElementById('customkb-name-input');
    const linkInput = document.getElementById('customkb-link-input');
    const scriptInput = document.getElementById('customkb-script-input');

    for (const input of [nameInput, linkInput]) {
        if (!input.value.trim()) {
            input.setAttribute('error', '');
            input.querySelector('md-icon[slot="trailing-icon"]').classList.remove('hidden');
            return;
        }
    }

    try {
        validateScript(scriptInput.value.trim());
    } catch (error) {
        showPrompt(getString("prompt_custom_invalid_script"), false);
        return;
    }

    const entries = getCustomKeyboxEntries();
    const newEntry = {
        name: nameInput.value.trim(),
        link: linkInput.value.trim(),
        script: scriptInput.value.trim()
    };

    entries.push(newEntry);
    saveCustomKeyboxEntries(entries);
    renderCustomKeyboxEntries();

    customkbDialog.close();
    showPrompt(getString("prompt_custom_saved"));
}

function removeCustomKeyboxEntry() {
    if (isRemoveAll) {
        saveCustomKeyboxEntries([]);
        renderCustomKeyboxEntries();
        document.getElementById('customkb-remove-dialog').close();
        showPrompt(getString("prompt_custom_removed"));
        isRemoveAll = false;
        return;
    }

    if (!currentRemoveName) return;

    const entries = getCustomKeyboxEntries().filter(e => e.name !== currentRemoveName);
    saveCustomKeyboxEntries(entries);
    renderCustomKeyboxEntries();

    document.getElementById('customkb-remove-dialog').close();
        showPrompt(getString("prompt_custom_removed"));
    currentRemoveName = null;
}

async function exportCustomKeyboxConfig() {
    const entries = getCustomKeyboxEntries();
    if (entries.length === 0) {
        showPrompt(getString("customkb_export_empty"), false);
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fileName = `tricky_addon-custom_keybox_config_${dateStr}.json`;

    const config = {
        metadata: CONFIG_METADATA,
        version: 1,
        entries: entries
    };

    const configStr = JSON.stringify(config, null, 2);
    const filePath = `/storage/emulated/0/Download/${fileName}`;
    const { errno } = await exec(`cat > "${filePath}" << 'EXPORT_EOF'
${configStr}
EXPORT_EOF`);

    if (errno === 0) {
        showPrompt(getString("customkb_export_success", filePath));
    } else {
        showPrompt(getString("customkb_export_error"), false);
    }
}

async function importCustomKeyboxConfig() {
    customkbDialog.close();
    try {
        const content = await FileSelector.getFileContent('json');
        if (!content) return;
        const config = JSON.parse(content);

        if (!config || config.metadata !== CONFIG_METADATA || !Array.isArray(config.entries)) {
            showPrompt(getString("customkb_import_error"), false);
            return;
        }

        const existingEntries = getCustomKeyboxEntries();
        const existingNames = new Set(existingEntries.map(e => e.name));
        const newEntries = config.entries.filter(e => !existingNames.has(e.name));
        const hasDuplicates = newEntries.length < config.entries.length;

        if (newEntries.length > 0) {
            saveCustomKeyboxEntries([...existingEntries, ...newEntries]);
            renderCustomKeyboxEntries();
        }

        showPrompt(getString(hasDuplicates ? "customkb_import_duplicate" : "customkb_import_success"));
    } catch (error) {
        console.error("Import error:", error);
        showPrompt(getString("customkb_import_error"), false);
    }
}

function showRemoveDialog(removeAll, name = null) {
    isRemoveAll = removeAll;
    currentRemoveName = name;
    document.getElementById('customkb-remove-single').style.display = removeAll ? 'none' : '';
    document.getElementById('customkb-remove-all').style.display = removeAll ? '' : 'none';
    document.getElementById('customkb-remove-dialog').show();
    customkbDialog.close();
}

export function initCustomKeybox() {
    renderCustomKeyboxEntries();

    document.getElementById('cancel-customkb').onclick = () => {
        customkbDialog.close();
    };
    
    document.getElementById('save-customkb').onclick = saveCustomKeyboxEntry;
    document.getElementById('clear-all-customkb').onclick = () => showRemoveDialog(true);
    document.getElementById('customkb-import').onclick = importCustomKeyboxConfig;
    document.getElementById('customkb-export').onclick = exportCustomKeyboxConfig;

    document.getElementById('cancel-remove-customkb').onclick = () => {
        document.getElementById('customkb-remove-dialog').close();
        isRemoveAll = false;
        currentRemoveName = null;
    };

    document.getElementById('confirm-remove-customkb').onclick = removeCustomKeyboxEntry;
    document.getElementById('confirm-remove-customkb').onclick = removeCustomKeyboxEntry;

    const nameInput = document.getElementById('customkb-name-input');
    const linkInput = document.getElementById('customkb-link-input');
    const scriptInput = document.getElementById('customkb-script-input');

    for (const input of [nameInput, linkInput]) {
        input.oninput = () => {
            if (input.value.trim()) {
                input.removeAttribute('error');
                input.querySelector('md-icon[slot="trailing-icon"]').classList.add('hidden');
            } else {
                input.setAttribute('error', '');
                input.querySelector('md-icon[slot="trailing-icon"]').classList.remove('hidden');
            }
        }
    }

    scriptInput.setAttribute('error-text', getString('prompt_custom_invalid_script'));
    scriptInput.oninput = () => {
        const value = scriptInput.value.trim();
        const errorIcon = scriptInput.querySelector('md-icon[slot="trailing-icon"]');
        
        if (value && BLOCKED_PATTERNS.test(value)) {
            scriptInput.setAttribute('error', '');
            errorIcon.classList.remove('hidden');
        } else {
            scriptInput.removeAttribute('error');
            errorIcon.classList.add('hidden');
        }
    };
}
