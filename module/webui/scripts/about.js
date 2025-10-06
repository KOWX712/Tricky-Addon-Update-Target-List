import { linkRedirect, basePath, showPrompt } from './main.js';
import { spawn } from './assets/kernelsu.js';

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

    showPrompt("prompt_checking_update", true, 10000);
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
            const zipURL = doc.querySelector('a[href$)=".zip"]')?.href;

            if (zipURL) {
                // Extract versionCode
                const parts = zipURL.split("-");
                const version = parts.length >= 2 ? parts[parts.length - 2] : null;

                // Check local version
                const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--check-update', `${version}`], { env: { CANARY: "true" } });
                output.on('exit', (code) => {
                    if (code === 0) {
                        showPrompt("prompt_no_update");
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

/**
 * Funtion to download update
 * @param {string} link - link of file to download
 * @returns {void}
 */
function downloadUpdate(link) {
    showPrompt("prompt_downloading", true, 20000);
    const download = spawn('sh', [`${basePath}/common/get_extra.sh`, '--get-update', `${link}`],
                        { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin" } });
    download.on('exit', (code) => {
        if (code === 0) {
            installUpdate();
        } else {
            showPrompt("prompt_download_fail", false);
            isDownloading = false;
        }
    });
}

/**
 * Funtion to install update
 * @returns {void}
 */
function installUpdate() {
    showPrompt("prompt_installing");
    const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--install-update'],
                    { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk" } });
    output.stderr.on('data', (data) => {
        console.error('Error during installation:', data);
    });
    output.on('exit', (code) => {
        if (code === 0) {
            showPrompt("prompt_installed");
        } else {
            showPrompt("prompt_install_fail", false);
        }
        isDownloading = false;
    });
}