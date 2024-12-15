#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH
MODPATH=${0%/*}
SKIPLIST="$MODPATH/tmp/skiplist"
OUTPUT="$MODPATH/tmp/exclude-list"
KBOUTPUT="$MODPATH/tmp/.extra"

aapt() { "$MODPATH/aapt" "$@"; }

# probe for downloaders
# wget = low pref, no ssl.
# curl, has ssl on android, we use it if found
download() {
	if command -v curl > /dev/null 2>&1; then
		curl --connect-timeout 3 -s "$1"
        else
		busybox wget -T 3 --no-check-certificate -qO - "$1"
        fi
}      

get_kb() {
    check_wget
    wget --no-check-certificate -qO "$KBOUTPUT" "https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/.extra"
    [ -s "$KBOUTPUT" ] || rm -f "$KBOUTPUT"
}

get_unnecessary() {
    check_wget
    if [ ! -s "$OUTPUT" ] || [ ! -f "$OUTPUT" ]; then
        wget --no-check-certificate -q -O - "https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/more-excldue.json" 2>/dev/null | \
        grep -o '"package-name": *"[^"]*"' | \
        awk -F'"' '{print $4}' > "$OUTPUT"
    fi
    get_xposed
}

get_xposed() {
    pm list packages -3 | cut -d':' -f2 | grep -vxF -f "$SKIPLIST" | grep -vxF -f "$OUTPUT" | while read -r PACKAGE; do
        APK_PATH=$(pm path "$PACKAGE" | grep "base.apk" | cut -d':' -f2 | tr -d '\r')
        if [[ -n "$APK_PATH" ]]; then
            if aapt dump xmltree "$APK_PATH" AndroidManifest.xml 2>/dev/null | grep -qE "xposed.category|xposeddescription"; then
                echo "$PACKAGE" >> "$OUTPUT"
            fi
        fi
    done
}

check_update() {
    check_wget
    if [ -d "$MODPATH/update" ]; then
        JSON=$(wget --no-check-certificate -q -O - "https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/update.json") || exit 1
        REMOTE_VERSION=$(echo "$JSON" | grep -o '"versionCode": *[0-9]*' | awk -F: '{print $2}' | tr -d ' ')
        LOCAL_VERSION=$(grep -o 'versionCode=[0-9]*' "$MODPATH/update/module.prop" | awk -F= '{print $2}')
        if [ "$REMOTE_VERSION" -gt "$LOCAL_VERSION" ]; then
            echo "update"
        fi
    fi
}

case "$1" in 
	--kb) get_kb; exit ;;
	--unnecessary) get_unnecessary; exit ;;
	--xposed) get_xposed; exit ;;
	--update) check_update; exit ;;
esac
