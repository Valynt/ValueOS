import { OrganizationGeneral } from "@/views/Settings/OrganizationGeneral";
import {
  TENANT_BRANDING_FIXTURE,
  TENANT_BRANDING_FIXTURE_DOMAIN,
  TENANT_BRANDING_FIXTURE_NAME,
} from "@/views/Settings/tenantBrandingFixture";

export function TenantBrandingHarness() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <OrganizationGeneral
          initialBranding={TENANT_BRANDING_FIXTURE}
          initialOrganizationName={TENANT_BRANDING_FIXTURE_NAME}
          initialDomain={TENANT_BRANDING_FIXTURE_DOMAIN}
        />
      </div>
    </main>
  );
}
