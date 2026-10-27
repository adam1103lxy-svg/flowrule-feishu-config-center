import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import type { DiscoveredChat } from '@shared/api.interface';

interface ChatPickerProps {
  chats: DiscoveredChat[];
  value: string;
  onChange: (chatId: string, chatName: string) => void;
  selectPlaceholder: string;
  manualPlaceholder: string;
}

const ChatPicker = ({
  chats,
  value,
  onChange,
  selectPlaceholder,
  manualPlaceholder,
}: ChatPickerProps) => {
  const inChats = chats.some((c: DiscoveredChat) => c.chatId === value);
  return (
    <div className="space-y-2">
      <Select
        value={inChats ? value : 'manual'}
        onValueChange={(v: string) => {
          if (v === 'manual') {
            onChange('', '');
            return;
          }
          const chat = chats.find((c: DiscoveredChat) => c.chatId === v);
          onChange(v, chat?.name ?? '');
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">手动输入群 ID</SelectItem>
          {chats.map((c: DiscoveredChat) => (
            <SelectItem key={c.chatId} value={c.chatId}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!inChats ? (
        <Input
          aria-label={selectPlaceholder}
          placeholder={manualPlaceholder}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            const chat = chats.find(
              (c: DiscoveredChat) => c.chatId === raw.trim(),
            );
            onChange(raw, chat?.name ?? '');
          }}
        />
      ) : null}
    </div>
  );
};

export default ChatPicker;
