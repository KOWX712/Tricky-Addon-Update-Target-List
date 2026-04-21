import { exec } from 'kernelsu-alt';
import * as webview from './webview.js';

function linkRedirect(link) {
    exec(`am start -a android.intent.action.VIEW -d ${link}`)
        .then(({ errno }) => {
            if (errno !== 0) window.open(link, '_blank');
        })
        .catch(() => window.open(link, '_blank'));
}

async function loadApp() {
    await import('./main.js');
    await import('./about.js');
    await import('./boot_hash.js');
    await import('./security_patch.js');
}

async function bootstrap() {
    document.getElementById('update-webview').onclick = () => linkRedirect(webview.UPDATE_URL);

    if (!webview.isSupported()) {
        document.getElementById('webview-update-page')?.classList.remove('hidden');
        return;
    }

    await loadApp();
}

bootstrap().catch((error) => {
    console.error('Failed to bootstrap app:', error);
});
