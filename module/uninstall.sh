MODPATH=${0%/*}
TS="/data/adb/modules/tricky_store"
SCRIPT_DIR="/data/adb/tricky_store"

# Enable back TSupport-A auto update
if [ -f "/storage/emulated/0/stop-tspa-auto-target" ]; then
    rm -f "/storage/emulated/0/stop-tspa-auto-target"
fi

# Remove residue and restore aosp keybox.
rm -rf "/data/adb/modules/.TA_utl"
rm -f "/data/adb/boot_hash"
if [ -d "$TS" ]; then
    rm -f "$TS/action.sh"
    rm -rf "$TS/webroot"
fi
xxd -r -p "$MODPATH/common/.default" | base64 -d > "$SCRIPT_DIR/keybox.xml"
