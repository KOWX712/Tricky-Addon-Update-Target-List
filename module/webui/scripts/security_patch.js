import { basePath, execCommand, showPrompt } from './main.js';

const overlay = document.getElementById('security-patch-overlay');
const overlayContent = document.querySelector('.security-patch-card');
const advancedToggle = document.getElementById('advanced-mode');
const normalInputs = document.getElementById('normal-mode-inputs');
const advancedInputs = document.getElementById('advanced-mode-inputs');
const allPatchInput = document.getElementById('all-patch');
const bootPatchInput = document.getElementById('boot-patch');
const systemPatchInput = document.getElementById('system-patch');
const vendorPatchInput = document.getElementById('vendor-patch');
const getButton = document.getElementById('get-patch');
const autoButton = document.getElementById('auto-config');
const saveButton = document.getElementById('save-patch');

// Show security patch dialog
function showSecurityPatchDialog() {
    document.body.classList.add("no-scroll");
    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.style.opacity = '1';
        overlayContent.classList.add('open');
        loadCurrentConfig();
    }, 10);
}

// Hide security patch dialog
function hideSecurityPatchDialog() {
    document.body.classList.remove("no-scroll");
    overlay.style.opacity = '0';
    overlayContent.classList.remove('open');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 200);
}

// Function to handle security patch operation
async function handleSecurityPatch(mode, value = null) {
    if (mode === 'disable') {
        try {
            await execCommand(`
                rm -f /data/adb/tricky_store/security_patch_auto_config
                rm -f /data/adb/tricky_store/security_patch.txt
            `);
            showPrompt('security_patch.value_empty');
            return true;
        } catch (error) {
            showPrompt('security_patch.save_failed', false);
            return false;
        }
    } else if (mode === 'manual') {
        try {
            await execCommand(`
                rm -f /data/adb/tricky_store/security_patch_auto_config
                echo "${value}" > /data/adb/tricky_store/security_patch.txt
                chmod 644 /data/adb/tricky_store/security_patch.txt
            `);
            showPrompt('security_patch.save_success');
            return true;
        } catch (error) {
            showPrompt('security_patch.save_failed', false);
            return false;
        }
    }
}

// Load current configuration
async function loadCurrentConfig() {
    let allValue, systemValue, bootValue, vendorValue;
    try {
        const autoConfig = await execCommand('[ -f /data/adb/tricky_store/security_patch_auto_config ] && echo "true" || echo "false"');
        if (autoConfig.trim() === 'true') {
            allValue = null;
            systemValue = null;
            bootValue = null;
            vendorValue = null;
        } else {
            // Read values from tricky_store if auto_config is 0
            const trickyResult = await execCommand('cat /data/adb/tricky_store/security_patch.txt');
            if (trickyResult) {
                const trickyLines = trickyResult.split('\n');
                for (const line of trickyLines) {
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
window.formatDate = function(input, type) {
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
    document.getElementById("security-patch").addEventListener("click", showSecurityPatchDialog);

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
    autoButton.addEventListener('click', async () => {
        try {
            const output = await execCommand(`sh ${basePath}/common/get_extra.sh --security-patch`);
            if (output.trim() === "not set") {
                showPrompt('security_patch.auto_failed', false);
            } else {
                await execCommand(`touch /data/adb/tricky_store/security_patch_auto_config`);
                // Reset inputs
                allPatchInput.value = '';
                systemPatchInput.value = '';
                bootPatchInput.value = '';
                vendorPatchInput.value = '';

                checkAdvanced(false);
                showPrompt('security_patch.auto_success');
            }
        } catch (error) {
            showPrompt('security_patch.auto_failed', false);
        }
        hideSecurityPatchDialog();
        loadCurrentConfig();
    });

    // Save button
    saveButton.addEventListener('click', async () => {
        if (!advancedToggle.checked) {
            // Normal mode validation
            const allValue = allPatchInput.value.trim();
            if (!allValue) {
                // Save empty value to disable auto config
                await handleSecurityPatch('disable');
                hideSecurityPatchDialog();
                return;
            }
            if (!isValid8Digit(allValue)) {
                showPrompt('security_patch.invalid_all', false);
                return;
            }
            const value = `all=${allValue}`;
            const result = await handleSecurityPatch('manual', value);
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
                await handleSecurityPatch('disable');
                hideSecurityPatchDialog();
                return;
            }

            if (systemValue && !isValid6Digit(systemValue)) {
                showPrompt('security_patch.invalid_system', false);
                return;
            }

            if (bootValue && !isValidDateFormat(bootValue)) {
                showPrompt('security_patch.invalid_boot', false);
                return;
            }

            if (vendorValue && !isValidDateFormat(vendorValue)) {
                showPrompt('security_patch.invalid_vendor', false);
                return;
            }

            const config = [
                systemValue ? `system=${systemValue}` : '',
                bootValue ? `boot=${bootValue}` : '',
                vendorValue ? `vendor=${vendorValue}` : ''
            ].filter(Boolean);
            const value = config.filter(Boolean).join('\n');
            const result = await handleSecurityPatch('manual', value);
            if (result) {
                // Reset inputs
                allPatchInput.value = '';
            }
        }
        hideSecurityPatchDialog();
        loadCurrentConfig();
    });

    // Get button
    getButton.addEventListener('click', async () => {
        try {
            showPrompt('security_patch.fetching');
            await new Promise(resolve => setTimeout(resolve, 200));
            const output = await execCommand(`sh ${basePath}/common/get_extra.sh --get-security-patch`);
            showPrompt('security_patch.fetched', true, 1000);
            checkAdvanced(true);

            allPatchInput.value = output.replace(/-/g, '');
            systemPatchInput.value = 'prop';
            bootPatchInput.value = output;
            vendorPatchInput.value = output;
        } catch (error) {
            showPrompt('security_patch.get_failed', false);
        }
    });
}
