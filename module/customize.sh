SKIPUNZIP=0
DEBUG=false
CONFIG_DIR="/data/adb/tricky_store"
MODID=`grep_prop id $TMPDIR/module.prop`
NEW_MODID=".TA_utl"

MIN_KERNELSU_VERSION=32234
MIN_APATCH_VERSION=11159

eol_setup() {
    old_modpath="/data/adb/modules/TA_utl"

    if [ -d "$old_modpath" ]; then
        # update link
        js="$(find "$old_modpath" -name "index*.js" -type f)"
        sed -i 's|main/.extra|keybox/.extra|g' "$js"
        # disable update
        sed -i 's|versionCode=.*|versionCode=9999|g' "$old_modpath/common/update/module.prop"
        rm -f "$old_modpath/module.prop"
    fi

    ui_print "$1"
    abort "- EOL setup has been configured, valid keybox option now should work correctly"
}

ui_print " "
if [ "$APATCH" ]; then
    [ "$APATCH_VER_CODE" -ge $MIN_APATCH_VERSION ] || eol_setup "! Unsupported APatch version, please update APatch to $MIN_APATCH_VERSION or higher"
    ui_print "- APatch:$APATCH_VER│$APATCH_VER_CODE"
    ACTION=false
elif [ "$KSU" ]; then
    [ "$KSU_VER_CODE" -ge $MIN_KERNELSU_VERSION ] || eol_setup "! Unsupported KernelSU version, please update KernelSU to $MIN_KERNELSU_VERSION or higher"
    if [ "$KSU_NEXT" ]; then
        ui_print "- KernelSU Next:$KSU_KERNEL_VER_CODE│$KSU_VER_CODE"
    else
        ui_print "- KernelSU:$KSU_KERNEL_VER_CODE│$KSU_VER_CODE"
    fi
    ACTION=false
elif [ "$MAGISK_VER_CODE" ]; then
    ui_print "- Magisk:$MAGISK_VER│$MAGISK_VER_CODE"
else
    ui_print " "
    ui_print "! recovery is not supported"
    abort " "
fi

[ -d "/data/adb/modules/tricky_store" ] || ui_print "! Warning: Tricky store module not found"

ui_print "- Installing..."
# Magisk cleanup
rm -rf "/data/adb/modules/$NEW_MODID"

if [ "$ACTION" = "false" ]; then
    rm -f "$MODPATH/action.sh"
    NEW_MODID="$MODID"
else
    mkdir -p "$MODPATH/common/update/common"
    cp "$MODPATH/common/.default" "$MODPATH/common/update/common/.default"
    cp "$MODPATH/uninstall.sh" "$MODPATH/common/update/uninstall.sh"
fi

cp "$MODPATH/module.prop" "$MODPATH/common/update/module.prop"

set_perm $MODPATH/common/get_extra.sh 0 2000 0755

ui_print "- Finalizing..."

if [ -f "/data/adb/boot_hash" ]; then
    hash_value=$(grep -v '^#' "/data/adb/boot_hash" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
    [ -z "$hash_value" ] && rm -f /data/adb/boot_hash || echo "$hash_value" > /data/adb/boot_hash
fi

if [ -f "/data/adb/security_patch" ]; then
    if grep -q "^auto_config=1" "/data/adb/security_patch"; then
        touch "$CONFIG_DIR/security_patch_auto_config"
    fi
    rm -f "/data/adb/security_patch"
fi

if [ ! -f "$CONFIG_DIR/system_app" ]; then
    SYSTEM_APP="
    com.google.android.gms
    com.google.android.gsf
    com.android.vending
    com.oplus.deepthinker
    com.heytap.speechassist
    com.coloros.sceneservice"
    touch "$CONFIG_DIR/system_app"
    for app in $SYSTEM_APP; do
        if pm list packages -s | grep -q "$app"; then
            echo "$app" >> "$CONFIG_DIR/system_app"
        fi
    done
fi

ui_print " "
ui_print "! This module is not a part of the Tricky Store module. DO NOT report any issues to Tricky Store if encountered."
ui_print " "

sleep 0.5

ui_print "- Installation completed successfully! "
ui_print " "
