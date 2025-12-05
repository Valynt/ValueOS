import React, { useState, useRef } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { Upload, Building2, Check, AlertCircle, Loader2, X } from 'lucide-react';

export const OrganizationGeneral: React.FC = () => {
  const [orgName, setOrgName] = useState('Acme Corporation');
  const [domain, setDomain] = useState('acme.com');
  const [industry, setIndustry] = useState('technology');
  const [orgSize, setOrgSize] = useState('51-200');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#8B5CF6');
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
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="Organization Identity" description="Manage your organization's basic information and branding">
        <div className="space-y-6">
          <div className="flex items-start space-x-6">
            <div>
              <div className="relative group">
                {logo ? (
                  <img src={logo} alt="Organization logo" className="w-24 h-24 rounded-lg object-cover border-2 border-gray-200" />
                ) : (
                  <div className="w-24 h-24 bg-blue-100 rounded-lg flex items-center justify-center border-2 border-gray-200">
                    <Building2 className="h-12 w-12 text-blue-600" />
                  </div>
                )}
                {logo && (
                  <button
                    onClick={() => { setLogo(null); setIsDirty(true); }}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Upload className="h-4 w-4 mr-1" />
                {logo ? 'Change Logo' : 'Upload Logo'}
              </button>
              <p className="text-xs text-gray-500 mt-1">Max 5MB (PNG, JPG, SVG)</p>
              {errors.logo && <p className="text-xs text-red-600 mt-1">{errors.logo}</p>}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => { setOrgName(e.target.value); setIsDirty(true); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.orgName ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {errors.orgName && <p className="text-sm text-red-600 mt-1">{errors.orgName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Domain <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => { setDomain(e.target.value); setIsDirty(true); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.domain ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="example.com"
                />
                {errors.domain && <p className="text-sm text-red-600 mt-1">{errors.domain}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => { setIndustry(e.target.value); setIsDirty(true); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Size</label>
                  <select
                    value={orgSize}
                    onChange={(e) => { setOrgSize(e.target.value); setIsDirty(true); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <SettingsSection title="Branding Colors" description="Customize your organization's color scheme">
        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => { setPrimaryColor(e.target.value); setIsDirty(true); }}
                className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => { setPrimaryColor(e.target.value); setIsDirty(true); }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => { setSecondaryColor(e.target.value); setIsDirty(true); }}
                className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => { setSecondaryColor(e.target.value); setIsDirty(true); }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
          <div className="flex space-x-3">
            <button style={{ backgroundColor: primaryColor }} className="px-4 py-2 text-white rounded-lg">
              Primary Button
            </button>
            <button style={{ backgroundColor: secondaryColor }} className="px-4 py-2 text-white rounded-lg">
              Secondary Button
            </button>
          </div>
        </div>
      </SettingsSection>

      {isDirty && (
        <div className="flex justify-end space-x-3 p-4 bg-white border-t border-gray-200 sticky bottom-0">
          <button
            onClick={() => setIsDirty(false)}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};
