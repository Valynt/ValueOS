---
trigger: always_on
---

0. Prime Directive

Any code, config, or automation produced by Windsurf MUST preserve or improve build reproducibility.
If a change introduces nondeterminism, it is a regression.

1. Deterministic Outputs Only

Windsurf MUST NOT introduce:

Timestamps (build time, generation time, “created at”)

Random IDs, UUIDs, hashes without fixed seeds

Hostnames, usernames, absolute paths

CI metadata (job IDs, runner names, ephemeral paths)

If unavoidable, values MUST be:

Explicitly parameterized

Fixed via environment variables

Or stripped at build time

2. Explicit Inputs Rule

Every generated build step MUST have explicit, locked inputs:

Tool versions must be pinned (exact versions, not ranges)

Dependencies must be locked (lockfiles, digests, SHAs)

Base images must use immutable digests, not floating tags

❌ node:latest
✅ node@sha256:…

3. Environment Neutrality

Windsurf MUST assume:

Different OS

Different filesystem ordering

Different locale / timezone

Different CPU architecture

Therefore:

File iteration must be sorted

Locales must be fixed (LC_ALL=C, etc.)

Timezone must be fixed (UTC)

Paths must be relative or normalized

4. No Hidden State

Windsurf MUST NOT rely on:

Developer machine state

Global system tools

Cached binaries outside declared caches

Network access during builds unless explicitly declared

If network access is required:

It MUST be declared

It MUST be content-addressed (hash-verified)

5. Build Instructions Are Code

All build logic MUST live in versioned artifacts:

Makefile, justfile, taskfile, scripts

CI YAML

Containerfiles / Nix / Bazel / Buck / Pants configs

Windsurf MUST NOT:

Assume “manual steps”

Encode build logic only in prose

Rely on IDE-only behavior

6. Rebuild Verifiability

For any build artifact Windsurf touches, it MUST be possible to:

Build twice in isolation

Compare outputs byte-for-byte

Explain any difference

When differences occur, Windsurf should:

Identify the source

Propose deterministic fixes

Prefer normalization over suppression

7. Metadata Discipline

If metadata is embedded:

It MUST be deterministic

It MUST be reproducible from source

It MUST NOT depend on build time or environment

Allowed examples:

Git commit hash (explicit)

Semantic version (explicit)

Content hash of inputs

8. CI/CD Enforcement

Windsurf SHOULD:

Add reproducibility checks to CI when appropriate

Fail builds on nondeterministic output

Treat reproducibility failures as quality regressions

Example expectations:

Repeat-build comparison

Artifact hash verification

diffoscope-style diagnostics when mismatches occur

9. Minimalism Bias

Windsurf SHOULD prefer:

Fewer tools

Smaller dependency surfaces

Simpler build graphs

Complexity increases the attack surface for nondeterminism.

10. Explainability Requirement

For any generated build system, Windsurf MUST be able to answer:

“What inputs affect this output?”

“Why will two builds match?”

“What would cause them to differ?”

If Windsurf cannot explain this clearly, the solution is incomplete.

11. Safe Defaults Rule

When uncertain, Windsurf MUST default to:

Deterministic behavior

Stricter pinning

More explicit configuration

Failing fast rather than “best effort”

12. Reproducibility > Convenience

If there is a tradeoff:

Faster vs reproducible → reproducible

Simpler UX vs deterministic → deterministic

Implicit vs explicit → explicit---
trigger: manual

---
