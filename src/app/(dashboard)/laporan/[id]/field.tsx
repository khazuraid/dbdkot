export function Field({
    label,
    value,
    numeric,
    wide,
}: {
    label: string;
    value: string;
    numeric?: boolean;
    wide?: boolean;
}) {
    return (
        <div className={wide ? 'sm:col-span-2' : undefined}>
            <dt className="text-[12px] text-muted-foreground">{label}</dt>
            <dd
                data-numeric={numeric ? true : undefined}
                className="mt-0.5 text-[14px]"
            >
                {value}
            </dd>
        </div>
    );
}
