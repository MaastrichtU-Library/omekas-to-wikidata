# Contributing to Omeka S to Wikidata Tool

**[← Back to README](../README.md)** | **[← Back to Technical Documentation](DOCUMENTATION.md)**

Thank you for your interest in contributing to the Omeka S to Wikidata tool! We welcome contributions from developers, documentarians, and users of all experience levels.

---

## 🚀 Quick Start for New Contributors

**New to this project?** Start here:

👉 **[Making Your First Edit with Claude Code](FIRST_EDIT_GUIDE.md)**

This comprehensive guide walks you through:
- Setting up Claude Code (the AI assistant used to build this project)
- Understanding the repository structure
- Creating your first contribution
- Working with branches and pull requests
- Best practices and troubleshooting

---

## 📚 Essential Documentation

Before contributing, familiarize yourself with:

1. **[FIRST_EDIT_GUIDE.md](FIRST_EDIT_GUIDE.md)** - Step-by-step guide for new contributors
2. **[CLAUDE.md](../CLAUDE.md)** - Project conventions and coding standards
3. **[JS_MODULE_MAP.md](JS_MODULE_MAP.md)** - Complete JavaScript module reference
4. **[DOCUMENTATION.md](DOCUMENTATION.md)** - Technical architecture overview

---

## 🤝 Ways to Contribute

### 🐛 Report Bugs
- Search [existing issues](https://github.com/MaastrichtU-Library/omekas-to-wikidata/issues) first
- Provide clear steps to reproduce
- Include screenshots or error messages
- Specify your browser and operating system

### 💡 Suggest Features
- Open a GitHub issue with the "enhancement" label
- Explain the use case and benefits
- Discuss implementation approaches

### 📝 Improve Documentation
- Fix typos, clarify instructions, or add examples
- Update documentation when code changes
- Help make the tool more accessible

### 🔧 Submit Code
- Follow the project's coding conventions in [CLAUDE.md](../CLAUDE.md)
- Write tests for new functionality
- Keep commits focused and descriptive
- Update documentation alongside code changes

### 🧪 Add Tests
- Increase test coverage for existing features
- Add edge case tests
- See our [Playwright E2E testing guide](../CLAUDE.md#testing)

### 🌐 Translate
- Help make the tool available in more languages
- Contact the project team to coordinate translation efforts

---

## 🛠️ Development Workflow

### 1. Set Up Your Environment

```bash
# Clone the repository
git clone https://github.com/MaastrichtU-Library/omekas-to-wikidata.git
cd omekas-to-wikidata

# Checkout dev branch
git checkout dev
git pull origin dev

# Create your feature branch
git checkout -b my-feature-name
```

### 2. Make Your Changes

**Work only in the `src/` directory** for code changes. Follow conventions in [CLAUDE.md](../CLAUDE.md):
- Use ES6+ JavaScript
- Follow the component factory system
- Use state management convenience methods
- Consult [JS_MODULE_MAP.md](JS_MODULE_MAP.md) to find the right files

### 3. Test Locally

```bash
# Start a local server
python -m http.server 8080

# Open in browser
# Navigate to http://localhost:8080/src/
```

Run E2E tests:
```bash
# Quick smoke tests
npm run test:e2e:smoke

# Full test suite
npm run test:e2e

# Interactive test runner
npm run test:e2e:ui
```

### 4. Commit Your Changes

```bash
git add <files>
git commit -m "Clear, descriptive commit message"
```

Follow the commit message format described in [CLAUDE.md](../CLAUDE.md).

### 5. Push and Create a Pull Request

```bash
git push origin my-feature-name
```

Then open a pull request on GitHub:
- Target the `dev` branch (not `main`)
- Write a clear description of your changes
- Reference any related issues
- Request review from maintainers

---

## 📋 Code Quality Standards

### JavaScript
- Use `const` by default, `let` when necessary
- Use arrow functions for callbacks
- Use async/await for asynchronous operations
- Wrap async operations in try/catch blocks
- **Always use component factory functions** from `src/js/ui/components.js`
- **Use state management convenience methods** from `src/js/state.js`

### File Organization
- Maximum 1000 lines per file
- Feature-based structure (see [CLAUDE.md](../CLAUDE.md))
- Keep related code together
- Separate concerns: business logic, UI, utilities

### Documentation
- Update [JS_MODULE_MAP.md](JS_MODULE_MAP.md) when adding/modifying JavaScript modules
- Add JSDoc comments to functions
- Keep README and user manual up to date
- Document complex logic with clear comments

### Testing
- **All new functionality requires E2E test coverage**
- Test error cases and edge conditions
- Use `@smoke` and `@critical` tags appropriately

---

## 🌳 Branch Structure

| Branch | Purpose | Deployment |
|--------|---------|------------|
| `main` | Production code | Live demo at root URL |
| `test` | Staged testing | `/test` subdirectory |
| `dev` | Active development | `/dev` subdirectory |
| `feature/*` | Individual features | Not deployed |

**Always create feature branches from `dev`, never from `main`.**

---

## ✅ Pull Request Checklist

Before submitting a pull request:

- [ ] Code follows project conventions in [CLAUDE.md](../CLAUDE.md)
- [ ] Tests pass (`npm run test:e2e`)
- [ ] New functionality includes tests
- [ ] Documentation is updated
- [ ] [JS_MODULE_MAP.md](JS_MODULE_MAP.md) is updated if modules changed
- [ ] Changes tested locally
- [ ] Commits are clear and focused
- [ ] Branch targets `dev` (not `main`)

---

## 🐛 Bug Reporting Template

When reporting bugs, include:

**Description**
Clear description of the issue

**Steps to Reproduce**
1. Go to...
2. Click on...
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14.0]
- Version: [e.g., dev/test/production]

**Screenshots**
If applicable, add screenshots

---

## 💬 Getting Help

- **Questions about contributing:** Open a GitHub discussion
- **Technical questions:** Consult [DOCUMENTATION.md](DOCUMENTATION.md) and [JS_MODULE_MAP.md](JS_MODULE_MAP.md)
- **Setup issues:** See [FIRST_EDIT_GUIDE.md](FIRST_EDIT_GUIDE.md)
- **Project team:** Contact via GitHub issues

---

## 📜 Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:
- Be respectful and considerate
- Provide constructive feedback
- Focus on what's best for the project and community
- Show empathy towards others

---

## 🙏 Recognition

All contributors will be recognized in project documentation. Thank you for helping make this tool better!

---

**[← Back to README](../README.md)** | **[← Back to Technical Documentation](DOCUMENTATION.md)**
