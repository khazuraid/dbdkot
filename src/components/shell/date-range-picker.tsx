'use client';

import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { id } from 'date-fns/locale';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import 'react-day-picker/style.css';

export function DateRangePicker({
    className,
    value,
    onChange,
    placeholder = 'Pilih rentang tanggal',
}: {
    className?: string;
    value?: DateRange;
    onChange?: (range: DateRange | undefined) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = React.useState(false);

    const formattedLabel = React.useMemo(() => {
        if (!value?.from) return null;
        if (!value.to) {
            return format(value.from, 'dd MMM yyyy', { locale: id });
        }
        return `${format(value.from, 'dd MMM yyyy', { locale: id })} – ${format(value.to, 'dd MMM yyyy', { locale: id })}`;
    }, [value]);

    return (
        <div className={cn('relative inline-flex items-center', className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-8 justify-start gap-2 text-left font-normal',
                            !value && 'text-muted-foreground',
                        )}
                        aria-label="Filter rentang tanggal surveilans"
                    >
                        <CalendarIcon className="size-3.5" data-icon="inline-start" />
                        <span className="truncate">
                            {formattedLabel ?? placeholder}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                    <DayPicker
                        mode="range"
                        selected={value}
                        onSelect={(range) => {
                            onChange?.(range);
                            if (range?.from && range?.to) {
                                setOpen(false);
                            }
                        }}
                        locale={id}
                        numberOfMonths={1}
                        className="text-[13px]"
                    />
                    {value && (
                        <div className="flex items-center justify-end border-t border-[var(--border)] pt-2 mt-2">
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                    onChange?.(undefined);
                                    setOpen(false);
                                }}
                            >
                                <X className="mr-1 size-3" />
                                Reset
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}
