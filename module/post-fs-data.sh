MODPATH=${0%/*}
TS="/data/adb/modules/tricky_store"
OMK="/data/adb/modules/oh_my_keymint"

if [ -d "$TS" ] && [ ! -e "$TS/disable" ] && [ ! -e "$TS/remove" ]; then
    RUNTIME="$TS"
elif [ -d "$OMK" ] && [ ! -e "$OMK/disable" ] && [ ! -e "$OMK/remove" ]; then
    RUNTIME="$OMK"
else
    if [ -f "$MODPATH/action.sh" ]; then
        [ -d "/data/adb/modules/TA_utl" ] && rm -rf "/data/adb/modules/TA_utl"
        cp -rf "$MODPATH/common/update" "/data/adb/modules/TA_utl"
        touch "/data/adb/modules/TA_utl/remove"
    else
        touch "$MODPATH/remove"
    fi
    abort || exit
fi

[ -L "$RUNTIME/webroot" ] && rm -f "$RUNTIME/webroot"
[ -L "$RUNTIME/action.sh" ] && rm -f "$RUNTIME/action.sh"

# detect root manager
[ "$APATCH" = "true" ] && MANAGER="APATCH"
[ "$KSU" = "true" ] && MANAGER="KSU"
[ ! "$APATCH" = "true" ] && [ ! "$KSU" = "true" ] && MANAGER="MAGISK"
echo "MANAGER=$MANAGER" > "$MODPATH/common/manager.sh"
chmod 755 "$MODPATH/common/manager.sh" || true
