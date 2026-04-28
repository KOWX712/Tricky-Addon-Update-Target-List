import { exec } from 'kernelsu-alt';
import { showPrompt } from './main.js';
import { getString } from './language.js';

const propDialog = document.getElementById('prop-dialog');
const propHandlerSwitch = document.getElementById('prop-setting-switch');
const inputBox = document.getElementById('boot-hash-input');
const saveButton = document.getElementById('boot-hash-save-button');
const cancelButton = document.getElementById('cancel-boot-hash');

const propHandlerFile = "/data/adb/disable_prop_handler";
const bootHashFile = "/data/adb/boot_hash";

// Remove empty spaces from input and convert to lowercase
window.trimInput = (input) => {
    input.value = input.value.replace(/\s+/g, '').toLowerCase();
};

// Function to handle Verified Boot Hash
document.getElementById("prop-setting").addEventListener("click", async () => {
    propDialog.show();
    inputBox.label = getString("boot_hash_title");

    // Check if prop handler is disabled
    exec(`[ -f ${propHandlerFile} ]`)
        .then(({ errno }) => {
            propHandlerSwitch.selected = errno !== 0;
        });

    // read current boot hash
    exec(`sed '/[^#]/d; /^$/d' ${bootHashFile}`)
        .then(({ errno, stdout }) => {
            if (errno !== 0) {
                inputBox.value = "";
            } else {
                const validHash = stdout.trim();
                inputBox.value = validHash || "";
            }
        });
});

propHandlerSwitch.addEventListener("change", (e) => {
    const disabled = e.target.selected;
    const cmd = disabled ? 'rm -f' : 'touch';
    exec(`${cmd} ${propHandlerFile}`);
});

// Save button listener
saveButton.addEventListener("click", async () => {
    const inputValue = inputBox.value.trim();
    exec(`
        resetprop -n ro.boot.vbmeta.digest "${inputValue}"
        [ -z "${inputValue}" ] && rm -f ${bootHashFile} || {
            echo "${inputValue}" > ${bootHashFile}
            chmod 644 ${bootHashFile}
        }
        resetprop -c || true
    `, { env: { PATH: "$PATH:/data/adb/ksu/bin:/data/adb/ap/bin:/data/adb/magisk" } })
        .then(() => {
            showPrompt(getString("prompt_boot_hash_set"));
            propDialog.close();
        });
});

cancelButton.addEventListener("click", () => {
    propDialog.close();
});

// Enter to save
inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveButton.click();
});
