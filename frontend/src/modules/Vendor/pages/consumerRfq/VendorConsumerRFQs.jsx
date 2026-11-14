import { useParams } from 'react-router-dom';
import { ConsumerRFQList, ConsumerRFQDetail } from '../../../../shared/components/consumerRfq/ConsumerRFQViews';

export const VendorConsumerRFQs = () => (
  <ConsumerRFQList
    role="seller"
    detailBase="/vendor/consumer-rfqs"
    title="Customer RFQs"
    subtitle="Quotation requests from customers for your own products."
  />
);

export const VendorConsumerRFQDetail = () => {
  const { id } = useParams();
  return <ConsumerRFQDetail role="seller" rfqId={id} backPath="/vendor/consumer-rfqs" orderLink={() => '/vendor/orders'} />;
};
