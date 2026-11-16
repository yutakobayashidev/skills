---
name: app-download
description: Search for or download app packages using apkeep for Android APKs and ipatool for Apple App Store packages.
---

# App Download

Choose `apkeep` for Android and `ipatool` for Apple platforms. Check the installed CLI's `--help` before using optional flags. Resolve the app identifier and output directory; keep credentials out of chat and logs.

## Android: apkeep

Always specify the source with `-d`; defaults vary across releases.

```bash
mkdir -p ./apks
apkeep -a org.mozilla.fennec_fdroid -d f-droid ./apks
apkeep -l -a org.mozilla.fennec_fdroid -d f-droid
apkeep -a com.example.app -d google-play -i /path/to/apkeep.ini ./apks
```

- Use `package.id@version` for a listed F-Droid or APKPure version; do not assume Google Play supports version selection.
- For Google Play credentials, follow the [authentication guide](https://github.com/EFForg/apkeep/blob/master/USAGE-google-play.md) and store tokens in a protected INI file. Accept terms only when authorized.
- Use APKPure (`-d apk-pure`) for research per its [source guide](https://github.com/EFForg/apkeep/blob/master/USAGE-apkpure.md). Preserve F-Droid signature verification and report failures.
- For batch downloads, use `-c apps.csv` instead of `-a`; consult [usage](https://github.com/EFForg/apkeep/blob/master/USAGE) for column selection and concurrency.

## Apple: ipatool

Use [majd/ipatool](https://github.com/majd/ipatool). Check `ipatool auth info`; if login is needed, have the user run `ipatool auth login --email user@example.com` in their terminal and complete the password, 2FA, and keychain prompts.

```bash
ipatool --non-interactive --format json search "app name" --limit 5
mkdir -p ./ipas
ipatool --non-interactive --format json download \
  --bundle-identifier com.example.app --output ./ipas
```

- Select the bundle identifier or numeric `--app-id` from results, not from the app name.
- If a license is missing, use `purchase` or `download --purchase` only within the user's authorization. Stop for user input on authentication or 2FA failures.
- For older versions, use `list-versions` and `get-version-metadata`, then pass the returned ID as `--external-version-id`, not the display version.
- Check `--platform` for other Apple targets; macOS downloads use `.pkg`. Downloading an IPA does not establish that it is decrypted or installable on another device.

Check the exit status and verify nonempty output files before reporting paths and failures. ipatool JSON output may contain multiple log events; inspect the final result.
