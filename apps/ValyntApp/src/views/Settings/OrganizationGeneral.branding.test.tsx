import { render, screen } from "@testing-library/react";

import { OrganizationGeneral } from "./OrganizationGeneral";
import {
  TENANT_BRANDING_FIXTURE,
  TENANT_BRANDING_FIXTURE_DOMAIN,
  TENANT_BRANDING_FIXTURE_NAME,
} from "./tenantBrandingFixture";

describe("OrganizationGeneral branding verification", () => {
  it("renders tenant branding assets and colors in the verification surfaces", () => {
    render(
      <OrganizationGeneral
        initialBranding={TENANT_BRANDING_FIXTURE}
        initialOrganizationName={TENANT_BRANDING_FIXTURE_NAME}
        initialDomain={TENANT_BRANDING_FIXTURE_DOMAIN}
      />
    );

    expect(screen.getByTestId("tenant-branding-logo")).toHaveAttribute(
      "src",
      TENANT_BRANDING_FIXTURE.logoUrl
    );
    expect(screen.getByTestId("tenant-branding-favicon")).toHaveAttribute(
      "src",
      TENANT_BRANDING_FIXTURE.faviconUrl
    );
    expect(screen.getByTestId("tenant-branding-primary-swatch")).toHaveStyle({
      backgroundColor: TENANT_BRANDING_FIXTURE.primaryColor,
    });
    expect(screen.getByTestId("tenant-branding-secondary-swatch")).toHaveStyle({
      backgroundColor: TENANT_BRANDING_FIXTURE.secondaryColor,
    });
    expect(screen.getByTestId("tenant-branding-primary-action")).toHaveStyle({
      backgroundColor: TENANT_BRANDING_FIXTURE.primaryColor,
    });
    expect(screen.getByTestId("tenant-branding-secondary-action")).toHaveStyle({
      backgroundColor: TENANT_BRANDING_FIXTURE.secondaryColor,
    });
    expect(screen.getByText(TENANT_BRANDING_FIXTURE_NAME)).toBeVisible();
    expect(screen.getByText(TENANT_BRANDING_FIXTURE_DOMAIN)).toBeVisible();
  });
});
