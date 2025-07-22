#!/bin/sh

# This file is the backend of JavaScript

MODPATH=${0%/*}
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
        curl --connect-timeout 10 -Ls "$1"
    else
        busybox wget -T 10 --no-check-certificate -qO- "$1"
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
        if [ "$CANARY" = "true" ]; then
            exit 1
        elif [ "$MAGISK" = "true" ]; then
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
    zip_file="$MODPATH/tmp/module.zip"
    . "$MODPATH/manager.sh"

    case $MANAGER in
        APATCH)
            apd module install "$zip_file" || exit 1
            ;;
        KSU)
            ksud module install "$zip_file" || exit 1
            ;;
        MAGISK)
            magisk --install-module "$zip_file" || exit 1
            ;;
        *)
            rm -f "$zip_file" "$MODPATH/tmp/changelog.md" "$MODPATH/tmp/version" || true
            exit 1
            ;;
    esac

    rm -f "$zip_file" "$MODPATH/tmp/changelog.md" "$MODPATH/tmp/version" || true
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
    # Look for security patch from PIF
    if [ -f "/data/adb/modules/playintegrityfix/pif.json" ]; then
        PIF="/data/adb/modules/playintegrityfix/pif.json"
        [ -f "/data/adb/pif.json" ] && PIF="/data/adb/pif.json"
    elif [ -f "/data/adb/modules/playintegrityfix/pif.prop" ]; then
        PIF="/data/adb/modules/playintegrityfix/pif.prop"
        [ -f "/data/adb/pif.prop" ] && PIF="/data/adb/pif.prop"
    elif [ -f "/data/adb/modules/playintegrityfix/custom.pif.json" ]; then
        PIF="/data/adb/modules/playintegrityfix/custom.pif.json"
    fi

    if [ -n "$PIF" ]; then
        if echo "$PIF" | grep -q "prop"; then
            security_patch=$(grep 'SECURITY_PATCH' "$PIF" | cut -d'=' -f2 | tr -d '\n')
        else
            security_patch=$(grep '"SECURITY_PATCH"' "$PIF" | sed 's/.*: "//; s/".*//')
        fi
    fi
    [ -z "$security_patch" ] && security_patch=$(getprop ro.build.version.security_patch) # Fallback

    formatted_security_patch=$(echo "$security_patch" | sed 's/-//g')
    security_patch_after_1y=$(echo "$formatted_security_patch + 10000" | bc)
    TODAY=$(date +%Y%m%d)
    if [ -n "$formatted_security_patch" ] && [ "$TODAY" -lt "$security_patch_after_1y" ]; then
        TS_version=$(grep "versionCode=" "/data/adb/modules/tricky_store/module.prop" | cut -d'=' -f2)
        # James Clef's TrickyStore fork (GitHub@qwq233/TrickyStore)
        if grep -q "James" "/data/adb/modules/tricky_store/module.prop" && ! grep -q "beakthoven" "/data/adb/modules/tricky_store/module.prop"; then
            SECURITY_PATCH_FILE="/data/adb/tricky_store/devconfig.toml"
            if grep -q "^securityPatch" "$SECURITY_PATCH_FILE"; then
                sed -i "s/^securityPatch .*/securityPatch = \"$security_patch\"/" "$SECURITY_PATCH_FILE"
            else
                if ! grep -q "^\\[deviceProps\\]" "$SECURITY_PATCH_FILE"; then
                    echo "securityPatch = \"$security_patch\"" >> "$SECURITY_PATCH_FILE"
                else
                    sed -i "s/^\[deviceProps\]/securityPatch = \"$security_patch\"\n&/" "$SECURITY_PATCH_FILE"
                fi
            fi
        # Official TrickyStore which supports custom security patch
        elif [ "$TS_version" -ge 158 ]; then
            SECURITY_PATCH_FILE="/data/adb/tricky_store/security_patch.txt"
            printf "system=prop\nboot=%s\nvendor=%s\n" "$security_patch" "$security_patch" > "$SECURITY_PATCH_FILE"
            chmod 644 "$SECURITY_PATCH_FILE"
        # Other
        else
            resetprop ro.vendor.build.security_patch "$security_patch"
            resetprop ro.build.version.security_patch "$security_patch"
        fi
    else
        echo "not set"
    fi
}

get_latest_security_patch() {
    security_patch=$(download "https://source.android.com/docs/security/bulletin/pixel" |
                     sed -n 's/.*<td>\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)<\/td>.*/\1/p' |
                     head -n 1)

    if [ -n "$security_patch" ]; then
        echo "$security_patch"
        exit 0
    elif ! ping -c 1 -W 5 "source.android.com" >/dev/null 2>&1; then
        echo "Connection failed" >&2
    fi
    exit 1
}

unknown_kb() {
    # adapted from https://github.com/TMLP-Team/keyboxGenerator/blob/main/keyboxGenerator_v2.0.py
    ECKEY="eckey.pem"
    CERT="cert.pem"
    RSAKEY="rsakey.pem"
    KEYBOX="keybox.xml"

    # gen ec_key
    openssl ecparam -name prime256v1 -genkey -noout -out "$ECKEY" || exit 1

    # gen cert
    openssl req -new -x509 -key "$ECKEY" -out "$CERT" -days 3650 -subj "/CN=Generated" || exit 1

    # gen rsa key
    openssl genrsa -out "$RSAKEY" 2048 || exit 1

    # convert rsa key to PKCS#1
    openssl rsa -in "$RSAKEY" -out "$RSAKEY" -traditional || exit 1

    # Generate keybox XML
    cat << KEYBOX_EOF > "$KEYBOX"
<?xml version="1.0"?>
    <AndroidAttestation>
        <NumberOfKeyboxes>1</NumberOfKeyboxes>
        <Keybox DeviceID="sw">
            <Key algorithm="ecdsa">
                <PrivateKey format="pem">
$(sed 's/^/                    /' "$ECKEY")
                </PrivateKey>
                <CertificateChain>
                    <NumberOfCertificates>1</NumberOfCertificates>
                        <Certificate format="pem">
$(sed 's/^/                        /' "$CERT")
                        </Certificate>
                </CertificateChain>
            </Key>
            <Key algorithm="rsa">
                <PrivateKey format="pem">
$(sed 's/^/                    /' "$RSAKEY")
                </PrivateKey>
            </Key>
        </Keybox>
</AndroidAttestation>
KEYBOX_EOF

    # cleanup
    rm -f $ECKEY $CERT $RSAKEY

    if [ -f $KEYBOX ]; then
        mv /data/adb/tricky_store/keybox.xml /data/adb/tricky_store/keybox.xml.bak
        mv "$KEYBOX" /data/adb/tricky_store/keybox.xml
    else
        exit 1
    fi
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
--unknown-kb)
    unknown_kb
    exit
    ;;
esac
