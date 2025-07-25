import { exec, spawn } from './assets/kernelsu.js';
import { basePath, showPrompt } from './main.js';
import { translations } from './language.js';

let jamesFork = false;

const overlay = document.getElementById('security-patch-overlay');
const overlayContent = document.querySelector('.security-patch-card');
const advancedToggleElement = document.querySelector('.advanced-toggle');
const advancedToggle = document.getElementById('advanced-mode');
const normalInputs = document.getElementById('normal-mode-inputs');
const advancedInputs = document.getElementById('advanced-mode-inputs');
const devconfigInputs = document.getElementById('devconfig-mode-inputs');
const allPatchInput = document.getElementById('all-patch');
const bootPatchInput = document.getElementById('boot-patch');
const systemPatchInput = document.getElementById('system-patch');
const vendorPatchInput = document.getElementById('vendor-patch');
const devconfigPatchInput = document.getElementById('devconfig-securityPatch');
const getButton = document.getElementById('get-patch');
const autoButton = document.getElementById('auto-config');
const saveButton = document.getElementById('save-patch');

// Configurable options in james' fork
const devconfigOption = [
    'securityPatch',
    'osVersion',
    'brand',
    'device',
    'product',
    'manufacturer',
    'model',
    'serial',
    'meid',
    'imei',
    'imei2'
];

// Hide security patch dialog
const hideSecurityPatchDialog = () => {
    document.body.classList.remove("no-scroll");
    overlay.style.opacity = '0';
    overlayContent.classList.remove('open');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 200);
}

/**
 * Save the security patch configuration to file
 * @param {string} mode - 'disable',
'manual'
 * @param {string} value - The security patch value to save, if mode is 'manual'.
 */
function handleSecurityPatch(mode, value = null) {
    if (mode === 'disable') {
        exec(`
            rm -f /data/adb/tricky_store/security_patch_auto_config || true
            rm -f /data/adb/tricky_store/security_patch.txt || true
            rm -f /data/adb/tricky_store/devconfig.toml || true
        `).then(({ errno }) => {
            showPrompt('security_patch_value_empty');
            return errno === 0;
        });
    } else if (mode === 'manual') {
        const configFile = jamesFork ? '/data/adb/tricky_store/devconfig.toml' : '/data/adb/tricky_store/security_patch.txt';
        exec(`
            ${jamesFork ? '' : 'rm -f /data/adb/tricky_store/security_patch_auto_config || true'}
            echo "${value}" > ${configFile}
            chmod 644 ${configFile}
        `).then(({ errno }) => {
            const result = errno === 0;
            showPrompt(result ? 'security_patch_save_success' : 'security_patch_save_failed', result);
            return result;
        });
    }
}

// Load current configuration
async function loadCurrentConfig() {
    let allValue, systemValue, bootValue, vendorValue;
    try {
        const { errno } = await exec('[ -f /data/adb/tricky_store/security_patch_auto_config ]');
        if (jamesFork) {
            const { stdout } = await exec('cat /data/adb/tricky_store/devconfig.toml');
            if (stdout.trim() !== '') {
                const lines = stdout.split('\n');
                for (const line of lines) {
                    for (const option of devconfigOption) {
                        if (line.startsWith(`${option} =`)) {
                            const value = line.split('=')[1].trim().replace(/"/g, '');
                            document.getElementById(`devconfig-${option}`).value = value;
                        }
                        if (!stdout.includes(option)) {
                            document.getElementById(`devconfig-${option}`).value = '';
                        }
                    }
                }
            }
        } else if (errno === 0) {
            allValue = null;
            systemValue = null;
            bootValue = null;
            vendorValue = null;
        } else {
            // Read values from tricky_store if manual mode
            const { stdout } = await exec('cat /data/adb/tricky_store/security_patch.txt');
            if (stdout.trim() !== '') {
                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (line.startsWith('all=')) {
                        allValue = line.split('=')[1] || null;
                        if (allValue !== null) allPatchInput.value = allValue;
                    } else {
                        allValue = null;
                    }
                    if (line.startsWith('system=')) {
                        systemValue = line.split('=')[1] || null;
                        if (systemValue !== null) systemPatchInput.value = systemValue;
                    } else {
                        systemValue = null;
                    }
                    if (line.startsWith('boot=')) {
                        bootValue = line.split('=')[1] || null;
                        if (bootValue !== null) bootPatchInput.value = bootValue;
                    } else {
                        bootValue = null;
                    }
                    if (line.startsWith('vendor=')) {
                        vendorValue = line.split('=')[1] || null;
                        if (vendorValue !== null) vendorPatchInput.value = vendorValue;
                    } else {
                        vendorValue = null;
                    }
                }
            }
            if (allValue === null && (bootValue || systemValue || vendorValue)) {
                checkAdvanced(true);
            }
        }
    } catch (error) {
        console.error('Failed to load security patch config:', error);
    }
}

