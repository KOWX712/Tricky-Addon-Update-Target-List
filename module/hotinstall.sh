#!/bin/sh

MODPATH=${0%/*}

sh "$MODPATH/post-fs-data.sh" > /dev/null 2>&1
sh "$MODPATH/service.sh" > /dev/null 2>&1
