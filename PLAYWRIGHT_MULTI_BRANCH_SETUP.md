# Multi-Branch Playwright Setup Guide

This document explains how to efficiently use Playwright across multiple branches without reinstalling dependencies each time.

## The Problem
When working with multiple branches that create separate copies of the repository, you typically face these issues:
- Having to run `npm install` in each branch (slow and redundant)
- Committing thousands of node_modules files to git
- Playwright browser binaries downloaded multiple times

## The Solution: Global Installation + Symlinks 

### 1. One-Time Global Setup

Install Playwright globally once on your system:

```bash
# Install Playwright globally
npm install -g @playwright/test

# Install browsers (only needs to be done once)
npx playwright install
```

### 2. Branch Setup (Zero Downloads!)

For each new branch, simply run the setup script:

```bash
./setup-playwright.sh
```

This creates lightweight symlinks (0 bytes total!) that provide module resolution without downloading anything.

### 3. Branch Configuration

Each branch only needs:
- **package.json** with Playwright scripts (no local dependencies!)
- **playwright.config.js** with test configuration  
- **setup-playwright.sh** for instant setup
- **.gitignore** excluding node_modules
- **tests/** directory structure

### 3. Project Structure

```
your-branch/
├── src/                      # Your application code
├── tests/
│   ├── e2e/                  # Playwright tests
│   ├── fixtures/             # Test data
│   └── helpers/              # Test utilities
├── package.json              # Includes Playwright scripts
├── playwright.config.js      # Test configuration
└── .gitignore               # Excludes node_modules
```

## Usage Across Branches

### Creating a New Branch
1. Create your branch as usual
2. Run the setup script: `./setup-playwright.sh`
3. Start testing immediately:

```bash
# In any branch
npm run test:e2e:smoke    # Quick smoke tests
npm run test:e2e         # Full test suite
npm run test:e2e:ui      # Interactive test runner
```

### Available Commands

```bash
# Test execution
npm run test:e2e                 # Run all tests
npm run test:e2e:smoke          # Run only smoke tests (@smoke tag)
npm run test:e2e:critical       # Run critical path tests (@critical tag)
npm run test:e2e:headed         # Run with browser visible
npm run test:e2e:ui             # Interactive test runner

# Development
npm run test:e2e:debug          # Debug mode with inspector
npm run test:e2e:codegen        # Record new tests
npm run test:report             # View test results
```

### Local Development Server

The configuration automatically starts a Python HTTP server:

```bash
# Automatic via playwright.config.js
python3 -m http.server 8080 --directory src

# Or start manually if needed
cd src && python3 -m http.server 8080
```

## Benefits of This Approach

✅ **Zero downloads** - Only 0 bytes of symlinks per branch
✅ **Instant setup** - One command creates full testing environment  
✅ **Clean git history** - No node_modules committed  
✅ **Shared everything** - Browsers, dependencies, all from global installation
✅ **Full compatibility** - Works exactly like local npm install
✅ **Fast branch switching** - No waiting, no downloads, no hassle

## Setup Script Details

The `setup-playwright.sh` script:

- ✅ Detects your global Playwright installation automatically
- ✅ Creates minimal symlink structure (0 bytes)
- ✅ Provides clear success confirmation
- ✅ Shows available commands and next steps
- ✅ Works across different Node.js installation paths

```bash
# What the script does:
mkdir -p node_modules/@playwright
ln -s /opt/homebrew/lib/node_modules/@playwright/test node_modules/@playwright/test

# Result: Full Playwright functionality with zero disk usage!
```

## Troubleshooting

### Command not found: playwright
If using global installation and getting command not found:

```bash
# Check global installation
npm list -g @playwright/test

# Reinstall if needed
npm install -g @playwright/test
```

### Browser not found errors
```bash
# Reinstall browsers
npx playwright install
```

### Port conflicts
The configuration uses port 8080. If busy, set PORT environment variable:

```bash
PORT=3000 npm run test:e2e
```

## Integration with CI/CD

For GitHub Actions or other CI environments, the regular approach works:

```yaml
- name: Install dependencies
  run: npm ci
  
- name: Install Playwright browsers
  run: npx playwright install --with-deps
  
- name: Run tests
  run: npm run test:e2e
```

## File Locations

Key files in this setup:
- `package.json` - Contains Playwright dependency and scripts
- `playwright.config.js` - Test configuration and web server setup
- `.gitignore` - Excludes node_modules and test artifacts
- `tests/e2e/` - Test files (to be created as needed)

## Next Steps

1. ✅ Configuration is complete
2. Create your first test: `npm run test:e2e:codegen`
3. Run smoke tests: `npm run test:e2e:smoke`
4. Build out test suite according to the comprehensive testing plan

This setup ensures you can work efficiently across multiple branches without the overhead of managing dependencies in each one.