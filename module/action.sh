###########################################
## This file is NOT a part of Tricky Store
###########################################

MODPATH="/data/adb/modules/.TA_utl"
ORG_PATH="$PATH"
TMP_DIR="$MODPATH/common/tmp"
APK_PATH="$TMP_DIR/base.apk"
REPO="KOWX712/KsuWebUIStandalone"

TS_ID="tricky_store"
OMK_ID="oh_my_keymint"

if [ -d "/data/adb/modules/$TS_ID" ] && [ ! -e "/data/adb/modules/$TS_ID/remove" ]; then
    ID=$TS_ID
elif [ -d "/data/adb/modules/$OMK_ID" ] && [ ! -e "/data/adb/modules/$OMK_ID/remove" ]; then
    ID=$OMK_ID
else
    echo "! Tricky Store not found"
    exit 1
fi

manual_download() {
    echo "$1"
    sleep 3
    am start -a android.intent.action.VIEW -d "https://github.com/$REPO/releases"
    exit 1
}

download() {
    PATH=/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH
    if curl --version >/dev/null 2>&1; then
        curl --connect-timeout 10 -Ls "$1"
    else
        busybox wget -T 10 --no-check-certificate -qO- "$1"
    fi
    PATH="$ORG_PATH"
}

get_webui() {
    echo "- Downloading KSU WebUI Standalone..."
    API="https://api.github.com/repos/$REPO/releases/latest"
    ping -c 1 -w 5 raw.githubusercontent.com &>/dev/null || manual_download "! Error: Unable to connect to raw.githubusercontent.com, please download manually."
    URL=$(download "$API" | grep -o '"browser_download_url": "[^"]*"' | cut -d '"' -f 4) || manual_download "! Error: Unable to get latest version, please download manually."
    download "$URL" > "$APK_PATH" || manual_download "! Error: APK download failed, please download manually."

    echo "- Installing..."
    pm install -r "$APK_PATH" || {
        rm -f "$APK_PATH"
        manual_download "! Error: APK installation failed, please download manually.."
    }

    echo "- Done."
    rm -f "$APK_PATH"

    echo "- Launching WebUI..."
    am start -n "io.github.a13e300.ksuwebui/.WebUIActivity" -e id "$ID"
}

# Launch KSUWebUI standalone or MMRL, install KSUWebUI standalone if both are not installed
if pm path io.github.a13e300.ksuwebui >/dev/null 2>&1; then
    echo "- Launching WebUI in KSUWebUIStandalone..."
    am start -n "io.github.a13e300.ksuwebui/.WebUIActivity" -e id "$ID"
elif pm path com.dergoogler.mmrl.wx > /dev/null 2>&1; then
    echo "- Launching WebUI in WebUI X..."
    am start -n "com.dergoogler.mmrl.wx/.ui.activity.webui.WebUIActivity" -e MOD_ID "$ID"
else
    echo "! No WebUI app found"
    get_webui
fi

echo "- WebUI launched successfully."
