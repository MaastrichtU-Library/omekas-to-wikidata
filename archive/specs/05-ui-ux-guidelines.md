# UI/UX Guidelines

## Design Philosophy

### Core Principles
- **Task-Focused**: Each interface element serves a specific purpose in the workflow
- **Progressive Disclosure**: Show only relevant information for current task
- **Keyboard-First**: Optimize for power users while remaining mouse-accessible
- **Transparent Process**: Users always understand what the system is doing
- **Recoverable Actions**: Every action can be undone or revised

### User Experience Goals
- **Efficiency**: Minimize time to complete mapping and reconciliation tasks
- **Confidence**: Users feel certain about their decisions and their consequences
- **Learning**: Interface teaches Wikidata concepts through use
- **Control**: Users direct the process rather than being automated away from it

## Visual Design System

### Layout Principles

#### Step Navigation Header
```
┌─────────────────────────────────────────────────────────────┐
│ [●] Input → [○] Mapping → [○] Reconciliation → [○] Designer │
│                                                             │
│ Progress: 47% complete • 12 items mapped • 3 remaining     │
└─────────────────────────────────────────────────────────────┘
```

- **Fixed header**: Always visible during workflow
- **Clear progression**: Visual indication of current and completed steps
- **Clickable navigation**: Jump to any previously completed step
- **Progress details**: Specific counts and percentages

#### Main Content Area
```
┌─ Step Title ──────────────────────────────────── [?] [⚙] ─┐
│                                                           │
│  Primary Content Area                                     │
│  ┌─ Section ────────────────────────────── [↕] ─┐        │
│  │ Content with collapsible sections              │        │
│  │ ┌─ Subsection ─────────────────────────┐      │        │
│  │ │ Detailed content                     │      │        │
│  │ └─────────────────────────────────────┘      │        │
│  └───────────────────────────────────────────────┘        │
│                                                           │
│  ┌─ Action Area ──────────────────────────────────┐       │
│  │ [Previous] [Skip] [Next] [Help]                │       │
│  └───────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────┘
```

- **Clear hierarchy**: Title, content, actions
- **Collapsible sections**: Progressive disclosure
- **Consistent action bar**: Standard placement of controls
- **Help integration**: Contextual help always available

### Color and Typography

