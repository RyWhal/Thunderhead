export type MessageKey =
  | 'build.complete'
  | 'attack.sent'
  | 'resources.insufficient'
  | 'campaign.surrender'
  | 'boot.authenticating'
  | 'session.accepted'
  | 'link.pending'
  | 'link.established'
  | 'link.lost';

const catalog: Record<MessageKey, string> = {
  'build.complete': 'FAB UNIT ONLINE',
  'attack.sent': 'OUTBOUND RAID PACKET DISPATCHED',
  'resources.insufficient': 'SUPPLY SHORTFALL: {{resource}}',
  'campaign.surrender': 'ABORT CAMPAIGN',
  'boot.authenticating': 'AUTHENTICATING…',
  'session.accepted': 'SESSION TOKEN ACCEPTED',
  'link.pending': 'LINK PENDING',
  'link.established': 'LINK ESTABLISHED',
  'link.lost': 'SIGNAL LOST',
};

export function renderMessage(key: MessageKey, params: Record<string, string> = {}): string {
  return Object.entries(params).reduce(
    (msg, [param, value]) => msg.replace(`{{${param}}}`, value),
    catalog[key],
  );
}
