import { exec, spawn } from 'kernelsu-alt';
import { basePath, showPrompt, linkRedirect } from './main.js';
import { updateCard } from './applist.js';
import { marked } from 'marked';

const updateDialog = document.getElementById('update-dialog');
const closeUpdate = document.getElementById('close-update');
const releaseNotes = document.querySelector('.changelog');
const installButton = document.querySelector('.install');
const rebootButton = document.querySelector('.reboot');

let remoteVersionCode, remoteVersion, zipURL, changelogURL, downloading = false;
export let connection = true;

// Function to download file
function downloadFile(targetURL, fileName) {
    return new Promise((resolve, reject) => {
        fetch(targetURL)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                const file = new File([blob], fileName, { type: blob.type });
                const reader = new FileReader();
                reader.onload = () => {
                    const base64Data = reader.result.split(',')[1];
                    exec(`echo ${base64Data} | base64 -d > ${basePath}/common/tmp/${fileName}`)
                        .then(({ errno, stderr }) => {
                            errno === 0 ? resolve() : reject(stderr);
                        });
                };
                reader.readAsDataURL(file);
            })
            .catch(reject);
    });
}

// Function to check for updates
export async function updateCheck() {
    try {
        const response = await fetch("https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/update.json")
            .catch(async () => {
                return fetch("https://raw.gitmirror.com/KOWX712/Tricky-Addon-Update-Target-List/main/update.json");
            });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        connection = true;
        const data = await response.json();
        remoteVersionCode = data.versionCode;
        remoteVersion = data.version;
        zipURL = data.zipUrl;
        changelogURL = data.changelog;

        const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--check-update', `${remoteVersionCode}`]);
        output.stdout.on('data', (data) => {
            if (data.includes("update")) {
                updateCard.style.display = "flex";
                setupUpdateMenu();
            }
        });
    } catch (error) {
        console.error("Error fetching JSON or executing command:", error);
        showPrompt("prompt_no_internet", false);
        connection = false;
    }
}

// Function to render changelog
function renderChangelog() {
    exec(`sh ${basePath}/common/get_extra.sh --release-note ${remoteVersion}`)
        .then(({ stdout }) => {
            window.linkRedirect = linkRedirect;
            marked.setOptions({
                sanitize: true,
                walkTokens(token) {
                    if (token.type === 'link') {
                        const href = token.href;
                        token.href = "javascript:void(0);";
                        token.type = "html";
                        token.text = `<a href="javascript:void(0);" onclick="linkRedirect('${href}')">${token.text}</a>`;
                    }
                }
            });
            const cleanedChangelog = stdout
                .split('\n')
                .filter(line => line.trim() !== '')
                .join('\n');
            const formattedChangelog = marked.parse(cleanedChangelog);
            releaseNotes.innerHTML = formattedChangelog;
        });
}

// Function to setup update menu
function setupUpdateMenu() {
    // Update card
    updateCard.addEventListener('click', async () => {
        const { stdout } = await exec(`
            [ -f ${basePath}/common/tmp/module.zip ] || echo "noModule"
            [ -f ${basePath}/common/tmp/changelog.md ] || echo "noChangelog"
            [ ! -f /data/adb/modules/TA_utl/update ] || echo "updated"
        `);
        if (stdout.trim().includes("updated")) {
            installButton.style.display = "none";
            rebootButton.style.display = "flex";
            updateDialog.show();
        } else if (stdout.trim().includes("noChangelog")) {
            showPrompt("prompt_downloading");
            await downloadFile(changelogURL, "changelog.md");
            renderChangelog();
            updateDialog.show();
            setTimeout(() => {
                updateCard.click();
            }, 200);
        } else if (stdout.trim().includes("noModule")) {
            if (downloading) return;
            downloading = true;
            const download = spawn('sh', [`${basePath}/common/get_extra.sh`, '--get-update', `${zipURL}`],
                                { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin" } });
            download.on('exit', (code) => {
                downloading = false;
                if (code === 0) {
                    showPrompt("prompt_downloaded");
                    installButton.style.display = "flex";
                } else {
                    showPrompt("prompt_download_fail", false);
                }
            });
        } else {
            installButton.style.display = "flex";
            renderChangelog();
            updateDialog.show();
        }
    });

    // Close update menu
    closeUpdate.addEventListener("click", () => updateDialog.close());

    // Install button
    installButton.addEventListener('click', async () => {
        showPrompt("prompt_installing");
        const output = spawn('sh', [`${basePath}/common/get_extra.sh`, '--install-update'],
                        { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk" } });
        output.stderr.on('data', (data) => {
            console.error('Error during installation:', data);
        });
        output.on('exit', (code) => {
            if (code === 0) {
                showPrompt("prompt_installed");
                installButton.style.display = "none";
                rebootButton.style.display = "flex";
            } else {
                showPrompt("prompt_install_fail", false);
            }
        });
    });

    // Reboot button
    rebootButton.addEventListener('click', async () => {
        try {
            showPrompt("prompt_rebooting");
            await new Promise(resolve => setTimeout(resolve, 1000));
            await exec("svc power reboot");
        } catch (error) {
            showPrompt("prompt_reboot_fail", false);
            console.error('Fail to reboot:', error);
        }
    });
}
