'use client';

import { useState, useTransition } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Compass,
    Globe2,
    KeyRound,
    Layers,
    MapPin,
    Radio,
    RefreshCw,
    Save,
    Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/shell/page';
import {
    saveRegionalApiSettingsAction,
    testRegionalApiConnectionAction,
    type RegionalApiConfig,
} from './actions';
import type { SettingRow } from './settings-editor';

type Props = {
    settings: SettingRow[];
    canManage: boolean;
};

const PROVIDER_OPTIONS = [
    {
        id: 'KEMENDAGRI',
        name: 'Kemendagri RI (Kode Wilayah Administrasi Pemerintahan)',
        defaultUrl: 'https://wilayah.id/api',
    },
    {
        id: 'BPS',
        name: 'Badan Pusat Statistik (BPS / Satu Data Indonesia)',
        defaultUrl: 'https://webapi.bps.go.id/v1/api/interoperabilitas',
    },
    {
        id: 'SATU_SEHAT',
        name: 'Kemenkes SatuSehat Location & Organization API',
        defaultUrl: 'https://api-satusehat.kemkes.go.id/fhir-r4/v1/Location',
    },
    {
        id: 'CUSTOM',
        name: 'Kustom / GIS Server Kota Cirebon (GeoJSON Proxy)',
        defaultUrl: 'https://gis.cirebonkota.go.id/api/v1/wilayah',
    },
];

