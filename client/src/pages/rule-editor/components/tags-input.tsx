import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';

interface TagsInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  ariaLabel: string;
  placeholder?: string;
}

const TagsInput = ({ id, value, onChange, ariaLabel, placeholder }: TagsInputProps) => {
  const [draft, setDraft] = useState('');
  const reactId = useId();
  const inputId = id ?? reactId;

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    if (value.includes(text)) {
      setDraft('');
      return;
    }
    onChange([...value, text]);
    setDraft('');
  };

  const remove = (tag: string) => {
    onChange(value.filter((t: string) => t !== tag));
  };

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5">
        {value.map((tag: string) => (
          <Badge key={tag} variant="secondary" className="max-w-full">
            <span className="truncate">{tag}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-0.5 size-4 rounded-full"
              aria-label={`移除 ${tag}`}
              onClick={() => remove(tag)}
            >
              <X className="size-3" />
            </Button>
          </Badge>
        ))}
        <Input
          id={inputId}
          aria-label={ariaLabel}
          className="h-7 min-w-[120px] flex-1 border-0 shadow-none focus-visible:ring-0"
          placeholder={value.length === 0 ? placeholder : ''}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
        />
      </div>
    </div>
  );
};

export default TagsInput;
