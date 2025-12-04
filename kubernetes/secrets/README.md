# Secrets Store CSI Driver Setup

This directory holds the manifests needed to mount secrets into the ValueCanvas pods via the [Secrets Store CSI Driver](https://secrets-store-csi-driver.sigs.k8s.io/). Secrets are delivered to the pod file system at `/mnt/secrets` instead of environment variables.

## 1) Install the CSI driver with Helm

```bash
helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm repo update
helm upgrade --install secrets-store-csi-driver secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system --create-namespace \
  -f kubernetes/secrets/secrets-store-csi-driver-values.yaml
```

## 2) Deploy SecretProviderClasses per environment

Apply the Vault-backed SecretProviderClasses for dev, staging, and production:

```bash
kubectl apply -f kubernetes/secrets/secret-provider-class-vault.yaml
```

Each SecretProviderClass mounts the following files in the pod:

- `db-username`
- `db-password`
- `db-url`
- `together-api-key`
- `openai-api-key`
- `supabase-url`
- `supabase-anon-key`
- `supabase-service-key`
- `jwt-secret`
- `redis-url`
- `slack-webhook` (optional)

If you prefer AWS Secrets Manager, switch the `secretProviderClass` in the deployment to `valuecanvas-secrets-production-aws` and adjust the object paths.

## 3) Deploy the application with the mounted volume

The sample deployment in `kubernetes/secrets/deployment-with-csi.yaml` already mounts the CSI volume at `/mnt/secrets`:

```yaml
        volumeMounts:
        - name: secrets-store
          mountPath: "/mnt/secrets"
          readOnly: true
...
      volumes:
      - name: secrets-store
        csi:
          driver: secrets-store.csi.k8s.io
          volumeAttributes:
            secretProviderClass: "valuecanvas-secrets-production-vault"
```

## 4) Validate secret delivery inside a pod

After rollout completes, verify that the secret files are available and contain the expected values:

```bash
kubectl exec -it deployment/valuecanvas-api -n production -- ls -la /mnt/secrets
kubectl exec -it deployment/valuecanvas-api -n production -- cat /mnt/secrets/db-password
```

The second command should print the database password from the configured provider, satisfying the acceptance criterion for `/mnt/secrets/db-password`.
