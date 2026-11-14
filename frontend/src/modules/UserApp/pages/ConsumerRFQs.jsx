import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';
import { ConsumerRFQList } from '../../../shared/components/consumerRfq/ConsumerRFQViews';

const ConsumerRFQs = () => (
  <PageTransition>
    <MobileLayout showBottomNav={false} showCartBar={false}>
      <ConsumerRFQList
        role="customer"
        detailBase="/consumer-rfqs"
        title="My Quotation Requests"
        subtitle="Track quotes from PLE and sellers, negotiate prices and place orders."
      />
    </MobileLayout>
  </PageTransition>
);

export default ConsumerRFQs;
