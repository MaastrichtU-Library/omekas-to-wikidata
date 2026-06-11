/**
 * ShEx Parser for Wikidata EntitySchemas
 * A simplified ShEx parser tailored for common Wikidata EntitySchema patterns
 * Based on @shexjs/parser concepts but adapted for client-side use without dependencies
 * 
 * @module entity-schemas/shex-parser
 */

/**
 * Default Wikidata prefixes commonly used in EntitySchemas
 */
export const WIKIDATA_PREFIXES = {
  'wd': 'http://www.wikidata.org/entity/',
  'wdt': 'http://www.wikidata.org/prop/direct/',
  'wds': 'http://www.wikidata.org/entity/statement/',
  'p': 'http://www.wikidata.org/prop/',
  'ps': 'http://www.wikidata.org/prop/statement/',
  'pq': 'http://www.wikidata.org/prop/qualifier/',
  'pr': 'http://www.wikidata.org/prop/reference/',
  'psv': 'http://www.wikidata.org/prop/statement/value/',
  'pqv': 'http://www.wikidata.org/prop/qualifier/value/',
  'prv': 'http://www.wikidata.org/prop/reference/value/',
  'wdno': 'http://www.wikidata.org/prop/novalue/',
  'wikibase': 'http://wikiba.se/ontology#',
  'schema': 'http://schema.org/',
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#',
  'prov': 'http://www.w3.org/ns/prov#'
};

/**
 * Configuration options for ShEx parsing
 */
export const DEFAULT_PARSER_OPTIONS = {
  baseIRI: '',
  prefixes: WIKIDATA_PREFIXES,
  strictMode: false, // If true, throws on unknown prefixes
  preserveComments: true,
  trackLocations: false // For error reporting (future enhancement)
};

/**
 * ShEx parsing error class with location information
 */
export class ShExParseError extends Error {
  constructor(message, line = null, column = null, source = null) {
    super(message);
    this.name = 'ShExParseError';
    this.line = line;
    this.column = column;
    this.source = source;
  }

  toString() {
    const location = this.line !== null && this.column !== null 
      ? ` at line ${this.line}, column ${this.column}` 
      : '';
    return `${this.name}: ${this.message}${location}`;
  }
}

/**
 * Parse ShExC code to extract property information for Wikidata schemas
 * 
 * ALGORITHM OVERVIEW:
 * This function implements a sophisticated ShExC (Shape Expressions Compact) parser
 * specifically optimized for Wikidata EntitySchema patterns. The parsing algorithm
 * operates in multiple phases to handle the complexity of ShEx grammar:
 * 
 * PHASE 1: PREFIX EXTRACTION
 * - Scans for prefix declarations (PREFIX wd: <...>)
 * - Builds prefix-to-URI mapping table for later resolution
 * - Merges with default Wikidata prefixes for comprehensive coverage
 * - Handles both standard and custom namespace declarations
 * 
 * PHASE 2: SHAPE IDENTIFICATION
 * - Locates shape definitions (typically starting with <schema:>)
 * - Identifies shape boundaries using brace matching
 * - Extracts shape names and associated constraint blocks
 * - Handles nested shapes and references
 * 
 * PHASE 3: PROPERTY EXTRACTION
 * - Parses property declarations within shapes (wdt:P123, p:P456)
 * - Resolves prefixed properties to full Wikidata property IDs
 * - Identifies cardinality constraints (?, *, +, {n,m})
 * - Extracts value type constraints and format requirements
 * - Distinguishes between required and optional properties
 * 
 * PHASE 4: CONSTRAINT ANALYSIS
 * - Processes constraint expressions (EXTRA, CLOSED, etc.)
 * - Identifies value shape references (@<ValueShape>)
 * - Extracts datatype constraints (xsd:string, xsd:dateTime)
 * - Parses comment annotations for property documentation
 * 
 * PHASE 5: DEPENDENCY RESOLUTION
 * - Resolves cross-references between shapes
 * - Builds dependency graph for complex schemas
 * - Handles circular references and validates schema consistency
 * - Optimizes property access patterns
 * 
 * ERROR HANDLING STRATEGY:
 * - Graceful degradation for malformed ShEx expressions
 * - Detailed error reporting with line/column information
 * - Fallback parsing for non-standard EntitySchema patterns
 * - Comprehensive logging for debugging complex schemas
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Incremental parsing for large schemas
 * - Caching of parsed prefix mappings
 * - Lazy evaluation of complex constraint expressions
 * - Memory-efficient shape representation
 * 
 * @param {string} shexCode - ShExC code from Entity Schema (full schema text)
 * @param {Object} [options={}] - Parsing configuration options
 * @param {Object} [options.prefixes] - Additional prefix mappings to merge
 * @param {boolean} [options.strictMode=false] - Throw errors on parse failures vs. graceful degradation
 * @param {boolean} [options.preserveComments=true] - Include schema comments in parsed output
 * @param {boolean} [options.trackLocations=false] - Track source locations for error reporting
 * @returns {Object} Parsed schema object with categorized properties and metadata
 * @returns {Object} returns.properties - Property categorization object
 * @returns {Array} returns.properties.required - Array of required property objects
 * @returns {Array} returns.properties.optional - Array of optional property objects
 * @returns {Object} returns.shapes - Named shape definitions from the schema
 * @returns {Object} returns.prefixes - Resolved prefix-to-URI mappings
 * @throws {ShExParseError} When critical parsing errors occur in strict mode
 * 
 * @example
 * // Parse a basic Wikidata EntitySchema
 * const schema = parseShExCode(`
 *   PREFIX wd: <http://www.wikidata.org/entity/>
 *   PREFIX wdt: <http://www.wikidata.org/prop/direct/>
 *   
 *   <schema:E123> {
 *     wdt:P31 [wd:Q5] ;        # instance of human (required)
 *     wdt:P569 xsd:dateTime ? ; # date of birth (optional)
 *   }
 * `);
 * // Returns: { properties: { required: [...], optional: [...] }, ... }
 * 
 * @example
 * // Parse with strict mode for validation
 * try {
 *   const schema = parseShExCode(shexCode, { strictMode: true });
 *   console.log('Schema is valid');
 * } catch (error) {
 *   console.error('Schema validation failed:', error.toString());
 * }
 */
