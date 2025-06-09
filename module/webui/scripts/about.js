import { linkRedirect, basePath, showPrompt } from './main.js';
import { translations } from './language.js';
import { spawn, toast } from './assets/kernelsu.js';

const aboutOverlay = document.getElementById('about-overlay');
const aboutContent = document.querySelector('.about-menu');
const closeAbout = document.getElementById('close-about');

let isDownloading = false;

// Function to show about overlay
document.getElementById("about").addEventListener("click", () => {
    // Show about menu
    setTimeout(() => {
        document.body.classList.add("no-scroll");
        aboutOverlay.style.display = 'flex';
        setTimeout(() => {
            aboutOverlay.style.opacity = '1';
            aboutContent.classList.add('open');
        }, 10);
    }, 80);
});

const hideMenu = () => {
    document.body.classList.remove("no-scroll");
    aboutOverlay.style.opacity = '0';
    aboutContent.classList.remove('open');
    setTimeout(() => {
        aboutOverlay.style.display = 'none';
    }, 200);
};

closeAbout.addEventListener("click", hideMenu);
aboutOverlay.addEventListener('click', (event) => {
    if (event.target === aboutOverlay) hideMenu();
});

// Event listener for link redirect
document.getElementById('telegram').addEventListener('click', () => {
    linkRedirect('https://t.me/kowchannel');
});
document.getElementById('github').addEventListener('click', () => {
    linkRedirect('https://github.com/KOWX712/Tricky-Addon-Update-Target-List');
});

// Update to latest canary verison
document.getElementById('canary').addEventListener('click', async () => {
    if (isDownloading) return;
    isDownloading = true;
    try {
        showPrompt("prompt_checking_update", true, 10000);
        const url = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://nightly.link/KOWX712/Tricky-Addon-Update-Target-List/workflows/build/main?preview");
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const zipURL = doc.querySelector('a[href$=".zip"]')?.href;

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
    } catch (error) {
        console.error("Error fetching ZIP link:", error);
        isDownloading = false;
    }
});

/**
 * Funtion to download update
 * @param {string} link - link of file to download
 * @returns {void}
 */
function downloadUpdate(link) {
    showPrompt("prompt_downloading", true, 10000);
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
