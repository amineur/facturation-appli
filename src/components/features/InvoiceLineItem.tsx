import { cn } from "@/lib/utils";
import { Reorder, useDragControls } from "framer-motion";
import { Trash2, GripVertical } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { LigneItem, Produit } from "@/types";

interface InvoiceLineItemProps {
    field: LigneItem & { id: string };
    index: number;
    showDateColumn: boolean;
    showTTCColumn: boolean;
    discountEnabled: boolean;
    discountType: 'pourcentage' | 'montant';
    products: Produit[];
    remove: (index: number) => void;
    handleDescriptionChange: (index: number, value: string) => void;
}

export const InvoiceLineItem = ({
    field,
    index,
    showDateColumn,
    showTTCColumn,
    discountEnabled,
    discountType,
    products,
    remove,
    handleDescriptionChange
}: InvoiceLineItemProps) => {
    const { register, control, setValue, watch, formState: { errors } } = useFormContext();
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={field}
            dragListener={false} // Disable default drag listener to allow input interaction
            dragControls={dragControls}
            className="relative mb-2 list-none" // Ensure list-none for UL context
        >
            <div className={cn(
                "group grid gap-4 items-start p-2 rounded-lg hover:bg-white/5 transition-colors pl-8",
            )}
                style={{
                    gridTemplateColumns: [
                        "4fr", // Description
                        showDateColumn ? "1.6fr" : null,
                        "0.7fr", // Qté
                        "1.1fr", // P.U HT
                        "1.3fr", // Total HT
                        "0.8fr", // TVA
                        showTTCColumn ? "1.2fr" : null, // Total TTC
                        discountEnabled ? "1.1fr" : null, // Remise
                        "0.4fr"
                    ].filter(Boolean).join(" ")
                }}>

                {/* Drag Handle */}
                <div
                    className="absolute left-2 top-3 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity touch-none"
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                {field.type === 'texte' ? (
                    /* Text Line Rendering */
                    <div className="col-span-full grid grid-cols-[1fr_auto] gap-4">
                        <div className="space-y-2">
                            <input
                                {...register(`items.${index}.description`)}
                                placeholder="Description libre..."
                                className="w-full h-9 rounded bg-white/5 border border-white/10 px-3 text-foreground text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 italic"
                            />
                        </div>
                        <div className="text-right pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Product Line Rendering */
                    <>
                        <div className="space-y-2">
                            <input
                                list={`products - ${index} `}
                                {...register(`items.${index}.description`)}
                                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                placeholder="Description"
                                className="w-full h-9 rounded bg-white/5 border border-white/10 px-3 text-foreground text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <datalist id={`products - ${index} `}>
                                {products.map(p => (
                                    <option key={p.id} value={p.nom}>
                                        {p.prixUnitaire.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} - TVA {p.tva}%
                                    </option>
                                ))}
                            </datalist>
                        </div>

                        {showDateColumn && (
                            <div className="overflow-hidden">
                                <input
                                    type="date"
                                    {...register(`items.${index}.date`)}
                                    className="w-full bg-transparent border-b border-white/20 dark:border-white/10 text-center text-foreground focus:border-blue-500 focus:ring-0 text-sm p-1"
                                />
                            </div>
                        )}

                        <div>
                            <input
                                type="number"
                                lang="fr-FR"
                                step="any"
                                {...register(`items.${index}.quantite`, { valueAsNumber: true })}
                                className="w-full bg-transparent border-b border-white/20 dark:border-white/10 text-center text-foreground focus:border-blue-500 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>

                        <div className="relative">
                            <Controller
                                control={control}
                                name={`items.${index}.prixUnitaire`}
                                render={({ field: { onChange, value, onBlur, ref } }) => (
                                    <input
                                        type="text"
                                        ref={ref}
                                        defaultValue={value ? value.toFixed(2).replace('.', ',') : "0,00"}
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                                            e.target.value = val.toFixed(2).replace('.', ',');
                                            onChange(val);
                                            onBlur();
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        className="w-full bg-transparent border-b border-white/20 dark:border-white/10 text-right text-foreground focus:border-blue-500 focus:ring-0 pr-5"
                                    />
                                )}
                            />
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                        </div>

                        <div className="text-right font-medium text-foreground pt-2">
                            {(() => {
                                const montantAvantRemise = (watch(`items.${index}.quantite`) || 0) * (watch(`items.${index}.prixUnitaire`) || 0);
                                const remise = watch(`items.${index}.remise`) || 0;
                                const remiseType = watch(`items.${index}.remiseType`) || discountType;
                                let montantApresRemise = montantAvantRemise;
                                if (remise > 0) {
                                    if (remiseType === 'montant') {
                                        montantApresRemise = Math.max(0, montantAvantRemise - remise);
                                    } else {
                                        montantApresRemise = montantAvantRemise * (1 - remise / 100);
                                    }
                                }
                                return montantApresRemise.toFixed(2);
                            })()} €
                        </div>

                        <div className="flex items-center justify-center pt-1">
                            <div className="relative w-16">
                                <input
                                    type="number"
                                    step="0.1"
                                    {...register(`items.${index}.tva`, { valueAsNumber: true })}
                                    className="w-full bg-transparent border-b border-white/20 dark:border-white/10 text-center text-foreground focus:border-blue-500 focus:ring-0 pr-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                            </div>
                        </div>

                        {showTTCColumn && (
                            <div className="text-right text-sm text-foreground pt-2">
                                {(() => {
                                    const prixU = watch(`items.${index}.prixUnitaire`) || 0;
                                    const tva = watch(`items.${index}.tva`) || 0;
                                    // Normally TTC is (TotalHT * (1 + TVA)).
                                    // But user put Total TTC BEFORE Remise in the list? No, after.
                                    // Wait, the previous logic calculated unit TTC: prixU * (1 + tva).
                                    // I should check if they want Line Total TTC or Unit TTC. Previously it was Unit TTC I think?
                                    // "Total TTC" suggests Line Total. But let's stick to what it was: (ttc).toFixed(2).
                                    // Actually, line 136 was `const ttc = prixU * (1 + tva / 100);`. That is Unit TTC.
                                    // "Total TTC" column header suggests Line Total.
                                    // Maybe calculate line total TTC?
                                    // The previous code: `const ttc = prixU * (1 + tva / 100);`
                                    // Let's stick to previous logical implementation for now but reorder it.
                                    const ttc = prixU * (1 + tva / 100);
                                    return (ttc).toFixed(2);
                                })()} €
                            </div>
                        )}

                        {discountEnabled && (
                            <div className="col-span-1 overflow-visible relative">
                                <input
                                    type="number"
                                    lang="fr-FR"
                                    step="0.01"
                                    min="0"
                                    max={discountType === 'pourcentage' ? "100" : undefined}
                                    placeholder="0"
                                    {...register(`items.${index}.remise`, { valueAsNumber: true })}
                                    onChange={(e) => {
                                        setValue(`items.${index}.remise`, parseFloat(e.target.value) || 0);
                                        setValue(`items.${index}.remiseType`, discountType);
                                    }}
                                    className="w-full bg-transparent border-b border-white/20 dark:border-white/10 text-right text-foreground focus:border-blue-500 focus:ring-0 pr-4 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                                    {discountType === 'pourcentage' ? '%' : '€'}
                                </span>
                            </div>
                        )}
                        <div className="text-right pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Reorder.Item>
    );
};
