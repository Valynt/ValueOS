# Release Attestation Verification Workflow

**Last Updated**: 2026-04-02

---

## Purpose

This workflow documents how ValueOS release CI verifies OCI image provenance and SBOM attestations before release publication.

The release pipeline in `.github/workflows/release.yml` enforces:

1. Backend and frontend images are built with BuildKit provenance attestation enabled.
2. Backend and frontend images are built with SBOM attestation enabled.
3. A release gate fails the workflow if attestation outputs are absent.
4. Build metadata and attestation extracts are retained as workflow artifacts for audit evidence.

---

## Build Configuration Controls

In the `release` job:

- `Build and push backend release image` sets:
  - `provenance: true`
  - `sbom: true`
- `Build and push frontend release image` sets:
  - `provenance: true`
  - `sbom: true`

These controls instruct `docker/build-push-action` to emit attestation metadata that can be verified and retained.

---

## Pre-Publish Release Gate

The `Verify and capture build attestations (provenance + SBOM)` step runs before package tagging/publishing.

It performs these checks:

1. Confirms metadata outputs exist for both backend and frontend build steps.
2. Parses the metadata JSON from each build.
3. Verifies the metadata includes at least one provenance key.
4. Verifies the metadata includes at least one SBOM key.
5. Fails fast if either attestation type is missing for either image.

This ensures release publication does not proceed without both required attestation classes.

---

## Audit Evidence Retention

The release workflow writes the following evidence files to `release-artifacts/attestations/`:

- `backend-build-metadata.json`
- `frontend-build-metadata.json`
- `backend-attestations.json`
- `frontend-attestations.json`

These files are uploaded in the `Upload release manifest bundle` artifact, alongside signed SBOM files and release-control outputs.

Auditors can use this artifact bundle to:

- Confirm CI emitted provenance/SBOM attestations for both release images.
- Correlate attestation evidence with immutable image digests and release manifests.
- Reconstruct release-time security controls without requiring registry access.