export function RegionalApiSettings({ settings, canManage }: Props) {
    const [isSaving, startSave] = useTransition();
    const [isTesting, startTest] = useTransition();

    // Map existing settings into helper dictionary
    const settingsMap = new Map<string, string>();
    for (const s of settings) {
        settingsMap.set(s.key, s.value);
    }

    const [provider, setProvider] = useState(
        settingsMap.get('REGIONAL_API_PROVIDER') || 'KEMENDAGRI',
    );
    const [baseUrl, setBaseUrl] = useState(
        settingsMap.get('REGIONAL_API_BASE_URL') || 'https://wilayah.id/api',
    );
    const [apiKey, setApiKey] = useState(
        settingsMap.get('REGIONAL_API_KEY') || '',
    );
    const [cityCode, setCityCode] = useState(
        settingsMap.get('REGIONAL_CODE_CITY') || '32.74',
    );
    const [autoSync, setAutoSync] = useState(
        settingsMap.get('REGIONAL_SYNC_AUTO') === 'true',
    );

    const [centerLat, setCenterLat] = useState(
        parseFloat(settingsMap.get('MAP_CENTER_LAT') || '-6.7320'),
    );
    const [centerLng, setCenterLng] = useState(
        parseFloat(settingsMap.get('MAP_CENTER_LNG') || '108.5523'),
    );
    const [defaultZoom, setDefaultZoom] = useState(
        parseInt(settingsMap.get('MAP_DEFAULT_ZOOM') || '13', 10),
    );
    const [clusterRadius, setClusterRadius] = useState(
        parseInt(
            settingsMap.get('EPIDEMIOLOGY_CLUSTER_RADIUS_METERS') || '100',
            10,
        ),
    );

    const [testResult, setTestResult] = useState<{
        ok: boolean;
        message: string;
        latency?: number;
    } | null>(null);

    const handleProviderChange = (newProvider: string) => {
        setProvider(newProvider);
        const match = PROVIDER_OPTIONS.find((p) => p.id === newProvider);
        if (match && (!baseUrl || baseUrl === 'https://wilayah.id/api')) {
            setBaseUrl(match.defaultUrl);
        }
    };

    const handleTestConnection = () => {
        if (!baseUrl) {
            toast.error('Masukkan Base URL API terlebih dahulu');
            return;
        }

        setTestResult(null);
        startTest(async () => {
            const res = await testRegionalApiConnectionAction(baseUrl);
            if (res.ok) {
                setTestResult({
                    ok: true,
                    message: res.message,
                    latency: res.latency,
                });
                toast.success('Koneksi endpoint API Wilayah berhasil terverifikasi');
            } else {
                setTestResult({
                    ok: false,
                    message: res.error,
                });
                toast.error(res.error);
            }
        });
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;

        startSave(async () => {
            const payload: RegionalApiConfig = {
                provider,
                baseUrl,
                apiKey: apiKey || undefined,
                cityCode,
                autoSync,
                centerLat,
                centerLng,
                defaultZoom,
                clusterRadiusMeters: clusterRadius,
            };

            const res = await saveRegionalApiSettingsAction(payload);
            if (res.ok) {
                toast.success('Konfigurasi API Wilayah berhasil disimpan');
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <Panel
                title="Integrasi API Wilayah Administratif"
                aside={
                    <Badge variant="outline" className="font-mono text-xs">
                        Kode Kota: {cityCode}
                    </Badge>
                }
            >
                <div className="p-5 space-y-5">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Konfigurasi endpoint API wilayah resmi untuk sinkronisasi otomatis nama
                        kecamatan, kelurahan, dan batas wilayah administratif di Kota Cirebon.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="provider-select" className="text-xs font-semibold">
                                Penyedia Data Wilayah (Provider)
                            </Label>
                            <Select
                                value={provider}
                                onValueChange={handleProviderChange}
                                disabled={!canManage}
                            >
                                <SelectTrigger id="provider-select">
                                    <SelectValue placeholder="Pilih provider API" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROVIDER_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.id} value={opt.id}>
                                            {opt.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city-code" className="text-xs font-semibold">
                                Kode Wilayah Kota (Kemendagri / BPS)
                            </Label>
                            <Input
                                id="city-code"
                                value={cityCode}
                                onChange={(e) => setCityCode(e.target.value)}
                                placeholder="32.74"
                                className="font-mono text-sm"
                                disabled={!canManage}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                32.74 adalah kode resmi Kemendagri untuk Kota Cirebon, Jawa Barat.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="base-url" className="text-xs font-semibold flex items-center justify-between">
                            <span>Base URL Endpoint API</span>
                            {testResult && (
                                <span
                                    className={`text-[11px] font-mono flex items-center gap-1 ${
                                        testResult.ok ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                >
                                    {testResult.ok ? (
                                        <CheckCircle2 className="size-3" />
                                    ) : (
                                        <AlertCircle className="size-3" />
                                    )}
                                    {testResult.latency ? `${testResult.latency}ms` : 'Gagal'}
                                </span>
                            )}
                        </Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                id="base-url"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder="https://wilayah.id/api"
                                className="font-mono text-sm flex-1"
                                disabled={!canManage}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleTestConnection}
                                disabled={isTesting || !baseUrl}
                                className="shrink-0 gap-1.5"
                            >
                                <Wifi className={`size-3.5 ${isTesting ? 'animate-pulse text-[var(--accent)]' : ''}`} />
                                {isTesting ? 'Menguji...' : 'Uji Koneksi'}
                            </Button>
                        </div>
                        {testResult && (
                            <p
                                className={`text-[11.5px] mt-1 ${
                                    testResult.ok ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                            >
                                {testResult.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="api-key" className="text-xs font-semibold">
                            Token / API Key (Opsional)
                        </Label>
                        <Input
                            id="api-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Biarkan kosong jika endpoint publik tanpa autentikasi"
                            className="font-mono text-sm"
                            disabled={!canManage}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/30 p-3.5">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-sync" className="text-xs font-semibold cursor-pointer">
                                Sinkronisasi Otomatis Batas Kelurahan
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                                Perbarui daftar kelurahan dan koordinat dari API setiap kali ada pembaruan regional.
                            </p>
                        </div>
                        <Switch
                            id="auto-sync"
                            checked={autoSync}
                            onCheckedChange={setAutoSync}
                            disabled={!canManage}
                        />
                    </div>
                </div>
            </Panel>

            <Panel title="Pusat Peta & Parameter Klaster Epidemiologi">
                <div className="p-5 space-y-5">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Koordinat titik tengah peta operasional, tingkat pembesaran (zoom) default,
                        dan batas radius lingkaran klaster transmisi DBD saat penyelidikan PE.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="center-lat" className="text-xs font-semibold">
                                Titik Tengah Lat
                            </Label>
                            <Input
                                id="center-lat"
                                type="number"
                                step="any"
                                value={centerLat}
                                onChange={(e) => setCenterLat(parseFloat(e.target.value) || 0)}
                                className="font-mono text-sm"
                                disabled={!canManage}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="center-lng" className="text-xs font-semibold">
                                Titik Tengah Lng
                            </Label>
                            <Input
                                id="center-lng"
                                type="number"
                                step="any"
                                value={centerLng}
                                onChange={(e) => setCenterLng(parseFloat(e.target.value) || 0)}
                                className="font-mono text-sm"
                                disabled={!canManage}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="default-zoom" className="text-xs font-semibold">
                                Zoom Default
                            </Label>
                            <Input
                                id="default-zoom"
                                type="number"
                                min={5}
                                max={19}
                                value={defaultZoom}
                                onChange={(e) => setDefaultZoom(parseInt(e.target.value, 10) || 13)}
                                className="font-mono text-sm"
                                disabled={!canManage}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cluster-radius" className="text-xs font-semibold">
                                Radius Klaster PE
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="cluster-radius"
                                    type="number"
                                    min={50}
                                    max={1000}
                                    step={10}
                                    value={clusterRadius}
                                    onChange={(e) =>
                                        setClusterRadius(parseInt(e.target.value, 10) || 100)
                                    }
                                    className="font-mono text-sm"
                                    disabled={!canManage}
                                />
                                <span className="text-xs text-muted-foreground font-mono">meter</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Compass className="size-4 shrink-0 text-[var(--accent)]" />
                        <span>
                            Standar Kemenkes RI: radius buffer penyelidikan epidemiologi adalah <strong>100 meter</strong> (sekitar 20 rumah di sekeliling penderita) untuk deteksi jentik dan potensi penularan Aedes aegypti.
                        </span>
                    </div>

                    {canManage && (
                        <div className="flex justify-end pt-2">
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="gap-2 bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90"
                            >
                                <Save className="size-4" />
                                {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi Wilayah'}
                            </Button>
                        </div>
                    )}
                </div>
            </Panel>
        </form>
    );
}
