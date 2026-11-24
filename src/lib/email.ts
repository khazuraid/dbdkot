import nodemailer from 'nodemailer';
import { inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { getPortalBranding } from './branding';
import { escapeHtml } from './security';
import { decryptSettingValue } from './security-server';

export type SmtpConfig = {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
};

const SMTP_KEYS = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM_EMAIL',
    'SMTP_FROM_NAME',
] as const;

/**
 * Retrieves the active SMTP settings from database (system_settings)
 * with graceful fallback to environment variables.
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
    const db = getDb();
    const rows = await db
        .select({ key: systemSettings.key, value: systemSettings.value })
        .from(systemSettings)
        .where(inArray(systemSettings.key, [...SMTP_KEYS]));

    const map = new Map<string, string>();
    for (const r of rows) {
        if (r.value !== null && r.value !== undefined) {
            map.set(r.key, r.value);
        }
    }

    const host =
        map.get('SMTP_HOST') || process.env.SMTP_HOST || 'smtp.sumopod.com';
    const portStr = map.get('SMTP_PORT') || process.env.SMTP_PORT || '465';
    const port = parseInt(portStr, 10) || 465;
    const secureVal = map.get('SMTP_SECURE') ?? process.env.SMTP_SECURE;
    const secure =
        secureVal !== undefined
            ? secureVal === 'true' || secureVal === '1'
            : port === 465;
    const user = map.get('SMTP_USER') || process.env.SMTP_USER || '';
    const pass =
        decryptSettingValue(map.get('SMTP_PASS')) ||
        process.env.SMTP_PASS ||
        '';
    const fromEmail =
        map.get('SMTP_FROM_EMAIL') ||
        process.env.SMTP_FROM_EMAIL ||
        user ||
        'noreply@wali-epi.id';
    const branding = await getPortalBranding();
    const fromName =
        map.get('SMTP_FROM_NAME') ||
        process.env.SMTP_FROM_NAME ||
        `${branding.title} · ${branding.institutionName}`;

    return {
        host,
        port,
        secure,
        user,
        pass,
        fromEmail,
        fromName,
    };
}

export async function createTransporter(config?: SmtpConfig) {
    const cfg = config ?? (await getSmtpConfig());
    if (!cfg.user || !cfg.pass) {
        throw new Error(
            'Kredensial SMTP belum dikonfigurasi. Lengkapi SMTP User dan Password di menu Pengaturan.',
        );
    }

    return nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: {
            user: cfg.user,
            pass: cfg.pass,
        },
        tls: {
            rejectUnauthorized: true,
        },
    });
}

export type SendEmailOptions = {
    to: string;
    subject: string;
    html: string;
    text?: string;
};

export async function sendEmail(
    options: SendEmailOptions,
    config?: SmtpConfig,
) {
    const cfg = config ?? (await getSmtpConfig());
    const transporter = await createTransporter(cfg);

    const fromAddress = cfg.fromName
        ? `"${cfg.fromName}" <${cfg.fromEmail}>`
        : cfg.fromEmail;

    return transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    });
}

/**
 * Sends a 6-digit OTP email with modern health-authority branding.
 */
export async function sendOtpEmail(
    to: string,
    otp: string,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
) {
    const branding = await getPortalBranding();
    const safeBrandTitle = escapeHtml(branding.title);
    const safeBrandTagline = escapeHtml(branding.tagline);
    const safeInstitution = escapeHtml(branding.institutionName);
    const isRegister = purpose === 'REGISTER';
    const title = isRegister
        ? 'Verifikasi Pendaftaran Akun'
        : 'Permintaan Reset Kata Sandi';
    const description = isRegister
        ? `Gunakan kode OTP berikut untuk menyelesaikan pendaftaran akun Anda di sistem ${safeBrandTitle}:`
        : 'Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Gunakan kode OTP berikut untuk melanjutkan:';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: system-ui, sans-serif; background-color: #fafafa; margin: 0; padding: 24px; color: #09090b;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="margin: 0; color: #0d9488; font-size: 22px; font-weight: 700; letter-spacing: -0.025em;">${safeBrandTitle}</h2>
      <p style="margin: 4px 0 0 0; color: #52525b; font-size: 13px;">${safeBrandTagline}</p>
    </div>

    <div style="border-top: 1px solid #f4f4f5; padding-top: 20px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #09090b;">${title}</h3>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #52525b;">${description}</p>

      <div style="background-color: #f0fdfa; border: 1px dashed #0d9488; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f766e;">${escapeHtml(otp)}</span>
      </div>

      <p style="margin: 0 0 8px 0; font-size: 12.5px; color: #52525b;">
        Kode OTP ini berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapapun demi keamanan data medis Anda.
      </p>
      <p style="margin: 0; font-size: 12.5px; color: #71717a;">
        Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini dengan aman.
      </p>
    </div>

    <div style="border-top: 1px solid #f4f4f5; margin-top: 28px; padding-top: 16px; text-align: center; font-size: 11.5px; color: #71717a;">
      &copy; ${new Date().getFullYear()} ${safeInstitution}. Hak Cipta Dilindungi.
    </div>
  </div>
</body>
</html>
    `.trim();

    return sendEmail({
        to,
        subject: `[${branding.title}] ${title} - Kode OTP: ${otp}`,
        text: `${title}\n\nKode OTP Anda: ${otp}\n\nBerlaku selama 10 menit. Jangan bagikan kepada siapapun.`,
        html,
    });
}
