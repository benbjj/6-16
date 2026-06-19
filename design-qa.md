# Design QA

- source visual truth path: `public/assets/reference-rain-curtain.png`
- implementation screenshot path: `qa/05-loop-two.png`
- viewport: 1280×720
- target state: second loop, 07:10, line “这是第二次六月十六日。”
- full-view comparison evidence: `qa/16-comparison-full.png`
- focused dialogue comparison evidence: `qa/17-comparison-dialogue.png`
- extended-state evidence: `qa/07-record-choice.png`, `qa/09-rescue-choice.png`, `qa/13-facts.png`, `qa/15-chapter-end.png`
- interaction evidence: `qa/interaction-results.json`

**Findings**

No actionable P0, P1, or P2 mismatches remain.

- Fonts and typography: Songti CJK typography remains consistent across dialogue, choices, facts, and chapter completion. Text is readable at 1280×720 with no clipping in the verified path.
- Spacing and layout rhythm: the exact source-comparison state retains the original four utility controls and contains no added chapter chrome. Chapter metadata and fact access appear only after the first fact is acquired. New panels use the existing spacing and alignment system.
- Colors and visual tokens: all three locations preserve the selected cold blue-gray palette, charcoal overlays, restrained white text, and red accent hierarchy.
- Image quality and asset fidelity: the classroom, records room, and old corridor are full-resolution generated environment assets with consistent rain, lighting, camera height, and rendering style. No placeholder or code-drawn scene assets are present.
- Copy and content: the source-comparison line matches exactly. The extended route maintains the approved 16:16/18:16 timing, distinguishes evidence from relationship context, and follows the required ordinary-memory beat after confession.
- Interactions: three investigation/confrontation choices complete; both fact cards are acquired and listed; history contains 67 entries; save, skip, and auto states work; the chapter completion screen is reachable; console and page error count is zero.

**Open Questions**

- None for this vertical slice.

**Implementation Checklist**

- [x] Preserve the selected source state.
- [x] Add and verify records-room and old-corridor scenes.
- [x] Complete the second-loop proof, roster investigation, confrontation, substitute accident, confession, and chapter ending.
- [x] Verify fact acquisition, fact list, history, save, skip, auto, and sound controls.
- [x] Capture clean 1280×720 screenshots and side-by-side comparisons.
- [x] Resolve all P0/P1/P2 findings and console errors.

**Patches Made Since Previous QA Pass**

- Expanded the story from 23 to 64 authored story nodes plus choice responses.
- Added two generated school environment backgrounds.
- Added procedural rain ambience and restrained bell/static/memory cues.
- Added persistent fact-card acquisition and review UI.
- Added chapter metadata, branch-aware rescue dialogue, and first-chapter completion state.
- Made the QA runner reuse an existing preview server and cover the full chapter.

**Follow-up Polish**

- P3: package licensed Chinese serif and sans-serif font files before public distribution.
- P3: replace procedural sound with authored audio during production audio direction.

final result: passed
