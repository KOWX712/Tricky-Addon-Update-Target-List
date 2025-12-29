#!/bin/sh

# This file is the backend of JavaScript

MODPATH=${0%/*}
SKIPLIST="$MODPATH/tmp/skiplist"
XPOSED="$MODPATH/tmp/xposed"
PATH=$MODPATH/bin:$PATH

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
    pm list packages -3 | cut -d':' -f2 | grep -vxF -f "$SKIPLIST" | grep -vxF -f "$XPOSED" | while read -r PACKAGE; do
        APK_PATH=$(pm path "$PACKAGE" 2>/dev/null | head -n1 | cut -d: -f2)
        [ -z "$APK_PATH" ] && continue
        if unzip -p $APK_PATH AndroidManifest.xml | tr -d '\0' | grep -q "xposedmodule"; then
            echo "$PACKAGE" >> "$XPOSED"
        else
            echo "$PACKAGE" >> "$SKIPLIST"
        fi
    done
    cat "$XPOSED"
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

update_locales() {
    link1="https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/bot/locales.zip"
    link2="https://raw.gitmirror.com/KOWX712/Tricky-Addon-Update-Target-List/bot/locales.zip"
    error=0
    download "$link1" > "$MODPATH/tmp/locales.zip" || download "$link2" > "$MODPATH/tmp/locales.zip"
    [ -s "$MODPATH/tmp/locales.zip" ] || error=1
    unzip -o "$MODPATH/tmp/locales.zip" -d "$MODDIR/webui/locales" || error=1
    if [ -d "/data/adb/modules_update/TA_utl" ]; then
        unzip -o "$MODPATH/tmp/locales.zip" -d "/data/adb/modules_update/TA_utl/webui/locales" || error=1
    fi
    rm -f "$MODPATH/tmp/locales.zip"
    [ "$error" -eq 0 ] || exit 1
}

uninstall() {
    . "$MODPATH/manager.sh"

    case $MANAGER in
        APATCH)
            cp -f "$MODPATH/update/module.prop" "$MODPATH/module.prop"
            apd module uninstall TA_utl || touch "$MODPATH/remove"
            ;;
        KSU)
            cp -f "$MODPATH/update/module.prop" "$MODPATH/module.prop"
            ksud module uninstall TA_utl || touch "$MODPATH/remove"
            ;;
        MAGISK)
            cp -rf "$MODPATH/update" "/data/adb/modules/TA_utl"
            magisk --remove-module -n TA_utl || touch "/data/adb/modules/TA_utl/remove"
            ;;
        *)
            touch "/data/adb/modules/TA_utl/remove"
            exit 1
            ;;
    esac
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

    update_locales || true
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
    elif [ -f "/data/adb/modules/playintegrityfix/custom.pif.prop" ]; then
        PIF="/data/adb/modules/playintegrityfix/custom.pif.prop"
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
        # Dakkshesh's fork (GitHub@beakthoven/TrickyStore) or Official TrickyStore which supports custom security patch
        elif [ "$TS_version" -ge 158 ] || grep -q "beakthoven" "/data/adb/modules/tricky_store/module.prop"; then
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
    keygen gen_ec_key > "$ECKEY" || exit 1

    # gen cert
    keygen gen_cert "$ECKEY" > "$CERT" || exit 1

    # gen rsa key
    keygen gen_rsa_key > "$RSAKEY" || exit 1

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
--check-update)
    REMOTE_VERSION="$2"
    check_update
    exit
    ;;
--update-locales)
    update_locales
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
