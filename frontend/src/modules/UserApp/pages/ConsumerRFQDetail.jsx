import { useParams } from 'react-router-dom';
import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';
import { ConsumerRFQDetail as View } from '../../../shared/components/consumerRfq/ConsumerRFQViews';

const ConsumerRFQDetailPage = () => {
  const { id } = useParams();
  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <View role="customer" rfqId={id} backPath="/consumer-rfqs" orderLink={(o) => `/orders/${o.orderId}`} />
      </MobileLayout>
    </PageTransition>
  );
};

export default ConsumerRFQDetailPage;
