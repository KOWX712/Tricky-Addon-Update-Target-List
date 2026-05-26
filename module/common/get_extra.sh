#!/bin/sh

# This file is the backend of JavaScript

MODPATH=${0%/*}
SKIPLIST="$MODPATH/tmp/skiplist"
XPOSED="$MODPATH/tmp/xposed"

mkdir -p "$MODPATH/tmp"

if [ "$MODPATH" = "/data/adb/modules/.TA_utl/common" ]; then
    MODDIR="/data/adb/modules/.TA_utl"
    MAGISK="true"
else
    MODDIR="/data/adb/modules/TA_utl"
fi

# probe for downloaders
# wget = low pref, no ssl.
# curl, has ssl on android, we use it if found
download() {
    if command -v curl >/dev/null 2>&1; then
        curl --connect-timeout 10 -Ls "$1"
    else
        busybox wget -T 10 --no-check-certificate -qO- "$1"
    fi
}

get_xposed() {
    mkdir -p "$MODPATH/tmp"
    touch "$XPOSED" "$SKIPLIST"
    pm list packages -3 | cut -d':' -f2 | grep -vxF -f "$SKIPLIST" | grep -vxF -f "$XPOSED" | busybox xargs -P $(busybox nproc) -n 1 sh -c '
        XPOSED=$1; SKIPLIST=$2; PACKAGE=$3
        APK_PATH=$(pm path "$PACKAGE" 2>/dev/null | head -n1 | cut -d: -f2)
        [ -z "$APK_PATH" ] && exit
        if unzip -l "$APK_PATH" | grep -qE "xposed_init|xposed/module.prop"; then
            echo "$PACKAGE" >> "$XPOSED"
        else
            echo "$PACKAGE" >> "$SKIPLIST"
        fi
    ' sh "$XPOSED" "$SKIPLIST"
    cat "$XPOSED"
}

case "$1" in
--download)
    shift
    download $@
    exit
    ;;
--xposed)
    get_xposed
    exit
    ;;
esac
