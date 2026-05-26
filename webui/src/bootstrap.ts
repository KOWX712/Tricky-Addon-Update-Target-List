import { exec } from 'kernelsu-alt'
import { isSupported, renderBlockingPage, UPDATE_URL } from './webview/webview'

// Check is webview version met requirement
if (!isSupported()) {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = renderBlockingPage()
  document.getElementById('update-webview')!.onclick = async () => {
    const result = await exec(`am start -a android.intent.action.VIEW -d '${UPDATE_URL}'`)
    if (result.errno !== 0) window.open(UPDATE_URL, '_blank')
  }
} else {
  try {
    await import('./main')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<p id="load-error">Failed to load app: ${msg}</p>`
  }
}
