---
name: subagent-driven-development
description: "Use when executing implementation plans with independent tasks in the current session"
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration.

## When to Use

- Have an implementation plan with mostly independent tasks
- Want to stay in the current session
- Tasks can be worked on sequentially without tight coupling

## The Process

1. **Read plan** - Extract all tasks with full text, note context, create task list
2. **Per task:**
   - Dispatch implementer subagent with full task text + context
   - Answer any questions the subagent raises
   - Implementer implements, tests, commits, self-reviews
   - Dispatch spec reviewer subagent to confirm code matches spec
   - If spec issues found → implementer fixes → re-review
   - Dispatch code quality reviewer subagent
   - If quality issues found → implementer fixes → re-review
   - Mark task complete
3. **After all tasks** - Dispatch final code reviewer for entire implementation
4. **Use finishing-a-development-branch skill**

## Handling Implementer Status

- **DONE:** Proceed to spec compliance review
- **DONE_WITH_CONCERNS:** Read concerns. Address if about correctness/scope.
- **NEEDS_CONTEXT:** Provide missing context and re-dispatch
- **BLOCKED:** Assess blocker — provide context, use more capable model, break task down, or escalate

## Red Flags

**Never:**
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel
- Skip review loops
- Start code quality review before spec compliance is approved
- Move to next task while review has open issues

## Advantages

- Fresh context per task (no confusion)
- Two-stage review catches issues early
- Subagent can ask questions before AND during work
- Self-review catches issues before handoff
