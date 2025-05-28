# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2024-05-28

### Fixed
- **White Screen Issue**: Resolved white screen on startup caused by missing WebKit dependencies on Ubuntu 24.04
- **Build Errors**: Fixed compilation errors related to missing system libraries on Linux
- **Tauri Integration**: Fixed incorrect plugin usage in lib.rs that prevented proper Tauri functionality

### Added
- **Ubuntu 24.04 Support**: Added `install-webkit.sh` script for easy WebKit dependency installation
- **Fallback Logic**: Added graceful fallbacks for non-Tauri environments (web browser compatibility)
- **Error Handling**: Improved error handling and user feedback in the React frontend
- **Documentation**: Comprehensive README with troubleshooting guide and setup instructions
- **License**: Added MIT license
- **Changelog**: Added this changelog file

### Changed
- **Entry Point**: Switched from main.rs to lib.rs as the primary Rust entry point
- **Dependencies**: Updated Tauri capabilities configuration for clipboard and dialog permissions
- **Code Structure**: Cleaned up duplicate code and unused imports

### Removed
- **Duplicate Files**: Removed duplicate main.rs file
- **Unused Imports**: Cleaned up unused Rust imports to eliminate compiler warnings

## [0.1.0] - 2024-05-27

### Added
- Initial release of the Password Manager
- AES-256-GCM encryption for secure password storage
- SQLite database for local data persistence
- React frontend with Bootstrap UI
- Tauri desktop application framework
- Cross-platform support (Windows, macOS, Linux)
- Password copying with automatic clipboard clearing
- Category-based password organization
- Notes support for password entries

### Security
- Local-only storage (no cloud synchronization)
- Strong encryption using industry-standard algorithms
- Memory-safe Rust backend
- Automatic clipboard clearing after 30 seconds 