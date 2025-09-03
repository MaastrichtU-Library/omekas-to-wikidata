# Identifier Detection System Specification

## Overview

The Identifier Detection System is designed to extract, analyze, and utilize various types of identifiers from Omeka S API responses to improve Wikidata integration, reconciliation accuracy, and duplicate detection. The system operates on two distinct levels: item-level identifiers and value-level identifiers.

**Automatic Processing**: Identifier detection is fully automatic and occurs when the user first navigates to the Mapping stage. Users have no control over whether detection happens - it is always executed.

## Core Principles

1. **No Data Enrichment**: The system does not enrich or modify source data
2. **No Hierarchical Confidence**: All identifiers are treated equally - no confidence scoring or hierarchical differences
3. **Direct Integration**: Focus on extraction, detection, and integration rather than enhancement
4. **Reconciliation Enhancement**: Use identifiers to improve the accuracy of Wikidata reconciliation
5. **Duplicate Detection**: Leverage item-level identifiers to identify potential duplicates

## Identifier Categories

### Item-Level Identifiers
These identifiers represent entire Omeka S items and are used for duplicate detection and automatic property addition to Wikidata items.

#### ARK (Archival Resource Key)
- **Wikidata Property**: P8091 (Archival Resource Key)
- **Source Location**: `dcterms:identifier` field in Omeka S JSON
- **Format**: `ark:/[NAAN]/[Name]` (e.g., `ark:/27364/d1n4b0E`)
- **Purpose**: 
  - Duplicate detection across collections
  - Automatic addition to Wikidata items as P8091
  - Direct matching against existing Wikidata items with ARK identifiers
- **Processing**: 
  - Extract using regex pattern: `ark:/\d+/.+`
  - No institution-specific mapping required
  - Query Wikidata directly using P8091 for matches
- **Integration**: Automatically add as "detected identifier" when found

#### OCLC Number
- **Wikidata Property**: P243 (OCLC number)
- **Source Location**: `schema:sameAs` WorldCat URLs
- **Format**: Numeric string (e.g., `65042490`)
- **Purpose**:
  - Bibliographic duplicate detection
  - Automatic addition to Wikidata items as P243
  - Cross-reference with WorldCat database
- **Processing**:
  - Extract from URLs like `https://maastrichtuniversity.on.worldcat.org/oclc/65042490`
  - Use regex: `oclc/(\d+)`
  - Query Wikidata using P243 for existing matches
- **Integration**: Automatically add as "detected identifier" when found

### Value-Level Identifiers
These identifiers represent specific values (people, places, concepts) and are used to improve reconciliation accuracy by providing authoritative matches.

#### VIAF (Virtual International Authority File)
- **Wikidata Property**: P214 (VIAF cluster ID)
- **Source Location**: `schema:publisher`, `schema:author` value suggest URIs
- **Format**: Numeric string (e.g., `172840804`)
- **Purpose**:
  - Authority control for persons and organizations
  - Improve reconciliation accuracy for entities
  - Default reconciliation when VIAF match exists
- **Processing**:
  - Extract from URIs like `http://viaf.org/viaf/172840804`
  - Use regex: `viaf\.org\/viaf\/(\d+)`
  - Query Wikidata using P214 for matches
- **Integration**: Use for automatic reconciliation when match found

#### GeoNames ID
- **Wikidata Property**: P1566 (GeoNames ID) **ONLY**
- **Source Location**: `schema:locationCreated`, `schema:itemLocation` GeoNames URIs
- **Format**: Numeric string (e.g., `2759794`)
- **Purpose**:
  - Geographic location reconciliation
  - Improve accuracy for place names
  - Default reconciliation for geographic entities
- **Processing**:
  - Extract from URIs like `http://www.geonames.org/2759794`
  - Use regex: `geonames\.org\/(\d+)`
  - Query Wikidata using P1566 for matches
- **Exclusions**: Ignore P2452 (GeoNames feature code) and hierarchical enrichment
- **Integration**: Use for automatic reconciliation when match found

#### ISO 639 Language Codes
- **Wikidata Properties**: 
  - P218 (ISO 639-1 code) - 2-letter codes
  - P220 (ISO 639-3 code) - 3-letter codes
- **Source Location**: `schema:inLanguage` Library of Congress URIs
- **Format**: 2-letter (e.g., `nl`) or 3-letter language codes
- **Purpose**:
  - Language entity reconciliation
  - Improve accuracy for language references
