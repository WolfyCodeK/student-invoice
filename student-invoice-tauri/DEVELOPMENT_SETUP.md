# Development Setup Guide

This guide provides detailed instructions for setting up the Student Invoice Tauri application development environment on Windows.

## 🎯 Why Windows Native Development?

Unlike many cross-platform development setups that recommend WSL2 (Windows Subsystem for Linux), this project is specifically designed for **native Windows development** using Command Prompt or PowerShell. Here's why:

### ✅ Advantages of Native Windows Development

1. **Native GUI Applications**: Direct access to Windows GUI components without X server complications
2. **Executable Creation**: Build authentic Windows executables (.exe, .msi) that integrate seamlessly with Windows
3. **System Integration**: Full access to Windows APIs, file system, and system services
4. **Performance**: No virtualization overhead from WSL2
5. **Deployment**: Create installers that match Windows user expectations

### ❌ Limitations of WSL2 for Desktop Apps

1. **GUI Complexity**: Requires X server setup (VcXsrv, WSLg) for GUI applications
2. **Executable Compatibility**: Linux executables don't integrate well with Windows ecosystem
3. **File System Issues**: Path and permission complications between Windows and WSL2
4. **Build Tooling**: Rust and Node.js tooling works better natively on Windows

## 📋 Prerequisites

### Required Software

#### 1. Node.js (v18 or higher)
**Why needed**: Frontend JavaScript runtime and package management
**Download**: https://nodejs.org/ (LTS version recommended)
**Verification**:
```cmd
node --version
npm --version
```

#### 2. Rust (latest stable)
**Why needed**: Backend systems programming and Tauri runtime
**Installation**: https://rustup.rs/
**Run the rustup installer and follow the prompts**
**Verification**:
```cmd
rustc --version
cargo --version
```

#### 3. Package Manager (pnpm recommended)
**Why needed**: Fast, reliable dependency management
**Installation**:
```cmd
npm install -g pnpm
```
**Verification**:
```cmd
pnpm --version
```

#### 4. Git (optional but recommended)
**Why needed**: Version control and collaboration
**Download**: https://git-scm.com/downloads
**Verification**:
```cmd
git --version
```

### Optional Tools

#### Visual Studio Code
**Why recommended**: Excellent TypeScript, Rust, and Tauri support
**Extensions to install**:
- Rust Analyzer (rust-lang.rust-analyzer)
- TypeScript Importer (pmneo.tsimporter)
- Tauri (tauri-apps.tauri-vscode)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)

#### Windows Terminal (optional)
**Why recommended**: Better terminal experience than Command Prompt
**Download**: Microsoft Store or https://github.com/microsoft/terminal

## 🚀 Installation Steps

### Step 1: Clone the Repository
```cmd
git clone <repository-url>
cd student-invoice-tauri
```

### Step 2: Run Automated Setup
```cmd
# Using batch file (Command Prompt)
setup.bat

# Using PowerShell
.\setup.ps1
```

### Step 3: Manual Setup (if needed)
```cmd
# Install Node.js dependencies
pnpm install

# Install Rust dependencies (may take several minutes)
cargo build --release
```

## 🏃 Running the Application

### Development Mode
```cmd
# Using batch file
dev.bat

# Using PowerShell
.\dev.ps1

# Manual command
pnpm tauri dev
```

### Production Build
```cmd
# Using batch file
build.bat

# Using PowerShell
.\build.ps1

# Manual command
pnpm tauri build
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "pnpm command not found"
**Solution**: Install pnpm globally
```cmd
npm install -g pnpm
```

#### 2. "cargo command not found"
**Solution**: Reinstall Rust
```cmd
# Download and run rustup-init.exe from https://rustup.rs/
# Or reinstall via winget
winget install --id Rustlang.Rustup
```

#### 3. Permission Errors
**Solution**: Run Command Prompt or PowerShell as Administrator, or check folder permissions

#### 4. Port Already in Use
**Solution**: Kill process using port 3000
```cmd
# Find process
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

#### 5. Rust Compilation Errors
**Solution**: Update Rust and clean build
```cmd
rustup update
cargo clean
cargo build
```

### Build Performance Tips

#### 1. Use SSD Storage
Place the project on an SSD for faster compilation

#### 2. Enable Rust Parallel Compilation
Add to your `Cargo.toml`:
```toml
[profile.dev]
opt-level = 0
debug = true
split-debuginfo = "unpacked"
```

#### 3. Use Release Builds for Testing
```cmd
cargo build --release
```

## 📁 Project Structure

```
student-invoice-tauri/
├── src/                          # React frontend
├── src-tauri/                    # Rust backend
├── dev.bat / dev.ps1             # Development scripts
├── build.bat / build.ps1         # Build scripts
├── setup.bat / setup.ps1         # Setup scripts
├── package.json                  # Node dependencies
├── Cargo.toml                    # Rust dependencies
└── tauri.conf.json              # Tauri configuration
```

## 🔐 Security Considerations

### Gmail API Setup

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Create new project or select existing

2. **Enable Gmail API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it

3. **Create OAuth2 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Create "OAuth 2.0 Client IDs"
   - Select "Desktop application"
   - Set redirect URI: `http://localhost:3000/auth/callback`

4. **Configure Credentials**
   Either set environment variables:
   ```cmd
   set GOOGLE_CLIENT_ID=your-client-id
   set GOOGLE_CLIENT_SECRET=your-client-secret
   ```

   Or enter them in the app settings after installation.

## 🎯 Development Workflow

1. **Make Changes**: Edit React components or Rust code
2. **Frontend**: Hot-reloads automatically
3. **Backend**: Restart required for Rust changes
4. **Test**: Use development server for testing
5. **Build**: Use build scripts for production releases

## 📞 Support

If you encounter issues:
1. Check this troubleshooting guide
2. Verify all prerequisites are installed
3. Try the automated setup scripts
4. Check GitHub issues for similar problems
5. Create a new issue with detailed error messages

## 📋 System Requirements

- **OS**: Windows 10/11 (64-bit)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 5GB free space for dependencies and builds
- **Internet**: Required for dependency downloads and Gmail API

---

**Happy coding! 🎵🎹**
