#!/bin/bash

# Playwright Multi-Branch Setup Script
# Creates symlinks to global Playwright installation for zero-download testing

echo "🎭 Setting up Playwright for multi-branch usage..."

# Check if global Playwright is installed
if ! command -v playwright &> /dev/null; then
    echo "❌ Playwright not found globally. Installing..."
    npm install -g @playwright/test
    npx playwright install
else
    echo "✅ Global Playwright found: $(playwright --version)"
fi

# Find global Playwright installation path
GLOBAL_PLAYWRIGHT_PATH=$(npm list -g @playwright/test --depth=0 --json 2>/dev/null | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin')).dependencies['@playwright/test'].path" 2>/dev/null)

# Fallback to common locations if the above doesn't work
if [ -z "$GLOBAL_PLAYWRIGHT_PATH" ] || [ ! -d "$GLOBAL_PLAYWRIGHT_PATH" ]; then
    if [ -d "/opt/homebrew/lib/node_modules/@playwright/test" ]; then
        GLOBAL_PLAYWRIGHT_PATH="/opt/homebrew/lib/node_modules/@playwright/test"
    elif [ -d "/usr/local/lib/node_modules/@playwright/test" ]; then
        GLOBAL_PLAYWRIGHT_PATH="/usr/local/lib/node_modules/@playwright/test"
    else
        echo "❌ Could not find global @playwright/test installation"
        echo "Please run: npm install -g @playwright/test"
        exit 1
    fi
fi

echo "📁 Global Playwright path: $GLOBAL_PLAYWRIGHT_PATH"

# Create node_modules structure
echo "🔗 Creating symlink structure..."
mkdir -p node_modules/@playwright

# Remove existing symlink if it exists
if [ -L "node_modules/@playwright/test" ]; then
    rm "node_modules/@playwright/test"
fi

# Create symlink to global installation
ln -s "$GLOBAL_PLAYWRIGHT_PATH" node_modules/@playwright/test

echo "✅ Setup complete!"
echo ""
echo "📊 Benefits:"
echo "  • No downloads: $(du -sh node_modules/ | cut -f1) total size"
echo "  • Uses global browsers and dependencies"
echo "  • Ready for testing across all branches"
echo ""
echo "🚀 Available commands:"
echo "  npm run test:e2e:smoke     # Quick smoke tests"
echo "  npm run test:e2e          # Full test suite"
echo "  npm run test:e2e:ui       # Interactive UI"
echo "  npm run test:e2e:codegen  # Record new tests"
echo ""
echo "🌟 To use in new branches:"
echo "  1. Switch to new branch"
echo "  2. Run: ./setup-playwright.sh"
echo "  3. Start testing immediately!"