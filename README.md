# Student Invoice Tauri App

A modern desktop application for automating music lesson invoice creation and Gmail integration, built with Tauri, React, and Rust.

## Overview

This application recreates and modernizes the existing Python-based student invoice system with the following improvements:

- **Modern UI**: Clean, responsive interface with dark/light themes
- **Cross-platform**: Native Windows, macOS, and Linux support
- **Performance**: Fast Rust backend with React frontend
- **Security**: Enhanced OAuth2 integration with Google APIs
- **Maintainability**: TypeScript and modern development practices

## Features

### Core Functionality
- **Template Management**: Create, edit, and delete invoice templates for different students
- **Automatic Scheduling**: Term-based calculations (Autumn, Spring, Summer terms)
- **Invoice Generation**: Dynamic invoice creation with cost calculations
- **Email Integration**: Gmail API integration for creating email drafts
- **Settings Management**: Configurable themes and preferences

### Technical Features
- **Modern Google APIs**: Updated Gmail API v1 with latest OAuth2 flows
- **Native Performance**: Rust backend for optimal speed and memory usage
- **Responsive UI**: Modern React interface with Tailwind CSS
- **Type Safety**: Full TypeScript implementation
- **Secure Storage**: Encrypted credential storage

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Hook Form** for form management
- **React Router** for navigation
- **Zustand** for state management

### Backend
- **Rust** for system-level operations
- **Tauri** for desktop app framework
- **Google APIs Client** for Gmail integration
- **OAuth2** for secure authentication

### Development Tools
- **Vite** for fast development builds
- **ESLint** for code linting
- **Prettier** for code formatting
- **pnpm** for package management

## Prerequisites

Before starting development, ensure you have these tools installed:

1. **Node.js** (LTS) - https://nodejs.org/
2. **Rust** (latest stable) - https://rustup.rs/
3. **Microsoft Visual Studio C++ Build Tools** (Windows only)
4. **WebView2 Runtime** (usually pre-installed on Windows 10/11)

See [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) for detailed installation instructions.

## Quick Start

### Development Setup

```bash
# Clone or navigate to project directory
cd student-invoice

# Create Tauri app with React TypeScript template
npm create tauri-app@latest student-invoice-tauri -- --template react-ts --package-manager pnpm

# Navigate to the created app
cd student-invoice-tauri

# Install dependencies
pnpm install

# Start development server (opens desktop app with hot reload)
pnpm tauri dev
```

### Production Build

```bash
# Build the application
pnpm tauri build

# The built app will be in src-tauri/target/release/
```

## Project Structure

```
student-invoice-tauri/
├── src/                          # React frontend
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base UI components (Button, Input, etc.)
│   │   ├── templates/            # Template management components
│   │   ├── invoices/             # Invoice generation components
│   │   └── settings/             # Settings components
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand state stores
│   ├── types/                    # TypeScript definitions
│   ├── utils/                    # Utility functions
│   └── lib/                      # Library functions
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs              # Application entry point
│   │   ├── commands.rs          # Tauri commands (API endpoints)
│   │   ├── gmail.rs             # Gmail API integration
│   │   ├── templates.rs         # Template management
│   │   ├── invoices.rs          # Invoice generation logic
│   │   └── settings.rs          # Settings management
│   ├── icons/                    # App icons
│   └── Cargo.toml               # Rust dependencies
├── public/                       # Static assets
├── package.json                  # Node.js dependencies and scripts
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite configuration
└── tauri.conf.json              # Tauri configuration
```

## API Integration

### Google Gmail API

The app integrates with Google's Gmail API to create email drafts. Setup requires:

1. Google Cloud Console project
2. Gmail API enabled
3. OAuth 2.0 credentials configured
4. Proper redirect URIs set

### OAuth2 Flow

- Development: `http://localhost:8080`
- Production: Custom URI scheme (`student-invoice://auth`)

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Google API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# App Configuration
APP_NAME=Student Invoice
APP_VERSION=1.0.0
```

### App Settings

The app stores user preferences locally:
- Theme selection (dark/light/custom)
- Email mode (auto-draft or clipboard)
- Window position and size
- Template preferences

## Development Scripts

```bash
# Development
pnpm tauri dev          # Start development server
pnpm dev               # Start frontend only

# Building
pnpm tauri build       # Build production app
pnpm build            # Build frontend only

# Code Quality
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm type-check       # Run TypeScript checking

# Maintenance
pnpm clean            # Clean build artifacts
pnpm clean-install    # Clean and reinstall dependencies
```

## Migration from Python Version

This Tauri version maintains all functionality from the original Python app:

- **Template System**: JSON-based template storage (compatible format)
- **Term Calculations**: Same Autumn/Spring/Summer term logic
- **Invoice Generation**: Identical cost calculation formulas
- **Email Integration**: Gmail API draft creation
- **Settings**: Theme and preference management

### Breaking Changes
- UI completely redesigned with modern components
- Settings storage moved to secure Tauri storage
- OAuth2 flow updated to latest Google standards

## Contributing

1. Follow the existing code style (Prettier/ESLint)
2. Use TypeScript for all new code
3. Add tests for new features
4. Update documentation for API changes
5. Follow conventional commit messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Documentation**: See DEVELOPMENT_SETUP.md for setup help
- **Tauri Docs**: https://tauri.app/v1/guides/
- **Google APIs**: https://developers.google.com/gmail/api

### Current Features ✅

- [x] **Modern Dark Mode UI** - Beautiful dark/light/system themes with Tailwind CSS
- [x] **Responsive Window Sizing** - Proper window dimensions (1200x800) with minimum constraints (1000x700)
- [x] **No Scrolling Layout** - Full-screen layout that adapts to window size without overflow
- [x] **Template Management** - Sample templates with persistent storage
- [x] **Invoice Generation** - Complete invoice generation with cost calculations and term logic
- [x] **Term Calculation** - Automatic Autumn/Spring/Summer term detection
- [x] **Real-time Preview** - Live invoice preview as you select templates
- [x] **State Management** - Zustand store with local persistence
- [x] **Type Safety** - Full TypeScript implementation

### Remaining Features 🔄

- [ ] Gmail API integration with OAuth2
- [ ] Template CRUD operations (Add/Edit/Delete forms)
- [ ] Settings panel with advanced configuration
- [ ] Auto-update functionality
- [ ] Cross-platform testing (macOS/Linux)
