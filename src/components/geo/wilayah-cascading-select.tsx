'use client';

import { useEffect, useState } from 'react';
import type {
    SumopodProvince,
    SumopodRegencyCity,
    SumopodDistrict,
    SumopodVillage,
} from '@/lib/services/sumopod';

export type WilayahSelection = {
    provinsi?: string;
    provinsiKode?: string;
    kota?: string;
    kotaKode?: string;
    kecamatan?: string;
    kecamatanKode?: string;
    kelurahan?: string;
    kelurahanKode?: string;
};

export function WilayahCascadingSelect({
    initialSelection,
    onSelect,
    disabled = false,
}: {
    initialSelection?: WilayahSelection;
    onSelect?: (selection: WilayahSelection) => void;
    disabled?: boolean;
}) {
    const [provinces, setProvinces] = useState<SumopodProvince[]>([]);
    const [cities, setCities] = useState<SumopodRegencyCity[]>([]);
    const [districts, setDistricts] = useState<SumopodDistrict[]>([]);
    const [villages, setVillages] = useState<SumopodVillage[]>([]);

    const [selectedProv, setSelectedProv] = useState<string>(initialSelection?.provinsiKode || '32');
    const [selectedKota, setSelectedKota] = useState<string>(initialSelection?.kotaKode || '3273');
    const [selectedKec, setSelectedKec] = useState<string>(initialSelection?.kecamatanKode || '');
    const [selectedKel, setSelectedKel] = useState<string>(initialSelection?.kelurahanKode || '');

    const [loadingProv, setLoadingProv] = useState(true);
    const [loadingKota, setLoadingKota] = useState(false);
    const [loadingKec, setLoadingKec] = useState(false);
    const [loadingKel, setLoadingKel] = useState(false);

    // 1. Load Provinces
    useEffect(() => {
        let ignore = false;
        fetch('/api/wilayah?level=provinsi')
            .then((r) => r.json())
            .then((res) => {
                if (!ignore && res?.data) setProvinces(res.data);
            })
            .catch(() => {})
            .finally(() => {
                if (!ignore) setLoadingProv(false);
            });
        return () => {
            ignore = true;
        };
    }, []);

    // 2. Load Cities when Province changes
    useEffect(() => {
        if (!selectedProv) return;
        let ignore = false;
        Promise.resolve().then(() => {
            if (!ignore) setLoadingKota(true);
        });
        fetch(`/api/wilayah?level=kota&provinsi=${selectedProv}`)
            .then((r) => r.json())
            .then((res) => {
                if (!ignore && res?.data) {
                    setCities(res.data);
                    if (selectedProv === '32' && !selectedKota) {
                        setSelectedKota('3273');
                    }
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!ignore) setLoadingKota(false);
            });
        return () => {
            ignore = true;
        };
    }, [selectedProv, selectedKota]);

    // 3. Load Districts when City changes
    useEffect(() => {
        if (!selectedKota) return;
        let ignore = false;
        Promise.resolve().then(() => {
            if (!ignore) setLoadingKec(true);
        });
        fetch(`/api/wilayah?level=kecamatan&kota=${selectedKota}`)
            .then((r) => r.json())
            .then((res) => {
                if (!ignore && res?.data) setDistricts(res.data);
            })
            .catch(() => {})
            .finally(() => {
                if (!ignore) setLoadingKec(false);
            });
        return () => {
            ignore = true;
        };
    }, [selectedKota]);

    // 4. Load Villages when District changes
    useEffect(() => {
        if (!selectedKec) return;
        let ignore = false;
        const kecObj = districts.find((d) => d.kode === selectedKec);
        const nameParam = kecObj ? `&kecamatanName=${encodeURIComponent(kecObj.nama)}` : '';

        Promise.resolve().then(() => {
            if (!ignore) setLoadingKel(true);
        });
        fetch(`/api/wilayah?level=kelurahan&kecamatan=${selectedKec}${nameParam}`)
            .then((r) => r.json())
            .then((res) => {
                if (!ignore && res?.data) setVillages(res.data);
            })
            .catch(() => {})
            .finally(() => {
                if (!ignore) setLoadingKel(false);
            });
        return () => {
            ignore = true;
        };
    }, [selectedKec, districts]);

    function notifyChange(provKode: string, kotaKode: string, kecKode: string, kelKode: string) {
        if (!onSelect) return;
        const pObj = provinces.find((p) => p.kode === provKode);
        const cObj = cities.find((c) => c.kode === kotaKode);
        const dObj = districts.find((d) => d.kode === kecKode);
        const vObj = villages.find((v) => v.kode === kelKode);

        onSelect({
            provinsi: pObj?.nama,
            provinsiKode: provKode,
            kota: cObj?.nama,
            kotaKode: kotaKode,
            kecamatan: dObj?.nama,
            kecamatanKode: kecKode,
            kelurahan: vObj?.nama,
            kelurahanKode: kelKode,
        });
    }

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Provinsi */}
            <div className="space-y-1">
                <label className="text-[11.5px] font-medium text-muted-foreground">Provinsi</label>
                <select
                    value={selectedProv}
                    disabled={disabled || loadingProv}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedProv(val);
                        setSelectedKota('');
                        setSelectedKec('');
                        setSelectedKel('');
                        setCities([]);
                        setDistricts([]);
                        setVillages([]);
                        notifyChange(val, '', '', '');
                    }}
                    className="block h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                >
                    <option value="">Pilih Provinsi...</option>
                    {provinces.map((p) => (
                        <option key={p.kode} value={p.kode}>
                            {p.nama}
                        </option>
                    ))}
                </select>
            </div>

            {/* Kota / Kabupaten */}
            <div className="space-y-1">
                <label className="text-[11.5px] font-medium text-muted-foreground">Kota / Kabupaten</label>
                <select
                    value={selectedKota}
                    disabled={disabled || loadingKota || !selectedProv}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedKota(val);
                        setSelectedKec('');
                        setSelectedKel('');
                        setDistricts([]);
                        setVillages([]);
                        notifyChange(selectedProv, val, '', '');
                    }}
                    className="block h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                >
                    <option value="">Pilih Kota/Kab...</option>
                    {cities.map((c) => (
                        <option key={c.kode} value={c.kode}>
                            {c.nama}
                        </option>
                    ))}
                </select>
            </div>

            {/* Kecamatan */}
            <div className="space-y-1">
                <label className="text-[11.5px] font-medium text-muted-foreground">Kecamatan</label>
                <select
                    value={selectedKec}
                    disabled={disabled || loadingKec || !selectedKota}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedKec(val);
                        setSelectedKel('');
                        setVillages([]);
                        notifyChange(selectedProv, selectedKota, val, '');
                    }}
                    className="block h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                >
                    <option value="">Pilih Kecamatan...</option>
                    {districts.map((d) => (
                        <option key={d.kode} value={d.kode}>
                            {d.nama}
                        </option>
                    ))}
                </select>
            </div>

            {/* Kelurahan / Desa */}
            <div className="space-y-1">
                <label className="text-[11.5px] font-medium text-muted-foreground">Kelurahan / Desa</label>
                <select
                    value={selectedKel}
                    disabled={disabled || loadingKel || !selectedKec}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedKel(val);
                        notifyChange(selectedProv, selectedKota, selectedKec, val);
                    }}
                    className="block h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                >
                    <option value="">Pilih Kelurahan...</option>
                    {villages.map((v) => (
                        <option key={v.kode} value={v.kode}>
                            {v.nama}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
