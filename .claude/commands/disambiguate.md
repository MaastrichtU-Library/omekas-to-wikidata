# Disambiguate Command

## Purpose
Transform vague feature requests into crystal-clear, implementable specifications by systematically uncovering all implicit assumptions and missing requirements.

## When to Use
- User provides a high-level feature idea
- Requirements seem incomplete or ambiguous
- Multiple interpretations are possible
- Technical decisions depend on unstated business rules

## Process

### 1. Initial Analysis
First, I'll provide:
- **Feature Understanding**: A concise summary of what I believe you're asking for
- **Context Assessment**: How this fits into the existing codebase/project
- **Complexity Estimate**: Initial assessment of scope and effort

### 2. Systematic Clarification

I'll ask targeted questions across these critical dimensions:

#### 🎯 Core Functionality & Business Logic
- What is the primary user goal?
- What are the success criteria?
- Are there existing similar features to follow?
- What are the non-negotiable requirements vs nice-to-haves?

#### 🔄 Data Flow & Integration
- What data needs to be read/written?
- Which APIs or services are involved?
- What are the data validation rules?
- How should data conflicts be resolved?

#### 👤 User Experience & Interface
- Who is the target user?
- What's the expected user journey?
- Are there specific UI patterns to follow?
- What feedback should users receive?
- Accessibility requirements?

#### ⚡ State Management & Edge Cases
- What states can the feature be in?
- How should errors be handled?
- What happens on network failures?
- Are there race conditions to consider?
- What about concurrent users/operations?

#### 🔒 Performance, Security & Constraints
- Expected data volume/frequency?
- Response time requirements?
- Security/permission considerations?
- Browser compatibility needs?
- Any regulatory compliance?

#### ✅ Testing & Validation
- How will we know it works correctly?
- What are the key test scenarios?
- Are there specific acceptance criteria?
- How should edge cases behave?

#### 🚀 Implementation & Deployment
- Any dependencies on other features/systems?
- Backwards compatibility requirements?
- Feature flags or gradual rollout needed?
- Documentation requirements?

### 3. Assumptions & Risks
I'll explicitly list:
- **Current Assumptions**: What I'm assuming if not specified
- **Technical Risks**: Potential implementation challenges
- **Unknown Dependencies**: Areas that need investigation

### 4. Proposed Specification
Based on our discussion, I'll provide:
- **User Stories**: In GIVEN/WHEN/THEN format
- **Technical Approach**: High-level implementation strategy
- **Acceptance Criteria**: Checklist format for validation
- **Out of Scope**: What we're explicitly not doing

## Example Usage

**You**: "Add a feature to bulk edit items"

**Me (using disambiguation)**:
```
📋 Understanding: You want users to select multiple items and apply changes to all of them at once.

🤔 Clarifying Questions:

Core Functionality:
1. Which fields should be bulk-editable?
2. Should changes be previewed before applying?
3. How many items can be selected at once?

Data Flow:
4. Should edits be atomic (all succeed or all fail)?
5. How to handle partial failures?
6. Should there be an undo mechanism?

[... continues with systematic questions ...]
```

## Benefits
- Prevents costly rework from misunderstood requirements
- Surfaces hidden complexity early
- Creates shared understanding before coding
- Produces better estimates and planning
- Results in more robust implementations

## Command Activation
When you want me to use this approach, simply say:
- "disambiguate this feature"
- "clarify requirements for..."
- "help me spec out..."
- Or reference this command directly