- **Processing**:
  - Extract from URIs like `http://id.loc.gov/vocabulary/iso639-1/nl`
  - Use regex: `iso639-1\/([a-z]{2})` or similar for other ISO standards
  - Query Wikidata using appropriate property for matches
- **Integration**: Use for automatic reconciliation when match found

#### Wikidata QIDs (Direct References)
- **Format**: Q-numbers (e.g., `Q7925880`)
- **Source Location**: Various fields with Wikidata URIs
- **Purpose**:
  - **Direct reconciliation override**: These are authoritative matches
  - Highest priority for reconciliation
  - No additional validation required
- **Processing**:
  - Extract from URIs like `http://www.wikidata.org/entity/Q7925880`
  - Use regex: `wikidata\.org\/(?:wiki\/|entity\/)([QP]\d+)`
- **Integration**: **Automatic reconciliation** - these override all other reconciliation methods

## Workflow Integration

### Timing and Triggers
Identifier detection is triggered **upon first navigation to the Mapping stage**. This timing is critical because:
- Some identifiers result in new properties being added to the mapping
- Detection results can affect both Mapping and Reconciliation stages
- All identifier information must be available before users begin property mapping

### Impact on Mapping Stage
- **Item-Level Identifiers**: When matched to existing Wikidata items, their corresponding properties (P8091 for ARK, P243 for OCLC) are automatically added to the mapping
- **New Properties**: These detected identifier properties appear in the property mapping interface
- **Automatic Addition**: Properties are added without user intervention and marked with "detected identifier" labels

### Impact on Reconciliation Stage
- **Existing Item Detection**: If item-level identifiers match existing Wikidata items, this is indicated in the row header
- **Pre-reconciled Values**: Value-level identifiers (VIAF, GeoNames, Language codes, QIDs) that match Wikidata entities are shown as "already reconciled" and can skip manual reconciliation
- **QID Override**: Direct Wikidata QID references automatically reconcile and override all other reconciliation methods
- **Default Reconciliation**: VIAF, GeoNames, and Language code matches default to their matched entities

### Data Flow
1. **Detection Phase**: Extract all identifiers from Omeka S JSON
2. **Matching Phase**: Query Wikidata for all identifier types in parallel
3. **Integration Phase**: 
   - Add item-level identifier properties to mapping
   - Store value-level matches for reconciliation use
   - Update main JSON with all identifier information
4. **UI Updates**: Reflect changes in both Mapping and Reconciliation interfaces

## Technical Implementation Strategy

### Identifier Extraction Phase

#### Data Structure for Extracted Identifiers
```javascript
{
  itemLevel: {
    ark: "ark:/27364/d1n4b0E",
    oclc: "65042490"
  },
  valueLevel: {
    viaf: ["172840804", "200887528"],
    geonames: ["2759794", "2988507"],
    iso639: ["nl", "fr"],
    wikidataQids: ["Q7925880", "Q20007257"]
  }
}
```

#### Extraction Functions Required

1. **extractARK(jsonData)**
   - Search `dcterms:identifier` arrays
   - Return ARK identifiers found
   - Format validation

2. **extractOCLC(jsonData)**
   - Search `schema:sameAs` arrays for WorldCat URLs
   - Extract OCLC numbers from URLs
   - Return numeric identifiers

3. **extractVIAF(jsonData)**
   - Search all value suggest fields with VIAF URIs
   - Extract VIAF cluster IDs
   - Return array of identifiers

4. **extractGeoNames(jsonData)**
   - Search location fields for GeoNames URIs
   - Extract GeoNames IDs
   - Return array of identifiers

5. **extractLanguageCodes(jsonData)**
   - Search `schema:inLanguage` for Library of Congress URIs
   - Extract ISO language codes
   - Return array of codes with type (639-1, 639-3)

6. **extractWikidataQIDs(jsonData)**
   - Search all fields for Wikidata entity URIs
   - Extract Q-numbers and P-numbers
   - Return array of QIDs

### Parallel Wikidata Matching

#### SPARQL Query Templates

**ARK Matching**:
```sparql
SELECT ?item WHERE { 
  ?item wdt:P8091 "ark:/27364/d1n4b0E" 
}
```

**OCLC Matching**:
```sparql
SELECT ?item WHERE { 
  ?item wdt:P243 "65042490" 
}
```

