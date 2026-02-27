/**
 * SEC EDGAR API Client
 *
 * Provides live access to SEC EDGAR filings, XBRL data, and company financial information
 * SEC EDGAR API: https://www.sec.gov/edgar/searchedgar/companies.htm
 */
import { logger } from "../../lib/logger";
import { fetchWithRetry } from "./utils/fetchWithRetry";
export class SECEdgarClient {
    baseUrl = "https://www.sec.gov";
    userAgent;
    rateLimiter = new Map();
    maxRequestsPerSecond = 10; // SEC rate limit
    constructor(userAgent) {
        this.userAgent = userAgent || "ValueOS/1.0 (contact@valueos.com)";
    }
    /**
     * Get company filings for a CIK
     */
    async getCompanyFilings(cik, formTypes = ["10-K", "10-Q", "8-K"], startDate, endDate, count = 40) {
        await this.checkRateLimit();
        try {
            // Format CIK with leading zeros
            const formattedCik = cik.padStart(10, "0");
            // Build query parameters
            const params = new URLSearchParams({
                action: "getcompany",
                CIK: formattedCik,
                type: formTypes.join(","),
                count: count.toString(),
                output: "atom",
            });
            if (startDate)
                params.append("start", startDate);
            if (endDate)
                params.append("end", endDate);
            const url = `${this.baseUrl}/cgi-bin/browse-edgar?${params.toString()}`;
            logger.debug("Fetching SEC filings", { cik: formattedCik, url });
            const response = await fetchWithRetry(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    Accept: "application/atom+xml",
                },
            });
            if (!response.ok) {
                throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
            }
            const xmlText = await response.text();
            return this.parseFilingsXML(xmlText);
        }
        catch (error) {
            logger.error("Failed to fetch SEC filings", { cik, error });
            throw error;
        }
    }
    /**
     * Get company information by CIK
     */
    async getCompanyInfo(cik) {
        await this.checkRateLimit();
        try {
            const formattedCik = cik.padStart(10, "0");
            const url = `${this.baseUrl}/cgi-bin/browse-edgar?action=getcompany&CIK=${formattedCik}&output=atom`;
            const response = await fetchWithRetry(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    Accept: "application/atom+xml",
                },
            });
            if (!response.ok) {
                throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
            }
            const xmlText = await response.text();
            return this.parseCompanyInfoXML(xmlText);
        }
        catch (error) {
            logger.error("Failed to fetch SEC company info", { cik, error });
            throw error;
        }
    }
    /**
     * Get XBRL data from a filing
     */
    async getXBRLData(accessionNumber, cik) {
        await this.checkRateLimit();
        try {
            // XBRL data is available through SEC's data.sec.gov API or direct filing access
            const formattedCik = cik.padStart(10, "0");
            const accessionPath = accessionNumber.replace(/-/g, "");
            // Try to get XBRL instance document
            const xbrlUrl = `${this.baseUrl}/Archives/edgar/data/${formattedCik}/${accessionPath}/${formattedCik}-${accessionPath}.xml`;
            logger.debug("Fetching XBRL data", { accessionNumber, cik, xbrlUrl });
            const response = await fetchWithRetry(xbrlUrl, {
                headers: {
                    "User-Agent": this.userAgent,
                    Accept: "application/xml",
                },
            });
            if (!response.ok) {
                // Fallback: try to get HTML filing and extract data
                logger.warn("XBRL not available, falling back to HTML parsing", { accessionNumber });
                return this.getHTMLFilingData(accessionNumber, cik);
            }
            const xmlText = await response.text();
            return this.parseXBRLData(xmlText, accessionNumber, cik);
        }
        catch (error) {
            logger.error("Failed to fetch XBRL data", { accessionNumber, cik, error });
            throw error;
        }
    }
    /**
     * Search for companies by name
     */
    async searchCompanies(companyName, limit = 10) {
        await this.checkRateLimit();
        try {
            const params = new URLSearchParams({
                action: "getcompany",
                company: companyName,
                count: limit.toString(),
                output: "atom",
            });
            const url = `${this.baseUrl}/cgi-bin/browse-edgar?${params.toString()}`;
            const response = await fetchWithRetry(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    Accept: "application/atom+xml",
                },
            });
            if (!response.ok) {
                throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
            }
            const xmlText = await response.text();
            return this.parseCompanySearchXML(xmlText);
        }
        catch (error) {
            logger.error("Failed to search SEC companies", { companyName, error });
            throw error;
        }
    }
    // ==================== Private Methods ====================
    async checkRateLimit() {
        const now = Date.now();
        const key = "sec_api";
        const lastRequest = this.rateLimiter.get(key) || 0;
        const timeSinceLastRequest = now - lastRequest;
        const minInterval = 1000 / this.maxRequestsPerSecond; // milliseconds between requests
        if (timeSinceLastRequest < minInterval) {
            const waitTime = minInterval - timeSinceLastRequest;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        this.rateLimiter.set(key, Date.now());
    }
    parseFilingsXML(xmlText) {
        // Parse XML and extract filing information
        // This is a simplified implementation - in production you'd use a proper XML parser
        const filings = [];
        // Extract entries using regex (simplified approach)
        const entryRegex = /<entry>(.*?)<\/entry>/gs;
        const entries = xmlText.match(entryRegex) || [];
        for (const entry of entries) {
            try {
                const filing = this.parseFilingEntry(entry);
                if (filing)
                    filings.push(filing);
            }
            catch (error) {
                logger.warn("Failed to parse filing entry", { error });
            }
        }
        return filings;
    }
    parseFilingEntry(entry) {
        // Extract key fields from XML entry
        const cikMatch = entry.match(/<cik>(\d+)<\/cik>/);
        const companyMatch = entry.match(/<name>(.*?)<\/name>/);
        const formMatch = entry.match(/<form>(.*?)<\/form>/);
        const filingDateMatch = entry.match(/<filing-date>(.*?)<\/filing-date>/);
        const acceptanceMatch = entry.match(/<acceptance-datetime>(.*?)<\/acceptance-datetime>/);
        const primaryDocMatch = entry.match(/<primary-document>(.*?)<\/primary-document>/);
        const accessionMatch = entry.match(/<accession-number>(.*?)<\/accession-number>/);
        if (!cikMatch || !companyMatch || !formMatch)
            return null;
        return {
            cik: cikMatch[1],
            companyName: companyMatch[1],
            formType: formMatch[1],
            filingDate: filingDateMatch ? filingDateMatch[1] : "",
            acceptanceDateTime: acceptanceMatch ? acceptanceMatch[1] : "",
            primaryDocument: primaryDocMatch ? primaryDocMatch[1] : "",
            primaryDocDescription: "",
            accessionNumber: accessionMatch ? accessionMatch[1] : "",
            fileNumber: "",
            filmNumber: "",
            isXBRL: false,
            isInlineXBRL: false,
            size: 0,
        };
    }
    parseCompanyInfoXML(xmlText) {
        // Simplified XML parsing for company information
        const cikMatch = xmlText.match(/<cik>(\d+)<\/cik>/);
        const nameMatch = xmlText.match(/<name>(.*?)<\/name>/);
        const sicMatch = xmlText.match(/<sic>(\d+)<\/sic>/);
        const sicDescMatch = xmlText.match(/<sic-description>(.*?)<\/sic-description>/);
        if (!cikMatch || !nameMatch) {
            throw new Error("Unable to parse company information from XML");
        }
        return {
            cik: cikMatch[1],
            companyName: nameMatch[1],
            sic: sicMatch ? sicMatch[1] : "",
            sicDescription: sicDescMatch ? sicDescMatch[1] : "",
            businessAddress: {
                street1: "",
                city: "",
                state: "",
                zipCode: "",
            },
            stateOfIncorporation: "",
            fiscalYearEnd: "",
        };
    }
    parseXBRLData(xmlText, accessionNumber, cik) {
        // Simplified XBRL parsing - in production, use proper XBRL parser
        // This extracts common financial metrics from XBRL instance documents
        const extractValue = (pattern) => {
            const match = xmlText.match(pattern);
            return match ? parseFloat(match[1]) : undefined;
        };
        return {
            cik,
            accessionNumber,
            formType: "10-K", // Would be determined from filing
            filingDate: "", // Would be determined from filing
            period: "", // Would be determined from context
            revenue: extractValue(/<us-gaap:Revenue[^>]*>([\d,.-]+)<\/us-gaap:Revenue>/),
            netIncome: extractValue(/<us-gaap:NetIncomeLoss[^>]*>([\d,.-]+)<\/us-gaap:NetIncomeLoss>/),
            assets: extractValue(/<us-gaap:Assets[^>]*>([\d,.-]+)<\/us-gaap:Assets>/),
            liabilities: extractValue(/<us-gaap:Liabilities[^>]*>([\d,.-]+)<\/us-gaap:Liabilities>/),
            equity: extractValue(/<us-gaap:StockholdersEquity[^>]*>([\d,.-]+)<\/us-gaap:StockholdersEquity>/),
            operatingIncome: extractValue(/<us-gaap:OperatingIncomeLoss[^>]*>([\d,.-]+)<\/us-gaap:OperatingIncomeLoss>/),
            grossProfit: extractValue(/<us-gaap:GrossProfit[^>]*>([\d,.-]+)<\/us-gaap:GrossProfit>/),
            cashAndEquivalents: extractValue(/<us-gaap:CashAndCashEquivalents[^>]*>([\d,.-]+)<\/us-gaap:CashAndCashEquivalents>/),
            accountsReceivable: extractValue(/<us-gaap:AccountsReceivable[^>]*>([\d,.-]+)<\/us-gaap:AccountsReceivable>/),
            inventory: extractValue(/<us-gaap:Inventory[^>]*>([\d,.-]+)<\/us-gaap:Inventory>/),
            accountsPayable: extractValue(/<us-gaap:AccountsPayable[^>]*>([\d,.-]+)<\/us-gaap:AccountsPayable>/),
            longTermDebt: extractValue(/<us-gaap:LongTermDebt[^>]*>([\d,.-]+)<\/us-gaap:LongTermDebt>/),
            retainedEarnings: extractValue(/<us-gaap:RetainedEarnings[^>]*>([\d,.-]+)<\/us-gaap:RetainedEarnings>/),
            cashFlowOperations: extractValue(/<us-gaap:NetCashProvidedByUsedInOperatingActivities[^>]*>([\d,.-]+)<\/us-gaap:NetCashProvidedByUsedInOperatingActivities>/),
            cashFlowInvesting: extractValue(/<us-gaap:NetCashProvidedByUsedInInvestingActivities[^>]*>([\d,.-]+)<\/us-gaap:NetCashProvidedByUsedInInvestingActivities>/),
            cashFlowFinancing: extractValue(/<us-gaap:NetCashProvidedByUsedInFinancingActivities[^>]*>([\d,.-]+)<\/us-gaap:NetCashProvidedByUsedInFinancingActivities>/),
        };
    }
    async getHTMLFilingData(accessionNumber, cik) {
        // Fallback: parse HTML filing for key financial data
        // This is a simplified implementation
        logger.warn("Using HTML fallback for financial data extraction", { accessionNumber, cik });
        return {
            cik,
            accessionNumber,
            formType: "",
            filingDate: "",
            period: "",
            // Would implement HTML table parsing here
        };
    }
    parseCompanySearchXML(xmlText) {
        const companies = [];
        // Simplified XML parsing for company search results
        const companyRegex = /<company-info>(.*?)<\/company-info>/gs;
        const matches = xmlText.match(companyRegex) || [];
        for (const match of matches) {
            const cikMatch = match.match(/cik="(\d+)"/);
            const nameMatch = match.match(/name="([^"]+)"/);
            if (cikMatch && nameMatch) {
                companies.push({
                    cik: cikMatch[1],
                    name: nameMatch[1],
                });
            }
        }
        return companies;
    }
}
//# sourceMappingURL=SECEdgarClient.js.map