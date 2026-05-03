import { exec, spawn } from 'kernelsu-alt';
import { basePath, showPrompt } from './main.js';
import { getString } from './language.js';
import { POLICY_KEYS, getDefaultPolicy, loadConfig, setDefaultPolicy, writeConfig } from './config.js';

let jamesFork = false;

const dialog = document.getElementById('security-patch-dialog');
const defaultPolicyInputs = document.getElementById('default-policy-inputs');
const devconfigInputs = document.getElementById('devconfig-mode-inputs');
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
            showPrompt(getString('security_patch_value_empty'));
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
            showPrompt(getString(result ? 'security_patch_save_success' : 'security_patch_save_failed'), result);
            return result;
        });
    }
}

function normalizePatchValue(value) {
    return value.trim().replace(/-/g, '');
}

function isDefaultPolicyDisabled(policy) {
    return POLICY_KEYS.every(field => (policy[field] || 'no') === 'no');
}

// Load current configuration
async function loadCurrentConfig() {
    try {
        if (jamesFork) {
            const { stdout } = await exec('cat /data/adb/tricky_store/devconfig.toml');
            if (stdout.trim() !== '') {
                const lines = stdout.split('\n');
                for (const line of lines) {
                    for (const option of devconfigOption) {
                        if (line.trim().startsWith(`${option} =`)) {
                            const value = line.split('=')[1].trim().replace(/"/g, '');
                            document.getElementById(`devconfig-${option}`).value = value;
                        }
                        if (!stdout.includes(option)) {
                            document.getElementById(`devconfig-${option}`).value = '';
                        }
                    }
                }
            }
        } else {
            await loadConfig();
            const policy = getDefaultPolicy();

            systemPatchInput.value = '';
            bootPatchInput.value = '';
            vendorPatchInput.value = '';

            if (isDefaultPolicyDisabled(policy)) return;

            systemPatchInput.value = policy.os_patch === 'no' ? '' : policy.os_patch;
            bootPatchInput.value = policy.boot_patch === 'no' ? '' : policy.boot_patch;
            vendorPatchInput.value = policy.vendor_patch === 'no' ? '' : policy.vendor_patch;
        }
    } catch (error) {
        console.error('Failed to load security patch config:', error);
    }
}

// Validate 6-digit format YYYYMM
function isValid6Digit(value) {
    if (value === 'prop') return true;
    const regex = /^[0-9YMD]{6}$/;
    return regex.test(value);
}

// Validate 8-digit format YYYYMMDD
function isValid8Digit(value) {
    if (value === 'no') return true;
    const regex = /^[0-9YMD]{8}$/;
    return regex.test(value);
}

// Initialize event listeners
export function securityPatch() {
    exec(`grep -q "James" "/data/adb/modules/tricky_store/module.prop" && ! grep -q "beakthoven" "/data/adb/modules/tricky_store/module.prop"`)
        .then(({ errno }) => {
            if (errno === 0) {
                jamesFork = true;
                document.getElementById('security-patch').textContent = getString('menu_set_devconfig');
                defaultPolicyInputs.classList.add('hidden');
                devconfigInputs.classList.remove('hidden');
            }
        });
    document.getElementById("security-patch").addEventListener("click", () => {
        dialog.show();
        loadCurrentConfig();
    });

    // Auto config button
    autoButton.addEventListener('click', () => {
        if (jamesFork) return;
        const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--get-security-patch'],
            { cwd: "/data/local/tmp", env: { PATH: "/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH" } });
        let fetchedPatch = '';
        output.stdout.on('data', (data) => {
            const patch = normalizePatchValue(data);
            if (!patch || data.includes("not set")) {
                showPrompt(getString('security_patch_auto_failed'), false);
            } else {
                fetchedPatch = patch;
                systemPatchInput.value = 'prop';
                bootPatchInput.value = patch;
                vendorPatchInput.value = patch;
            }
        });
        output.on('exit', async (code) => {
            if (code === 0) {
                const patch = fetchedPatch || normalizePatchValue(bootPatchInput.value || vendorPatchInput.value);
                if (!patch || !isValid8Digit(patch)) {
                    showPrompt(getString('security_patch_auto_failed'), false);
                    return;
                }
                setDefaultPolicy({
                    os_patch: 'prop',
                    vendor_patch: patch,
                    boot_patch: patch
                });
                const { errno } = await writeConfig();
                showPrompt(getString(errno === 0 ? 'security_patch_auto_success' : 'security_patch_auto_failed'), errno === 0);
            } else {
                showPrompt(getString('security_patch_auto_failed'), false);
            }
            dialog.close();
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
                dialog.close();
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
                        topLevel.push(`${key} = \"${value}\"`);
                    }
                } else {
                    deviceProps.push(`${key} = \"${value}\"`);
                }
            }

            let config = topLevel.join('\n');
            if (deviceProps.length > 0) {
                config += `\n[deviceProps]\n` + deviceProps.join('\n');
            }

            handleSecurityPatch('manual', config);
        } else {
            const bootValue = normalizePatchValue(bootPatchInput.value);
            const systemValue = normalizePatchValue(systemPatchInput.value);
            const vendorValue = normalizePatchValue(vendorPatchInput.value);

            if (!bootValue && !systemValue && !vendorValue) {
                setDefaultPolicy({});
                const { errno } = await writeConfig();
                showPrompt(getString(errno === 0 ? 'security_patch_value_empty' : 'security_patch_save_failed'), errno === 0);
                dialog.close();
                return;
            }

            if (systemValue && !isValid6Digit(systemValue)) {
                showPrompt(getString('security_patch_invalid_system'), false);
                return;
            }

            if (bootValue && !isValid8Digit(bootValue)) {
                showPrompt(getString('security_patch_invalid_boot'), false);
                return;
            }

            if (vendorValue && !isValid8Digit(vendorValue)) {
                showPrompt(getString('security_patch_invalid_vendor'), false);
                return;
            }

            setDefaultPolicy({
                os_patch: systemValue || 'no',
                boot_patch: bootValue || 'no',
                vendor_patch: vendorValue || 'no'
            });
            const { errno } = await writeConfig();
            showPrompt(getString(errno === 0 ? 'security_patch_save_success' : 'security_patch_save_failed'), errno === 0);
        }
        dialog.close();
        loadCurrentConfig();
    });

    // Get button
    getButton.addEventListener('click', async () => {
        showPrompt(getString('security_patch_fetching'));
        const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--get-security-patch'],
                        { cwd: "/data/local/tmp", env: { PATH: "/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH" }});
        output.stdout.on('data', (data) => {
            showPrompt(getString('security_patch_fetched'), true, 1000);
            const patch = normalizePatchValue(data);
            systemPatchInput.value = 'prop';
            bootPatchInput.value = patch;
            vendorPatchInput.value = patch;
            devconfigPatchInput.value = data.trim();
        });
        output.stderr.on('data', (data) => {
            if (data.includes("failed")) {
                showPrompt(getString('security_patch_unable_to_connect'), false);
            } else {
                console.error(data);
            }
        });
        output.on('exit', (code) => {
            if (code !== 0) showPrompt(getString('security_patch_get_failed'), false);
        });
    });
}