**VIAF Matching**:
```sparql
SELECT ?item WHERE { 
  ?item wdt:P214 "172840804" 
}
```

**GeoNames Matching**:
```sparql
SELECT ?item WHERE { 
  ?item wdt:P1566 "2759794" 
}
```

**Language Code Matching**:
```sparql
SELECT ?item WHERE { 
  ?item wdt:P218 "nl" 
}
```

#### Batch Query Strategy
- Execute all SPARQL queries in parallel
- Collect results for both item-level and value-level identifiers
- No prioritization or confidence scoring between results

### Integration with Reconciliation System

#### Item-Level Integration
- **Duplicate Detection**: If ARK or OCLC matches existing Wikidata item, flag as potential duplicate
- **Automatic Property Addition**: Add detected ARK/OCLC identifiers to matched items with "detected identifier" label
- **Value Type Detection**: Integration with value type detection system (being developed in separate branch)

#### Value-Level Integration
- **Reconciliation Override**: 
  1. **QIDs**: Automatic reconciliation (highest priority)
  2. **VIAF/GeoNames/Language codes**: Default to matched entity when found
- **No Manual Review**: When value-level identifier matches, use automatically
- **Multiple Matches**: Handle cases where multiple value-level identifiers exist
- **Conflict Resolution UI**: Display conflicting matches with red information blocks for user selection

### Storage and State Management

#### Main JSON Integration
All identifier information is stored in the main project JSON that is:
- Exported when the user saves the project
- Imported when the user loads a project
- Persists across browser sessions through the existing save/load mechanism

#### Identifier Data Structure in Main JSON
```javascript
{
  // Existing project data...
  identifierDetection: {
    detectedIdentifiers: {
      [omekaItemId]: {
        itemLevel: { 
          ark: {
            value: "ark:/27364/d1n4b0E",
            wikidataMatch: "Q12345" // if matched
          },
          oclc: {
            value: "65042490",
            wikidataMatch: "Q67890" // if matched
          }
        },
        valueLevel: {
          viaf: [
            {
              fieldName: "schema:author", 
              value: "172840804",
              wikidataMatch: "Q7925880"
            }
          ],
          geonames: [
            {
              fieldName: "schema:locationCreated",
              value: "2759794", 
              wikidataMatch: "Q727"
            }
          ],
          iso639: [
            {
              fieldName: "schema:inLanguage",
              value: "nl",
              wikidataMatch: "Q7411"
            }
          ],
          wikidataQids: [
            {
              fieldName: "schema:license",
              value: "Q20007257"
            }
          ]
        }
      }
    },
    conflicts: {
      [omekaItemId]: {
        [fieldName]: [
          { identifier: "viaf:123456", wikidataMatch: "Q111" },
          { identifier: "geonames:789012", wikidataMatch: "Q222" }
        ]
      }
    }
  }
}
```

#### Value-Level Data for Reconciliation
Value-level identifier matches are stored with their field context and used during the reconciliation step to:
- Pre-populate reconciliation results
- Skip manual reconciliation for matched values
- Provide context for user decisions on conflicts

### String Manipulation Requirements

#### ARK Normalization
- Ensure `ark:/` prefix is present
- Validate NAAN format (numeric)
- No URL encoding/decoding needed

#### OCLC Normalization
- Strip leading zeros if present
- Ensure numeric format
- Remove any URL parameters

#### VIAF Normalization
- Extract numeric cluster ID only
- No additional formatting required

#### GeoNames Normalization
- Extract numeric ID only
- Remove any URL fragments or parameters

#### Language Code Normalization
- Convert to lowercase
- Validate against known ISO standards
- Handle both 2-letter and 3-letter codes

## Implementation Phases

### Phase 1: Extraction Engine
- Implement all extraction functions
- Create unified extraction orchestrator
- Build string manipulation utilities
- Add validation for each identifier type

### Phase 2: Wikidata Query Engine
- Implement SPARQL query templates
- Create parallel query execution system
- Build result aggregation logic
- Handle API rate limiting and errors

### Phase 3: Integration with Reconciliation
- Modify reconciliation logic to prioritize identifier matches
- Implement automatic reconciliation for QIDs
- Add default reconciliation for value-level matches
- Create duplicate detection alerts for item-level matches

### Phase 4: Property Addition System
- Implement automatic property addition for item-level identifiers
- Add "detected identifier" labeling system
- Create value type detection for identifier properties
- Build batch addition capabilities

