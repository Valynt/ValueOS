import React, { useState, useRef } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { User, Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react';

interface ProfileData {
  fullName: string;
  displayName: string;
  email: string;
  jobTitle: string;
  phone: string;
  avatarUrl: string | null;
}

export const UserProfile: React.FC = () => {
  const [formData, setFormData] = useState<ProfileData>({
    fullName: 'John Doe',
    displayName: 'johndoe',
    email: 'john@example.com',
    jobTitle: 'Product Manager',
    phone: '+1 (555) 123-4567',
    avatarUrl: null,
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateField = (name: keyof ProfileData, value: string): string | null => {
    switch (name) {
      case 'fullName':
        if (!value.trim()) return 'Name is required';
        if (value.length < 2) return 'Name must be at least 2 characters';
        return null;

      case 'displayName':
        if (!value.trim()) return 'Display name is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return 'Display name can only contain letters, numbers, hyphens, and underscores';
        }
        if (value.length < 3) return 'Display name must be at least 3 characters';
        return null;

      case 'phone':
        if (value && !/^\+?[\d\s()-]+$/.test(value)) {
          return 'Please enter a valid phone number';
        }
        return null;

      case 'jobTitle':
        if (value && value.length > 100) return 'Job title is too long';
        return null;

      default:
        return null;
    }
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveSuccess(false);

    const error = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: error || undefined,
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatarUrl: 'Please upload an image file' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatarUrl: 'Image must be smaller than 5MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
      setIsDirty(true);
      setSaveSuccess(false);
      setErrors(prev => ({ ...prev, avatarUrl: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setFormData(prev => ({ ...prev, avatarUrl: null }));
    setIsDirty(true);
    setSaveSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    setFormData({
      fullName: 'John Doe',
      displayName: 'johndoe',
      email: 'john@example.com',
      jobTitle: 'Product Manager',
      phone: '+1 (555) 123-4567',
      avatarUrl: null,
    });
    setAvatarPreview(null);
    setErrors({});
    setIsDirty(false);
    setSaveSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const newErrors: Partial<Record<keyof ProfileData, string>> = {};
    (Object.keys(formData) as Array<keyof ProfileData>).forEach(key => {
      const error = validateField(key, formData[key] as string);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setErrors({ fullName: 'Failed to save profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = Object.values(errors).some(error => error);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Profile Information"
        description="Update your personal details and how others see you"
        actions={
          saveSuccess && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              <span>Saved successfully</span>
            </div>
          )
        }
      >
        <div className="space-y-6">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              <div className="relative group">
                {avatarPreview || formData.avatarUrl ? (
                  <img
                    src={avatarPreview || formData.avatarUrl || ''}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center border-2 border-gray-200">
                    <User className="h-12 w-12 text-blue-600" />
                  </div>
                )}
                {(avatarPreview || formData.avatarUrl) && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    aria-label="Remove avatar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                onClick={handleAvatarClick}
                className="mt-3 flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Upload className="h-4 w-4 mr-1" />
                {avatarPreview || formData.avatarUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
              <p className="text-xs text-gray-500 mt-1">Max 5MB (JPG, PNG, GIF)</p>
              {errors.avatarUrl && (
                <p className="text-xs text-red-600 mt-1 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.avatarUrl}
                </p>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.fullName
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter your full name"
                />
                {errors.fullName && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">@</span>
                  <input
                    id="displayName"
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => handleChange('displayName', e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      errors.displayName
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="username"
                  />
                </div>
                {errors.displayName && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.displayName}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">This is how others will see you</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed. Contact support if needed.</p>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.phone
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="+1 (555) 123-4567"
                />
                {errors.phone && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <input
                  id="jobTitle"
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => handleChange('jobTitle', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.jobTitle
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="e.g., Product Manager"
                />
                {errors.jobTitle && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.jobTitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {isDirty && (
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || hasErrors}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};
