import { useState } from 'react';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';

interface MentionsFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
}

/** 演示用 tags 输入：输入匿名成员名（如「成员A」），回车或按钮添加 */
const MentionsField = ({ value, onChange }: MentionsFieldProps) => {
  const [draft, setDraft] = useState('');

  const addMention = () => {
    const name = draft.trim();
    if (!name) return;
    if (value.includes(name)) {
      setDraft('');
      return;
    }
    onChange([...value, name]);
    setDraft('');
  };

  const removeMention = (name: string) => {
    onChange(value.filter((item: string) => item !== name));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id="mention-input"
          aria-label="添加被@人（如：成员A）"
          placeholder="输入成员名后添加，如：成员A"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addMention();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="whitespace-nowrap"
          onClick={addMention}
          aria-label="添加被@人"
        >
          添加
        </Button>
      </div>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((name: string) => (
            <Badge key={name} variant="secondary">
              @{name}
              <button
                type="button"
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label={`移除被@人 ${name}`}
                onClick={() => removeMention(name)}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">暂无被@人</p>
      )}
    </div>
  );
};

export default MentionsField;
