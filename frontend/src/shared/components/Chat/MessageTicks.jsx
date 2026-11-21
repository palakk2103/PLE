import { BsCheck2, BsCheck2All } from 'react-icons/bs';

/**
 * WhatsApp-style delivery ticks for a message YOU sent:
 *   sent       one grey tick
 *   delivered  two grey ticks
 *   seen       two blue ticks
 * tone: "onDark" for coloured bubbles, "onLight" for white / grey ones.
 */
const MessageTicks = ({ status, tone = 'onDark', className = '' }) => {
  if (!status) return null;
  const idle = tone === 'onDark' ? 'text-white/60' : 'text-gray-400';
  const seen = tone === 'onDark' ? 'text-sky-300' : 'text-sky-500';
  const common = `inline-block text-[14px] leading-none align-middle ${className}`;

  if (status === 'seen') {
    return <BsCheck2All className={`${common} ${seen}`} title="Seen" aria-label="Seen" data-testid="tick-seen" />;
  }
  if (status === 'delivered') {
    return <BsCheck2All className={`${common} ${idle}`} title="Delivered" aria-label="Delivered" data-testid="tick-delivered" />;
  }
  return <BsCheck2 className={`${common} ${idle}`} title="Sent" aria-label="Sent" data-testid="tick-sent" />;
};

export default MessageTicks;
