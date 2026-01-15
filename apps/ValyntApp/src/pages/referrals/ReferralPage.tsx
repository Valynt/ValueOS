/**
 * Referral Page
 * Main page for viewing and managing referral program
 */

import React from 'react';
import { ReferralDashboard } from '../components/referrals/ReferralDashboard';

const ReferralPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Referral Program</h1>
        <p className="text-gray-600">
          Earn rewards by inviting friends to join ValueOS. Get 1 month free for every successful referral!
        </p>
      </div>

      <ReferralDashboard />
    </div>
  );
};

export default ReferralPage;