// Function to check advanced mode
function checkAdvanced(shouldCheck) {
    if (jamesFork) return;
    if (shouldCheck) {
        advancedToggle.checked = true;
        normalInputs.classList.add('hidden');
        advancedInputs.classList.remove('hidden');
    } else {
        advancedToggle.checked = false;
        normalInputs.classList.remove('hidden');
        advancedInputs.classList.add('hidden');
    }
}

// Unified date formatting function
window.formatDate = function(input) {
    let value = input.value.replace(/-/g, '');
    let formatted = value.slice(0, 4);

    // Allow 'no' input
    if (value === 'no') {
        input.value = 'no';
        input.setSelectionRange(2, 2);
        return 'no';
    }

    if (value.startsWith('n')) {
        // Only allow 'o' after 'n'
        if (value.length > 1 && value[1] !== 'o') {
            value = 'n';
        }
        formatted = value.slice(0, 2);
        if (value.length > 2) {
            input.value = formatted;
            input.setSelectionRange(2, 2);
            return formatted;
        }
    } else {
        // Only allow numbers if not starting with 'n'
        const numbersOnly = value.replace(/\D/g, '');
        if (numbersOnly !== value) {
            input.value = numbersOnly;
            value = numbersOnly;
            formatted = numbersOnly.slice(0, 4);
        }
        
        // Add hyphens on 5th and 7th character
        if (value.length >= 4) {
            formatted += '-'+ value.slice(4, 6);
        }
        if (value.length >= 6) {
            formatted += '-'+ value.slice(6, 8);
        }
    }

    // Handle backspace/delete
    const lastChar = value.slice(-1);
    if (lastChar === '-' || (isNaN(lastChar) && !['n'].includes(lastChar))) {
        formatted = formatted.slice(0, -1);
    }

    // Update input value
    const startPos = input.selectionStart;
    input.value = formatted;
    const newLength = formatted.length;
    const shouldMoveCursor = (value.length === 4 || value.length === 6) && newLength > startPos;
    input.setSelectionRange(shouldMoveCursor ? newLength : startPos, shouldMoveCursor ? newLength : startPos);

    return formatted;
}

// Validate date format YYYY-MM-DD
function isValidDateFormat(date) {
    if (date === 'no') return true;
    const regex = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
    return regex.test(date);
}

// Validate 6-digit format YYYYMM
function isValid6Digit(value) {
    if (value === 'prop') return true;
    const regex = /^\d{6}$/;
    return regex.test(value);
}

// Validate 8-digit format YYYYMMDD
function isValid8Digit(value) {
    const regex = /^\d{8}$/;
    return regex.test(value);
}

