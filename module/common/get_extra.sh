#!/bin/sh
MODPATH=${0%/*}
ORG_PATH="$PATH"
SKIPLIST="$MODPATH/tmp/skiplist"
OUTPUT="$MODPATH/tmp/exclude-list"
KBOUTPUT="$MODPATH/tmp/.extra"

if [ "$MODPATH" = "/data/adb/modules/.TA_utl/common" ]; then
    MODDIR="/data/adb/modules/.TA_utl"
    MAGISK="true"
else
    MODDIR="/data/adb/modules/TA_utl"
fi

aapt() { "$MODPATH/aapt" "$@"; }

# probe for downloaders
# wget = low pref, no ssl.
# curl, has ssl on android, we use it if found
download() {
    download_type=${1#--}
    download_url=$2
    download_output=$3

    PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH
    if command -v curl >/dev/null 2>&1; then
        if [ "$download_type" = "output" ]; then
            timeout 10 curl -Lo "$download_output" "$download_url"
        else
            timeout 3 curl -s "$download_url"
        fi
    else
        if [ "$download_type" = "output" ]; then
            timeout 10 busybox wget --no-check-certificate -qO "$download_output" "$download_url"
        else
            timeout 3 busybox wget --no-check-certificate -qO- "$download_url"
        fi
    fi
    PATH="$ORG_PATH"
}

get_kb() {
    download --output "https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/.extra" "$KBOUTPUT" 
    [ -s "$KBOUTPUT" ] || rm -f "$KBOUTPUT"
}

get_xposed() {
    pm list packages -3 | cut -d':' -f2 | grep -vxF -f "$SKIPLIST" | grep -vxF -f "$OUTPUT" | while read -r PACKAGE; do
        APK_PATH=$(pm path "$PACKAGE" | grep "base.apk" | cut -d':' -f2 | tr -d '\r')
        if [ -n "$APK_PATH" ]; then
            if aapt dump xmltree "$APK_PATH" AndroidManifest.xml 2>/dev/null | grep -qE "xposed.category|xposeddescription"; then
                echo "$PACKAGE" >>"$OUTPUT"
            fi
        fi
    done
}

get_unnecessary() {
    if [ ! -s "$OUTPUT" ] || [ ! -f "$OUTPUT" ]; then
        JSON=$(download --fetch "https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/more-exclude.json") || exit 1
        echo "$JSON" | grep -o '"package-name": *"[^"]*"' | awk -F'"' '{print $4}' >"$OUTPUT"
    fi
    get_xposed
}

check_update() {
    [ -f "$MODDIR/disable" ] && rm -f "$MODDIR/disable"
    LOCAL_VERSION=$(grep '^versionCode=' "$MODPATH/update/module.prop" | awk -F= '{print $2}')
    if [ "$REMOTE_VERSION" -gt "$LOCAL_VERSION" ] && [ ! -f "/data/adb/modules/TA_utl/update" ]; then
        if [ "$MAGISK" = "true" ]; then
            [ -d "/data/adb/modules/TA_utl" ] && rm -rf "/data/adb/modules/TA_utl"
            cp -rf "$MODPATH/update" "/data/adb/modules/TA_utl"
        else
            cp -f "$MODPATH/update/module.prop" "/data/adb/modules/TA_utl/module.prop"
        fi
        echo "update"
    fi
}

uninstall() {
    if [ "$MAGISK" = "true" ]; then
        cp -rf "$MODPATH/update" "/data/adb/modules/TA_utl"
    else
        cp -f "$MODPATH/update/module.prop" "/data/adb/modules/TA_utl/module.prop"
    fi
    touch "/data/adb/modules/TA_utl/remove"
}

get_update() {
    download --output "$ZIP_URL" "$MODPATH/tmp/module.zip"
    [ -s "$MODPATH/tmp/module.zip" ] || exit 1
}

install_update() {
    if command -v magisk >/dev/null 2>&1; then
        magisk --install-module "$MODPATH/tmp/module.zip"
    elif command -v apd >/dev/null 2>&1; then
        apd module install "$MODPATH/tmp/module.zip"
    elif command -v ksud >/dev/null 2>&1; then
        ksud module install "$MODPATH/tmp/module.zip"
    else
        exit 1
    fi

    rm -f "$MODPATH/tmp/module.zip"
    rm -f "$MODPATH/tmp/changelog.md"
    rm -f "$MODPATH/tmp/version"
}

release_note() {
    awk -v header="### $VERSION" '
        $0 == header { 
            print; 
            found = 1; 
            next 
        }
        found && /^###/ { exit }
        found { print }
    ' "$MODPATH/tmp/changelog.md"
}

set_security_patch() {
    # Find pif.json
    [ -f "/data/adb/modules/playintegrityfix/pif.json" ] && PIF="/data/adb/modules/playintegrityfix/pif.json"
    [ -f "/data/adb/pif.json" ] && PIF="/data/adb/pif.json"
    [ -f "/data/adb/modules/playintegrityfix/custom.pif.json" ] && PIF="/data/adb/modules/playintegrityfix/custom.pif.json"
    
    security_patch=$(grep '"SECURITY_PATCH"' "$PIF" | sed 's/.*: "//; s/".*//')
    [ -z "$security_patch" ] && security_patch=$(getprop ro.build.version.security_patch) # Fallback

    formatted_security_patch=$(echo "$security_patch" | sed 's/-//g')
    security_patch_after_1y=$(echo "$formatted_security_patch + 10000" | bc)
    TODAY=$(date +%Y%m%d)
    if [ -n "$formatted_security_patch" ] && [ "$TODAY" -lt "$security_patch_after_1y" ]; then
        TS_version=$(grep "versionCode=" "/data/adb/modules/tricky_store/module.prop" | cut -d'=' -f2)
        if [ "$TS_version" -lt 158 ]; then
            resetprop ro.vendor.build.security_patch "$security_patch"
            resetprop ro.build.version.security_patch "$security_patch"
        else
            SECURITY_PATCH_FILE="/data/adb/tricky_store/security_patch.txt"
            printf "system=prop\nboot=%s\nvendor=%s\n" "$security_patch" "$security_patch" > "$SECURITY_PATCH_FILE"
            chmod 644 "$SECURITY_PATCH_FILE"
        fi
    else
        echo "not set"
    fi
}

get_latest_security_patch() {
    security_patch=$(download --fetch https://source.android.com/docs/security/bulletin/pixel | grep -o "<td>[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}</td>" | head -n 1 | sed 's/<td>\(.*\)<\/td>/\1/')
    [ -n "$security_patch" ] && echo "$security_patch" || exit 1
}

case "$1" in
--kb)
    get_kb
    exit
    ;;
--unnecessary)
    get_unnecessary
    exit
    ;;
--xposed)
    get_xposed
    exit
    ;;
--check-update)
    REMOTE_VERSION="$2"
    check_update
    exit
    ;;
--uninstall)
    uninstall
    exit
    ;;
--get-update)
    ZIP_URL="$2"
    get_update
    exit
    ;;
--install-update)
    install_update
    exit
    ;;
--release-note)
    VERSION="$2"
    release_note
    exit
    ;;
--security-patch)
    set_security_patch
    exit
    ;;
--get-security-patch)
    get_latest_security_patch
    exit
    ;;
esac
