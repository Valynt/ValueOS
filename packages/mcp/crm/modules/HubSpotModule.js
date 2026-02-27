/**
 * HubSpot CRM Module
 *
 * Implements CRM operations for HubSpot via their REST API.
 * Uses OAuth tokens stored at tenant level.
 */
import { logger } from "../../lib/logger";
// ============================================================================
// HubSpot Module Implementation
// ============================================================================
export class HubSpotModule {
    provider = "hubspot";
    connection = null;
    baseUrl = "https://api.hubapi.com";
    constructor(connection) {
        if (connection) {
            this.setConnection(connection);
        }
    }
    setConnection(connection) {
        if (connection.provider !== "hubspot") {
            throw new Error("Invalid connection provider for HubSpot module");
        }
        this.connection = connection;
    }
    isConnected() {
        return this.connection !== null && this.connection.status === "active";
    }
    async testConnection() {
        try {
            const response = await this.apiRequest("/crm/v3/objects/deals?limit=1");
            return response.ok;
        }
        catch {
            return false;
        }
    }
    // ==========================================================================
    // Deals
    // ==========================================================================
    async searchDeals(params) {
        const limit = params.limit || 10;
        // Build HubSpot search request
        const filterGroups = [];
        if (params.companyName) {
            // Search by associated company name requires a different approach
            // For now, we'll use deal name search
            filterGroups.push({
                filters: [
                    {
                        propertyName: "dealname",
                        operator: "CONTAINS_TOKEN",
                        value: params.companyName,
                    },
                ],
            });
        }
        if (params.stage && params.stage.length > 0) {
            filterGroups.push({
                filters: params.stage.map((s) => ({
                    propertyName: "dealstage",
                    operator: "EQ",
                    value: s,
                })),
            });
        }
        if (params.minAmount) {
            filterGroups.push({
                filters: [
                    {
                        propertyName: "amount",
                        operator: "GTE",
                        value: params.minAmount.toString(),
                    },
                ],
            });
        }
        const searchBody = {
            filterGroups: filterGroups.length > 0 ? filterGroups : undefined,
            query: params.query,
            limit,
            properties: [
                "dealname",
                "amount",
                "dealstage",
                "closedate",
                "hubspot_owner_id",
                "createdate",
                "hs_lastmodifieddate",
            ],
        };
        try {
            const response = await this.apiRequest("/crm/v3/objects/deals/search", {
                method: "POST",
                body: JSON.stringify(searchBody),
            });
            if (!response.ok) {
                throw new Error(`HubSpot search failed: ${response.status}`);
            }
            const data = await response.json();
            const deals = data.results.map((d) => this.mapDeal(d));
            return {
                deals,
                total: data.total || deals.length,
                hasMore: data.paging?.next !== undefined,
            };
        }
        catch (error) {
            logger.error("HubSpot searchDeals failed", error instanceof Error ? error : undefined);
            return { deals: [], total: 0, hasMore: false };
        }
    }
    async getDeal(dealId) {
        try {
            const response = await this.apiRequest(`/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,closedate,hubspot_owner_id,createdate,hs_lastmodifieddate&associations=contacts,companies`);
            if (!response.ok) {
                if (response.status === 404)
                    return null;
                throw new Error(`HubSpot getDeal failed: ${response.status}`);
            }
            const data = await response.json();
            return this.mapDeal(data);
        }
        catch (error) {
            logger.error("HubSpot getDeal failed", error instanceof Error ? error : undefined);
            return null;
        }
    }
    async getDealContacts(dealId) {
        try {
            // Get associated contacts
            const response = await this.apiRequest(`/crm/v3/objects/deals/${dealId}/associations/contacts`);
            if (!response.ok) {
                return [];
            }
            const { results } = await response.json();
            const contactIds = results.map((r) => r.id);
            if (contactIds.length === 0)
                return [];
            // Batch get contact details
            const batchResponse = await this.apiRequest("/crm/v3/objects/contacts/batch/read", {
                method: "POST",
                body: JSON.stringify({
                    inputs: contactIds.map((id) => ({ id })),
                    properties: [
                        "firstname",
                        "lastname",
                        "email",
                        "phone",
                        "jobtitle",
                        "company",
                    ],
                }),
            });
            if (!batchResponse.ok) {
                return [];
            }
            const batchData = await batchResponse.json();
            return batchData.results.map((c) => this.mapContact(c));
        }
        catch (error) {
            logger.error("HubSpot getDealContacts failed", error instanceof Error ? error : undefined);
            return [];
        }
    }
    async getDealActivities(dealId, limit = 20) {
        try {
            // Get engagements associated with deal
            const response = await this.apiRequest(`/crm/v3/objects/deals/${dealId}/associations/engagements`);
            if (!response.ok) {
                return [];
            }
            const { results } = await response.json();
            const engagementIds = results
                .slice(0, limit)
                .map((r) => r.id);
            if (engagementIds.length === 0)
                return [];
            // Batch get engagement details
            const batchResponse = await this.apiRequest("/crm/v3/objects/engagements/batch/read", {
                method: "POST",
                body: JSON.stringify({
                    inputs: engagementIds.map((id) => ({ id })),
                    properties: [
                        "hs_timestamp",
                        "hs_engagement_type",
                        "hs_body_preview",
                        "hs_call_duration",
                    ],
                }),
            });
            if (!batchResponse.ok) {
                return [];
            }
            const batchData = await batchResponse.json();
            return batchData.results.map((e) => this.mapActivity(e));
        }
        catch (error) {
            logger.error("HubSpot getDealActivities failed", error instanceof Error ? error : undefined);
            return [];
        }
    }
    // ==========================================================================
    // Companies
    // ==========================================================================
    async getCompany(companyId) {
        try {
            const response = await this.apiRequest(`/crm/v3/objects/companies/${companyId}?properties=name,domain,industry,numberofemployees,annualrevenue`);
            if (!response.ok) {
                if (response.status === 404)
                    return null;
                throw new Error(`HubSpot getCompany failed: ${response.status}`);
            }
            const data = await response.json();
            return this.mapCompany(data);
        }
        catch (error) {
            logger.error("HubSpot getCompany failed", error instanceof Error ? error : undefined);
            return null;
        }
    }
    async searchCompanies(query, limit = 10) {
        try {
            const response = await this.apiRequest("/crm/v3/objects/companies/search", {
                method: "POST",
                body: JSON.stringify({
                    query,
                    limit,
                    properties: [
                        "name",
                        "domain",
                        "industry",
                        "numberofemployees",
                        "annualrevenue",
                    ],
                }),
            });
            if (!response.ok) {
                return [];
            }
            const data = await response.json();
            return data.results.map((c) => this.mapCompany(c));
        }
        catch (error) {
            logger.error("HubSpot searchCompanies failed", error instanceof Error ? error : undefined);
            return [];
        }
    }
    // ==========================================================================
    // Sync Operations
    // ==========================================================================
    async updateDealProperties(dealId, properties) {
        try {
            const response = await this.apiRequest(`/crm/v3/objects/deals/${dealId}`, {
                method: "PATCH",
                body: JSON.stringify({ properties }),
            });
            return response.ok;
        }
        catch (error) {
            logger.error("HubSpot updateDealProperties failed", error instanceof Error ? error : undefined);
            return false;
        }
    }
    async addDealNote(dealId, note) {
        try {
            // Create a note engagement
            const response = await this.apiRequest("/crm/v3/objects/notes", {
                method: "POST",
                body: JSON.stringify({
                    properties: {
                        hs_note_body: note,
                        hs_timestamp: new Date().toISOString(),
                    },
                    associations: [
                        {
                            to: { id: dealId },
                            types: [
                                {
                                    associationCategory: "HUBSPOT_DEFINED",
                                    associationTypeId: 214,
                                },
                            ],
                        },
                    ],
                }),
            });
            return response.ok;
        }
        catch (error) {
            logger.error("HubSpot addDealNote failed", error instanceof Error ? error : undefined);
            return false;
        }
    }
    // ==========================================================================
    // Private Helpers
    // ==========================================================================
    async apiRequest(path, options = {}) {
        if (!this.connection?.accessToken) {
            throw new Error("HubSpot not connected");
        }
        const makeRequest = (token) => {
            return fetch(`${this.baseUrl}${path}`, {
                ...options,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });
        };
        // Initial request
        let response = await makeRequest(this.connection.accessToken);
        // If we get a 401, try to refresh the token once
        if (response.status === 401 && this.connection.refreshToken) {
            try {
                logger.info("HubSpot token expired, attempting refresh");
                // Attempt to refresh token via the edge function
                // Note: We use the refresh_token for authentication, not the expired access_token
                const refreshResponse = await fetch("/api/crm-oauth/refresh", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Refresh-Token": this.connection.refreshToken,
                    },
                    body: JSON.stringify({
                        provider: "hubspot",
                        refresh_token: this.connection.refreshToken,
                    }),
                });
                if (refreshResponse.ok) {
                    const refreshData = await refreshResponse.json();
                    if (refreshData.access_token) {
                        // Update connection with new token
                        this.connection.accessToken = refreshData.access_token;
                        if (refreshData.refresh_token) {
                            this.connection.refreshToken = refreshData.refresh_token;
                        }
                        // Retry the original request with new token
                        response = await makeRequest(this.connection.accessToken);
                        logger.info("HubSpot token refreshed successfully");
                    }
                }
            }
            catch (refreshError) {
                logger.error("Failed to refresh HubSpot token", refreshError instanceof Error ? refreshError : undefined);
                // Continue with the original 401 response
            }
        }
        return response;
    }
    mapDeal(d) {
        return {
            id: d.id,
            externalId: d.id,
            provider: "hubspot",
            name: d.properties.dealname || "Untitled Deal",
            amount: d.properties.amount ? parseFloat(d.properties.amount) : undefined,
            stage: d.properties.dealstage || "unknown",
            closeDate: d.properties.closedate
                ? new Date(d.properties.closedate)
                : undefined,
            createdAt: new Date(d.properties.createdate || Date.now()),
            updatedAt: new Date(d.properties.hs_lastmodifieddate || Date.now()),
            ownerId: d.properties.hubspot_owner_id,
            companyId: d.associations?.companies?.results[0]?.id,
            properties: d.properties,
        };
    }
    mapContact(c) {
        return {
            id: c.id,
            externalId: c.id,
            provider: "hubspot",
            firstName: c.properties.firstname,
            lastName: c.properties.lastname,
            email: c.properties.email,
            phone: c.properties.phone,
            title: c.properties.jobtitle,
            companyName: c.properties.company,
            properties: c.properties,
        };
    }
    mapCompany(c) {
        return {
            id: c.id,
            externalId: c.id,
            provider: "hubspot",
            name: c.properties.name || "Unknown Company",
            domain: c.properties.domain,
            industry: c.properties.industry,
            size: c.properties.numberofemployees,
            revenue: c.properties.annualrevenue
                ? parseFloat(c.properties.annualrevenue)
                : undefined,
            properties: c.properties,
        };
    }
    mapActivity(e) {
        const typeMap = {
            EMAIL: "email",
            CALL: "call",
            MEETING: "meeting",
            TASK: "task",
            NOTE: "note",
        };
        return {
            id: e.id,
            externalId: e.id,
            provider: "hubspot",
            type: typeMap[e.properties.hs_engagement_type || ""] || "note",
            body: e.properties.hs_body_preview,
            occurredAt: new Date(e.properties.hs_timestamp || Date.now()),
            durationMinutes: e.properties.hs_call_duration
                ? parseInt(e.properties.hs_call_duration) / 60000
                : undefined,
            properties: e.properties,
        };
    }
}
//# sourceMappingURL=HubSpotModule.js.map