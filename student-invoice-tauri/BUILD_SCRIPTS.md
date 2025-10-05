# Student Invoice Build Scripts

This directory contains scripts for building the Student Invoice application with different versioning strategies.

## 🚀 Quick Commands (Recommended)

From the project root directory:

```batch
# Development server
dev.bat

# Set version in all files (package.json, Cargo.toml, tauri.conf.json)
set-version.bat 1.2.0

# For local testing - rebuild current version
build.bat

# For new releases - specify version number
release.bat 1.2.0
```

> **Note:** These root-level commands are the simplest way to build and release. The scripts below are the detailed implementations.

## Available Scripts

### 1. `dev.bat` (Development Server)
**Purpose:** Start the development server with hot-reload.

**Usage:**
```batch
dev.bat
```

**What it does:**
- Starts Vite development server
- Enables hot-reload for React components
- Serves the app at http://localhost:3000

### 2. `build.bat` (Primary Build Scripts)
**Purpose:** Rebuild the application with the current version number.

**Usage:**
```batch
build.bat
```

**What it does:**
- Shows current version from `package.json`
- Installs dependencies if `node_modules` doesn't exist
- Runs `pnpm tauri build` to create production build
- Outputs installer to `src-tauri/target/release/bundle/`

### 3. `new-build.bat` (Versioned Builds)
**Purpose:** Create a new build with an updated version number.

**Usage:**
```batch
# Interactive mode (prompts for version)
new-build.bat

# Command line mode
new-build.bat 1.2.0
```

**What it does:**
- Shows current version from `package.json`
- Prompts for new version or accepts as command line parameter
- Updates version in:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
- Installs dependencies if needed
- Runs `pnpm tauri build` to create production build
- Outputs installer to `src-tauri/target/release/bundle/`

### 4. `release.bat` (Automated Release Workflow)
**Purpose:** Complete workflow for automated releases with GitHub Actions.

**Usage:**
```batch
release.bat 1.1.0
```

**What it does:**
- Calls `new-build` to update versions and build
- **Automatically runs all git commands:**
  - `git add .`
  - `git commit -m "Bump version to X.X.X"`
  - `git tag vX.X.X`
  - `git push origin main`
  - `git push origin vX.X.X`
- **Fully automated release process**

## Version Number Format

Use semantic versioning format: `MAJOR.MINOR.PATCH`
- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes (backward compatible)

Examples: `1.0.0`, `1.1.0`, `1.1.1`, `2.0.0`

## Build Output

After running either script, check the `src-tauri/target/release/bundle/` directory for:

### Windows
- `msi/` - MSI installer (recommended for distribution)
- `nsis/` - NSIS installer (alternative)

### File Naming
The installer files will be named like:
- `student-invoice-tauri_1.0.0_x64_en-US.msi`

## For Auto-Updates

### Option 1: Manual Release (Current)
When creating a new version for release:

1. Use `new-build.bat` (or `.\new-build.ps1 -Version "1.1.0"`) to update version and build locally
2. Create a GitHub release with tag `v1.1.0`
3. Upload the MSI installer to the release
4. Users can update via the "Check for Updates" button in the app

### Option 2: Automated Release with GitHub Actions (Recommended)

**Setup:**
1. The `.github/workflows/release.yml` file is already created
2. Push your code to GitHub with the workflow file

**Release Process:**
1. Run `new-build.bat` locally to update versions and test
2. Commit and push your version changes
3. Create and push a git tag: `git tag v1.1.0 && git push origin v1.1.0`
4. GitHub Actions automatically:
   - Builds the app
   - Creates the GitHub release
   - Uploads the MSI installer
   - Generates `latest.json` for auto-updater
5. Users can update via the "Check for Updates" button!

**Fully automated workflow:**
```bash
# One command does everything!
release.bat 1.1.0

# This automatically:
# 1. Updates version files to 1.1.0
# 2. Builds the application
# 3. Commits changes: "Bump version to 1.1.0"
# 4. Creates git tag: v1.1.0
# 5. Pushes to GitHub (triggers automated release!)
```

**GitHub Actions will automatically:**
- Build the app in the cloud
- Create the GitHub release
- Upload the MSI installer
- Generate `latest.json` for auto-updates

## Troubleshooting

### Permission Errors
Run terminal/command prompt as Administrator.

### Build Fails
- Ensure Node.js and Rust are installed
- Clear caches: `pnpm clean` and `cargo clean`
- Reinstall dependencies: `pnpm install`

### Version Not Updating
- Check that all three files are writable
- Ensure no syntax errors in JSON files
- Try running PowerShell scripts with admin privileges

## Development vs Production

- **Development:** Use `dev.bat` or `dev.ps1` for hot-reload development
- **Production:**
  - `build.bat` / `build.ps1` - Rebuild current version
  - `new-build.bat` / `new-build.ps1` - Create new version

## Quick Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `dev.bat` | Development server | During development |
| `set-version.bat` | Update version in all files | Before building a specific version |
| `build.bat` | Rebuild current version | Quick rebuilds, testing |
| `new-build.bat` | New version build | Manual releases, local testing |
| `release.bat` | Automated release workflow | Full automated releases with GitHub Actions |
