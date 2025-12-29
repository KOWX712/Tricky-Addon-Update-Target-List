MODPATH=${0%/*}
PATH=$MODPATH/common/bin:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
HIDE_DIR="/data/adb/modules/.TA_utl"
TS="/data/adb/modules/tricky_store"
TSPA="/data/adb/modules/tsupport-advance"

add_denylist_to_target() {
    exclamation_target=$(grep '!' "/data/adb/tricky_store/target.txt" | sed 's/!$//')
    question_target=$(grep '?' "/data/adb/tricky_store/target.txt" | sed 's/?$//')
    target=$(sed 's/[!?]$//' /data/adb/tricky_store/target.txt)
    denylist=$(magisk --denylist ls 2>/dev/null | awk -F'|' '{print $1}' | grep -v "isolated")
    
    printf "%s\n" "$target" "$denylist" | sort -u > "/data/adb/tricky_store/target.txt"

    for target in $exclamation_target; do
        sed -i "s/^$target$/$target!/" "/data/adb/tricky_store/target.txt"
    done

    for target in $question_target; do
        sed -i "s/^$target$/$target?/" "/data/adb/tricky_store/target.txt"
    done
}

# Spoof security patch
if [ -f "/data/adb/tricky_store/security_patch_auto_config" ]; then
    sh "$MODPATH/common/get_extra.sh" --security-patch
fi

# Handle sensitive prop in background
sh "$MODPATH/prop.sh" &

# Disable TSupport-A auto update target to prevent overwrite
if [ -d "$TSPA" ]; then
    touch "/storage/emulated/0/stop-tspa-auto-target"
elif [ ! -d "$TSPA" ] && [ -f "/storage/emulated/0/stop-tspa-auto-target" ]; then
    rm -f "/storage/emulated/0/stop-tspa-auto-target"
fi

# Magisk operation
if [ -f "$MODPATH/action.sh" ]; then
    # Hide module from Magisk manager
    if [ "$MODPATH" != "$HIDE_DIR" ]; then
        rm -rf "$HIDE_DIR"
        mkdir -p "$HIDE_DIR"
        busybox chcon --reference="$MODPATH" "$HIDE_DIR"
        cp -af "$MODPATH/." "$HIDE_DIR/"
    fi
    MODPATH="$HIDE_DIR"

    # Add target from denylist
    # To trigger this, choose "Select from DenyList" in WebUI once
    [ -f "/data/adb/tricky_store/target_from_denylist" ] && add_denylist_to_target
else
    [ -d "$HIDE_DIR" ] && rm -rf "$HIDE_DIR"
fi

# Hide module from APatch, KernelSU, KSUWebUIStandalone, MMRL
rm -f "$MODPATH/module.prop"

# Symlink tricky store
if [ -f "$MODPATH/action.sh" ] && [ ! -e "$TS/action.sh" ]; then
    ln -s "$MODPATH/action.sh" "$TS/action.sh"
fi
if [ ! -e "$TS/webroot" ]; then
    ln -s "$MODPATH/webui" "$TS/webroot"
fi

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

# Create temporary directory
mkdir -p "$MODPATH/common/tmp"

sh "$MODPATH/common/get_extra.sh" --xposed >/dev/null 2>&1 &

[ -f "$MODPATH/action.sh" ] && rm -rf "/data/adb/modules/TA_utl"
