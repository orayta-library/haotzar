# CI Build Fix - Meilisearch Resources

## Problem
The Tauri build was failing in GitHub Actions with the error:
```
path matching ../resources/meilisearch/** not found.
```

## Root Cause
Tauri's build process validates that all paths specified in `tauri.conf.json` under `bundle.resources` exist with files before starting the build. The `resources/meilisearch` directory was specified but:
1. The meilisearch.exe file is too large for git (~50MB)
2. Downloading it before build was complex and unreliable
3. The file isn't actually needed at build time - only at runtime

## Solution
**Removed Meilisearch from bundled resources entirely.**

Changed `src-tauri/tauri.conf.json`:
```json
"resources": []
```

Instead of bundling Meilisearch with the app, it should be:
- Downloaded separately by users
- Or downloaded on first run
- Or provided as a separate installer component

### Benefits:
- ✅ Smaller app bundle size
- ✅ No build-time dependency on large binary
- ✅ Easier CI/CD pipeline
- ✅ Users can update Meilisearch independently

### Implementation Notes:
The app currently uses Electron IPC to start Meilisearch (`window.electron.startMeilisearch()`). For Tauri, this needs to be reimplemented using:
- Tauri commands to spawn the Meilisearch process
- Or external process management
- Or user-managed Meilisearch server

## Next Steps:
1. Update the app to handle Meilisearch as an external dependency
2. Add documentation for users on how to install Meilisearch
3. Consider adding auto-download on first run
4. Or provide a separate installer that includes Meilisearch

## Related Files
- `src-tauri/tauri.conf.json` - Removed resources configuration
- `src/utils/meilisearchEngine.js` - Frontend Meilisearch client
- `electron/main.js` - Electron IPC handlers (not used in Tauri)
