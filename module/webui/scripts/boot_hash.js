import { exec } from './assets/kernelsu.js';
import { showPrompt } from './main.js';

const bootHashOverlay = document.getElementById('boot-hash-overlay');
const bootHash = document.querySelector('.boot-hash-card');
const inputBox = document.getElementById('boot-hash-input');
const saveButton = document.getElementById('boot-hash-save-button');

// Remove empty spaces from input and convert to lowercase
window.trimInput = (input) => {
    input.value = input.value.replace(/\s+/g, '').toLowerCase();
};

// Function to handle Verified Boot Hash
document.getElementById("boot-hash").addEventListener("click", async () => {
    // Display boot hash menu
    document.body.classList.add("no-scroll");
    bootHashOverlay.style.display = "flex";
    setTimeout(() => {
        bootHashOverlay.style.opacity = 1;
        bootHash.classList.add('open');
    }, 10);

    // read current boot hash
    exec(`sed '/^#/d; /^$/d' /data/adb/boot_hash`)
        .then(({ errno, stdout }) => {
            if (errno !== 0) {
                inputBox.value = "";
            } else {
                const validHash = stdout.trim();
                inputBox.value = validHash || "";
            }
        });
});

const closeBootHashMenu = () => {
    document.body.classList.remove("no-scroll");
    bootHashOverlay.style.opacity = 0;
    bootHash.classList.remove('open');
    setTimeout(() => {
        bootHashOverlay.style.display = "none";
    }, 200);
};

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
            closeBootHashMenu();
        });
});

bootHashOverlay.addEventListener("click", (event) => {
    if (event.target === bootHashOverlay) closeBootHashMenu();
});

// Enter to save
inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveButton.click();
});