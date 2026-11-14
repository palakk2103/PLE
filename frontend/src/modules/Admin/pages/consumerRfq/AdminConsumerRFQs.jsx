import { useParams } from 'react-router-dom';
import { ConsumerRFQList, ConsumerRFQDetail } from '../../../../shared/components/consumerRfq/ConsumerRFQViews';

const BASE = '/ple-ops-desk/consumer-rfqs';

export const AdminConsumerRFQs = () => (
  <ConsumerRFQList
    role="admin"
    detailBase={BASE}
    title="Consumer RFQs"
    subtitle="Admin-owned RFQs are managed by you. Seller-owned RFQs are visible for monitoring only."
  />
);

export const AdminConsumerRFQDetail = () => {
  const { id } = useParams();
  return <ConsumerRFQDetail role="admin" rfqId={id} backPath={BASE} orderLink={(o) => `/ple-ops-desk/orders/${o._id}`} />;
};