## Error Handling and Edge Cases

### Identifier Validation
- Malformed ARK identifiers
- Invalid OCLC numbers
- Mixed VIAF clusters (different subjects)
- Non-existent GeoNames IDs
- Deprecated language codes

### Wikidata Query Failures
- API timeouts
- Rate limiting
- Malformed SPARQL queries
- No results found

### Reconciliation Conflicts
- **Multiple Identifiers → Different Wikidata Items**: Display all conflicting matches to user with red information block
- **Multiple Identifiers of Same Type**: Show all options, treat as conflict requiring user selection
- **Identifier exists but entity doesn't match expected type**: Display type mismatch warning
- **User Conflict Resolution**: Provide interface for users to select correct match from conflicting options

### API Error Handling
- Use existing top-right error message system for Wikidata API failures
- No progress feedback required - detection happens transparently
- Graceful degradation: continue with available results if some API calls fail

## User Interface Specifications

### Mapping Stage UI Changes
- **New Properties**: Item-level identifier properties (P8091, P243) appear automatically in property list
- **Detected Identifier Labels**: Clear visual indicators for automatically detected properties
- **Item Status Indicators**: Visual cues in row headers when item-level identifiers match existing Wikidata items

### Reconciliation Stage UI Changes
- **Pre-reconciled Values**: Values with identifier matches show "already reconciled" status
- **Skip Options**: Pre-reconciled values can be skipped in reconciliation workflow
- **Conflict Display**: Red information blocks for conflicting identifier matches
- **Multiple Choice UI**: Interface for users to select correct match from multiple options
- **Context Information**: Display why conflicts occurred and what data sources are involved

### Conflict Resolution Interface
```
⚠️ Multiple matches found for [Field Name]
┌──────────────────────────────────────────────────┐
│ • VIAF 172840804 → Victor van Vriesland (Q7925880) │
│ • GeoNames 2759794 → Amsterdam (Q727)             │
│                                                 │
│ [Select: Victor van Vriesland] [Select: Amsterdam] │
│ [Skip this field] [Manual reconciliation]         │
└──────────────────────────────────────────────────┘
ℹ️ This conflict suggests data quality issues in source
```

## Success Metrics

### Extraction Accuracy
- Percentage of valid identifiers extracted
- False positive rate for each identifier type
- Coverage across different Omeka S collections

### Reconciliation Improvement
- Increase in automatic reconciliation success rate
- Reduction in manual reconciliation required
- Accuracy of identifier-based matches

### Duplicate Detection
- Number of duplicates identified through ARK/OCLC matching
- False positive rate for duplicate detection
- Time saved in manual duplicate checking

## Testing Strategy

### Logic Prototype Development
- **Input**: Use provided Omeka S JSON sample data
- **Processing**: Implement identifier detection logic
- **Output**: Show detected matches and their corresponding Wikidata items
- **Validation**: Verify extraction accuracy and matching results
- **Conflict Testing**: Test scenarios with multiple/conflicting identifiers

### Test Scenarios
1. **Single Identifier per Type**: Verify basic extraction and matching
2. **Multiple Identifiers Same Type**: Test conflict resolution UI
3. **Cross-Type Conflicts**: Different identifier types pointing to different entities  
4. **API Failures**: Test graceful degradation with service unavailability
5. **Malformed Identifiers**: Validate error handling for invalid formats
6. **Large Dataset**: Performance testing with multiple items

## Future Considerations

### Value Type Detection Integration
- **Status**: Being developed in separate repository branch
- **Future Integration**: Will enhance automatic value type determination for identifier properties
- **Current Approach**: Manual value type specification until integration available

### Scalability
- Batch processing for large collections
- Caching strategies for frequently accessed identifiers
- Memory optimization for identifier storage

### Maintenance
- Regular validation of identifier formats
- Updates to Wikidata property mappings
- Monitoring of external identifier services (VIAF, GeoNames, etc.)

### Extension Points
- Support for additional identifier types
- Custom identifier extraction rules per collection
- Integration with other linked data sources

---

*This specification defines the complete identifier detection system requirements and implementation strategy. The system operates automatically upon entering the Mapping stage, integrates with the main project JSON for data persistence, and provides user interfaces for conflict resolution. No data enrichment, hierarchical confidence scoring, gap analysis, progress feedback, or user control features are included per project requirements.*