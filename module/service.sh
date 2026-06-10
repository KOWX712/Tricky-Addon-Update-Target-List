MODPATH=${0%/*}
PATH=$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk
HIDE_DIR="/data/adb/modules/.TA_utl"
TS="/data/adb/modules/tricky_store"
OMK="/data/adb/modules/oh_my_keymint"
TSPA="/data/adb/modules/tsupport-advance"

# Determine active engine — OMK takes priority if both are installed
if [ -d "$OMK" ] && [ ! -e "$OMK/disable" ] && [ ! -e "$OMK/remove" ]; then
    RUNTIME="$OMK"
    ENGINE="omk"
elif [ -d "$TS" ] && [ ! -e "$TS/disable" ] && [ ! -e "$TS/remove" ]; then
    RUNTIME="$TS"
    ENGINE="ts"
else
    # No engine found — nothing to do
    exit 0
fi

. "$MODPATH/common/manager.sh"

# Handle sensitive prop in background (only for TrickyStore — OMK manages props itself)
if [ "$ENGINE" = "ts" ]; then
    sh "$MODPATH/prop.sh" &
fi

# Disable TSupport-A auto update target to prevent overwrite
if [ -d "$TSPA" ]; then
    touch "/storage/emulated/0/stop-tspa-auto-target"
elif [ ! -d "$TSPA" ] && [ -f "/storage/emulated/0/stop-tspa-auto-target" ]; then
    rm -f "/storage/emulated/0/stop-tspa-auto-target"
fi

# Magisk operation
if [ "$MANAGER" = "MAGISK" ]; then
    # Hide module from Magisk manager
    if [ "$MODPATH" != "$HIDE_DIR" ]; then
        rm -rf "$HIDE_DIR"
        mkdir -p "$HIDE_DIR"
        busybox chcon --reference="$MODPATH" "$HIDE_DIR"
        cp -af "$MODPATH/." "$HIDE_DIR/"
    fi
    MODPATH="$HIDE_DIR"
    [ -f "$MODPATH/action.sh.old" ] && mv -f "$MODPATH/action.sh.old" "$MODPATH/action.sh"
else
    [ -f "$MODPATH/action.sh" ] && mv -f "$MODPATH/action.sh" "$MODPATH/action.sh.old"
    [ -d "$HIDE_DIR" ] && rm -rf "$HIDE_DIR"
fi

# Symlink to the active engine module
if [ -f "$MODPATH/action.sh" ] && [ ! -e "$RUNTIME/action.sh" ]; then
    ln -s "$MODPATH/action.sh" "$RUNTIME/action.sh"
fi
if [ ! -e "$RUNTIME/webroot" ]; then
    ln -s "$MODPATH/webui" "$RUNTIME/webroot"
fi

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

sh "$MODPATH/common/get_extra.sh" --xposed >/dev/null 2>&1

[ ! -f "$MODPATH/action.sh" ] || rm -rf "/data/adb/modules/TA_utl"

# Hide module from APatch, KernelSU, KSUWebUIStandalone, MMRL
nohup sh -c "
count=0
while kill -0 $PPID 2>/dev/null; do
    [ \$count -ge 5 ] && break
    sleep 1
    count=\$((count + 1))
done
rm -f '$MODPATH/module.prop'
" >/dev/null 2>&1 &
