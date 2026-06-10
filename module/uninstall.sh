MODPATH=${0%/*}
TS="/data/adb/modules/tricky_store"
OMK="/data/adb/modules/oh_my_keymint"
SCRIPT_DIR="/data/adb/tricky_store"
OMK_KEYBOX_DIR="/data/misc/keystore/omk"

# Enable back TSupport-A auto update
if [ -f "/storage/emulated/0/stop-tspa-auto-target" ]; then
    rm -f "/storage/emulated/0/stop-tspa-auto-target"
fi

# Remove residue
rm -rf "/data/adb/modules/.TA_utl"
rm -f "/data/adb/boot_hash"
rm -f "/data/adb/tricky_store/security_patch_auto_config"
rm -f "/data/adb/tricky_store/system_app"

# Clean up symlinks from TrickyStore
if [ -d "$TS" ]; then
    [ -L "$TS/webroot" ] && rm -f "$TS/webroot"
    [ -L "$TS/action.sh" ] && rm -f "$TS/action.sh"
fi

# Clean up symlinks from Oh My Keymint
if [ -d "$OMK" ]; then
    [ -L "$OMK/webroot" ] && rm -f "$OMK/webroot"
    [ -L "$OMK/action.sh" ] && rm -f "$OMK/action.sh"
fi

# Restore AOSP keybox for TrickyStore
if [ -d "$SCRIPT_DIR" ]; then
    mv -f "$SCRIPT_DIR/keybox.xml" "$SCRIPT_DIR/keybox.xml.bak"
    xxd -r -p "$MODPATH/common/.default" | base64 -d > "$SCRIPT_DIR/keybox.xml"
fi

# Restore AOSP keybox for OMK
if [ -d "$OMK_KEYBOX_DIR" ]; then
    mv -f "$OMK_KEYBOX_DIR/keybox.xml" "$OMK_KEYBOX_DIR/keybox.xml.bak"
    xxd -r -p "$MODPATH/common/.default" | base64 -d > "$OMK_KEYBOX_DIR/keybox.xml"
    # Restore proper ownership for OMK keybox
    chown 1017:1017 "$OMK_KEYBOX_DIR/keybox.xml" 2>/dev/null
    chmod 0600 "$OMK_KEYBOX_DIR/keybox.xml" 2>/dev/null
fi
