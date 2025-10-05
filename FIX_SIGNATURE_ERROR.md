# Fix: "Invalid encoding in minisign data" Error

## What Went Wrong

Your v2.7.0 build was created **without signing**. The `latest.json` has a dummy signature value `"dW50cnVzdGVk"` which Tauri can't parse as a valid minisign signature.

## How to Fix It - Simple Steps

### Option 1: Use the Helper Script (Easiest)

I've created a script that does everything for you:

```batch
BUILD_SIGNED_RELEASE.bat 2.7.0
```

This will:
1. Update version to 2.7.0
2. Build with signing enabled
3. Show you the signature to copy
4. Tell you which files to upload

**Then scroll up in the output and COPY the signature!**

### Option 2: Manual Method

If you prefer to do it manually:

#### Step 1: Build v2.7.0 with Signing

```batch
cd student-invoice-tauri
set TAURI_SIGNING_PRIVATE_KEY=%cd%\myapp.key
pnpm tauri build
```

#### Step 2: Find the Signature File

Go to: `student-invoice-tauri\src-tauri\target\release\bundle\msi\`

You should see:
- `student-invoice-tauri_2.7.0_x64_en-US.msi` ✅
- `student-invoice-tauri_2.7.0_x64_en-US.msi.sig` ✅ **This is new!**

#### Step 3: Get the Signature Content

**Using File Explorer:**
1. Right-click the `.sig` file
2. Open with Notepad
3. Copy the entire content (it's one long base64 string)

**Using PowerShell:**
```powershell
cd student-invoice-tauri\src-tauri\target\release\bundle\msi
Get-Content student-invoice-tauri_2.7.0_x64_en-US.msi.sig
```

#### Step 4: Update latest.json

Edit `student-invoice-tauri\latest.json`:

```json
{
  "version": "2.7.0",
  "notes": "Student Invoice 2.7.0",
  "pub_date": "2025-10-05T21:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "PASTE_THE_REAL_SIGNATURE_HERE",
      "url": "https://github.com/WolfyCodeK/student-invoice/releases/download/v2.7.0/student-invoice-tauri_2.7.0_x64_en-US.msi"
    }
  }
}
```

**Replace `PASTE_THE_REAL_SIGNATURE_HERE` with the content from the `.sig` file!**

#### Step 5: Upload to GitHub

Go to: https://github.com/WolfyCodeK/student-invoice/releases/tag/v2.7.0

**Delete the old files and upload:**
1. `student-invoice-tauri_2.7.0_x64_en-US.msi`
2. `student-invoice-tauri_2.7.0_x64_en-US.msi.sig`
3. `latest.json` (with the REAL signature filled in)

#### Step 6: Test Again

1. Open your v1.0.0 app
2. Click "Check for Updates"
3. Click "Install Update"
4. Should work now! ✅

## Why This Fixes It

The signature in the `.sig` file is generated using your **private key** (`myapp.key`). When users download the update, Tauri:

1. Downloads the MSI file
2. Uses your **public key** (in `tauri.conf.json`) to verify the signature
3. Only installs if the signature matches (meaning the file hasn't been tampered with)

The dummy signature `"dW50cnVzdGVk"` is not a valid minisign signature, so it fails.

## Important Notes

⚠️ **Every future build MUST be signed!**

The build scripts (`build.bat` and `new-build.bat`) already set `TAURI_SIGNING_PRIVATE_KEY`, so if you use those scripts, signing happens automatically.

If you build manually with `pnpm tauri build`, you MUST set the environment variable first:
```batch
set TAURI_SIGNING_PRIVATE_KEY=%cd%\myapp.key
```

## Quick Verification

To check if a build was signed, look for the `.sig` file in the MSI directory. If there's no `.sig` file, the build wasn't signed.

---

**Use `BUILD_SIGNED_RELEASE.bat 2.7.0` for the easiest method!**

