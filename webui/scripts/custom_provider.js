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
let isReset = false;

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
            showCustomKbDialog(true, entry);
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

    if (currentRemoveName) {
        const index = entries.findIndex(e => e.name === currentRemoveName);
        if (index !== -1) {
            entries[index] = newEntry;
        }
    } else {
        entries.push(newEntry);
    }

    saveCustomKeyboxEntries(entries);
    renderCustomKeyboxEntries();

    customkbDialog.close();
    showPrompt(getString("prompt_custom_saved"));
}

function removeCustomKeyboxEntry() {
    if (isReset) {
        saveCustomKeyboxEntries(defaultEntries);
        renderCustomKeyboxEntries();
        document.getElementById('customkb-remove-dialog').close();
        showPrompt(getString("prompt_custom_removed"));
        isReset = false;
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

        const updatedEntries = Array.from(new Map([
            ...getCustomKeyboxEntries().map(e => [e.name, e]),
            ...config.entries.map(e => [e.name, e])
        ]).values());

        saveCustomKeyboxEntries(updatedEntries);
        renderCustomKeyboxEntries();

        showPrompt(getString("customkb_import_success"));
    } catch (error) {
        console.error("Import error:", error);
        showPrompt(getString("customkb_import_error"), false);
    }
}

function showCustomKbDialog(edit, entry = null) {
    document.getElementById('customkb-name-input').value = edit ? entry.name : '';
    document.getElementById('customkb-link-input').value = edit ? entry.link : '';
    document.getElementById('customkb-script-input').value = edit ? (entry.script || '') : '';

    customkbDialog.querySelectorAll('.new').forEach(el => el.style.display = edit ? 'none' : '');
    customkbDialog.querySelectorAll('.old').forEach(el => el.style.display = edit ? '' : 'none');

    currentRemoveName = edit ? entry.name : null;
    customkbDialog.show();
}

function showRemoveDialog(reset, name = null) {
    isReset = reset;
    currentRemoveName = name;
    document.getElementById('customkb-remove-single').style.display = isReset ? 'none' : '';
    document.getElementById('customkb-reset').style.display = isReset ? '' : 'none';
    document.getElementById('customkb-remove-dialog').show();
    customkbDialog.close();
}

export function initCustomKeybox() {
    renderCustomKeyboxEntries();

    document.getElementById('customkb').onclick = () => {
        showCustomKbDialog(false);
    };

    document.getElementById('cancel-customkb').onclick = () => {
        customkbDialog.close();
    };
    
    document.getElementById('save-customkb').onclick = saveCustomKeyboxEntry;
    document.getElementById('reset-customkb').onclick = () => showRemoveDialog(true);
    document.getElementById('remove-customkb').onclick = () => showRemoveDialog(false, currentRemoveName);
    document.getElementById('customkb-import').onclick = importCustomKeyboxConfig;
    document.getElementById('customkb-export').onclick = exportCustomKeyboxConfig;

    document.getElementById('cancel-remove-customkb').onclick = () => {
        document.getElementById('customkb-remove-dialog').close();
        isReset = false;
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
