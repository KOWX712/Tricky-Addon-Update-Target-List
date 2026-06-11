MODPATH=${0%/*}
TS="/data/adb/modules/tricky_store"
OMK="/data/adb/modules/oh_my_keymint"

# Enable back TSupport-A auto update
if [ -f "/storage/emulated/0/stop-tspa-auto-target" ]; then
    rm -f "/storage/emulated/0/stop-tspa-auto-target"
fi

# Remove residue and restore aosp keybox.
rm -rf "/data/adb/modules/.TA_utl"
rm -f "/data/adb/boot_hash"
rm -f "/data/adb/tricky_store/security_patch_auto_config"
rm -f "/data/adb/tricky_store/system_app"
for dir in "$TS" "$OMK"; do
    [ -d "$dir" ] && {
        [ -L "$dir/webroot" ] && rm -f "$dir/webroot"
        [ -L "$dir/action.sh" ] && rm -f "$dir/action.sh"
    }
done
