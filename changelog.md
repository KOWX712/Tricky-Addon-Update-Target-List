### Tricky Addon: Update Target List
A **KSU WebUI** to configure tricky store target.txt

*This module is **not** a part of the Tricky Store module. DO NOT report any issues to Tricky Store if encountered.*

GitHub release: [Tricky Addon: Update Target List](https://github.com/KOWX712/Tricky-Addon-Update-Target-List/releases/latest)

Telegram channel: [KOW's Little World](https://t.me/kowchannel)

## Changelog
### v3.9
- **WebUI:** Optmized app loading speed, fixed all known freezing issue.
- **WebUI:** Added unknown keybox option, similar to AOSP keybox, removed AOSP keybox fallback when no valid keybox available.
- **MMRL:** Added app icon support, enjoy with latest [MMRL](https://github.com/MMRLApp/MMRL/releases/latest) or [WebUI X](https://github.com/MMRLApp/WebUI-X-Portable/releases/latest).
- **Action:** Added support for Magisk action redirect WebUI X.
- **Script:** Get actual vbmeta size before resetprop.
- **WebUI:** Add Portuguese Brazilian Translation (#38, @JeanxPereira)

### v3.8.1
- **WebUI:** Fixed missing aosp key fallback when no valid key is available.

### v3.8
- **WebUI:** Optimized UI.
- **WebUI:** Added mirror link fallback to fetch content from raw.githubusercontent.com
- **WebUI:** Added French translation (#31, @anaelle-dev)
- **WebUI:** Added Arabic Translation (#32, @ZG089)
- **WebUI:** Added Azerbaijani Translation (#34, @mnasibzade)

### v3.7
- **WebUI:** Optimized UI.
- **WebUI:** Added uninstall confirmation dialog.
- **WebUI:** Sanitize text content (#23, @totalolage)
- **WebUI:** Added selected language memory.
- **WebUI:** Fixed Chinese translation (#26 #27, @xiaokuqwq)
- **WebUI:** Added Indonesian translation (#28, @ChiseWaguri)
- **WebUI:** Added Italian translation (#30, @luigimak)
- **MMRL:** Added monet theme suport.
- **MMRL:** Fixed fail to display guide when permission is not granted.
- No longer add Play Store by default.

### v3.6
- **WebUI:** Option to add system apps.
- **WebUI:** Fixed abnormal gap between content and header in MMRL.
- Handle some vbmeta related prop, enforce boot hash to lowercase.
- No longer auto config security patch by default (old user will remain current setup).
- Fixed issue with disable sucompat.
- More minor improvements.

### v3.5
- **Script:** Set `system=prop` in auto config.
- **WebUI:** Option to fetch secuirty patch date.
- **WebUI:** Fixed `Failed to fetch app list` issue in vanilla rom.
- **WebUI:** Added Polish translation (#18, @Bladius2024)
- **WebUI:** Update Japanese translation (#20, @reindex-ot)
- **WebUI:** Minor UI improvements.

### v3.4
- **WebUI:** Allow import custom keybox from device storage.
- **WebUI:** Allow custom config security patch in WebUI, save empty to disable auto config.
- **WebUI:** Update Turkish translation (#16, @berkmirsatk)
- **WebUI:** Fix wrong changelog version displayed in update changelog.
- **MMRL:** Display a guide to enable the JavaScript API in MMRL. Directly request API permission on v33045+
- More minor improvements

### v3.3.1
- Fixed security patch logic, use pif.json to get security patch date.
- No auto config `security_patch.txt` for security patch lesser than one year.

### v3.3
- Support auto config `security_patch.txt` for Tricky Store v1.2.1 or higher.
- No longer need to add `!` to Play Store for devices that have security patch older than one year to get strong integrity in new A13+ check.
- **Magisk:** automatically add apps from DenyList to `target.txt` on boot. To enable this feature, click "Select from DenyList" once in WebUI after update.

### v3.2
- Add `android` and `com.android.vending` by default.
- Handle `ro.vendor.build.security_patch` if the value is different.
- Updated Japanese translation (#11, @reindex-ot)
- Added Turkish translation (@berkmirsatk)

### v3.1
- Added `com.google.android.gsf` and `com.android.vending` into WebUI app list. (#10, @ChiseWaguri)
- Fixed multiple instances of GMS appeared in the app list when GMS isn't a system app.
- Added auto backup `keybox.xml` to `keybox.xml.bak` before replacing it.
- Minor animation improvements and code optimizations.
- [Markdown support](https://github.com/markedjs/marked) for future update changelog in WebUI.

### v3.0
- Animation improvement: new checkbox animation, new touch ripple animation, and more.
- Adjust save button and prompt position in MMRL.
- Long press on app to select `!` and `?` mode, use this only when the app cannot work without this.
- Display gms in app list.
- Show module version in header.
- Rewrite update method, you can now update module directly in WebUI.

### v2.9
- Preserve `!` and `?` during update target in WebUI.
- Optimized scripts, thanks to @backslashxx.
- Fixed freeze in weak connection.
- Added Spanish, thanks to @Keinta15.
- Removed restriction on installation but module will still be removed if Tricky Store is not found after reboot.

### v2.8
- Fixed all KSUWebUIStandalone freeze issue, removed visible option.
- Reduced WebUI loading time.
- Added Japanese. Thanks to @reindex-ot.

### v2.7.1
- Link redirect quick fix

### v2.7
- Abandoned `UpdateTargetList.sh`; No longer automatically update target on boot.  
- Adapted with MMRL, Magisk user can uninstall KSUWebUIStandalone if you have latest MMRL installed, action button will redirect to MMRL if KSUWebUIStandalone not found.
- New update card for invisible module.
- Improved UI.
- Press any position of app card to select/deselct.

### v2.6
- Invisible module, integrate action button & WebUI on Tricky Store card. You can still use visible option if you found any issue with invisible module. Thanks for idea from @backslashxx.
- To uninstall invisble module, scroll down to the bottom of WebUI and press Uninstall WebUI.
- Add update prompt if found new version in webui, and show module if found an update. (invisible)
- Reduced WebUI loading time
- Added feature to save verifiedBootHash
- New way to detect Xposed module, now can catch all Xposed module apk package name in Deselect Unnecessary option, feedback in [Telegram](https://t.me/kowchannel) or [create issue](https://github.com/KOWX712/Tricky-Addon-Update-Target-List/issues) if missed any.
- **Initial support for multiple languages**
- Language available: **en-US**, **ru-RU**, **tl-PH**, **zh-CN**, **zh-TW**
- Add language or fix translation error? [Read here](https://github.com/KOWX712/Tricky-Addon-Update-Target-List/tree/master/module/webui/locales/A-translate.md).

### v2.6-beta.3
- Check in [release notes](https://github.com/KOWX712/Tricky-Addon-Update-Target-List/releases/tag/v2.6-beta.3).

### v2.6-beta.2
- Check in [release notes](https://github.com/KOWX712/Tricky-Addon-Update-Target-List/releases/tag/v2.6-beta.2).

### v2.6-beta.1
- Check in [release notes](https://github.com/KOWX712/Tricky-Addon-Update-Target-List/releases/tag/v2.6-beta.1).

### v2.5
- Remove kb prompt on installation, moved into WebUI
- Restore to AOSP keybox during uninstallation

### v2.4
- Added aapt binary for app name display

- **KSU WebUI:**
- Added app name display

### v2.3
- Removed curl binary
- Moved boot_hash to /data/adb to prevent overwrite
- Stop TSP-A auto target to prevent overwrite
- Abandoned action button in KernelSU and Apatch
- Magisk action button: open WebUI, automatic download if not installed (optional)

- **KSU WebUI:**
- Option to select app from DenyList (Magisk)

### v2.2
- **KSU WebUI:**
- Added help menu
- Added extra [unnecessary app](https://raw.githubusercontent.com/KOWX712/Tricky-Addon-Update-Target-List/main/more-excldue.json) exclude option
- Added no Internet connection prompt

### v2.1
- Added curl binary to fetch Xposed module package name from LSPosed webside

- **KSU WebUI:**
- Added feature to exclude Xposed module package name
- Fixed abnormal color in dark mode
- Combined save config and update target.txt button
- Fixed some more known bugs

### v2.0
- Added WebUI for configuration

### v1.7
- Fixed update issue (Will start to work in next update)

### v1.6
- Updated something

### v1.5
- Fixed some known issue
- Updated something

### v1.4.1
- Fixed Magisk installation issue

### v1.4
- Migrate ro.boot.vbmeta.digest from system.prop to resetprop
- Fix config list recognize error on some device
- Refactor code

### v1.3.1
- Added Apatch Next package name to exclude list
- Fix automatic update target script not working issue

### v1.3
- Minor improvement in code
- Overwrite protection: won't remove previous setup when updating module

### v1.2
- Initial release
- Automated update target list on every boot

### v1.1
- Add exclution and addition list config, config directory: /data/adb/tricky_store/target_list_config (No release)

### v1.0
- Initial version (No release)