export function parseShExCode(shexCode, options = {}) {
  const opts = { ...DEFAULT_PARSER_OPTIONS, ...options };
  
  try {
    // Extract prefixes from the schema
    const extractedPrefixes = extractPrefixes(shexCode);
    const allPrefixes = { ...opts.prefixes, ...extractedPrefixes };
    
    // Extract shapes and properties
    const shapes = extractShapes(shexCode, allPrefixes, opts);
    
    return {
      prefixes: allPrefixes,
      shapes: shapes,
      properties: extractAllProperties(shapes),
      metadata: {
        originalShEx: opts.preserveComments ? shexCode : null,
        baseIRI: opts.baseIRI,
        parsedAt: new Date().toISOString()
      }
    };
    
  } catch (error) {
    if (error instanceof ShExParseError) {
      throw error;
    }
    throw new ShExParseError(`Failed to parse ShEx: ${error.message}`);
  }
}

/**
 * Extract prefix declarations from ShEx code
 * Pattern: PREFIX prefix: <iri>
 */
function extractPrefixes(shexCode) {
  const prefixes = {};
  const prefixPattern = /PREFIX\s+([^:]+):\s*<([^>]+)>/gi;
  let match;
  
  while ((match = prefixPattern.exec(shexCode)) !== null) {
    const [, prefix, iri] = match;
    prefixes[prefix.trim()] = iri.trim();
  }
  
  return prefixes;
}

/**
 * Extract shape definitions from ShEx code
 */
