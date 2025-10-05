# Student Invoice Tauri App - Development Setup

## Prerequisites

Before starting development, install the following tools in order:

### 1. Node.js (LTS Version)
- Download from: https://nodejs.org/ (choose LTS version)
- This will also install npm automatically
- Verify installation: `node --version` and `npm --version`

### 2. Rust (Latest Stable)
- Download from: https://rustup.rs/
- Choose the default installation (option 1)
- This installs rustup, cargo, and the latest stable Rust
- Verify installation: `rustc --version` and `cargo --version`

### 3. Microsoft Visual Studio C++ Build Tools
Required for compiling native Windows applications:
- Download Visual Studio Build Tools from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- During installation, select "Desktop development with C++" workload
- Verify installation: Open PowerShell and run `cl` (should show Microsoft C++ compiler)

### 4. WebView2 Runtime (Optional)
- Usually pre-installed on Windows 10/11
- If needed, download from: https://developer.microsoft.com/microsoft-edge/webview2/

### 5. Git (Optional but Recommended)
- Download from: https://git-scm.com/
- Verify installation: `git --version`

## Project Structure

```
student-invoice-tauri/
├── src/                    # React frontend source
│   ├── components/         # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── lib/               # Library functions
├── src-tauri/             # Rust backend source
│   ├── src/               # Rust source files
│   ├── icons/             # App icons
│   └── target/            # Build artifacts (generated)
├── public/                # Static assets
└── dist/                  # Built frontend (generated)
```

## Development Workflow

### Starting Development
```bash
# Install dependencies
pnpm install

# Start development server
pnpm tauri dev
```

### Building Production App
```bash
# Build the app
pnpm tauri build
```

## Technologies Used

### Frontend
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **React Hook Form**: Form management
- **Zustand**: State management

### Backend
- **Rust**: Systems programming language for performance
- **Tauri**: Framework for building desktop apps with web technologies
- **Google APIs**: Gmail API for email draft creation
- **OAuth2**: Secure authentication flow

### APIs & Services
- **Google Gmail API v1**: For creating email drafts
- **Google OAuth2**: For secure authentication
- **Local Storage**: For app settings and templates

## Key Features

1. **Template Management**: CRUD operations for invoice templates
2. **Term Calculation**: Automatic term-based scheduling (Autumn, Spring, Summer)
3. **Invoice Generation**: Dynamic invoice creation with cost calculations
4. **Email Integration**: Gmail API integration for draft creation
5. **Theme Support**: Dark/Light mode with multiple themes
6. **Settings Management**: Configurable app preferences
7. **Auto-Updates**: Built-in update mechanism (future feature)

## Development Scripts

### Available Commands

```bash
# Install dependencies
pnpm install

# Start development with hot reload
pnpm tauri dev

# Build for production
pnpm tauri build

# Run linting
pnpm lint

# Run type checking
pnpm type-check

# Clean build artifacts
pnpm clean
```

## Environment Setup

### Environment Variables
Create a `.env` file in the root directory:

```env
# Google API Configuration (to be added)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# App Configuration
APP_NAME=Student Invoice
APP_VERSION=1.0.0
```

### Google API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:8080` (for development)
   - Custom URI scheme for production (e.g., `student-invoice://auth`)

## Troubleshooting

### Common Issues

1. **Build fails with C++ errors**
   - Ensure Visual Studio Build Tools are installed correctly
   - Try running in a new PowerShell as Administrator

2. **Node.js/npm not recognized**
   - Reinstall Node.js and ensure it's added to PATH
   - Use PowerShell instead of Command Prompt

3. **Rust compilation errors**
   - Update Rust: `rustup update`
   - Install missing components: `rustup component add rust-src`

4. **Tauri dev server won't start**
   - Kill any processes using port 8080
   - Clear node_modules: `pnpm clean-install`

### Getting Help

- Tauri Documentation: https://tauri.app/v1/guides/
- Google APIs Documentation: https://developers.google.com/gmail/api
- React Documentation: https://react.dev/

## Next Steps

After completing the setup above:

1. Run `npm create tauri-app@latest student-invoice-tauri -- --template react-ts --package-manager pnpm`
2. Navigate to the created directory
3. Follow the development workflow above
4. Start implementing the features from the Python version

---

**Note**: This setup uses modern, up-to-date versions of all tools to avoid the npm issues you mentioned previously.
