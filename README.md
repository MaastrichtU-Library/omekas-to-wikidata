# Omeka S to Wikidata Tool

A web-based application that guides users through importing linked data from Omeka S collections into Wikidata. Transform your cultural heritage metadata into structured, linked open data that contributes to the global knowledge base.

**Developed by** [Maastricht University Library](https://library.maastrichtuniversity.nl/) and [Radboud University Library](https://www.ru.nl/library/) as part of the 2025 "Open Topstukken" (Open Collection Highlights) project.

---

## 🚀 Try It Now

**[▶ Launch Live Demo](https://maastrichtu-library.github.io/omekas-to-wikidata/)**

Start using the tool immediately—no installation required. Process your Omeka S data through our guided 5-step workflow and generate Wikidata-ready QuickStatements.

### Other Versions
- **[Test Version](https://maastrichtu-library.github.io/omekas-to-wikidata/test)** - Preview upcoming features
- **[Development Version](https://maastrichtu-library.github.io/omekas-to-wikidata/dev)** - Latest experimental changes

---

## 📚 Documentation

### For Everyone
- **[User Guide](documentation/USER_GUIDE.md)** - Current walkthrough of Input, Mapping, Reconciliation, References, and Export
- **[Product Decisions](documentation/DECISIONS.md)** - Why Mapping/Reconciliation are central and Step 4 is reference-focused

### For Developers & Contributors
- **[Developer Guide](documentation/DEVELOPER_GUIDE.md)** - Local setup, conventions, branch flow, and issue practice
- **[Architecture](documentation/ARCHITECTURE.md)** - Current client-side design and value-resolution model
- **[Testing and Release](documentation/TESTING_AND_RELEASE.md)** - Scenario checks and `dev -> test -> main` promotion
- **[JavaScript Module Map](docs/JS_MODULE_MAP.md)** - Complete codebase reference

Older plans and specifications remain available in [Historical Project Material](archive/README.md). They are preserved for context and may describe an earlier Item Designer direction.

---

## 🎯 What Does This Tool Do?

The Omeka S to Wikidata tool bridges cultural heritage collections with the semantic web. It helps you:

1. **Import** data from Omeka S APIs (with automatic CORS handling)
2. **Map** your metadata fields to Wikidata properties using Entity Schemas
3. **Reconcile** values with existing Wikidata entities to avoid duplicates
4. **Assign references** to document your data sources
5. **Export** QuickStatements code for bulk import into Wikidata

**Who is this for?**
- Librarians and archivists managing digital collections
- Collection managers at cultural heritage institutions
- Digital humanities researchers working with linked data
- Data curators contributing to Wikidata

**No programming required** - the tool provides a visual, step-by-step interface for the entire process.

---

## ⚡ Key Features

### 🔄 Automatic CORS Handling
Access Omeka S APIs even when CORS headers aren't configured:
- Tries direct connection first
- Automatically falls back to proxy services
- Provides manual JSON input as last resort
- Includes administrator guidance for CORS configuration

### 💾 Save & Reuse Mappings
Create mapping templates once, use them many times:
- Save mapping configurations as reusable templates
- Load mappings for similar datasets
- Share mappings with colleagues
- Separate mappings from actual data

### 🎯 Entity Schema Integration
Leverage Wikidata's structured schemas:
- Select appropriate schemas for your item types (paintings, books, etc.)
- Get intelligent property suggestions
- Ensure data quality and consistency
- Follow Wikidata best practices automatically

### 🔗 Smart Reconciliation
Link to existing Wikidata items to avoid duplicates:
- Search for matching items in Wikidata
- Configure property-specific requirements (languages, units, etc.)
- Edit and validate data before export
- Track progress across large datasets

### 📦 Project Management
Never lose your work:
- Save complete project state at any time
- Resume work later from saved projects
- Export mapping templates separately
- Keep backups of your work

---

## 🛠️ How It Works

The tool guides you through five clear steps:

### 1️⃣ Input
Configure an Omeka S API endpoint and select its scope. The tool supports resource-template, item-set, site, owner, and optional one-page pagination filters. If browser access is blocked by CORS, paste the items JSON manually and, when needed, the matching resource-template JSON.

### 2️⃣ Mapping
Start with Label and Instance of, then map only the Omeka S fields you want to reconcile and send to Wikidata. Use Entity Schema guidance, observed segment families, source filters, transformations, and live samples to handle mixed values safely.

### 3️⃣ Reconciliation
Review individual values, verify Wikidata QIDs, choose label languages, validate dates and identifiers, and use source badges to see whether a value came from literal text, an authority, or Wikidata.

### 4️⃣ References
Assign detected or custom source URLs to mapped properties. This step focuses on provenance for statements rather than a separate item designer.

### 5️⃣ Export
Generate QuickStatements code and import your data into Wikidata. Test in the Wikidata Sandbox before going live.

**[Read the current User Guide →](documentation/USER_GUIDE.md)**

---

## 🔗 Related Links

- **[Wikidata Project Page](https://www.wikidata.org/wiki/Wikidata:WikiProject_Open_Topstukken_Maastricht_University_and_Radboud_University)** - Learn about the Open Topstukken project
- **[QuickStatements](https://quickstatements.toolforge.org/)** - Review and run the generated export
- **[GitHub Repository](https://github.com/MaastrichtU-Library/omekas-to-wikidata)** - Source code and issue tracking

---

## 🤝 Contributing

We welcome contributions from developers, documentarians, and users!

**Getting Started:**
1. Read the **[Developer Guide](documentation/DEVELOPER_GUIDE.md)** - Local setup and project conventions
2. Review the **[Architecture](documentation/ARCHITECTURE.md)** - Current design and data flow
3. Follow **[Testing and Release](documentation/TESTING_AND_RELEASE.md)** - Validation and promotion practice
4. Explore the **[JavaScript Module Map](docs/JS_MODULE_MAP.md)** - Navigate the codebase

**Ways to Contribute:**
- 🐛 Report bugs and issues
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit code improvements
- 🧪 Add or improve tests
- 🌐 Translate the interface

---

## 💡 For Omeka S Administrators

To enable direct API access without proxies, add this to your `.htaccess` file:

```apache
# Enable CORS for API access
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Headers "origin, x-requested-with, content-type"
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
</IfModule>
```

For production environments, replace `"*"` with specific trusted domains.

---

## 📄 License

[Add license information here]

---

## 🙋 Support & Contact

- **Issues & Bug Reports:** [GitHub Issues](https://github.com/MaastrichtU-Library/omekas-to-wikidata/issues)
- **Questions:** Open a discussion or issue on GitHub
- **Project Team:** Maastricht University Library & Radboud University Library

---

## 🌟 Project Status

This tool is actively developed and maintained as part of the Open Topstukken project. We welcome feedback, bug reports, and contributions from the community.

**Latest Updates:** Check the [development version](https://maastrichtu-library.github.io/omekas-to-wikidata/dev) for the newest features.
