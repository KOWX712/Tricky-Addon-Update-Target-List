#!/bin/sh

# This file is the backend of JavaScript

MODPATH=${0%/*}
ORG_PATH="$PATH"
SKIPLIST="$MODPATH/tmp/skiplist"
XPOSED="$MODPATH/tmp/xposed"

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
    if command -v curl >/dev/null 2>&1; then
        timeout 10 curl -Ls "$1"
    else
        timeout 10 busybox wget --no-check-certificate -qO- "$1"
    fi
}

get_xposed() {
    touch "$XPOSED"
    pm list packages -3 | cut -d':' -f2 | grep -vxF -f "$SKIPLIST" | grep -vxF -f "$XPOSED" | while read -r PACKAGE; do
        APK_PATH=$(pm path "$PACKAGE" | grep "base.apk" | cut -d':' -f2 | tr -d '\r')
        if [ -n "$APK_PATH" ]; then
            if aapt dump xmltree "$APK_PATH" AndroidManifest.xml 2>/dev/null | grep -qE "xposed.category|xposeddescription"; then
                echo "$PACKAGE" >> "$XPOSED"
            fi
        fi
    done
    cat "$XPOSED"
}

get_applist() {
    pm list packages -3 | awk -F: '{print $2}'
    [ -s "/data/adb/tricky_store/system_app" ] && SYSTEM_APP=$(cat "/data/adb/tricky_store/system_app" | tr '\n' '|' | sed 's/|*$//') || SYSTEM_APP=""
    [ -z "$SYSTEM_APP" ] || pm list packages -s | awk -F: '{print $2}' | grep -Ex "$SYSTEM_APP" || true
}

get_appname() {
    base_apk=$(pm path $package_name | head -n1 | awk -F: '{print $2}')
    app_name=$(aapt dump badging $base_apk 2>/dev/null | grep "application-label:" | sed "s/application-label://; s/'//g")
    [ -z "$app_name" ] && app_name="$package_name"
    echo "$app_name"
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
    download "$ZIP_URL" > "$MODPATH/tmp/module.zip"
    [ -s "$MODPATH/tmp/module.zip" ] || exit 1
}

install_update() {
    if command -v magisk >/dev/null 2>&1; then
        magisk --install-module "$MODPATH/tmp/module.zip" || exit 1
    elif command -v apd >/dev/null 2>&1; then
        apd module install "$MODPATH/tmp/module.zip" || exit 1
    elif command -v ksud >/dev/null 2>&1; then
        ksud module install "$MODPATH/tmp/module.zip" || exit 1
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
    security_patch=$(download "https://source.android.com/docs/security/bulletin/pixel" | grep -o "<td>[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}</td>" | head -n 1 | sed 's/<td>\(.*\)<\/td>/\1/')
    [ -n "$security_patch" ] && echo "$security_patch" || exit 1
}

case "$1" in
--xposed)
    get_xposed
    exit
    ;;
--applist)
    get_applist
    exit
    ;;
--appname)
    package_name="$2"
    get_appname
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
