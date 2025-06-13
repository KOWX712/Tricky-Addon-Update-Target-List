MODPATH=${0%/*}
TS="/data/adb/modules/tricky_store"

while [ -z "$(ls -A /data/adb/modules/)" ]; do
    sleep 1
done

if [ ! -d "$TS" ] || [ -f "$TS/remove" ]; then
    if [ -f "$MODPATH/action.sh" ]; then
        [ -d "/data/adb/modules/TA_utl" ] && rm -rf "/data/adb/modules/TA_utl"
        cp -rf "$MODPATH/common/temp" "/data/adb/modules/TA_utl"
        touch "/data/adb/modules/TA_utl/remove"
    else
        touch "$MODPATH/remove"
    fi
fi

[ -L "$TS/webroot" ] && rm -f "$TS/webroot"
[ -L "$TS/action.sh" ] && rm -f "$TS/action.sh"

# detect root manager
[ "$APATCH" = "true" ] && MANAGER="APATCH"
[ "$KSU" = "true" ] && MANAGER="KSU"
[ ! "$APATCH" = "true" ] && [ ! "$KSU" = "true" ] && MANAGER="MAGISK"
echo "MANAGER=$MANAGER" > "$MODPATH/common/manager.sh"
chmod 755 "$MODPATH/common/manager.sh"
