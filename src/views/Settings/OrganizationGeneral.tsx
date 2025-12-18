import React, { useEffect, useRef, useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { AlertCircle, Building2, Check, Loader2, Upload, X } from 'lucide-react';
import {
  applyBrandTheme,
  VALYNT_BRAND_PRIMARY,
  VALYNT_BRAND_SECONDARY,
} from '../../styles/brandTheme';

export const OrganizationGeneral: React.FC = () => {
  const [orgName, setOrgName] = useState('Acme Corporation');
  const [domain, setDomain] = useState('acme.com');
  const [industry, setIndustry] = useState('technology');
  const [orgSize, setOrgSize] = useState('51-200');
  const [primaryColor, setPrimaryColor] = useState(VALYNT_BRAND_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(VALYNT_BRAND_SECONDARY);
  const [logo, setLogo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateOrgName = (name: string): string | null => {
    if (!name.trim()) return 'Organization name is required';
    if (name.length < 2) return 'Name must be at least 2 characters';
    return null;
  };

  const validateDomain = (domain: string): string | null => {
    if (!domain.trim()) return 'Domain is required';
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) return 'Invalid domain format';
    return null;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, logo: 'Please upload an image file' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, logo: 'Image must be smaller than 5MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
      setIsDirty(true);
      setErrors(prev => ({ ...prev, logo: '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const nameError = validateOrgName(orgName);
    const domainError = validateDomain(domain);

    if (nameError || domainError) {
      setErrors({
        orgName: nameError || '',
        domain: domainError || '',
      });
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      applyBrandTheme({ primary: primaryColor, secondary: secondaryColor });
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    applyBrandTheme({ primary: primaryColor, secondary: secondaryColor });
    // We only want to apply the initial defaults on mount; subsequent updates
    // are driven via the save handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <SettingsSection title="Organization Identity" description="Manage your organization's basic information and branding">
        <div className="space-y-6">
          <div className="flex items-start space-x-6">
            <div>
              <div className="relative group">
                {logo ? (
                  <img src={logo} alt="Organization logo" className="w-24 h-24 rounded-lg object-cover border-2 border-border" />
                ) : (
                  <div className="w-24 h-24 bg-card rounded-lg flex items-center justify-center border-2 border-border">
                    <Building2 className="h-12 w-12 text-primary" />
                  </div>
                )}
                {logo && (
                  <button
                    onClick={() => { setLogo(null); setIsDirty(true); }}
                    className="absolute -top-2 -right-2 p-1.5 bg-error text-error-foreground rounded-full hover:bg-error/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex items-center text-sm text-primary hover:text-accent transition-colors"
              >
                <Upload className="h-4 w-4 mr-1" />
                {logo ? 'Change Logo' : 'Upload Logo'}
              </button>
              <p className="text-xs text-muted-foreground mt-1">Max 5MB (PNG, JPG, SVG)</p>
              {errors.logo && <p className="text-xs text-error mt-1">{errors.logo}</p>}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Organization Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => { setOrgName(e.target.value); setIsDirty(true); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.orgName ? 'border-error focus:ring-error' : 'border-border focus:ring-primary'
                  } bg-background text-foreground`}
                />
                {errors.orgName && <p className="text-sm text-error mt-1">{errors.orgName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Primary Domain <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => { setDomain(e.target.value); setIsDirty(true); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.domain ? 'border-error focus:ring-error' : 'border-border focus:ring-primary'
                  } bg-background text-foreground`}
                  placeholder="example.com"
                />
                {errors.domain && <p className="text-sm text-error mt-1">{errors.domain}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => { setIndustry(e.target.value); setIsDirty(true); }}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="technology">Technology</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="finance">Finance</option>
                    <option value="education">Education</option>
                    <option value="retail">Retail</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Organization Size</label>
                  <select
                    value={orgSize}
                    onChange={(e) => { setOrgSize(e.target.value); setIsDirty(true); }}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-1000">201-1000 employees</option>
                    <option value="1000+">1000+ employees</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Branding Colors" description="VALYNT colors are fixed to economic intelligence semantics.">
        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Primary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={primaryColor}
                disabled
                aria-disabled="true"
                className="w-16 h-10 border border-border rounded bg-card cursor-not-allowed opacity-60"
              />
              <input
                type="text"
                value={primaryColor}
                readOnly
                disabled
                aria-disabled="true"
                className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg font-mono text-sm opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Secondary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={secondaryColor}
                disabled
                aria-disabled="true"
                className="w-16 h-10 border border-border rounded bg-card cursor-not-allowed opacity-60"
              />
              <input
                type="text"
                value={secondaryColor}
                readOnly
                disabled
                aria-disabled="true"
                className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg font-mono text-sm opacity-60 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">Brand colors are locked to VALYNT system tokens.</p>

        <div className="mt-6 p-4 bg-card rounded-lg border border-border">
          <p className="text-sm font-medium text-foreground mb-3">Preview</p>
          <div className="flex space-x-3">
            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-accent transition-colors">
              Primary Button
            </button>
            <button className="px-4 py-2 rounded-lg bg-info text-info-foreground hover:bg-primary transition-colors">
              Secondary Button
            </button>
          </div>
        </div>
      </SettingsSection>

      {isDirty && (
        <div className="flex justify-end space-x-3 p-4 bg-card border-t border-border sticky bottom-0">
          <button
            onClick={() => setIsDirty(false)}
            disabled={saving}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-card transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};
