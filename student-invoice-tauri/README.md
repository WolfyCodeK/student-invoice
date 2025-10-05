# Student Invoice Tauri App

A modern desktop application for generating music lesson invoices with Gmail integration, built using Tauri 2.0, React, TypeScript, and Rust.

![Student Invoice App](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Student+Invoice+App)

## ✨ Features

### Core Functionality
- **Invoice Generation**: Automatically calculate lesson costs based on term dates and student information
- **Term Calculation**: Smart detection of Autumn, Spring, and Summer terms with proper date ranges
- **Template Management**: Create, edit, and manage invoice templates with full CRUD operations
- **Real-time Preview**: Live invoice preview as you modify templates and settings

### Gmail Integration
- **OAuth2 Authentication**: Secure Google OAuth2 flow with PKCE
- **Email Draft Creation**: Automatically create Gmail drafts from generated invoices
- **Token Management**: Automatic token refresh and secure storage

### Modern UI/UX
- **Dark Mode**: Beautiful dark/light/system theme support
- **Responsive Design**: Optimized for various screen sizes with proper window constraints
- **Modern Components**: Built with Shadcn/ui and Tailwind CSS
- **Type Safety**: Full TypeScript implementation

### Settings & Configuration
- **Theme Management**: Switch between dark, light, and system themes
- **Email Preferences**: Choose between clipboard copy or Gmail draft creation
- **Gmail Credentials**: Configure Google API credentials securely
- **Default Templates**: Set default templates for quick invoice generation

## 🚀 Quick Start

### Prerequisites

