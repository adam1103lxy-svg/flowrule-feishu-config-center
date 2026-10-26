import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/src/components/ui/card';

interface SectionCardProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

const SectionCard = ({ id, title, description, children }: SectionCardProps) => (
  <Card id={id} className="scroll-mt-24">
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

export default SectionCard;
