# Tauri Icons Fix - CI/CD Build Issue

## Problem

The Tauri build was failing in CI/CD with the error:
```
`icons/icon.ico` not found; required for generating a Windows Resource file during tauri-build
```

## Root Cause

The `src-tauri/icons/` directory was empty (only contained `.gitkeep` and `README.md`), but Tauri requires several icon files to build the application, especially `icon.ico` for Windows builds.

## Solution

### 1. Created Placeholder Icon Generator

Created `scripts/generate-placeholder-icons.js` that generates minimal placeholder icons:
- `icon.ico` - Minimal Windows icon (16x16, 1-bit color)
- `icon.icns` - Empty macOS icon file
- `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png` - Minimal 1x1 PNG files

These are sufficient for CI/CD builds to succeed.

### 2. Updated CI/CD Workflow

Modified `.github/workflows/tauri-build.yml` to run the icon generator before building:

```yaml
- name: Generate placeholder icons
  run: node scripts/generate-placeholder-icons.js
  shell: pwsh
```

This ensures icons are always available during CI/CD builds.

### 3. Committed Placeholder Icons

The generated placeholder icons are committed to the repository in `src-tauri/icons/` to ensure:
- CI/CD builds work immediately without additional setup
- Local development works out of the box
- No external dependencies for basic builds

### 4. Updated Documentation

Updated `src-tauri/icons/README.md` with:
- Clear indication that current icons are placeholders
- Instructions for generating placeholders
- Instructions for creating production-quality icons
- Notes about when to replace placeholders

## Files Changed

1. **Created**: `scripts/generate-placeholder-icons.js` - Icon generator script
2. **Modified**: `.github/workflows/tauri-build.yml` - Added icon generation step
3. **Created**: `src-tauri/icons/*.png`, `src-tauri/icons/icon.ico`, `src-tauri/icons/icon.icns` - Placeholder icons
4. **Updated**: `src-tauri/icons/README.md` - Documentation
5. **Created**: `docs/TAURI-ICONS-FIX.md` - This document

## Testing

Run locally to verify:
```bash
# Generate icons
node scripts/generate-placeholder-icons.js

# Verify icons exist
ls src-tauri/icons/

# Test Tauri build (requires Rust)
npm run tauri:build
```

## Next Steps for Production

Before releasing to production, replace placeholder icons with proper branded icons:

1. Create a high-quality icon (512x512 PNG, transparent background)
2. Run: `npm run tauri icon path/to/icon.png`
3. Commit the generated icons

## Notes

- Placeholder icons are intentionally minimal (1x1 pixels) to keep repository size small
- They are sufficient for CI/CD builds but should be replaced for production
- The icon generator uses base64-encoded minimal PNG and a hand-crafted minimal ICO format
- No external dependencies required for icon generation
