import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
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
    isReadOnly?: boolean;
}

const PriceInput = ({ value, onChange, onBlur, inputRef, className, disabled }: any) => {
    const [localValue, setLocalValue] = useState(value !== undefined ? value.toFixed(2).replace('.', ',') : "0,00");

    useEffect(() => {
        setLocalValue(value !== undefined ? value.toFixed(2).replace('.', ',') : "0,00");
    }, [value]);

    return (
        <input
            type="text"
            ref={inputRef}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={(e) => {
                const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                onChange(val);
                onBlur();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
            className={cn(className, disabled && "pointer-events-none opacity-80")}
            readOnly={disabled} // Use readOnly instead of disabled to preserve styles
            disabled={false} // Disable native disabled styles
        />
    );
};

export const InvoiceLineItem = ({
    field,
    index,
    showDateColumn,
    showTTCColumn,
    discountEnabled,
    discountType,
    products,
    remove,
    handleDescriptionChange,
    isReadOnly = false
}: InvoiceLineItemProps) => {
    const { register, control, setValue, watch, formState: { errors } } = useFormContext();
    const dragControls = useDragControls();
    const [open, setOpen] = useState(false);

    return (
        <Reorder.Item
            value={field}
            dragListener={!isReadOnly} // Disable drag if read only
            dragControls={dragControls}
            className="relative mb-2 list-none" // Ensure list-none for UL context
        >
            <div className={cn(
                "group grid gap-4 items-start p-2 rounded-lg hover:bg-white/5 transition-colors pl-8",
                isReadOnly && "hover:bg-transparent" // Adjust padding if no drag handle
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
                    className={cn(
                        "absolute left-2 top-3 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity touch-none",
                        isReadOnly && "invisible pointer-events-none"
                    )}
                    onPointerDown={(e) => !isReadOnly && dragControls.start(e)}
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
                                className={cn(
                                    "w-full h-9 rounded bg-white/5 border border-white/10 px-3 text-foreground text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 italic",
                                    isReadOnly && "opacity-80 pointer-events-none" // Removed border-transparent
                                )}
                                readOnly={isReadOnly}
                                disabled={false}
                            />
                        </div>
                        <div className="text-right pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                type="button"
                                onClick={() => !isReadOnly && remove(index)}
                                className={cn(
                                    "text-red-500 hover:text-red-400",
                                    isReadOnly && "invisible pointer-events-none"
                                )}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Product Line Rendering */
                    <>


                        <div className="relative">
                            <input
                                autoComplete="off"
                                {...register(`items.${index}.description`)}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                    setOpen(true);
                                    handleDescriptionChange(index, e.target.value);
                                }}
                                onClick={() => !isReadOnly && setOpen(true)}
                                onKeyDown={(e) => {
                                    if (!isReadOnly && (e.key === "ArrowDown" || e.key === "Enter")) {
                                        setOpen(true);
                                    }
                                }}
                                onBlur={() => setTimeout(() => setOpen(false), 200)}
                                placeholder="Description"
                                className={cn(
                                    "w-full h-9 rounded glass-input px-3 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 peer",
                                    (errors?.items as any)?.[index]?.description && "border-red-500 focus:border-red-500 focus:ring-red-500",
                                    isReadOnly && "opacity-80 pointer-events-none cursor-default"
                                )}
                            />
                            {(errors?.items as any)?.[index]?.description && (
                                <p className="text-xs text-red-500 mt-1 ml-1 font-medium">
                                    {((errors?.items as any)?.[index]?.description as any)?.message || "Produit manquant"}
                                </p>
                            )}
                            {/* Custom Dropdown for Products */}
                            {open && !isReadOnly && (
                                <div className="absolute top-full left-0 w-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md glass-dropdown animate-in fade-in zoom-in-95 duration-100">
                                    {products.length > 0 ? (
                                        products
                                            .filter(p => p.nom.toLowerCase().includes((watch(`items.${index}.description`) || "").toLowerCase()))
                                            .map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault(); // Prevent input blur
                                                        handleDescriptionChange(index, p.nom);
                                                        setOpen(false); // Close on selection
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors border-b border-black/5 dark:border-white/5 last:border-0"
                                                >
                                                    <div className="font-medium">{p.nom}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {p.prixUnitaire.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} - TVA {p.tva}%
                                                    </div>
                                                </button>
                                            ))
                                    ) : (
                                        <div className="p-3 text-center text-xs text-muted-foreground">
                                            Aucun produit disponible.
                                        </div>
                                    )}
                                    {products.filter(p => p.nom.toLowerCase().includes((watch(`items.${index}.description`) || "").toLowerCase())).length === 0 && products.length > 0 && (
                                        <div className="p-2 text-center text-xs text-muted-foreground">
                                            Aucun résultat.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {showDateColumn && (
                            <div className="overflow-visible">
                                <input
                                    type="date"
                                    {...register(`items.${index}.date`)}
                                    readOnly={isReadOnly}
                                    disabled={false}
                                    className={cn(
                                        "w-full bg-transparent border-b border-white/20 dark:border-white/10 text-center text-foreground focus:border-blue-500 focus:ring-0 text-sm p-1",
                                        (errors?.items as any)?.[index]?.date && "border-red-500 focus:border-red-500",
                                        isReadOnly && "opacity-80 pointer-events-none"
                                    )}
                                />
                                {(errors?.items as any)?.[index]?.date && (
                                    <p className="text-xs text-red-500 mt-1 text-center font-medium">
                                        {((errors?.items as any)?.[index]?.date as any)?.message || "Date requise"}
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <input
                                type="number"
                                lang="fr-FR"
                                step="any"
                                {...register(`items.${index}.quantite`, { valueAsNumber: true })}
                                readOnly={isReadOnly}
                                disabled={false}
                                className={cn(
                                    "w-full bg-transparent border-b border-white/20 dark:border-white/10 text-center text-foreground focus:border-blue-500 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    isReadOnly && "opacity-80 pointer-events-none"
                                )}
                            />
                        </div>

                        <div className="relative">
                            <Controller
                                control={control}
                                name={`items.${index}.prixUnitaire`}
                                render={({ field: { onChange, value, onBlur, ref } }) => (
                                    <PriceInput
                                        value={value}
                                        onChange={onChange}
                                        onBlur={onBlur}
                                        inputRef={ref}
                                        disabled={isReadOnly}
                                        className={cn(
                                            "w-full bg-transparent border-b border-white/20 dark:border-white/10 text-right text-foreground focus:border-blue-500 focus:ring-0 pr-5",
                                            isReadOnly && "opacity-80 pointer-events-none"
                                        )}
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
                                    readOnly={isReadOnly}
                                    disabled={false}
                                    className={cn(
                                        "w-full bg-transparent border-b border-white/20 dark:border-white/10 text-center text-foreground focus:border-blue-500 focus:ring-0 pr-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                        isReadOnly && "opacity-80 pointer-events-none"
                                    )}
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
                                    readOnly={isReadOnly}
                                    disabled={false}
                                    onChange={(e) => {
                                        setValue(`items.${index}.remise`, parseFloat(e.target.value) || 0);
                                        setValue(`items.${index}.remiseType`, discountType);
                                    }}
                                    className={cn(
                                        "w-full bg-transparent border-b border-white/20 dark:border-white/10 text-right text-foreground focus:border-blue-500 focus:ring-0 pr-4 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                        isReadOnly && "opacity-80 pointer-events-none"
                                    )}
                                />
                                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                                    {discountType === 'pourcentage' ? '%' : '€'}
                                </span>
                            </div>
                        )}
                        <div className="text-right pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                type="button"
                                onClick={() => !isReadOnly && remove(index)}
                                className={cn(
                                    "text-red-500 hover:text-red-400",
                                    isReadOnly && "invisible pointer-events-none"
                                )}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </>
                )
                }
            </div >
        </Reorder.Item >
    );
};
