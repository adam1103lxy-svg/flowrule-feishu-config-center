import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { cn } from '@client/src/lib/utils';

interface CodeBlockProps {
  code: string;
  label: string;
  className?: string;
}

const CodeBlock = ({ code, label, className }: CodeBlockProps) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('已复制');
    } catch {
      toast.error('复制失败，请手动选择文本复制');
    }
  };

  return (
    <div
      className={cn('relative rounded-lg border bg-muted/40', className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 whitespace-nowrap"
        aria-label={`复制${label}`}
        onClick={() => void copy()}
      >
        <Copy /> 复制
      </Button>
      <pre className="max-h-96 overflow-auto p-4 pr-24 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
