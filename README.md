# Student Invoice

A desktop application for managing student invoices with Gmail integration and automatic updates.

## Quick Start

### Development Server
```batch
dev.bat
```
Starts the development server with hot-reload.

### Set App Version
```batch
set-version.bat 1.2.0
```
Updates version in package.json, Cargo.toml, and tauri.conf.json.

### For Local Development/Testing
```batch
build.bat
```
Rebuilds the current version for local testing.

### For Creating New Releases
```batch
release.bat 1.2.0
```
**Fully automated:** Creates new release version, builds the app, commits changes, creates git tag, and pushes to GitHub. GitHub Actions handles the rest!

## Project Structure

- `student-invoice-tauri/` - Main Tauri application
- `dev.bat` - Development server
- `set-version.bat` - Update app version in all files
- `build.bat` - Local build script
- `release.bat` - Release build script

## Features

- 📧 Gmail integration for invoice emails
- 🔄 Automatic updates
- 🎨 Modern dark/light theme
- 📱 Responsive design
- 🔒 Secure OAuth2 authentication

## Development

See `student-invoice-tauri/DEVELOPMENT_SETUP.md` for detailed setup instructions.

## Releases

The app uses GitHub Actions for automated releases. When you run `release.bat`, it will:
1. Update version numbers
2. Build the application
3. Create installers (MSI/NSIS)
4. Show git commands to complete the release

GitHub Actions will then automatically create the GitHub release and enable auto-updates for users.