import React from 'react';
import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';
import RFQs from '../../B2BAdmin/pages/RFQs';

const RFQList = () => {
  return (
    <MobileLayout>
      <PageTransition>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <RFQs />
        </div>
      </PageTransition>
    </MobileLayout>
  );
};

export default RFQList;
