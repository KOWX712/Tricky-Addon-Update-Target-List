import { linkRedirect, basePath, showPrompt } from './main.js';
import { getString } from './language.js';
import { spawn } from 'kernelsu-alt';

const aboutDialog = document.getElementById('about-dialog');
const closeAbout = document.getElementById('close-about');

let isDownloading = false;

// Function to show about overlay
document.getElementById("about").addEventListener("click", () => {
    aboutDialog.show();
});

closeAbout.onclick = () => aboutDialog.close();

// Event listener for link redirect
document.getElementById('telegram').onclick = () => {
    linkRedirect('https://t.me/kowchannel');
}
document.getElementById('github').onclick = () => {
    linkRedirect('https://github.com/KOWX712/Tricky-Addon-Update-Target-List');
}

// Update to latest canary verison
document.getElementById('canary').onclick = () => {
    if (isDownloading) return;
    isDownloading = true;

    aboutDialog.close();
    showPrompt(getString("prompt_checking_update"), true, 10000);
    let htmlContent = '';
    const link = "https://nightly.link/KOWX712/Tricky-Addon-Update-Target-List/workflows/build/main?preview"
    const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--download', `${link}`],
                    { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk" } });
    output.stdout.on('data', (data) => {
        htmlContent += data;
    });
    output.on('exit', async (code) => {
        if (code === 0) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, "text/html");
            const zipURL = doc.querySelector('a[href$=".zip"]')?.href;

            if (zipURL) {
                // Extract versionCode
                const parts = zipURL.split("-");
                const version = parts.length >= 2 ? parts[parts.length - 2] : null;

                // Check local version
                const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--check-update', `${version}`], { env: { CANARY: "true" } });
                output.on('exit', (code) => {
                    if (code === 0) {
                        showPrompt(getString("prompt_no_update"));
                        isDownloading = false;
                    } else if (code === 1) {
                        downloadUpdate(zipURL);
                    }
                });
            } else {
                console.error("No link found.");
            }
        } else {
            console.error("Error fetching ZIP link");
            isDownloading = false;
        }
    });
}

// Update translation bundle
document.getElementById('locales').onclick = () => {
    if (isDownloading) return;
    isDownloading = true;

    aboutDialog.close();
    showPrompt(getString("prompt_checking_update"), true, 10000);
    fetch("https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/bot/locales_version")
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .catch(async () => {
            return fetch("https://hub.gitmirror.com/raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/bot/locales_version")
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.text()
                });
        })
        .then(async (version) => {
            const remote_version = version.trim();
            const local_version = await fetch('locales/version').then(response => response.text()).then(text => text.trim());

            if (Number(remote_version) <= Number(local_version)) {
                showPrompt(getString("prompt_no_update"));
                isDownloading = false;
            } else {
                showPrompt(getString("prompt_downloading"), true, 20000);
                const result = spawn('sh', [`${basePath}/common/get_extra.sh`, '--update-locales']);
                result.on('exit', (code) => {
                    isDownloading = false;
                    showPrompt(getString(code === 0 ? "prompt_translation_updated" : "prompt_translation_update_failed"), code === 0);
                    if (code === 0) window.location.reload();
                });
            }
        })
        .catch(error => {
            showPrompt(getString("prompt_translation_update_failed"), false);
            isDownloading = false;
        });
}

/**
 * Funtion to download update
 * @param {string} link - link of file to download
 * @returns {void}
 */
function downloadUpdate(link) {
    showPrompt(getString("prompt_downloading"), true, 20000);
    const download = spawn('sh', [`${basePath}/common/get_extra.sh`, '--get-update', `${link}`],
                        { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin" } });
    download.on('exit', (code) => {
        if (code === 0) {
            installUpdate();
        } else {
            showPrompt(getString("prompt_download_fail"), false);
            isDownloading = false;
        }
    });
}

/**
 * Funtion to install update
 * @returns {void}
 */
function installUpdate() {
    showPrompt(getString("prompt_installing"));
    const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--install-update'],
                    { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk" } });
    output.stderr.on('data', (data) => {
        console.error('Error during installation:', data);
    });
    output.on('exit', (code) => {
        if (code === 0) {
            showPrompt(getString("prompt_installed"));
        } else {
            showPrompt(getString("prompt_install_fail"), false);
        }
        isDownloading = false;
    });
}