Before running this application, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Rust** (latest stable) - [Install Rust](https://rustup.rs/)
- **pnpm** (recommended) or npm/yarn

```bash
# Install pnpm (recommended)
npm install -g pnpm
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd student-invoice-tauri
   ```

2. **Run the setup script**
   ```bash
   # Windows (Command Prompt)
   setup.bat

   # Windows (PowerShell)
   .\setup.ps1

   # Or manually:
   pnpm install
   cargo build --release
   ```

3. **Start development**
   ```bash
   # Windows (Command Prompt)
   dev.bat

   # Windows (PowerShell)
   .\dev.ps1

   # Or manually:
   pnpm tauri dev
   ```

### Google API Setup

To use Gmail integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Gmail API
4. Create OAuth2 credentials (Desktop application)
5. Set the redirect URI to: `http://localhost:3000/auth/callback`

Configure credentials in one of two ways:

**Option 1: Environment Variables**
```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

**Option 2: App Settings**
- Open the app settings
- Go to "Gmail Integration" section
- Enter your Client ID and Client Secret

## 🏗️ Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 19 + TypeScript | User interface and state management |
| **Backend** | Rust + Tauri 2.0 | Native desktop functionality and system integration |
| **Styling** | Tailwind CSS + Shadcn/ui | Modern, responsive UI components |
| **State Management** | Zustand | Client-side state with persistence |
| **Forms** | React Hook Form + Zod | Type-safe form validation |
| **API Client** | Reqwest + OAuth2 | Google API integration |
| **Build Tool** | Vite | Fast development and optimized builds |

### Project Structure

```
student-invoice-tauri/
├── src/                          # Frontend React application
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Shadcn/ui components
│   │   ├── theme-provider.tsx    # Theme context provider
│   │   ├── settings-dialog.tsx   # Settings management
│   │   └── template-form.tsx     # Template CRUD form
│   ├── stores/                   # Zustand state management
│   │   └── app-store.ts          # Main application state
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   │   └── invoice-generator.ts  # Invoice calculation logic
│   ├── App.tsx                   # Main application component
│   └── main.tsx                  # Application entry point
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri application entry point
│   │   ├── lib.rs                # Tauri commands and state management
│   │   └── gmail.rs              # Gmail API integration
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── build-scripts/                # Build automation scripts
│   ├── dev.bat / dev.ps1         # Development startup
│   ├── build.bat / build.ps1     # Production build
│   └── setup.bat / setup.ps1     # Initial setup
└── package.json                  # Node.js dependencies and scripts
```

## 📖 Usage Guide

### Creating Templates

1. Click the **"New Template"** button
2. Fill in template details:
   - **Recipient**: Parent/guardian name
   - **Cost**: Lesson cost per session
   - **Instrument**: Music instrument or lesson type
   - **Day**: Day of the week for lessons
   - **Students**: Number of students per session
3. Click **"Save Template"**

### Generating Invoices

1. Select a template from the dropdown
2. The app automatically calculates:
   - Current term dates
   - Number of lesson weeks
   - Total cost calculation
3. Review the invoice preview
4. Choose your delivery method:
   - **Copy to Clipboard**: Copy invoice text for manual use
   - **Create Gmail Draft**: Automatically create a Gmail draft

### Gmail Integration

1. Click **"Connect Gmail"** in the settings or main panel
2. Grant permissions in the browser
3. Copy the authorization code from the redirect URL
4. Paste it in the dialog that appears
5. Gmail connection status will show as "Connected"

### Settings Management

Access comprehensive settings through the **"Settings"** button:

- **Appearance**: Theme selection (Dark/Light/System)
- **Email & Templates**: Default template and email mode
- **Gmail Integration**: API credentials configuration
- **Preferences**: Notifications and auto-save options

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm start          # Start Tauri development server
pnpm tauri:dev      # Start Tauri dev (alternative)

# Building
pnpm tauri:build    # Build for production
pnpm build          # Build frontend only

# Setup & Maintenance
pnpm setup          # Install all dependencies
pnpm clean          # Clean build artifacts
```

### Development Workflow

1. **Make changes** to React components or Rust code
2. **Frontend changes** hot-reload automatically
3. **Rust changes** require app restart (Tauri handles this)
4. **Test Gmail integration** requires valid Google API credentials
5. **Build for production** using the build scripts

### Code Style

- **TypeScript**: Strict type checking enabled
- **Rust**: Standard Rust formatting (`cargo fmt`)
- **React**: Functional components with hooks
- **Styling**: Tailwind CSS with component-based architecture

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 Client ID | Yes (for Gmail) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 Client Secret | Yes (for Gmail) |

### App Configuration

All app settings are stored locally using Zustand persistence:

- **Templates**: Invoice templates with full CRUD
- **Settings**: User preferences and Gmail credentials
- **Theme**: UI theme preference
- **Window State**: Position and size preferences

## 📦 Building & Deployment

### Development Build

```bash
# Quick development start
.\dev.bat    # Windows Command Prompt
.\dev.ps1    # Windows PowerShell

# Manual development
pnpm tauri dev
```

### Production Build

```bash
# Quick production build
.\build.bat    # Windows Command Prompt
.\build.ps1    # Windows PowerShell

# Manual production build
pnpm tauri build
```

The production build creates:
- **Windows**: `.msi` installer (Windows)
- **macOS**: `.dmg` installer (if built on macOS)
- **Linux**: `.deb` or `.AppImage` (if built on Linux)

### Distribution

After building, find the installer in:
```
src-tauri/target/release/bundle/
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/student-invoice-tauri.git`
3. Install dependencies: `pnpm install && cargo build --release`
4. Start development: `pnpm tauri dev`
5. Create a feature branch: `git checkout -b feature/your-feature`
6. Make your changes and test thoroughly
7. Submit a pull request

### Code Guidelines

- **Commits**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Pull Requests**: Include description and link to any related issues
- **Testing**: Test Gmail integration with valid credentials
- **Documentation**: Update README for any new features

### Reporting Issues

When reporting bugs:
1. Include your OS and versions (Node.js, Rust, etc.)
2. Describe the steps to reproduce
3. Include error messages and screenshots
4. Specify if Gmail integration is involved

## 📄 API Documentation

### Tauri Commands

#### Gmail Integration
- `get_gmail_auth_url()`: Get OAuth2 authorization URL
- `exchange_gmail_code(code, verifier)`: Exchange authorization code for token
- `create_gmail_draft(subject, body)`: Create Gmail draft
- `is_gmail_authenticated()`: Check authentication status

#### Template Management
All template operations are handled client-side through Zustand store.

### Invoice Calculation Logic

The app calculates invoices based on:
- **Term Detection**: Automatically determines current academic term
- **Lesson Frequency**: Weekly lessons by default
- **Cost Calculation**: `cost_per_lesson × students_per_session × weeks_in_term`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tauri**: For the amazing desktop app framework
- **Shadcn/ui**: For beautiful, accessible UI components
- **Tailwind CSS**: For utility-first styling
- **Google APIs**: For Gmail integration capabilities
- **Original Python App**: For the core business logic inspiration

## 📞 Support

For questions, issues, or contributions:
- **GitHub Issues**: [Create an issue](https://github.com/your-username/student-invoice-tauri/issues)
- **Discussions**: [Start a discussion](https://github.com/your-username/student-invoice-tauri/discussions)

---

**Built with ❤️ using Tauri, React, and Rust**