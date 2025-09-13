# ShEx Parser Migration Plan: Step-by-Step Legacy Removal

This document provides a detailed, actionable plan for gradually migrating from the legacy regex-based ShEx parser to the new standards-compliant implementation, with careful backwards compatibility tracking.

## Overview

The migration is designed in **4 phases** over **4 versions** to ensure zero-risk transition:

- **Phase 1 (v1.1.0)**: Introduction - New parser available via flag, legacy default
- **Phase 2 (v1.2.0)**: Soft Migration - New parser default, legacy available via flag  
- **Phase 3 (v1.3.0)**: Hard Migration - Legacy marked for removal with warnings
- **Phase 4 (v1.4.0)**: Removal - Clean new implementation only

## Current Implementation Status

### Files Modified
- ✅ `src/js/entity-schemas/shex-parser.js` - New parser implementation
- ✅ `src/js/entity-schemas/entity-schema-core.js` - Dual parser with backwards compatibility
- ✅ `docs/SHEX_PARSING_GUIDE.md` - Reference documentation
- ✅ `docs/SHEX_PARSER_BACKWARDS_COMPATIBILITY.md` - Compatibility tracking

### Current Function Behavior (Phase 1)
```javascript
// DEFAULT: Uses legacy parser (100% backwards compatible)
const result = parseShExProperties(shexCode);

// OPT-IN: Uses new parser with fallback to legacy
const result = parseShExProperties(shexCode, { useNewParser: true });

// STRICT: Uses new parser, no fallback (for testing)
const result = parseShExProperties(shexCode, { 
  useNewParser: true, 
  enableFallback: false 
});
```

## Phase 1: Introduction (v1.1.0) - ✅ COMPLETED

### Objectives
- New parser available but not default
- Zero risk to existing functionality
- Allow early testing and feedback

### Implementation Checklist
- [x] Create `shex-parser.js` with comprehensive new parser
- [x] Update `parseShExProperties()` with dual implementation
- [x] Preserve `parseShExPropertiesLegacy()` as exact copy
- [x] Default to legacy parser (`useNewParser: false`)
- [x] Add comprehensive error handling and fallback
- [x] Document backwards compatibility requirements

### Testing Requirements for Phase 1
- [ ] All existing E2E tests must pass unchanged
- [ ] New parser can be enabled via flag without breaking tests  
- [ ] Fallback mechanism works correctly
- [ ] Error messages are clear and actionable

### User Communication (Phase 1)
```javascript
// No user-visible changes - internal enhancement only
// Existing code continues to work exactly as before
const result = parseShExProperties(shexCode); // Still uses legacy
```

## Phase 2: Soft Migration (v1.2.0) - 📋 PLANNED

### Objectives  
- New parser becomes default
- Legacy still available for safety
- Gradual user adoption with monitoring

### Implementation Steps

#### 2.1 Change Default Behavior
```javascript
// BEFORE (Phase 1):
const opts = {
    useNewParser: false, // Legacy default
    // ...
};

// AFTER (Phase 2):
const opts = {
    useNewParser: true,  // New parser default
    legacyParser: false, // Legacy opt-in flag
    // ...
};
```

#### 2.2 Update Function Interface
```javascript
// New default behavior
const result = parseShExProperties(shexCode); // Uses new parser

// Opt-in to legacy (for compatibility)
const result = parseShExProperties(shexCode, { legacyParser: true });

// Explicit new parser (same as default)
const result = parseShExProperties(shexCode, { useNewParser: true });
```

#### 2.3 Add Usage Tracking
```javascript
// Add console warnings when legacy parser is used
if (opts.legacyParser) {
    console.warn('DEPRECATION: Legacy ShEx parser is deprecated and will be removed in v1.4.0. Please test with the new parser.');
    return parseShExPropertiesLegacy(shexCode);
}
```

### Testing Requirements for Phase 2
- [ ] All tests pass with new parser as default
- [ ] Legacy flag works correctly when needed
- [ ] Performance metrics show no regression
- [ ] Real EntitySchema parsing produces equivalent results

### User Communication (Phase 2)
- Update CHANGELOG.md with deprecation notice
- Add migration guide to documentation  
- Announce breaking change in next major version

## Phase 3: Hard Migration (v1.3.0) - 🔮 FUTURE

### Objectives
- Clear deprecation warnings
- Prepare for legacy removal
- Encourage complete migration

### Implementation Steps

#### 3.1 Add Deprecation Warnings
```javascript
function parseShExPropertiesLegacy(shexCode) {
    console.error(`
    ⚠️  DEPRECATED: Legacy ShEx parser will be REMOVED in v1.4.0
    
    This function is deprecated and will be removed in the next major version.
    Please update your code to use the new parser:
    
    // OLD (deprecated):
    parseShExProperties(shexCode, { legacyParser: true })
    
    // NEW (recommended):  
    parseShExProperties(shexCode) // Uses new parser by default
    
    For help with migration, see: docs/SHEX_PARSER_MIGRATION_PLAN.md
    `);
    
    // Original legacy implementation...
}
```

