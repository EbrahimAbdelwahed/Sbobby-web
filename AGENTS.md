<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

When working on `sbobby-web` and making web interface changes, push the relevant changes to GitHub after verification.

## Workflow for non-trivial changes

Unless the user explicitly asks otherwise, the primary agent should not immediately implement non-trivial codebase changes. The primary agent must first inspect the relevant files, reason through the task, create a precise implementation plan, define a clear goal, and then delegate the implementation to a sub-agent using gpt-5.5-low. The primary agent must provide the sub-agent with all relevant context, constraints, affected files, acceptance criteria, and expected behavior. After the sub-agent completes the implementation, the primary agent must review the diff and verify that the goal has been met.
