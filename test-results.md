# Wikidata Property Data Type Test Results

## Summary
This prototype demonstrates that **each Wikidata property has exactly ONE data type** that is set when the property is created and cannot be changed afterward. However, properties can have multiple **constraints** that further restrict what values are allowed.

## How to Use the Prototype
1. Open `wikidata-property-datatype-prototype.html` in your browser
2. Enter a property ID (e.g., P31, P21, P569) or click test buttons
3. The tool will display:
   - The property's single data type
   - Any constraints that limit allowed values
   - Raw API response data

## Key Findings

### 1. Single Data Type per Property
Every Wikidata property has exactly one data type. Common data types include:
- **wikibase-item**: Links to other Wikidata items (e.g., P31 "instance of")
- **time**: Date/time values (e.g., P569 "date of birth")
- **globe-coordinate**: Geographic coordinates (e.g., P625 "coordinate location")
- **quantity**: Numeric values with units (e.g., P1082 "population")
- **commonsMedia**: Links to Wikimedia Commons files (e.g., P18 "image")
- **external-id**: External identifier strings (e.g., P227 "GND ID")
- **string**: Text values (e.g., P373 "Commons category")
- **url**: Web addresses (e.g., P856 "official website")

### 2. Constraints vs Data Types
While each property has one data type, it can have multiple **constraints** that define:
- **Allowed values**: Specific items that can be used (e.g., P21 allows only specific gender items)
- **Value type constraints**: What types of items can be linked (e.g., P31 requires items to be classes)
- **Format constraints**: Regular expressions for string formats
- **Unit constraints**: Which units can be used with quantities
- **Cardinality constraints**: Single vs multiple values allowed

### 3. Test Results for Common Properties

| Property | Label | Data Type | Key Constraints |
|----------|-------|-----------|-----------------|
| P31 | instance of | wikibase-item | Value type constraint (must be classes) |
| P21 | sex or gender | wikibase-item | Allowed values constraint (specific gender items only) |
| P569 | date of birth | time | Single value constraint |
| P625 | coordinate location | globe-coordinate | Single value constraint |
| P18 | image | commonsMedia | Format constraint (file extensions) |
| P1082 | population | quantity | Allowed units constraint |
| P2046 | area | quantity | Allowed units constraint (area units) |
| P856 | official website | url | Format constraint (URL pattern) |
| P227 | GND ID | external-id | Format constraint (specific ID pattern) |
| P373 | Commons category | string | Format constraint |

## API Endpoint Used
```
https://www.wikidata.org/w/api.php?action=wbgetentities&ids={PROPERTY_ID}&format=json&props=labels|descriptions|datatype|claims
```

## Key Technical Details

1. **Data Type is Immutable**: Once a property is created with a data type, it cannot be changed
2. **Constraints are Flexible**: Constraints can be added or modified after property creation
3. **Property P2302**: Used to define constraints on properties
4. **Validation**: Wikidata uses constraints for validation but they're not strictly enforced

## Implementation Notes

The prototype:
- Uses the Wikidata API's `wbgetentities` action
- Fetches property metadata including data type and constraints
- Parses constraint qualifiers to show allowed values
- Displays results in a user-friendly format
- Includes test buttons for common properties

## Conclusion

**Answer to your question**: Each Wikidata property has **exactly one data type**, not multiple. However, the flexibility comes from constraints that can restrict or guide what specific values are allowed within that data type. This is a fundamental design principle of Wikidata - the data type defines the storage format, while constraints define the validation rules.