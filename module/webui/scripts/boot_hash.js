import { exec } from './assets/kernelsu.js';
import { showPrompt } from './main.js';

const bootHashDialog = document.getElementById('boot-hash-dialog');
const inputBox = document.getElementById('boot-hash-input');
const saveButton = document.getElementById('boot-hash-save-button');
const cancelButton = document.getElementById('cancel-boot-hash');

// Remove empty spaces from input and convert to lowercase
window.trimInput = (input) => {
    input.value = input.value.replace(/\s+/g, '').toLowerCase();
};

// Function to handle Verified Boot Hash
document.getElementById("boot-hash").addEventListener("click", async () => {
    bootHashDialog.show();

    // read current boot hash
    exec(`sed '/[^#]/d; /^$/d' /data/adb/boot_hash`)
        .then(({ errno, stdout }) => {
            if (errno !== 0) {
                inputBox.value = "";
            } else {
                const validHash = stdout.trim();
                inputBox.value = validHash || "";
            }
        });
});

// Save button listener
saveButton.addEventListener("click", async () => {
    const inputValue = inputBox.value.trim();
    exec(`
        resetprop -n ro.boot.vbmeta.digest "${inputValue}"
        [ -z "${inputValue}" ] && rm -f /data/adb/boot_hash || {
            echo "${inputValue}" > /data/adb/boot_hash
            chmod 644 /data/adb/boot_hash
        }
    `, { env: { PATH: "/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH" } })
        .then(() => {
            showPrompt("prompt_boot_hash_set");
            bootHashDialog.close();
        });
});

cancelButton.addEventListener("click", () => {
    bootHashDialog.close();
});

// Enter to save
inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveButton.click();
});
