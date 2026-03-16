# Key Management Runbook

This runbook covers KEK-backed envelope encryption used by:

- `packages/backend/src/utils/encryption.ts`
- `packages/backend/src/services/crm/tokenEncryption.ts`

## Key hierarchy

- **KEK (Key Encryption Key)**: stored in Vault/KMS and exposed to runtime via rotated secret references.
- **DEK (Data Encryption Key)**: generated per-encryption operation, wrapped by KEK, and embedded in ciphertext payload.

## Ciphertext formats

### General encryption utility

- **Current (v2):**
  `v2:{kekVersion}:{dataKeyVersion}:{createdAt}:{wrappedDataKey}:{iv}:{authTag}:{ciphertext}`
- **Legacy (v1):**
  `{ivHex}:{authTagHex}:{ciphertextHex}`

### CRM token encryption

- **Current (v2):**
  `v2:{kekVersion}:{dataKeyVersion}:{createdAt}:{wrappedDataKey}:{iv}:{authTag}:{ciphertext}`
- **Legacy supported:**
  `v{n}:{iv}:{authTag}:{ciphertext}` and `{iv}:{authTag}:{ciphertext}`

## Required environment variables

### App encryption module

- `APP_ENCRYPTION_KEK_PROVIDER` (optional, default `vault`)
- `APP_ENCRYPTION_KEK_VERSION` (default `1`)
- `APP_ENCRYPTION_KEK_MATERIAL` (`_V{n}` variants for rotated keys)
- `APP_ENCRYPTION_KEK_ID` (`_V{n}` variants optional)
- Rotation policy:
  - `APP_ENCRYPTION_KEY_MAX_AGE_DAYS`
  - `APP_ENCRYPTION_LAST_ROTATED_AT`

### CRM token encryption module

- `CRM_TOKEN_KEK_PROVIDER` (optional, default `vault`)
- `CRM_TOKEN_KEY_VERSION` (default `1`)
- `CRM_TOKEN_KEK_SECRET` (`_V{n}` variants for rotated keys)
- `CRM_TOKEN_KEK_ID` (`_V{n}` variants optional)
- Rotation policy:
  - `CRM_TOKEN_KEY_MAX_AGE_DAYS`
  - `CRM_TOKEN_LAST_ROTATED_AT`

## Rotation procedure

1. **Create next KEK version** in Vault/KMS.
2. **Deploy new KEK material reference** as `*_V{n+1}` without removing old version.
3. **Set rotation metadata** (`*_LAST_ROTATED_AT`, max age) and bump configured version if desired.
4. **Run CRM re-encryption job**:
   - `TokenReEncryptionJob` to rewrite old ciphertexts under active KEK version.
5. **Verify logs** for:
   - `*.kek_rotation_promoted`
   - `*.kek_access_failed`
   - `*.decrypt_key_access_failed`
6. **After migration window**, remove deprecated key versions from runtime env.

## Emergency KEK revocation and re-encryption

1. **Revoke compromised key material in KMS/Vault immediately.**
2. **Generate replacement KEK version** and publish as next `*_V{n}` secret.
3. **Force runtime to new version** by updating version env vars and restarting backend pods.
4. **Execute bulk re-encryption** for CRM tokens with `TokenReEncryptionJob`.
5. **Re-encrypt application secrets/data** by reading and writing through the updated `encrypt`/`decrypt` flow.
6. **Monitor audit logs** for key access failures and decryption failures.
7. **Invalidate stale sessions/tokens** that cannot be safely re-encrypted.

## Backward compatibility notes

- Decrypt paths intentionally support legacy ciphertext formats.
- New encrypt operations always emit v2 envelope payloads with key version metadata.
- Keep previous key versions available until all persisted ciphertexts are migrated.
