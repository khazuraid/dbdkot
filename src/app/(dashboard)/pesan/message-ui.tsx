'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquarePlus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    deleteConversationAction,
    sendMessageAction,
    startConversationAction,
} from '@/app/(dashboard)/actions';

export type Peer = { id: string; name: string; role: string };

/** Start a thread with one colleague; the first message is required. */
export function NewThreadButton({ peers }: { peers: Peer[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [peer, setPeer] = useState('');
    const [body, setBody] = useState('');
    const [pending, startTransition] = useTransition();

    function submit() {
        startTransition(async () => {
            const result = await startConversationAction({
                peerId: peer,
                body,
            });
            if (!result.ok) {
                toast.error(result.error ?? 'Gagal memulai percakapan.');
                return;
            }
            setOpen(false);
            setPeer('');
            setBody('');
            router.push(`/pesan/${result.id}`);
        });
    }

    return (
        <>
            <Button
                size="sm"
                disabled={peers.length === 0}
                onClick={() => setOpen(true)}
            >
                <MessageSquarePlus /> Percakapan baru
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="text-[15px]">
                            Percakapan baru
                        </DialogTitle>
                        <DialogDescription className="text-[12px]">
                            Rekan di institusi Anda. Pesan pertama langsung
                            terkirim.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5">
                        <Label htmlFor="peer" className="text-[12.5px]">
                            Kepada
                        </Label>
                        <Select value={peer} onValueChange={setPeer}>
                            <SelectTrigger id="peer" aria-label="Pilih rekan">
                                <SelectValue placeholder="Pilih rekan" />
                            </SelectTrigger>
                            <SelectContent>
                                {peers.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="body" className="text-[12.5px]">
                            Pesan
                        </Label>
                        <Textarea
                            id="body"
                            rows={3}
                            maxLength={4000}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={pending}
                            onClick={() => setOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            disabled={pending || !peer || !body.trim()}
                            onClick={submit}
                        >
                            Kirim
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Removes the thread from this user's inbox, after a confirm. */
export function DeleteThreadButton({
    id,
    onDeleted,
}: {
    id: string;
    onDeleted?: () => void;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();

    function confirm() {
        startTransition(async () => {
            const result = await deleteConversationAction(id);
            if (!result.ok) {
                toast.error(result.error ?? 'Gagal menghapus.');
                return;
            }
            toast.success('Percakapan dihapus dari daftar Anda.');
            setOpen(false);
            onDeleted?.();
            router.refresh();
        });
    }

    return (
        <>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus percakapan"
                className="text-muted-foreground hover:text-[var(--negative)]"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(true);
                }}
            >
                <Trash2 />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-[15px]">
                            Hapus percakapan?
                        </DialogTitle>
                        <DialogDescription className="text-[12px]">
                            Percakapan hilang dari daftar Anda. Pesan tetap ada
                            untuk peserta lain.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={pending}
                            onClick={() => setOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={pending}
                            onClick={confirm}
                        >
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** The message composer under a thread. Enter sends, Shift+Enter breaks. */
export function MessageComposer({
    conversationId,
}: {
    conversationId: string;
}) {
    const router = useRouter();
    const [value, setValue] = useState('');
    const [pending, startTransition] = useTransition();
    const input = useRef<HTMLTextAreaElement>(null);

    function submit() {
        const content = value.trim();
        if (!content || pending) return;
        startTransition(async () => {
            const result = await sendMessageAction({ conversationId, content });
            if (!result.ok) {
                toast.error(result.error ?? 'Gagal mengirim.');
                return;
            }
            setValue('');
            router.refresh();
            input.current?.focus();
        });
    }

    return (
        <div className="flex items-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-3">
            <Textarea
                ref={input}
                rows={1}
                value={value}
                maxLength={4000}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                    }
                }}
                placeholder="Tulis pesan… (Enter untuk kirim)"
                className="max-h-32 min-h-9 flex-1 resize-none"
            />
            <Button
                size="icon"
                aria-label="Kirim pesan"
                disabled={pending || !value.trim()}
                onClick={submit}
            >
                <Send />
            </Button>
        </div>
    );
}

export type ThreadMessage = {
    id: string;
    senderName: string;
    content: string;
    createdAt: Date;
    mine: boolean;
};

/** Messages oldest-first; own messages align right, filled with the accent. */
export function MessageList({ messages }: { messages: ThreadMessage[] }) {
    const end = useRef<HTMLDivElement>(null);

    useEffect(() => {
        end.current?.scrollIntoView({ block: 'end' });
    }, [messages.length]);

    if (messages.length === 0) {
        return (
            <p className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                Belum ada pesan.
            </p>
        );
    }

    return (
        <ul className="space-y-2.5 p-4">
            {messages.map((m) => {
                const mine = m.mine;
                return (
                    <li
                        key={m.id}
                        className={cn(
                            'flex',
                            mine ? 'justify-end' : 'justify-start',
                        )}
                    >
                        <div
                            className={cn(
                                'max-w-[78%] rounded-[var(--radius-card)] px-3 py-2',
                                mine
                                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                    : 'bg-[var(--raised)] text-foreground',
                            )}
                        >
                            {!mine && (
                                <p className="mb-0.5 text-[11px] font-semibold opacity-70">
                                    {m.senderName}
                                </p>
                            )}
                            <p className="text-[13px] whitespace-pre-wrap">
                                {m.content}
                            </p>
                        </div>
                    </li>
                );
            })}
            <div ref={end} />
        </ul>
    );
}
