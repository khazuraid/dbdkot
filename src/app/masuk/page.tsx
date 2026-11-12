export default function MasukPage() {
    return (
        <div className="grid min-h-dvh place-items-center px-4">
            <div className="w-full max-w-[360px]">
                <div className="mb-8 flex items-center gap-2">
                    <span
                        aria-hidden
                        className="grid size-6 place-items-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground"
                    >
                        WE
                    </span>
                    <span className="text-[14px] font-medium">WALI-EPI</span>
                </div>

                <h1 className="text-[24px] font-medium tracking-tight">
                    Masuk
                </h1>
                <p className="mt-1 text-[14px] text-muted-foreground">
                    Sistem surveilans DBD. Gunakan akun yang diberikan Dinas
                    Kesehatan.
                </p>

                <form
                    className="mt-8 space-y-4"
                    action="/api/auth/sign-in/email"
                    method="post"
                >
                    <div className="space-y-1.5">
                        <label
                            htmlFor="email"
                            className="text-[13px] font-medium"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            required
                            className="h-9 w-full rounded-md border border-input bg-card px-3 text-[14px]"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label
                            htmlFor="password"
                            className="text-[13px] font-medium"
                        >
                            Kata sandi
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="h-9 w-full rounded-md border border-input bg-card px-3 text-[14px]"
                        />
                    </div>

                    <button
                        type="submit"
                        className="h-9 w-full rounded-md bg-primary text-[14px] font-medium text-primary-foreground"
                    >
                        Masuk
                    </button>
                </form>

                <p className="mt-6 text-[12px] text-muted-foreground">
                    Belum punya akun? Akun dibuat oleh administrator, bukan
                    lewat pendaftaran mandiri.
                </p>
            </div>
        </div>
    );
}