#### 3.2 Add Runtime Monitoring
```javascript
// Track legacy parser usage for removal planning
if (opts.legacyParser) {
    // Send usage telemetry (if available)
    console.warn('Legacy parser usage detected - please migrate');
    
    // Add stack trace to help identify call sites
    console.trace('Legacy parser call stack:');
}
```

### Testing Requirements for Phase 3
- [ ] Deprecation warnings appear correctly
- [ ] New parser handles all known EntitySchemas
- [ ] Performance is equivalent or better
- [ ] Error messages are clear and helpful

## Phase 4: Removal (v1.4.0) - 🔮 FUTURE

### Objectives
- Clean, standards-compliant implementation
- Remove all legacy code
- Simplified maintenance

### Implementation Steps

#### 4.1 Remove Legacy Function
```javascript
// DELETE: parseShExPropertiesLegacy() function entirely
// DELETE: legacyParser option handling
// DELETE: backwards compatibility mapping code
```

#### 4.2 Simplify Main Function
```javascript
export function parseShExProperties(shexCode, options = {}) {
    // Clean implementation using only new parser
    const parsed = parseShExCode(shexCode, options);
    
    // Return in expected format (keeping interface)
    return {
        required: parsed.properties.required,
        optional: parsed.properties.optional
    };
}
```

#### 4.3 Update Documentation
- Remove backwards compatibility documentation
- Update function signatures in docs
- Clean up migration-related comments

### Testing Requirements for Phase 4
- [ ] All legacy-related code removed
- [ ] Function interface remains stable
- [ ] Performance optimizations implemented
- [ ] Documentation updated

## Rollback Plans

### Phase 2 Rollback (if issues found)
```javascript
// Emergency rollback: change default back to legacy
const opts = {
    useNewParser: false, // Rollback to legacy default
    // Keep dual implementation for safety
};
```

### Phase 3 Rollback
- Remove deprecation warnings
- Restore legacy as supported option
- Extend timeline if needed

### Monitoring & Success Metrics

#### Phase 1 Success Criteria
- [ ] Zero existing test failures
- [ ] New parser flag works without issues
- [ ] No performance degradation

#### Phase 2 Success Criteria  
- [ ] <5% of users need legacy fallback
- [ ] No parsing accuracy regressions
- [ ] Performance equivalent or better

#### Phase 3 Success Criteria
- [ ] <1% legacy parser usage in telemetry
- [ ] All known EntitySchemas parsed correctly
- [ ] User feedback positive

#### Phase 4 Success Criteria
- [ ] Clean codebase with single parser
- [ ] All tests passing
- [ ] Documentation updated

## Risk Mitigation

### High Risk Items
1. **Breaking Changes**: New parser might parse differently
   - **Mitigation**: Extensive comparison testing, gradual rollout
2. **Performance Issues**: New parser might be slower
   - **Mitigation**: Benchmarking, profiling, optimization
3. **Edge Cases**: Legacy parser handles unknown edge cases
   - **Mitigation**: Comprehensive real-world testing

### Medium Risk Items
1. **User Adoption**: Users might not migrate voluntarily
   - **Mitigation**: Clear warnings, good documentation, gradual timeline
2. **Testing Coverage**: Missing test cases for complex ShEx
   - **Mitigation**: Add tests for all known EntitySchemas

## Testing Strategy

### Phase 1 Testing (Current)
```bash
# Run existing tests to ensure no regressions
npm run test:e2e

# Test new parser flag  
npm run test:e2e -- --grep "new parser"

# Comparison testing
npm run test:shex-parser-comparison
```

### Ongoing Monitoring
- Compare parser outputs for all EntitySchemas
- Performance benchmarking  
- User feedback collection
- Error rate monitoring

## Communication Timeline

### v1.1.0 (Phase 1) - Internal
- Internal documentation only
- Code review and testing
- No user-facing changes announced

### v1.2.0 (Phase 2) - Announcement
- CHANGELOG entry about new default
- Migration guide published
- Community notification

### v1.3.0 (Phase 3) - Warning
- Deprecation notice in release notes
- Email to maintainers about upcoming removal
- Final migration assistance

### v1.4.0 (Phase 4) - Completion  
- Breaking change announcement
- Migration completed notice
- Performance improvements highlighted

## Files to Monitor During Migration

### Critical Files
- `src/js/entity-schemas/entity-schema-core.js` - Main parser entry point
- `tests/e2e/entity-schema/entity-schema-overview.spec.js` - E2E tests
- Any files calling `parseShExProperties()` directly

### Files to Eventually Remove
- Legacy parser code in `entity-schema-core.js:parseShExPropertiesLegacy()`  
- Backwards compatibility documentation (this file can be archived)
- Vendor libraries if unused: `src/js/vendor/shex-parser.js`, etc.

### Files to Keep
- `src/js/entity-schemas/shex-parser.js` - Core new implementation
- `docs/SHEX_PARSING_GUIDE.md` - Reference guide  
- Test files for new parser functionality

This migration plan ensures a smooth, low-risk transition while providing clear checkpoints and rollback options at each phase.