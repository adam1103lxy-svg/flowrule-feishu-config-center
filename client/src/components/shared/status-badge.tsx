import { Badge } from '@client/src/components/ui/badge';
import { cn } from '@client/src/lib/utils';
import {
  RULE_STATUSES,
  RULE_STATUS_LABELS,
  type RuleStatus,
} from '@shared/api.interface';

const STATUS_STYLES: Record<RuleStatus, string> = {
  published: 'bg-success/10 text-success border-success/30',
  draft: 'bg-warning/10 text-warning border-warning/30',
  disabled: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
};

export const RuleStatusBadge = ({ status }: { status: RuleStatus }) => (
  <Badge variant="outline" className={cn('whitespace-nowrap', STATUS_STYLES[status])}>
    {RULE_STATUS_LABELS[status]}
  </Badge>
);

export default RuleStatusBadge;