#### Color Palette
- **Primary**: Deep blue (#1976D2) for main actions and progress
- **Secondary**: Green (#388E3C) for success states and confirmations
- **Warning**: Orange (#F57C00) for cautions and required attention
- **Error**: Red (#D32F2F) for errors and destructive actions
- **Neutral**: Gray scale (#212121, #424242, #757575, #BDBDBD, #F5F5F5)

#### Typography Hierarchy
- **H1**: Step titles (24px, bold)
- **H2**: Section headers (20px, semibold)
- **H3**: Subsection headers (16px, semibold)
- **Body**: Content text (14px, regular)
- **Caption**: Helper text and labels (12px, regular)
- **Code**: Monospace font for technical content (14px, Monaco/Consolas)

## Modal Design System

### Modal Types and Behavior

#### Mapping Modal
```
┌─ Map Property: "dcterms:creator" ──────────── [×] ─┐
│                                                    │
│ Example values:                                    │
│ • "John Smith"                                     │
│ • "Mary Johnson"                                   │
│ • "University Library"                             │
│                                                    │
│ Map to Wikidata property:                          │
│ ┌─────────────────────────────────────────────────┐│
│ │ author (P50) ★★★                               ││ 
│ │ creator (P170) ★★☆                             ││
│ │ publisher (P123) ★☆☆                           ││
│ │ [Search properties...]                          ││
│ └─────────────────────────────────────────────────┘│
│                                                    │
│ Selected: author (P50)                             │
│ Used for: person who wrote the work                │
│                                                    │
│ [C]onfirm  [S]kip  [I]gnore  [R]esearch          │
└────────────────────────────────────────────────────┘
```

#### Reconciliation Modal
```
┌─ Reconcile: "John Smith" for author (P50) ──── [×] ─┐
│                                                      │
│ Original value: "John Smith"                         │
│ Property: author (P50) - person who wrote the work   │
│                                                      │
│ Suggestions:                                         │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ● John Smith (Q12345) ★★★                       │ │
│ │   American author (1975-2023)                   │ │
│ │                                                 │ │
│ │ ○ John Smith (Q67890) ★★☆                       │ │
│ │   British historian (1952-)                     │ │
│ │                                                 │ │
│ │ ○ [Search manually...]                          │ │
│ │ ○ [Create new entity]                           │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ [A]ccept  [S]earch  [C]reate  [L]ater              │
└──────────────────────────────────────────────────────┘
```

### Modal Interaction Patterns

#### Opening Behavior
- **Smooth animation**: 200ms fade-in with subtle scale
- **Focus trap**: Tab navigation contained within modal
- **Background dim**: Partially transparent overlay
- **Escape handling**: ESC key closes modal

#### Keyboard Navigation
- **Tab order**: Logical progression through interactive elements
- **Arrow keys**: Navigate through suggestion lists
- **Letter shortcuts**: Quick access to common actions
- **Enter/Space**: Activate focused element

#### Closing Behavior
- **Explicit confirmation**: Changes saved only on confirmation
- **Cancel warning**: Alert for unsaved changes
- **Auto-advance**: Optional progression to next task
- **State preservation**: Remember modal position and selections

## Keyboard Navigation System

### Global Shortcuts
- **Alt + 1-5**: Jump to specific workflow step
- **Ctrl + S**: Save current session state
- **Ctrl + ?**: Open help system
- **Ctrl + /**: Search within help content
- **Escape**: Close current modal or return to main view

### Step-Specific Shortcuts
- **Tab/Shift+Tab**: Navigate between focusable elements
- **Space**: Toggle collapsible sections
- **Enter**: Open modal or activate primary action
- **Arrow keys**: Navigate within lists and suggestion boxes

### Modal Shortcuts
- **C**: Confirm current selection
- **S**: Skip current item
- **I**: Ignore item (mapping step)
- **A**: Accept suggestion (reconciliation step)
- **L**: Mark for later (reconciliation step)
- **R**: Research/get more info
- **N**: Next item
- **P**: Previous item

### Accessibility Features
- **Focus indicators**: Clear visual indication of keyboard focus
- **Screen reader support**: Proper ARIA labels and descriptions
- **High contrast**: Sufficient color contrast ratios
- **Font scaling**: Responsive to browser font size settings

## Component Design Patterns

### Collapsible Sections
```javascript
// Standard collapsible section structure
<div class="collapsible-section" data-state="expanded">
  <div class="section-header" tabindex="0" role="button">
    <span class="section-title">Section Name</span>
    <span class="item-count">(5 items)</span>
    <span class="expand-icon">▼</span>
  </div>
  <div class="section-content">
    <!-- Section content -->
  </div>
</div>
```

### Suggestion Lists
```javascript
// Reusable suggestion list component
<div class="suggestion-list" role="listbox">
  <div class="suggestion-item selected" role="option" tabindex="0">
    <div class="suggestion-header">
      <span class="suggestion-title">Primary Text</span>
      <span class="confidence-score">★★★</span>
    </div>
    <div class="suggestion-description">Secondary descriptive text</div>
  </div>
</div>
```

### Progress Indicators
```javascript
// Step progress indicator
<div class="step-progress">
  <div class="progress-bar">
    <div class="progress-fill" style="width: 47%"></div>
  </div>
  <div class="progress-text">47% complete • 12 of 25 items</div>
</div>
```

## Responsive Behavior

### Desktop-Only Design
- **Minimum width**: 1024px optimized layout
- **Maximum width**: 1920px with center alignment
- **Fixed proportions**: Consistent ratios across different screen sizes
- **Readable text**: Minimum 14px font size at all zoom levels

### Zoom Compatibility
- **Browser zoom**: Functional at 50%-200% zoom levels
- **Font scaling**: Respects user font size preferences
- **Layout preservation**: Maintains usability at different zoom levels

## Error and Feedback States

### Success Feedback
- **Visual confirmation**: Green checkmark with brief animation
- **Progress update**: Immediate reflection in progress indicators
- **Status message**: Clear confirmation of completed action
- **Auto-dismiss**: Temporary feedback disappears after 3 seconds

### Error States
- **Inline validation**: Real-time feedback on form inputs
- **Error highlighting**: Red border and icon for problem areas
- **Descriptive messages**: Specific explanation of what went wrong
- **Recovery guidance**: Clear steps to resolve the error

### Loading States
- **Progress indicators**: For operations taking >1 second
- **Skeleton screens**: For content that's loading
- **Spinner overlays**: For modal operations
- **Cancel options**: For long-running operations

## Information Architecture

### Help System Integration
- **Contextual help**: Question mark icons near complex features
- **Progressive disclosure**: Basic → intermediate → advanced information
- **Search functionality**: Quick access to specific help topics
- **Examples**: Concrete examples for abstract concepts

### Content Hierarchy
- **Scannable layout**: Use of whitespace and visual grouping
- **Action-oriented**: Labels describe what will happen
- **Consistent terminology**: Same terms used throughout interface
- **Clear relationships**: Visual connection between related elements

This UI/UX system creates a professional, efficient interface that guides users through complex data mapping tasks while remaining approachable for newcomers to Wikidata concepts.