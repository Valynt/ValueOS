/**
 * SAML Test Response Fixtures
 * Used for automated SAML compliance testing
 */

export const VALID_SAML_RESPONSE = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                ID="_valid_response_id_123"
                Version="2.0"
                IssueInstant="2024-01-01T12:00:00Z"
                Destination="http://localhost:5174/api/auth/saml/acs">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                  ID="_assertion_id_123"
                  Version="2.0"
                  IssueInstant="2024-01-01T12:00:00Z">
    <saml:Issuer>http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">test.user@valuecanvas.test</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="2024-01-01T12:05:00Z"
                                       Recipient="http://localhost:5174/api/auth/saml/acs"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="2024-01-01T11:55:00Z" NotOnOrAfter="2024-01-01T12:05:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>http://localhost:5174/saml/metadata</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="2024-01-01T12:00:00Z" SessionIndex="_session_index_123">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>test.user@valuecanvas.test</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="firstName">
        <saml:AttributeValue>Test</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="lastName">
        <saml:AttributeValue>User</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="tenant_id">
        <saml:AttributeValue>test-tenant-001</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
`;

export const EXPIRED_ASSERTION_RESPONSE = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                ID="_expired_response_id"
                Version="2.0"
                IssueInstant="2020-01-01T12:00:00Z"
                Destination="http://localhost:5174/api/auth/saml/acs">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                  ID="_expired_assertion_id"
                  Version="2.0"
                  IssueInstant="2020-01-01T12:00:00Z">
    <saml:Issuer>http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
    <saml:Conditions NotBefore="2020-01-01T11:55:00Z" NotOnOrAfter="2020-01-01T12:05:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>http://localhost:5174/saml/metadata</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
  </saml:Assertion>
</samlp:Response>
`;

export const REPLAY_ATTACK_RESPONSE = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                ID="_replay_response_id_456"
                Version="2.0"
                IssueInstant="2024-01-01T12:00:00Z"
                Destination="http://localhost:5174/api/auth/saml/acs">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                  ID="_replay_assertion_id_456"
                  Version="2.0"
                  IssueInstant="2024-01-01T12:00:00Z">
    <saml:Issuer>http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">replay.user@valuecanvas.test</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="2024-01-01T11:55:00Z" NotOnOrAfter="2024-01-01T12:05:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>http://localhost:5174/saml/metadata</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
  </saml:Assertion>
</samlp:Response>
`;

export const CLOCK_SKEW_RESPONSE = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                ID="_clock_skew_response"
                Version="2.0"
                IssueInstant="2024-01-01T12:03:00Z"
                Destination="http://localhost:5174/api/auth/saml/acs">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                  ID="_clock_skew_assertion"
                  Version="2.0"
                  IssueInstant="2024-01-01T12:03:00Z">
    <saml:Issuer>http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">test.user@valuecanvas.test</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="2024-01-01T12:01:00Z" NotOnOrAfter="2024-01-01T12:08:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>http://localhost:5174/saml/metadata</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
  </saml:Assertion>
</samlp:Response>
`;

export const LOGOUT_REQUEST = `
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     ID="_logout_request_id"
                     Version="2.0"
                     IssueInstant="2024-01-01T12:30:00Z"
                     Destination="http://localhost:5174/api/auth/saml/slo">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">http://keycloak:8080/realms/valuecanvas-test</saml:Issuer>
  <saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
               Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">test.user@valuecanvas.test</saml:NameID>
  <samlp:SessionIndex>_session_index_123</samlp:SessionIndex>
</samlp:LogoutRequest>
`;

export const LOGOUT_RESPONSE = `
<samlp:LogoutResponse xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                      ID="_logout_response_id"
                      Version="2.0"
                      IssueInstant="2024-01-01T12:30:05Z"
                      Destination="http://keycloak:8080/realms/valuecanvas-test/protocol/saml"
                      InResponseTo="_logout_request_id">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">http://localhost:5174/saml/metadata</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
</samlp:LogoutResponse>
`;

export interface SAMLTestUser {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  enabled: boolean;
}

export const TEST_USERS: Record<string, SAMLTestUser> = {
  valid: {
    username: 'test.user@valuecanvas.test',
    password: 'Test123!@#',
    email: 'test.user@valuecanvas.test',
    firstName: 'Test',
    lastName: 'User',
    tenantId: 'test-tenant-001',
    enabled: true,
  },
  expired: {
    username: 'expired.user@valuecanvas.test',
    password: 'Expired123!@#',
    email: 'expired.user@valuecanvas.test',
    firstName: 'Expired',
    lastName: 'User',
    tenantId: 'test-tenant-001',
    enabled: false,
  },
};

export const SAML_ENDPOINTS = {
  idpMetadata: 'http://localhost:8080/realms/valuecanvas-test/protocol/saml/descriptor',
  idpSsoUrl: 'http://localhost:8080/realms/valuecanvas-test/protocol/saml',
  idpSloUrl: 'http://localhost:8080/realms/valuecanvas-test/protocol/saml',
  spAcsUrl: 'http://localhost:5174/api/auth/saml/acs',
  spSloUrl: 'http://localhost:5174/api/auth/saml/slo',
  spMetadata: 'http://localhost:5174/saml/metadata',
};

export const CLOCK_SKEW_TOLERANCE_SECONDS = 180; // 3 minutes
