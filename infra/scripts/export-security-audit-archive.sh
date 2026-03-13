#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUDIT_ARCHIVE_BUCKET:?AUDIT_ARCHIVE_BUCKET is required}"
: "${AUDIT_ARCHIVE_PREFIX:=immutable/security-audit}"
: "${RETENTION_POLICY_VERSION:=security-audit-retention-v1}"

batch_json=$(psql "$DATABASE_URL" -tA -c "SELECT public.rotate_security_audit_logs(jsonb_build_object('policy_version', '${RETENTION_POLICY_VERSION}', 'operational_window_days', 365, 'archive_years', 7), 10000);")
batch_id=$(echo "$batch_json" | jq -r '.batch_id')
rows_moved=$(echo "$batch_json" | jq -r '.rows_moved')

if [[ "$rows_moved" == "0" ]]; then
  echo "No rows moved for archival"
  exit 0
fi

workdir=$(mktemp -d)
segments_file="$workdir/${batch_id}.ndjson"
manifest_file="$workdir/${batch_id}.manifest.json"

psql "$DATABASE_URL" -tA -c "SELECT jsonb_build_object('source_id', source_id, 'event_timestamp', event_timestamp, 'payload', payload, 'checksum_sha256', checksum_sha256, 'chain_checksum_sha256', chain_checksum_sha256)::text FROM public.security_audit_archive_segment WHERE batch_id = '${batch_id}' ORDER BY event_timestamp;" > "$segments_file"

segments_sha256=$(sha256sum "$segments_file" | awk '{print $1}')
segment_count=$(wc -l < "$segments_file" | xargs)

cat > "$manifest_file" <<JSON
{
  "batch_id": "${batch_id}",
  "retention_policy_version": "${RETENTION_POLICY_VERSION}",
  "segment_count": ${segment_count},
  "segments_sha256": "${segments_sha256}",
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

manifest_sha256=$(sha256sum "$manifest_file" | awk '{print $1}')

aws s3api put-object \
  --bucket "$AUDIT_ARCHIVE_BUCKET" \
  --key "$AUDIT_ARCHIVE_PREFIX/${batch_id}/segments.ndjson" \
  --body "$segments_file" \
  --checksum-algorithm SHA256 \
  --object-lock-mode COMPLIANCE \
  --object-lock-retain-until-date "$(date -u -d '+7 years' +%Y-%m-%dT%H:%M:%SZ)" \
  --metadata "batch_id=${batch_id},segments_sha256=${segments_sha256}"

aws s3api put-object \
  --bucket "$AUDIT_ARCHIVE_BUCKET" \
  --key "$AUDIT_ARCHIVE_PREFIX/${batch_id}/manifest.json" \
  --body "$manifest_file" \
  --checksum-algorithm SHA256 \
  --object-lock-mode COMPLIANCE \
  --object-lock-retain-until-date "$(date -u -d '+7 years' +%Y-%m-%dT%H:%M:%SZ)" \
  --object-lock-legal-hold-status ON \
  --metadata "batch_id=${batch_id},manifest_sha256=${manifest_sha256}"

psql "$DATABASE_URL" -c "UPDATE public.security_audit_archive_batch SET object_store_uri = 's3://${AUDIT_ARCHIVE_BUCKET}/${AUDIT_ARCHIVE_PREFIX}/${batch_id}/', export_checksum_sha256 = '${manifest_sha256}', exported_at = NOW(), status = 'exported' WHERE id = '${batch_id}';"

psql "$DATABASE_URL" -c "SELECT public.verify_security_audit_archive_integrity(45);"

echo "Archived batch ${batch_id} with checksum ${manifest_sha256}"
