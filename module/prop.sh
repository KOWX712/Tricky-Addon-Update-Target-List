#!/bin/sh

check_reset_prop() {
    local NAME=$1
    local EXPECTED=$2
    local VALUE=$(resetprop $NAME)
    [ -z $VALUE ] || [ $VALUE = $EXPECTED ] || resetprop -n $NAME $EXPECTED
}

contains_reset_prop() {
    local NAME=$1
    local CONTAINS=$2
    local NEWVAL=$3
    [[ "$(resetprop $NAME)" = *"$CONTAINS"* ]] && resetprop -n $NAME $NEWVAL
}

empty_reset_prop() {
    local NAME=$1
    local NEWVAL=$2
    local VALUE=$(getprop "$NAME")
    [ -z "$VALUE" ] && resetprop -n $NAME $NEWVAL
}

resetprop -w sys.boot_completed 0

if [ -f "/data/adb/boot_hash" ]; then
    hash_value=$(grep -v '^#' "/data/adb/boot_hash" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
    [ -z "$hash_value" ] && rm -f /data/adb/boot_hash || resetprop -n ro.boot.vbmeta.digest "$hash_value"
fi

if [ -f "/data/adb/disable_prop_handler" ]; then
    exit 0
fi

check_reset_prop "ro.boot.vbmeta.device_state" "locked"
check_reset_prop "ro.boot.verifiedbootstate" "green"
check_reset_prop "ro.boot.flash.locked" "1"
check_reset_prop "ro.boot.veritymode" "enforcing"
check_reset_prop "ro.boot.warranty_bit" "0"
check_reset_prop "ro.warranty_bit" "0"
check_reset_prop "ro.debuggable" "0"
check_reset_prop "ro.force.debuggable" "0"
check_reset_prop "ro.secure" "1"
check_reset_prop "ro.adb.secure" "1"
check_reset_prop "ro.build.type" "user"
check_reset_prop "ro.build.tags" "release-keys"
check_reset_prop "ro.vendor.boot.warranty_bit" "0"
check_reset_prop "ro.vendor.warranty_bit" "0"
check_reset_prop "vendor.boot.vbmeta.device_state" "locked"
check_reset_prop "vendor.boot.verifiedbootstate" "green"
check_reset_prop "sys.oem_unlock_allowed" "0"

# MIUI specific
check_reset_prop "ro.secureboot.lockstate" "locked"

# Realme specific
check_reset_prop "ro.boot.realmebootstate" "green"
check_reset_prop "ro.boot.realme.lockstate" "1"

# Hide that we booted from recovery when magisk is in recovery mode
contains_reset_prop "ro.bootmode" "recovery" "unknown"
contains_reset_prop "ro.boot.bootmode" "recovery" "unknown"
contains_reset_prop "vendor.boot.bootmode" "recovery" "unknown"

# Reset vbmeta related prop
empty_reset_prop "ro.boot.vbmeta.device_state" "locked"
empty_reset_prop "ro.boot.vbmeta.invalidate_on_error" "yes"
empty_reset_prop "ro.boot.vbmeta.avb_version" "1.0"
empty_reset_prop "ro.boot.vbmeta.hash_alg" "sha256"
empty_reset_prop "ro.boot.vbmeta.size" "4096"

resetprop -c || true
