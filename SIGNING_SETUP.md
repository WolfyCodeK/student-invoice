# Tauri Updater Signing Setup - Complete Guide

## ✅ What We've Done

### 1. Generated Signing Keypair
- **Public Key**: Stored in `tauri.conf.json` (already updated)
- **Private Key**: `student-invoice-tauri/myapp.key` (⚠️ KEEP THIS SECRET! Add to .gitignore)

### 2. Updated Build Scripts
All build scripts now automatically sign releases:
- `student-invoice-tauri/build.bat` - For rebuilding current version
- `student-invoice-tauri/new-build.bat` - For creating new versions
- Both now set `TAURI_SIGNING_PRIVATE_KEY` before building

### 3. Updated Configuration
- `tauri.conf.json` now has your real public key
- `latest.json` format updated to include signature field

## 🔐 Important Security Notes

### Protect Your Private Key
Your private key is stored at: `student-invoice-tauri/myapp.key`

**⚠️ NEVER commit this file to git!**

Add to your `.gitignore`:
```
student-invoice-tauri/myapp.key
student-invoice-tauri/myapp.key.pub
```

### Backup Your Key
If you lose this key, you **CANNOT** sign future updates and existing users won't be able to update!

**Save a copy somewhere safe:**
- External drive
- Password manager
- Encrypted cloud storage

## 📦 How to Build and Release Now

### For Testing (v1.0.0):
```batch
cd D:\data\programming\Tauri\student-invoice
set-version.bat 1.0.0
cd student-invoice-tauri
pnpm tauri build
```

The build will automatically:
1. Sign the MSI installer with your private key
2. Generate a `.sig` file with the signature
3. Place both in `src-tauri/target/release/bundle/msi/`

### For Production Releases:
```batch
cd D:\data\programming\Tauri\student-invoice
release.bat 2.7.0
```

This will:
1. Update all version numbers
2. Build and sign the application
3. Commit and tag the release
4. Push to GitHub

## 📝 Creating the GitHub Release

After building, you'll find these files in `src-tauri/target/release/bundle/msi/`:
- `student-invoice-tauri_X.X.X_x64_en-US.msi` - The installer
- `student-invoice-tauri_X.X.X_x64_en-US.msi.sig` - The signature

### Manual Upload Steps:
1. Go to GitHub releases: https://github.com/WolfyCodeK/student-invoice/releases
2. Create a new release with tag `vX.X.X`
3. Upload both files:
   - The `.msi` file
   - The `.msi.sig` file (THIS IS CRITICAL!)
4. Update and upload `latest.json`:

```json
{
  "version": "X.X.X",
  "notes": "Student Invoice X.X.X",
  "pub_date": "2025-10-05T18:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "PASTE_SIGNATURE_CONTENT_HERE",
      "url": "https://github.com/WolfyCodeK/student-invoice/releases/download/vX.X.X/student-invoice-tauri_X.X.X_x64_en-US.msi"
    }
  }
}
```

### Getting the Signature Content:
The signature is in the `.sig` file. It's base64 encoded. You can:
1. Open the `.sig` file in a text editor
2. Copy the entire content (it's one long string)
3. Paste it as the `signature` value in `latest.json`

**OR** use this PowerShell command:
```powershell
cd student-invoice-tauri\src-tauri\target\release\bundle\msi
Get-Content student-invoice-tauri_X.X.X_x64_en-US.msi.sig
```

## 🧪 Testing the Update System

### Step 1: Build v1.0.0 for Testing
```batch
set-version.bat 1.0.0
cd student-invoice-tauri
pnpm tauri build
```
Install this version on your machine.

### Step 2: Build v2.7.0 for Update
```batch
release.bat 2.7.0
```

### Step 3: Create GitHub Release
1. Upload the v2.7.0 MSI and SIG files
2. Get the signature from the .sig file
3. Update latest.json with the correct signature
4. Upload latest.json to the release

### Step 4: Test the Update
1. Open your v1.0.0 installed app
2. Click "Check for Updates"
3. Should detect v2.7.0 ✅
4. Click "Install Update"
5. Should download, verify signature, and install ✅
6. App restarts with v2.7.0 ✅

## ❓ Troubleshooting

### "Invalid signature" error
- Make sure you uploaded the `.sig` file to GitHub
- Make sure the signature in `latest.json` matches the content of the `.sig` file
- Make sure the public key in `tauri.conf.json` hasn't changed

### "Failed to download" error
- Check the URL in `latest.json` is correct
- Make sure the MSI file is uploaded to GitHub
- Test the URL in a browser

### Build doesn't create .sig file
- Make sure `TAURI_SIGNING_PRIVATE_KEY` is set (check build.bat/new-build.bat)
- Make sure `myapp.key` exists in the student-invoice-tauri directory
- Make sure the public key is in `tauri.conf.json`

## 🎯 Quick Checklist for Each Release

- [ ] Run `release.bat X.X.X` or `new-build.bat X.X.X`
- [ ] Find the MSI and SIG files in `src-tauri/target/release/bundle/msi/`
- [ ] Create GitHub release with tag `vX.X.X`
- [ ] Upload both MSI and SIG files
- [ ] Copy content from SIG file
- [ ] Update latest.json with version and signature
- [ ] Upload latest.json to the release
- [ ] Test the update from a previous version

## 🔒 The Private Key File

**Location**: `student-invoice-tauri/myapp.key`

This file is automatically used by the build scripts. You don't need to do anything with it manually, just keep it safe and secret!

**DO NOT:**
- ❌ Commit to git
- ❌ Share publicly
- ❌ Email or upload to cloud (unless encrypted)

**DO:**
- ✅ Keep a secure backup
- ✅ Store in a password manager
- ✅ Keep it in the student-invoice-tauri folder for builds

---

## 🎉 You're All Set!

Your app now has proper signed updates. The update system will:
1. Download the update
2. Verify the signature using your public key
3. Only install if the signature is valid
4. Reject any tampered or modified installers

This ensures your users only install legitimate updates from you!

