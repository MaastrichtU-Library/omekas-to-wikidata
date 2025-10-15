# Making Your First Edit with Claude Code

**[← Back to README](../README.md)** | **[← Back to Technical Documentation](DOCUMENTATION.md)** | **[← Back to Contributing](CONTRIBUTING.md)**

This guide will walk you through making your first contribution to this repository using Claude Code, an AI-powered coding assistant from Anthropic. This is the AI tool used to build this tool.

## Table of Contents
- [Making Your First Edit with Claude Code](#making-your-first-edit-with-claude-code)
  - [Table of Contents](#table-of-contents)
  - [Installing Claude Code](#installing-claude-code)
  - [Setting Up Your Account](#setting-up-your-account)
    - [Using Pay-As-You-Go (No Subscription Required)](#using-pay-as-you-go-no-subscription-required)
  - [Working Effectively with Claude Code](#working-effectively-with-claude-code)
    - [Context Management](#context-management)
    - [Writing Effective Prompts](#writing-effective-prompts)
  - [Repository Setup](#repository-setup)
    - [Creating Your Working Branch](#creating-your-working-branch)
  - [Running the Code Locally](#running-the-code-locally)
  - [Understanding the Branch Structure](#understanding-the-branch-structure)
    - [Automatic Deployment](#automatic-deployment)
    - [Important Notes](#important-notes)
  - [Troubleshooting and Best Practices](#troubleshooting-and-best-practices)
    - [When Claude Code Doesn't Perform as Expected](#when-claude-code-doesnt-perform-as-expected)
    - [General Best Practices](#general-best-practices)
    - [Getting Help](#getting-help)
  - [Next Steps](#next-steps)
  - [Additional Resources](#additional-resources)

---

## Installing Claude Code

Claude Code is Anthropic's AI coding assistant that integrates directly into your development workflow.

**Important:** Installation instructions change over time, so always refer to the official documentation:
- Visit [Anthropic's Claude Code documentation](https://docs.claude.com/en/docs/claude-code/overview) for the latest installation guide
- Follow their platform-specific instructions for your operating system

The installation process typically involves:
- Installing the Claude Code application or extension
- Setting up authentication with your Anthropic account
- Configuring your development environment (partialy pre-configured in this repository )

---

## Setting Up Your Account

### Using Pay-As-You-Go (No Subscription Required)

If you prefer not to subscribe, you can use Claude Code with a pay-as-you-go model:

1. **Create a free Anthropic account** at [console.anthropic.com](https://console.anthropic.com)
3. **Add credits to your account:** in the billing section of the console. Please refer to the official Anthropic documentation for changes might happen over time.
   - Look for the billing or credits section
   - Add the desired amount of money to your account
   - These credits will be used as you interact with Claude Code. in Claude Code you can use the "/cost" command to see what has been spent in that session.  

4. **Configure Claude Code** to use your API key or account credentials

This approach gives you full control over your spending without requiring a monthly subscription. And is perfect for the first time using the tool.

---

## Working Effectively with Claude Code

This repository is configured with a `CLAUDE.md` file that helps Claude Code understand the project structure, conventions, and best practices. However, to get the most out of Claude Code, keep these tips in mind:

### Context Management

**Clear your context regularly** to reduce costs and improve response quality:

```bash
/clear    # Clears the entire context window
/compact  # Compacts context by removing less relevant information
```

A smaller, more focused context means:
- Lower API costs
- Faster responses
- More accurate answers
- Better performance on subsequent questions

Clear or compact your context whenever you move to a new, unrelated task.

### Writing Effective Prompts

Claude Code is designed to understand natural language, so you don't need to use special formatting or technical jargon:

- **Write naturally:** Communicate as if you're talking to a knowledgeable colleague
- **Be conversational:** Use normal, spoken language
- **Say where to change code:** Seeing which part of the tool you want to change helps the AI to locate the right code. "Step two entity schema model" will let the AI know where to search. There is no need for telling AI which specific code files to edit. 
- **Be specific when possible:** The more precise your instructions, the better the outcome
  - ✅ Good: "Update the reconciliation modal to add a 'Skip All' button next to the existing buttons"
  - ❌ Vague: "Make the modal better"

- **Provide context:** If you're working on a specific feature or fixing a bug, explain what you're trying to achieve. In the case of a bug, it's nice to say what is happening currently and what is expected/disired behavior.
- **Avoid ambiguity:** Specific details prevent misinterpretation and save time

Remember: Clear communication leads to better results and fewer iterations.

---

## Repository Setup

### Creating Your Working Branch

**Never work directly on the `dev` or `main` branches.** Always create a new branch for your changes:

1. **Clone the repository:**
   ```bash
   git clone [repository-url]
   cd [repository-name]
   ```

2. **Checkout the `dev` branch:**
   ```bash
   git checkout dev
   git pull origin dev
   ```

3. **Create your feature branch:**
   ```bash
   git checkout -b my-feature-name
   ```

   Choose a descriptive branch name that reflects your work, such as:
   - `fix-reconciliation-bug`
   - `add-export-feature`
   - `update-documentation`

4. **Make your edits** using Claude Code or your preferred editor. The current CLAUDE.md configuration tells Claude Code to commit every time it edits code.

5. **Commit your changes** as you work:
   ```bash
   git add .
   git commit -m "Descriptive commit message"
   ```
note: The current CLAUDE.md configuration tells Claude Code to commit for you every time it edits code.

Working in a separate branch allows you to:
- Experiment freely without affecting the main codebase
- Easily discard changes if something goes wrong
- Create clean pull requests for code review
- Revert individual commits without impacting others

---

## Running the Code Locally

To test your changes before pushing them, run the application locally using Python's built-in HTTP server:

1. **Navigate to the repository root:**
   ```bash
   cd [repository-root]
   ```

2. **Start the Python server:**
   ```bash
   python -m http.server 8080
   ```

   Or for Python 2:
   ```bash
   python -m SimpleHTTPServer 8080
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:8080
   ```

4. **Navigate to the application:**
   - Go to the `src/` directory in the browser
   - The application will open and function as it would in production

This local server allows you to:
- Test changes immediately
- Debug issues in a safe environment
- Verify functionality before pushing to GitHub

---

## Understanding the Branch Structure

This repository uses an automated deployment system that copies code from specific branches to corresponding directories in the `main` branch:

### Automatic Deployment

| Source Branch | Source Directory | Destination in `main` | URL Path | Purpose |
|---------------|------------------|----------------------|----------|---------|
| `dev` | `src/` | `src/dev/` | `[website-url]/dev` | Latest development version |
| `test` | `src/` | `src/test/` | `[website-url]/test` | Staged testing version |

**How it works:**

1. **Development workflow:**
   - Make changes in your feature branch
   - Push to the `dev` branch
   - Changes are automatically copied to `main/src/dev/`
   - Access at `[website-url]/dev` for testing

2. **Testing workflow:**
   - Push stable changes to the `test` branch
   - Changes are automatically copied to `main/src/test/`
   - Share `[website-url]/test` with testers for feedback

3. **Production workflow:**
   - Manually merge to `main` after thorough testing
   - Production code lives in `main/src/`

### Important Notes

- **Only code in `src/` is automatically deployed** from `dev` and `test` branches
- **Documentation files** (`.md`, `README`, etc.) are **not automatically merged**
- To update documentation in `main`, you must either:
  - Use the GitHub web interface to manually copy files between branches
  - Manually move files between branches on your local machine
  - Create a pull request with documentation changes

This system allows developers to experiment safely while giving stakeholders access to preview versions.

---

## Troubleshooting and Best Practices

### When Claude Code Doesn't Perform as Expected

If Claude Code produces unexpected results:

1. **Don't stack unsuccessful commits** – This makes it harder to track what went wrong

2. **Revert immediately:**
   ```bash
   git revert [commit-hash]
   ```
   Or revert the most recent commit:
   ```bash
   git revert HEAD
   ```

3. **Revise your prompt** and try again with clearer instructions

4. **Tell Claude Code what went wrong:**
   - "The bug is still present after your changes"
   - "Please revert the code and try a different approach"
   - Explain what you expected vs. what happened

This feedback helps Claude Code understand that its previous attempt didn't work and it needs to investigate alternative solutions.

### General Best Practices

- **Commit frequently** with descriptive messages
- **Test locally** before pushing
- **Review changes** before committing
- **Use meaningful branch names** that describe your work
- **Keep commits focused** on a single logical change
- **Clear your AI context** when switching between unrelated tasks

### Getting Help

If you encounter issues:
- Ask Claude Code questions about the codebase – it has context about the project
- Consult the `CLAUDE.md` file in the repository root for project-specific conventions
- Review the `docs/JS_MODULE_MAP.md` for understanding the codebase structure
- Reach out to the development team for guidance

---

## Next Steps

Once you've made your changes and tested them locally:

1. **Push your branch to GitHub:**
   ```bash
   git push origin my-feature-name
   ```

2. **Create a pull request** on GitHub:
   - Compare your branch against `dev` (or the appropriate target branch)
   - Write a clear description of your changes
   - Request review from maintainers

3. **Respond to feedback** and make any requested changes

4. **Merge your pull request** once approved

Congratulations on making your first contribution using Claude Code!

---

## Additional Resources

- [Claude Code Official Documentation](https://docs.claude.com/en/docs/claude-code/overview)
- [Project CLAUDE.md](../CLAUDE.md) – Project-specific conventions and guidelines
- [JavaScript Module Map](JS_MODULE_MAP.md) – Understanding the codebase structure
- [GitHub Flow Guide](https://guides.github.com/introduction/flow/) – Understanding Git workflows

---

**[← Back to README](../README.md)** | **[← Back to Technical Documentation](DOCUMENTATION.md)** | **[← Back to Contributing](CONTRIBUTING.md)**