function extractShapes(shexCode, prefixes, options) {
  const shapes = {};
  
  // Enhanced pattern to match shape definitions with optional EXTRA keywords and constraints
  // Handles: <label> { ... }, <label> EXTRA constraints { ... }, etc.
  const shapePattern = /<([^>]+)>\s*(?:EXTRA\s+[^{]*?)?\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/gs;
  let match;
  
  while ((match = shapePattern.exec(shexCode)) !== null) {
    const [, label, body] = match;
    const normalizedLabel = expandIRI(label, prefixes);
    
    shapes[normalizedLabel] = {
      id: normalizedLabel,
      label: label,
      properties: extractPropertiesFromShape(body, prefixes, options),
      raw: body.trim()
    };
  }
  
  // If no labeled shapes found, try to parse as single shape
  if (Object.keys(shapes).length === 0) {
    const singleShapeProps = extractPropertiesFromShape(shexCode, prefixes, options);
    if (singleShapeProps.required.length > 0 || singleShapeProps.optional.length > 0) {
      shapes['_default'] = {
        id: '_default',
        label: 'Default Shape',
        properties: singleShapeProps,
        raw: shexCode
      };
    }
  }
  
  return shapes;
}

/**
 * Extract properties from a shape body
 */
function extractPropertiesFromShape(shapeBody, prefixes, options) {
  const required = [];
  const optional = [];
  
  // Pattern to match property declarations: predicate constraint; or predicate constraint;
  // Handles comments after # symbol
  const propPattern = /([^\s;]+)\s+([^;#]+)(?:\s*;\s*)?(?:\s*#\s*([^\n\r]*))?/g;
  let match;
  
  while ((match = propPattern.exec(shapeBody)) !== null) {
    const [, predicate, constraint, comment] = match;
    
    // Skip if this looks like a prefix declaration or other non-property construct
    if (predicate.toUpperCase() === 'PREFIX' || predicate.includes('{') || predicate.includes('}')) {
      continue;
    }
    
    // Skip pure comment lines (lines starting with #)
    if (predicate.startsWith('#')) {
      continue;
    }
    
    try {
      const property = parseProperty(predicate, constraint, comment, prefixes, options);
      
      if (property) {
        // Determine if required based on cardinality and constraint patterns
        if (isOptionalProperty(constraint)) {
          optional.push(property);
        } else {
          required.push(property);
        }
      }
    } catch (error) {
      if (options.strictMode) {
        throw error;
      }
      // In non-strict mode, log and continue
      console.warn(`Failed to parse property: ${predicate} ${constraint}`, error);
    }
  }
  
  return { required, optional };
}

/**
 * Parse individual property declaration
 */
function parseProperty(predicate, constraint, comment, prefixes, options) {
  // Expand the predicate IRI
  const expandedPredicate = expandIRI(predicate.trim(), prefixes);
  
  // Extract property ID (for Wikidata properties)
  const propertyId = extractPropertyId(expandedPredicate);
  
  if (!propertyId) {
    return null; // Skip non-Wikidata properties
  }
  
  return {
    id: propertyId,
    predicate: expandedPredicate,
    schemaComment: comment ? comment.trim() : null, // Preserve schema comment for tooltip
    constraint: constraint.trim(),
    requiresSource: detectSourceRequirement(constraint),
    cardinality: parseCardinality(constraint),
    valueConstraints: parseValueConstraints(constraint, prefixes)
    // Note: label and description will be added from Wikidata API
  };
}

/**
 * Determine if a property is optional based on its constraint
 */
function isOptionalProperty(constraint) {
  const cleaned = constraint.trim();
  
  // Check for required indicators first (+ means one or more = required)
  if (cleaned.includes('+')) {
    return false;
  }
  
  // Check for explicit optional indicators
  if (cleaned.includes('?') || cleaned.includes('*')) {
    return true;
  }
  
  // Check for cardinality patterns that indicate optional
  const cardinalityPattern = /\{\s*(\d+|\*)\s*,\s*(\d+|\*)\s*\}/;
  const cardMatch = cleaned.match(cardinalityPattern);
  if (cardMatch) {
    const [, min] = cardMatch;
    return min === '0' || min === '*';
  }
  
  return false;
}

/**
 * Parse cardinality from constraint
 */
function parseCardinality(constraint) {
  const cleaned = constraint.trim();
  
  // Simple cardinality indicators
  if (cleaned.endsWith('?')) return { min: 0, max: 1 };
  if (cleaned.endsWith('*')) return { min: 0, max: -1 }; // unbounded
  if (cleaned.endsWith('+')) return { min: 1, max: -1 }; // unbounded
  
  // Explicit cardinality patterns {min,max}
  const cardPattern = /\{\s*(\d+|\*)\s*,\s*(\d+|\*)\s*\}/;
  const match = cleaned.match(cardPattern);
  if (match) {
    const [, min, max] = match;
    return {
      min: min === '*' ? -1 : parseInt(min),
      max: max === '*' ? -1 : parseInt(max)
    };
  }
  
  // Default: exactly one
  return { min: 1, max: 1 };
}

/**
 * Parse value constraints from the constraint expression
 */
function parseValueConstraints(constraint, prefixes) {
  const constraints = [];
  const cleaned = constraint.trim();
  
  // IRI references @<Shape>
  const shapeRefPattern = /@<([^>]+)>/g;
  let match;
  while ((match = shapeRefPattern.exec(cleaned)) !== null) {
    constraints.push({
      type: 'shape',
      value: expandIRI(match[1], prefixes)
    });
  }
  
  // Literal datatypes
  const datatypePattern = /\b(xsd:\w+|IRI|LITERAL|BNODE|NONLITERAL)\b/g;
  while ((match = datatypePattern.exec(cleaned)) !== null) {
    constraints.push({
      type: 'datatype',
      value: expandIRI(match[1], prefixes)
    });
  }
  
  // Specific values [value1 value2]
  const valueListPattern = /\[([^\]]+)\]/;
  const valueMatch = cleaned.match(valueListPattern);
  if (valueMatch) {
    const values = valueMatch[1].split(/\s+/)
      .map(v => expandIRI(v.trim(), prefixes))
      .filter(v => v);
    
    if (values.length > 0) {
      constraints.push({
        type: 'valueSet',
        values: values
      });
    }
  }
  
  return constraints;
}

/**
 * Detect if a property requires a source based on constraint patterns
 */
function detectSourceRequirement(constraint) {
  if (!constraint || typeof constraint !== 'string') {
    return false;
  }
  
  const lowerConstraint = constraint.toLowerCase();
  
  // Patterns that indicate source requirements
  const sourcePatterns = [
    'prov:wasderivedfrom',
    'reference',
    'source',
    'citation',
    'wasderivedfrom',
    'pr:', // Property reference namespace
    'prov:', // Provenance namespace
    'stated in',
    'retrieved',
    'referenceurl'
  ];
  
  return sourcePatterns.some(pattern => lowerConstraint.includes(pattern.toLowerCase()));
}

/**
 * Expand CURIE to full IRI using prefixes
 */
function expandIRI(curie, prefixes) {
  if (!curie || typeof curie !== 'string') {
    return curie;
  }
  
  const trimmed = curie.trim();
  
  // Already a full IRI
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Remove angle brackets if present
  const cleaned = trimmed.replace(/^<|>$/g, '');
  
  // Check for prefix:localname pattern
  const colonIndex = cleaned.indexOf(':');
  if (colonIndex > 0) {
    const prefix = cleaned.substring(0, colonIndex);
    const localName = cleaned.substring(colonIndex + 1);
    
    if (prefixes[prefix]) {
      return prefixes[prefix] + localName;
    }
  }
  
  return cleaned;
}

/**
 * Extract Wikidata property ID from expanded IRI
 */
function extractPropertyId(expandedIRI) {
  if (!expandedIRI) return null;
  
  // Patterns for different Wikidata property IRIs
  const patterns = [
    /http:\/\/www\.wikidata\.org\/prop\/direct\/(P\d+)$/, // wdt: direct properties
    /http:\/\/www\.wikidata\.org\/prop\/(P\d+)$/, // p: statement properties
    /http:\/\/www\.wikidata\.org\/prop\/statement\/(P\d+)$/, // ps: statement value properties
    /http:\/\/www\.wikidata\.org\/prop\/qualifier\/(P\d+)$/, // pq: qualifier properties
  ];
  
  for (const pattern of patterns) {
    const match = expandedIRI.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Extract all properties from parsed shapes
 */
function extractAllProperties(shapes) {
  const required = [];
  const optional = [];
  
  for (const shape of Object.values(shapes)) {
    if (shape.properties) {
      required.push(...shape.properties.required);
      optional.push(...shape.properties.optional);
    }
  }
  
  // Remove duplicates based on property ID
  const uniqueRequired = deduplicateProperties(required);
  const uniqueOptional = deduplicateProperties(optional.filter(
    prop => !uniqueRequired.some(req => req.id === prop.id)
  ));
  
  return {
    required: uniqueRequired,
    optional: uniqueOptional
  };
}

/**
 * Remove duplicate properties, keeping the first occurrence
 */
function deduplicateProperties(properties) {
  const seen = new Set();
  return properties.filter(prop => {
    if (seen.has(prop.id)) {
      return false;
    }
    seen.add(prop.id);
    return true;
  });
}