// Initialize event listeners
export function securityPatch() {
    exec(`grep -q "James" "/data/adb/modules/tricky_store/module.prop" && ! grep -q "beakthoven" "/data/adb/modules/tricky_store/module.prop"`)
        .then(({ errno }) => {
            if (errno === 0) {
                jamesFork = true;
                document.getElementById('security-patch').textContent = translations.menu_set_devconfig;
                advancedToggleElement.style.display = 'none';
                normalInputs.classList.add('hidden');
                devconfigInputs.classList.remove('hidden');
            }
        });
    document.getElementById("security-patch").addEventListener("click", () => {
        setTimeout(() => {
            document.body.classList.add("no-scroll");
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.style.opacity = '1';
                overlayContent.classList.add('open');
                loadCurrentConfig();
            }, 10);
        }, 80);
    });

    // Toggle advanced mode
    advancedToggle.addEventListener('change', () => {
        normalInputs.classList.toggle('hidden');
        advancedInputs.classList.toggle('hidden');
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideSecurityPatchDialog();
        }
    });

    // Auto config button
    autoButton.addEventListener('click', () => {
        const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--security-patch']);
        output.stdout.on('data', (data) => {
            if (data.includes("not set")) {
                showPrompt('security_patch_auto_failed', false);
            }
        });
        output.on('exit', (code) => {
            if (code === 0) {
                exec(`touch /data/adb/tricky_store/security_patch_auto_config`)
                // Reset inputs
                allPatchInput.value = '';
                systemPatchInput.value = '';
                bootPatchInput.value = '';
                vendorPatchInput.value = '';

                checkAdvanced(false);
                showPrompt('security_patch_auto_success');
            } else {
                showPrompt('security_patch_auto_failed', false);
            }
            hideSecurityPatchDialog();
            loadCurrentConfig();
        });
    });

    // Save button
    saveButton.addEventListener('click', async () => {
        if (jamesFork) {
            const devconfig = new Map();
            for (const option of devconfigOption) {
                const input = document.getElementById(`devconfig-${option}`);
                if (input.value.trim() === '') continue;
                devconfig.set(option, input.value.trim());
            }

            if (devconfig.size === 0) {
                handleSecurityPatch('disable');
                hideSecurityPatchDialog();
                return;
            }

            if (!devconfig.has('securityPatch')) {
                exec('rm -f /data/adb/tricky_store/security_patch_auto_config || true');
            }

            // Separate top-level and deviceProps
            const topLevelKeys = ['securityPatch', 'osVersion'];
            const topLevel = [];
            const deviceProps = [];

            for (const [key, value] of devconfig.entries()) {
                if (topLevelKeys.includes(key)) {
                    if (key === 'osVersion') {
                        topLevel.push(`${key} = ${value}`);
                    } else {
                        topLevel.push(`${key} = \\"${value}\\"`);
                    }
                } else {
                    deviceProps.push(`${key} = \\"${value}\\"`);
                }
            }

            let config = topLevel.join('\n');
            if (deviceProps.length > 0) {
                config += `\n[deviceProps]\n` + deviceProps.join('\n');
            }

            handleSecurityPatch('manual', config);
        } else if (!advancedToggle.checked) {
            // Normal mode validation
            const allValue = allPatchInput.value.trim();
            if (!allValue) {
                // Save empty value to disable auto config
                handleSecurityPatch('disable');
                hideSecurityPatchDialog();
                return;
            }
            if (!isValid8Digit(allValue)) {
                showPrompt('security_patch_invalid_all', false);
                return;
            }
            const value = `all=${allValue}`;
            const result = handleSecurityPatch('manual', value);
            if (result) {
                // Reset inputs
                systemPatchInput.value = '';
                bootPatchInput.value = '';
                vendorPatchInput.value = '';
            }
        } else {
            // Advanced mode validation
            const bootValue = formatDate(bootPatchInput, 'boot');
            const systemValue = systemPatchInput.value.trim();
            const vendorValue = vendorPatchInput.value.trim();

            if (!bootValue && !systemValue && !vendorValue) {
                // Save empty values to disable auto config
                handleSecurityPatch('disable');
                hideSecurityPatchDialog();
                return;
            }

            if (systemValue && !isValid6Digit(systemValue)) {
                showPrompt('security_patch_invalid_system', false);
                return;
            }

            if (bootValue && !isValidDateFormat(bootValue)) {
                showPrompt('security_patch_invalid_boot', false);
                return;
            }

            if (vendorValue && !isValidDateFormat(vendorValue)) {
                showPrompt('security_patch_invalid_vendor', false);
                return;
            }

            const config = [
                systemValue ? `system=${systemValue}` : '',
                bootValue ? `boot=${bootValue}` : '',
                vendorValue ? `vendor=${vendorValue}` : ''
            ].filter(Boolean).join('\n');
            const result = handleSecurityPatch('manual', config);
            if (result) {
                // Reset inputs
                allPatchInput.value = '';
            }
        }
        overlayContent.scrollTop = 0;
        hideSecurityPatchDialog();
        loadCurrentConfig();
    });

    // Get button
    getButton.addEventListener('click', async () => {
        showPrompt('security_patch_fetching');
        const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--get-security-patch'],
                        { cwd: "/data/local/tmp", env: { PATH: "/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH" }});
        output.stdout.on('data', (data) => {
            showPrompt('security_patch_fetched', true, 1000);
            checkAdvanced(true);

            allPatchInput.value = data.replace(/-/g, '');
            systemPatchInput.value = 'prop';
            bootPatchInput.value = data;
            vendorPatchInput.value = data;
            devconfigPatchInput.value = data;
        });
        output.stderr.on('data', (data) => {
            if (data.includes("failed")) {
                showPrompt('security_patch_unable_to_connect', false);
            } else {
                console.error(data);
            }
        });
        output.on('exit', (code) => {
            if (code !== 0) showPrompt('security_patch_get_failed', false);
        });
    });
}
