# 🪟 Windows Setup Guide

## Prerequisites for Windows

### 1. Install Node.js
- Download from: https://nodejs.org/
- Install the LTS version (20.x or later)
- Verify installation: `node --version` and `npm --version`

### 2. Install Rust
- Download from: https://rustup.rs/
- Run the installer and follow the prompts
- Restart your terminal/PowerShell
- Verify installation: `rustc --version`

### 3. Install Git (if not already installed)
- Download from: https://git-scm.com/download/win
- Use default settings during installation

## 🚀 Quick Start on Windows

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd password_app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Development Mode (Web + Desktop)
```bash
npm run tauri dev
```

### 4. Build for Production
```bash
npm run tauri build
```

## 📦 Windows Build Outputs

After building, you'll find these files in `src-tauri/target/release/bundle/`:

- **MSI Installer**: `password-app_0.1.1_x64_en-US.msi`
- **NSIS Installer**: `password-app_0.1.1_x64-setup.exe`
- **Portable EXE**: `password-app.exe`

## 🔧 Troubleshooting Windows Issues

### Issue: "WebView2 not found"
**Solution**: Install Microsoft Edge WebView2
- Download: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
- Install the "Evergreen Standalone Installer"

### Issue: Build fails with "MSVC not found"
**Solution**: Install Visual Studio Build Tools
- Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Install "C++ build tools" workload

### Issue: "cargo not found"
**Solution**: 
1. Restart your terminal/PowerShell
2. If still not working, add Rust to PATH manually:
   - Add `%USERPROFILE%\.cargo\bin` to your PATH environment variable

## 🎯 Windows-Specific Features

- **Native Windows Integration**: Taskbar, system tray, notifications
- **Windows Security**: Integrates with Windows Credential Manager
- **Auto-updater**: Built-in update mechanism for Windows
- **File Associations**: Can register custom file types

## 📋 System Requirements

- **OS**: Windows 10 version 1903+ or Windows 11
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 100MB for app + data
- **WebView2**: Automatically installed with Windows 11, manual install for Windows 10

## 🔐 Security Notes for Windows

- Database stored in: `%APPDATA%\com.secure.passwordmanager\`
- Encryption keys managed securely by Windows DPAPI
- No admin privileges required for installation or operation

## 🚀 Distribution Options

1. **MSI Package**: For enterprise deployment via Group Policy
2. **NSIS Installer**: Standard Windows installer with uninstaller
3. **Portable EXE**: No installation required, runs from any folder
4. **Microsoft Store**: (Future) Submit to Windows Store for wider distribution

## 📞 Support

If you encounter issues on Windows:
1. Check the troubleshooting section above
2. Ensure all prerequisites are installed
3. Try running as administrator if permission issues occur
4. Check Windows Event Viewer for detailed error logs 