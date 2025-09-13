# ShEx Parser Backwards Compatibility Documentation

This document meticulously tracks the current (legacy) implementation of `parseShExProperties()` to ensure perfect backwards compatibility during the migration to the new standards-compliant ShEx parser.

## Current Implementation Analysis

### Location
- **File**: `src/js/entity-schemas/entity-schema-core.js`
- **Function**: `parseShExProperties(shexCode)`  
- **Lines**: 197-245 (as of Phase 2 implementation)

### Current Behavior Documentation

#### 1. **Input Processing**
```javascript
// Current: Takes only shexCode string
function parseShExProperties(shexCode) {
    const requiredProperties = [];
    const optionalProperties = [];
    // ...
}

// New: Takes shexCode + optional options object  
function parseShExProperties(shexCode, options = {}) {
    // Backwards compatible - options are optional
}
```

#### 2. **Property Extraction Pattern**
```javascript
// EXACT CURRENT REGEX (must be preserved for fallback):
const propertyMatches = shexCode.match(/wdt:(\w+)\s+([^;]+);?\s*(?:#\s*(.*))?/g);

// Breakdown of current regex:
// - `wdt:(\w+)` - Captures Wikidata property ID (P123 format)
// - `\s+` - Required whitespace
// - `([^;]+)` - Captures constraint (everything except semicolon)
// - `;?` - Optional semicolon
// - `\s*(?:#\s*(.*))?` - Optional comment after # symbol
```

#### 3. **Property Object Structure** 
**CRITICAL**: The exact property object format that must be preserved:
```javascript
const property = {
    id: propertyId,                                    // String: "P123"
    label: comment || propertyId,                      // String: comment or fallback to propertyId
    description: `Constraint: ${constraint}`,          // String: EXACT template format
    url: `https://www.wikidata.org/wiki/Property:${propertyId}`,  // String: EXACT URL template
    requiresSource: detectSourceRequirement(constraint)          // Boolean: from schema-property-mapper.js
};
```

#### 4. **Required vs Optional Logic**
**EXACT CURRENT LOGIC** (must be preserved exactly):
```javascript
// Determine if required (no ? or *)
if (constraint.includes('?') || constraint.includes('*')) {
    optionalProperties.push(property);
} else {
    requiredProperties.push(property);
}
```

**Critical Points:**
- Uses **simple string inclusion** checks, not sophisticated parsing
- Only looks for `?` or `*` anywhere in constraint string
- Does NOT handle cardinality patterns like `{0,1}`, `{1,*}`, etc.

#### 5. **Return Format**
**EXACT CURRENT STRUCTURE** (cannot be changed):
```javascript
return {
    required: requiredProperties,  // Array of property objects
    optional: optionalProperties   // Array of property objects
};
```

#### 6. **Fallback Behavior**
**EXACT CURRENT FALLBACK**:
```javascript
// If no properties were parsed, add fallback
if (requiredProperties.length === 0 && optionalProperties.length === 0) {
    requiredProperties.push({
        id: 'P31',
        label: 'instance of',
        description: 'that class of which this subject is a particular example',
        url: 'https://www.wikidata.org/wiki/Property:P31',
        requiresSource: false  // EXACTLY false, not from detectSourceRequirement
    });
}
```

#### 7. **Integration with detectSourceRequirement**
```javascript
// Current dependency from schema-property-mapper.js
import { detectSourceRequirement } from './schema-property-mapper.js';

// Called for each property:
requiresSource: detectSourceRequirement(constraint)
```

### Edge Cases and Limitations

#### 1. **Regex Limitations**
- **Only matches `wdt:` properties** - ignores `p:`, `ps:`, etc.
- **Semicolon handling**: Optional but affects parsing
- **Comment extraction**: Simple regex, doesn't handle complex comments
- **No prefix handling**: Hardcoded to `wdt:` namespace only

#### 2. **Constraint Processing**
- **No actual parsing**: Treats constraint as opaque string
- **Simple cardinality**: Only `?` and `*` recognized
- **No datatype analysis**: Ignores xsd:, IRI, @<Shape> patterns

#### 3. **Error Handling**
- **Silent failures**: No error throwing on malformed input
- **Fallback behavior**: Always adds P31 if nothing found
- **No validation**: Doesn't validate property IDs or URLs

### Test Cases for Backwards Compatibility

#### Test Case 1: Basic Property Detection
```javascript
const shexCode = `wdt:P31 @<Q5> ; # instance of`;
const result = parseShExProperties(shexCode);
// MUST return:
// {
//   required: [{
//     id: 'P31',
//     label: 'instance of',
//     description: 'Constraint: @<Q5>',
//     url: 'https://www.wikidata.org/wiki/Property:P31',
//     requiresSource: false
//   }],
//   optional: []
// }
```

#### Test Case 2: Optional Property Detection  
```javascript
const shexCode = `wdt:P123 xsd:string? ; # optional title`;
const result = parseShExProperties(shexCode);
// MUST have P123 in optional array due to '?' in constraint
```

#### Test Case 3: Empty Input Fallback
```javascript
const shexCode = `# just comments`;
const result = parseShExProperties(shexCode);
// MUST return P31 fallback in required array
```

#### Test Case 4: Source Requirement Detection
```javascript
const shexCode = `wdt:P248 @<Q1> ; # stated in (source)`;
const result = parseShExProperties(shexCode);
// MUST call detectSourceRequirement('stated in (source)')
```

### Migration Strategy: Backwards Compatibility Implementation

#### Phase 1: Dual Implementation (Current)
```javascript
export function parseShExProperties(shexCode, options = {}) {
  // NEW: Try new parser first
  if (options.useNewParser !== false) {
    try {
      return parseShExPropertiesNew(shexCode, options);
    } catch (error) {
      console.warn('New parser failed, falling back to legacy:', error);
    }
  }
  
  // LEGACY: Exact current implementation
  return parseShExPropertiesLegacy(shexCode);
}
```

#### Phase 2: Flag-Based Migration
- Add feature flag in state/configuration
- Default to legacy parser
- Allow opt-in to new parser
- Monitor for differences

#### Phase 3: New Parser Default
- Switch default to new parser
- Keep legacy as fallback
- Add warnings for fallback usage

#### Phase 4: Legacy Removal
- Remove legacy implementation
- Remove backwards compatibility layer
- Update documentation

### Breaking Changes Documentation

#### Changes that WILL break backwards compatibility:
1. **Enhanced Cardinality**: New parser recognizes `{0,1}`, `{1,*}` patterns
2. **Multiple Namespaces**: New parser handles `p:`, `ps:`, `pr:` in addition to `wdt:`
3. **Better Error Reporting**: New parser can throw ShExParseError instead of silent failures
4. **Richer Property Objects**: New parser may add fields like `cardinality`, `valueConstraints`

#### Changes that MAINTAIN backwards compatibility:
1. **Same Return Structure**: `{ required: [], optional: [] }`
2. **Same Property Fields**: `id`, `label`, `description`, `url`, `requiresSource`
3. **Same Fallback Logic**: P31 added when no properties found
4. **Same Input Interface**: Function signature unchanged

### Testing Requirements

#### Must Pass All Legacy Tests:
1. All existing E2E tests must continue passing
2. All existing unit tests (if any) must continue passing
3. Real-world EntitySchema parsing must produce identical results

#### Comparison Tests:
1. Parse same schema with both old and new parser
2. Compare output field-by-field
3. Document any differences for review
4. Only allow approved differences in new parser

### Deprecation Timeline

#### Version N: Introduction
- New parser available via flag
- Legacy parser remains default
- Full backwards compatibility maintained

#### Version N+1: Soft Migration  
- New parser becomes default
- Legacy parser available via flag
- Deprecation warnings added

#### Version N+2: Hard Migration
- Legacy parser marked for removal
- Breaking change notices
- Migration tools provided

#### Version N+3: Removal
- Legacy parser removed
- Clean new implementation
- Updated documentation