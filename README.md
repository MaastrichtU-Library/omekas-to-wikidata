# Omeka S to Wikidata tool
Software to guide users to import (linked) data from Omeka S systems into Wikidata.

Developed as part of the 2025 project "Open Topstukken" ("Open Collection Highlights") by Maastricht University Library and Radboud University Library.

**📚 For technical and developer documentation, see [DOCUMENTATION.md](docs/DOCUMENTATION.md)**

# Use the tool
- [live demo](https://maastrichtu-library.github.io/omekas-to-wikidata/)
- [test version](https://maastrichtu-library.github.io/omekas-to-wikidata/test)
- [development version](https://maastrichtu-library.github.io/omekas-to-wikidata/dev)
- old prototypes:
    - [Original prototype](https://maastrichtu-library.github.io/omekas-to-wikidata/dev/prototypes/index.html)
    - [Mapping](https://maastrichtu-library.github.io/omekas-to-wikidata/dev/prototypes/map.html)
    - [Reconciliation](https://maastrichtu-library.github.io/omekas-to-wikidata/dev/prototypes/wikimedia-reconciliation.html)

# Links
[Wikidata Project Page](https://www.wikidata.org/wiki/Wikidata:WikiProject_Open_Topstukken_Maastricht_University_and_Radboud_University)

# How it works

The tool guides users through a 5-step process:

1. **Input**: Configure Omeka S API endpoint and import JSON data (with automatic CORS handling)
2. **Mapping**: Map JSON keys to Wikidata properties with load/save functionality
3. **Reconciliation**: Match data values to existing Wikidata entities
4. **References**: Placeholder step for future reference configuration
5. **Export**: Generate QuickStatements for bulk import to Wikidata

## Load/Save Mapping Functionality

In Step 2 (Mapping), you can save and load mapping configurations to reuse them across different datasets:

### Save Mapping
- Click "Save Mapping" to download a JSON file containing all current mappings
- File includes key-to-property mappings, property metadata, and ignored keys
- Excludes dataset-specific information (sample values, frequencies)

### Load Mapping
- Click "Load Mapping" to upload a previously saved mapping configuration
- Restores all mapped and ignored keys with their Wikidata property assignments
- Allows you to reuse mappings across similar datasets

### JSON Structure Example
```json
{
  "version": "1.0",
  "createdAt": "2025-06-04T07:26:43.213Z",
  "entitySchema": "E473",
  "mappings": {
    "mapped": [
      {
        "key": "dc:title",
        "linkedDataUri": "http://purl.org/dc/terms/title",
        "contextMap": {},
        "property": {
          "id": "P1476",
          "label": "title",
          "description": "published name of a work"
        },
        "mappedAt": "2025-06-04T07:26:41.537Z"
      }
    ],
    "ignored": [...]
  }
}
```

## CORS Proxy System

The tool includes an automatic CORS (Cross-Origin Resource Sharing) proxy fallback system to handle Omeka S installations that don't have CORS headers configured.

### How it works
1. **Direct Access**: First attempts to fetch data directly from the Omeka S API
2. **Proxy Fallback**: If CORS blocks the request, automatically tries proxy services in order:
   - CORS Anywhere (Heroku-based)
   - AllOrigins (reliable public proxy)
   - JSONProxy (backup option)
3. **Manual Input**: If all proxies fail, provides manual JSON input option
4. **Administrator Guidance**: Includes copy-paste email template for requesting CORS configuration

### For Omeka S Administrators

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

# Technical information
[Tool description](specs/Tool%20description.md)