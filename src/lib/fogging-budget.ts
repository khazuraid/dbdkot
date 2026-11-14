/**
 * Pure fogging 2-cycle budget calculator per `alur_website_wali_epi.md`:
 * Total Anggaran Fogging = (Bahan + Honor Petugas + Pemeliharaan) x 2 Siklus
 */

export type FoggingBudgetInput = {
    insecticideLitersPerCycle: number;
    insecticidePricePerLiter: number;
    abateKgPerCycle: number;
    abatePricePerKg: number;
    solarBensinCostPerCycle: number;
    officersCount: number;
    honorPerOfficerPerCycle: number;
    foggerMachinesCount: number;
    maintenancePerMachinePerCycle: number;
    cycles?: number;
};

export type FoggingBudgetBreakdown = {
    materialCostPerCycle: number;
    honorCostPerCycle: number;
    maintenanceCostPerCycle: number;
    costPerCycle: number;
    cycles: number;
    totalBudget: number;
};

export function calculateFoggingBudget(
    input: FoggingBudgetInput,
): FoggingBudgetBreakdown {
    const cycles = Math.max(1, Math.round(input.cycles ?? 2));
    const materialCostPerCycle = Math.round(
        Math.max(0, input.insecticideLitersPerCycle) *
            Math.max(0, input.insecticidePricePerLiter) +
            Math.max(0, input.abateKgPerCycle) *
                Math.max(0, input.abatePricePerKg) +
            Math.max(0, input.solarBensinCostPerCycle),
    );
    const honorCostPerCycle = Math.round(
        Math.max(0, input.officersCount) *
            Math.max(0, input.honorPerOfficerPerCycle),
    );
    const maintenanceCostPerCycle = Math.round(
        Math.max(0, input.foggerMachinesCount) *
            Math.max(0, input.maintenancePerMachinePerCycle),
    );
    const costPerCycle =
        materialCostPerCycle + honorCostPerCycle + maintenanceCostPerCycle;
    const totalBudget = costPerCycle * cycles;

    return {
        materialCostPerCycle,
        honorCostPerCycle,
        maintenanceCostPerCycle,
        costPerCycle,
        cycles,
        totalBudget,
    };
}
