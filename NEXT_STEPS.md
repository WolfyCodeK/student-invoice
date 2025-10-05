# 🚀 Next Steps - Test Your Update System

## What We Just Did

✅ Generated signing keypair (myapp.key + public key)  
✅ Updated tauri.conf.json with your public key  
✅ Updated build scripts to automatically sign releases  
✅ Added signing keys to .gitignore (they won't be committed)  

## Test It Now!

### Step 1: Build v1.0.0 (Your Test Version)
```batch
cd D:\data\programming\Tauri\student-invoice\student-invoice-tauri
# First, update version to 1.0.0
cd ..
set-version.bat 1.0.0
cd student-invoice-tauri
pnpm tauri build
```

The build will:
- Create `student-invoice-tauri_1.0.0_x64_en-US.msi`
- Create `student-invoice-tauri_1.0.0_x64_en-US.msi.sig` ← **This is new!**

### Step 2: Install v1.0.0
1. Go to `student-invoice-tauri\src-tauri\target\release\bundle\msi\`
2. Install `student-invoice-tauri_1.0.0_x64_en-US.msi`
3. Run the app to make sure it works

### Step 3: Build v2.7.0 (Your Update Version)
```batch
cd D:\data\programming\Tauri\student-invoice
release.bat 2.7.0
```

### Step 4: Create GitHub Release for v2.7.0

1. **Find your built files:**
   - `student-invoice-tauri_2.7.0_x64_en-US.msi`
   - `student-invoice-tauri_2.7.0_x64_en-US.msi.sig` ← **Important!**

2. **Get the signature:**
   ```powershell
   cd student-invoice-tauri\src-tauri\target\release\bundle\msi
   Get-Content student-invoice-tauri_2.7.0_x64_en-US.msi.sig
   ```
   Copy the output (long base64 string)

3. **Update latest.json:**
   ```json
   {
     "version": "2.7.0",
     "notes": "Student Invoice 2.7.0",
     "pub_date": "2025-10-05T18:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "PASTE_THE_SIGNATURE_HERE",
         "url": "https://github.com/WolfyCodeK/student-invoice/releases/download/v2.7.0/student-invoice-tauri_2.7.0_x64_en-US.msi"
       }
     }
   }
   ```

4. **Upload to GitHub:**
   - Go to https://github.com/WolfyCodeK/student-invoice/releases
   - Create release with tag `v2.7.0`
   - Upload:
     - `student-invoice-tauri_2.7.0_x64_en-US.msi`
     - `student-invoice-tauri_2.7.0_x64_en-US.msi.sig`
     - `latest.json` (with the signature filled in)

### Step 5: Test the Update!

1. Open your installed v1.0.0 app
2. Click "Check for Updates" button
3. Should say "A new version (2.7.0) is available!" ✅
4. Click "Install Update"
5. App should download, verify signature, and install
6. App restarts as v2.7.0 ✅

## If It Still Fails...

Check these common issues:

1. **"Invalid signature" error**
   - Did you upload the `.sig` file to GitHub?
   - Did you paste the signature into `latest.json`?
   - Is the URL in `latest.json` correct?

2. **"Failed to download" error**
   - Is the MSI file uploaded to GitHub?
   - Is the URL correct in `latest.json`?
   - Try accessing the URL in a browser

3. **App crashes on startup**
   - Make sure `myapp.key` exists in `student-invoice-tauri/` folder
   - Make sure the public key is in `tauri.conf.json`

## Important Files

- **Private Key**: `student-invoice-tauri/myapp.key` ⚠️ Keep secret!
- **Public Key**: In `tauri.conf.json` (safe to commit)
- **Signatures**: `.sig` files created during build (upload to GitHub)

## Future Releases

Every time you want to release:
```batch
release.bat X.X.X
```

Then:
1. Get signature from .sig file
2. Update latest.json
3. Upload MSI, SIG, and latest.json to GitHub

The build script automatically signs everything for you!

---

**Read `SIGNING_SETUP.md` for complete details!**

