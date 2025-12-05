/**
 * CRM Import Modal
 * 
 * Allows users to import deals from connected CRM (HubSpot/Salesforce).
 * Supports URL paste, search, and field mapping preview.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Link2,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building2,
  DollarSign,
  Calendar,
  Users,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { parseCRMUrl, getCRMProviderName, ParsedCRMUrl } from '../../utils/crmUrlParser';
import { crmFieldMapper, MappedValueCase } from '../../services/CRMFieldMapper';
import { getMCPCRMServer } from '../../mcp-crm';
import { CRMDeal, CRMContact, CRMProvider } from '../../mcp-crm/types';
import { crmOAuthService } from '../../services/CRMOAuthService';
import { logger } from '../../lib/logger';

// ============================================================================
// Types
// ============================================================================

interface CRMImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (valueCase: MappedValueCase, deal: CRMDeal) => void;
  tenantId?: string;
  userId?: string;
}

type ImportState = 'idle' | 'checking' | 'loading' | 'preview' | 'importing' | 'error';

interface CRMStatus {
  hubspot: boolean;
  salesforce: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const CRMImportModal: React.FC<CRMImportModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  tenantId,
  userId,
}) => {
  // Handle Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // State
  const [activeTab, setActiveTab] = useState<'url' | 'search'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importState, setImportState] = useState<ImportState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [crmStatus, setCrmStatus] = useState<CRMStatus>({ hubspot: false, salesforce: false });
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Deal preview state
  const [parsedUrl, setParsedUrl] = useState<ParsedCRMUrl | null>(null);
  const [deal, setDeal] = useState<CRMDeal | null>(null);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [mappedCase, setMappedCase] = useState<MappedValueCase | null>(null);

  // Search results
  const [searchResults, setSearchResults] = useState<CRMDeal[]>([]);
  const [searching, setSearching] = useState(false);

  // Check CRM connection status on mount
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const status = await crmOAuthService.getStatus(tenantId);
        setCrmStatus({
          hubspot: status.hubspot?.connected ?? false,
          salesforce: status.salesforce?.connected ?? false,
        });
      } catch (err) {
        logger.error('Failed to check CRM status', err instanceof Error ? err : undefined);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [isOpen, tenantId]);

  // Parse URL on input change
  useEffect(() => {
    if (!urlInput.trim()) {
      setParsedUrl(null);
      return;
    }
    const parsed = parseCRMUrl(urlInput);
    setParsedUrl(parsed);
  }, [urlInput]);

  // Fetch deal from URL
  const handleFetchDeal = async () => {
    if (!parsedUrl || !tenantId || !userId) {
      setError('Invalid URL or missing authentication');
      return;
    }

    // Check if we have the right CRM connected
    const isConnected = parsedUrl.provider === 'hubspot' 
      ? crmStatus.hubspot 
      : crmStatus.salesforce;

    if (!isConnected) {
      setError(`${getCRMProviderName(parsedUrl.provider)} is not connected. Please connect it in Settings.`);
      return;
    }

    setImportState('loading');
    setError(null);

    try {
      const crmServer = await getMCPCRMServer(tenantId, userId);
      
      if (!crmServer.isConnected()) {
        throw new Error('CRM server not connected');
      }

      // Fetch deal details
      const dealResult = await crmServer.executeTool('crm_get_deal_details', {
        deal_id: parsedUrl.dealId,
        include_contacts: true,
        include_activities: false,
      });

      if (!dealResult.success || !dealResult.data) {
        throw new Error(dealResult.error || 'Failed to fetch deal');
      }

      const fetchedDeal = dealResult.data as { deal: CRMDeal; contacts: CRMContact[] };
      setDeal(fetchedDeal.deal);
      setContacts(fetchedDeal.contacts || []);

      // Map to Value Case
      const mapped = crmFieldMapper.mapDealToValueCase(
        fetchedDeal.deal,
        fetchedDeal.contacts || [],
        parsedUrl.provider
      );
      setMappedCase(mapped);
      setImportState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deal');
      setImportState('error');
    }
  };

  // Search deals
  const handleSearch = async () => {
    if (!searchQuery.trim() || !tenantId || !userId) return;

    // Determine which CRM to search
    const provider: CRMProvider | null = crmStatus.hubspot 
      ? 'hubspot' 
      : crmStatus.salesforce 
        ? 'salesforce' 
        : null;

    if (!provider) {
      setError('No CRM connected. Please connect HubSpot or Salesforce in Settings.');
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const crmServer = await getMCPCRMServer(tenantId, userId);
      
      const result = await crmServer.executeTool('crm_search_deals', {
        query: searchQuery,
        limit: 10,
      });

      if (!result.success) {
        throw new Error(result.error || 'Search failed');
      }

      const searchData = result.data as { deals: CRMDeal[] };
      setSearchResults(searchData.deals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Select deal from search results
  const handleSelectDeal = async (selectedDeal: CRMDeal) => {
    if (!tenantId || !userId) return;

    setImportState('loading');
    setError(null);

    try {
      const crmServer = await getMCPCRMServer(tenantId, userId);
      
      // Fetch contacts for the deal
      const contactsResult = await crmServer.executeTool('crm_get_stakeholders', {
        deal_id: selectedDeal.id,
      });

      const fetchedContacts = contactsResult.success 
        ? (contactsResult.data as { contacts: CRMContact[] })?.contacts || []
        : [];

      setDeal(selectedDeal);
      setContacts(fetchedContacts);

      // Map to Value Case
      const mapped = crmFieldMapper.mapDealToValueCase(
        selectedDeal,
        fetchedContacts,
        selectedDeal.provider
      );
      setMappedCase(mapped);
      setImportState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deal details');
      setImportState('error');
    }
  };

  // Import the deal
  const handleImport = () => {
    if (!mappedCase || !deal) return;
    onComplete(mappedCase, deal);
  };

  // Reset state
  const resetState = useCallback(() => {
    setUrlInput('');
    setSearchQuery('');
    setImportState('idle');
    setError(null);
    setParsedUrl(null);
    setDeal(null);
    setContacts([]);
    setMappedCase(null);
    setSearchResults([]);
    setActiveTab('url');
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  const hasAnyCRM = crmStatus.hubspot || crmStatus.salesforce;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crm-import-title"
    >
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl m-4 border border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="crm-import-title" className="text-xl font-semibold text-gray-900">Import from CRM</h2>
              <p className="text-sm text-gray-400">
                {checkingStatus ? 'Checking connections...' : 
                  hasAnyCRM 
                    ? `Connected: ${[crmStatus.hubspot && 'HubSpot', crmStatus.salesforce && 'Salesforce'].filter(Boolean).join(', ')}`
                    : 'No CRM connected'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {checkingStatus ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-gray-400">Checking CRM connections...</p>
            </div>
          ) : !hasAnyCRM ? (
            <NoCRMConnected />
          ) : importState === 'preview' && mappedCase && deal ? (
            <DealPreview 
              deal={deal} 
              contacts={contacts} 
              mappedCase={mappedCase} 
            />
          ) : (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-gray-800">
                <button
                  onClick={() => setActiveTab('url')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'url'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Link2 className="w-4 h-4 inline mr-2" />
                  Paste URL
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'search'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Search className="w-4 h-4 inline mr-2" />
                  Search Deals
                </button>
              </div>

              {/* URL Input */}
              {activeTab === 'url' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Deal URL
                    </label>
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://app.hubspot.com/contacts/.../deal/..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    {parsedUrl && (
                      <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {getCRMProviderName(parsedUrl.provider)} {parsedUrl.objectType} detected
                      </div>
                    )}
                    {urlInput && !parsedUrl && (
                      <div className="mt-2 flex items-center gap-2 text-orange-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        URL not recognized. Paste a HubSpot or Salesforce deal URL.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Search Input */}
              {activeTab === 'search' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Search Deals
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Company name or deal name..."
                        className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={searching || !searchQuery.trim()}
                        className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {searching ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Search className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">
                        {searchResults.length} deals found
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleSelectDeal(result)}
                            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors text-left"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-white font-medium">{result.name}</p>
                                <p className="text-gray-400 text-sm">
                                  {result.companyName || 'No company'} • {result.stage}
                                </p>
                              </div>
                              {result.amount && (
                                <span className="text-green-400 font-medium">
                                  {crmFieldMapper.formatDealValue(result.amount, result.currency)}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Loading */}
              {importState === 'loading' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                  <p className="text-gray-400">Fetching deal details...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800 flex-shrink-0">
          {importState === 'preview' ? (
            <>
              <button
                onClick={() => {
                  setImportState('idle');
                  setDeal(null);
                  setMappedCase(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Import Deal
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm">
                {hasAnyCRM ? 'Import a deal to create a new Value Case' : 'Connect a CRM to import deals'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                {activeTab === 'url' && parsedUrl && (
                  <button
                    onClick={handleFetchDeal}
                    disabled={importState === 'loading'}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {importState === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        Fetch Deal
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

const NoCRMConnected: React.FC = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
      <Link2 className="w-8 h-8 text-gray-500" />
    </div>
    <h3 className="text-white font-medium mb-2">No CRM Connected</h3>
    <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
      Connect HubSpot or Salesforce in Settings to import deals directly into ValueCanvas.
    </p>
    <button
      onClick={() => window.location.href = '/settings/integrations'}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
    >
      <RefreshCw className="w-4 h-4" />
      Go to Settings
    </button>
  </div>
);

interface DealPreviewProps {
  deal: CRMDeal;
  contacts: CRMContact[];
  mappedCase: MappedValueCase;
}

const DealPreview: React.FC<DealPreviewProps> = ({ deal, contacts, mappedCase }) => {
  return (
    <div className="space-y-6">
      {/* Deal Info Card */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-white font-medium text-lg">{deal.name}</h3>
            <p className="text-gray-400">{deal.companyName || 'No company'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm ${
            mappedCase.stage === 'opportunity' ? 'bg-blue-500/20 text-blue-400' :
            mappedCase.stage === 'target' ? 'bg-purple-500/20 text-purple-400' :
            mappedCase.stage === 'realization' ? 'bg-green-500/20 text-green-400' :
            'bg-orange-500/20 text-orange-400'
          }`}>
            {mappedCase.stage.charAt(0).toUpperCase() + mappedCase.stage.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <div>
              <p className="text-gray-400 text-xs">Value</p>
              <p className="text-white font-medium">
                {crmFieldMapper.formatDealValue(deal.amount, deal.currency)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-gray-400 text-xs">Close Date</p>
              <p className="text-white font-medium">
                {crmFieldMapper.formatCloseDate(deal.closeDate?.toISOString())}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <div>
              <p className="text-gray-400 text-xs">CRM Stage</p>
              <p className="text-white font-medium truncate">{deal.stage}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stakeholders */}
      {contacts.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-gray-400" />
            <h4 className="text-white font-medium">Stakeholders ({contacts.length})</h4>
          </div>
          <div className="space-y-2">
            {contacts.slice(0, 5).map((contact, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                <div>
                  <p className="text-white">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="text-gray-400 text-sm">{contact.title || contact.email}</p>
                </div>
                {mappedCase.metadata.stakeholders?.[i]?.role && (
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    {mappedCase.metadata.stakeholders[i].role}
                  </span>
                )}
              </div>
            ))}
            {contacts.length > 5 && (
              <p className="text-gray-400 text-sm text-center pt-2">
                +{contacts.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mapping Preview */}
      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
        <h4 className="text-blue-400 font-medium mb-2">Value Case Preview</h4>
        <div className="text-sm space-y-1">
          <p className="text-gray-300">
            <span className="text-gray-500">Name:</span> {mappedCase.name}
          </p>
          <p className="text-gray-300">
            <span className="text-gray-500">Company:</span> {mappedCase.company}
          </p>
          <p className="text-gray-300">
            <span className="text-gray-500">Stage:</span> {mappedCase.stage}
          </p>
          <p className="text-gray-300">
            <span className="text-gray-500">Status:</span> {mappedCase.status}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CRMImportModal;
