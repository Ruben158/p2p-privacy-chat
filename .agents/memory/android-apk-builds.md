---
name: Android APK build environment
description: Local Android SDK availability and APK build options in this Replit workspace.
---

Before building an APK locally, check for Android SDK tools and SDK environment paths; Java 17 alone is not sufficient. In this workspace, the Replit package index did not provide Android SDK packages, so the configured GitHub Actions workflow is the available build route.

**Why:** The workspace had Java 17 but no Android SDK, and Android SDK package installation was rejected because those packages were absent from the package index.

**How to apply:** Verify the current SDK state before attempting a local build. If it is still unavailable, use the GitHub Actions workflow after the project is connected to a GitHub repository.
