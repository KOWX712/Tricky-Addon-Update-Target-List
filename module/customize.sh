SKIPUNZIP=0
DEBUG=false
COMPATH="$MODPATH/common"
TS="/data/adb/modules/tricky_store"
SCRIPT_DIR="/data/adb/tricky_store"
CONFIG_DIR="$SCRIPT_DIR/target_list_config"
MODID=`grep_prop id $TMPDIR/module.prop`
NEW_MODID=".TA_utl"
kb="$COMPATH/.default"

ui_print " "
if [ "$APATCH" ]; then
    [ "$APATCH_VER_CODE" -ge 11159 ] || abort "! Unsupported APatch version, please update APatch to 11159 or higher"
    ui_print "- APatch:$APATCH_VER│$APATCH_VER_CODE"
    ACTION=false
elif [ "$KSU" ]; then
    [ "$KSU_VER_CODE" -ge 32234 ] || abort "! Unsupported KernelSU version, please update KernelSU to 32234 or higher"
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

[ -d "$TS" ] || ui_print "! Warning: Tricky store module not found"

. "$MODPATH/install_func.sh"

ui_print "- Installing..."
initialize

ui_print "- Finalizing..."
find_config
migrate_config

rm -f "$MODPATH/install_func.sh"

ui_print " "
ui_print "! This module is not a part of the Tricky Store module. DO NOT report any issues to Tricky Store if encountered."
ui_print " "

sleep 1

ui_print "- Installation completed successfully! "
ui_print " "
