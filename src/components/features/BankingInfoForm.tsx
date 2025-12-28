'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, CheckCircle2, Loader2, Info, AlertTriangle, CreditCard } from 'lucide-react';

// --- BASE DE DONNÉES LOCALE (BANK_DATABASE) ---
const BANK_DATABASE: Record<string, { name: string; bic: string; color: string }> = {
    "30004": { name: "BNP PARIBAS", bic: "BNPAFRPP", color: "#16a34a" },      // Green
    "30003": { name: "SOCIETE GENERALE", bic: "SOGEFRPP", color: "#dc2626" }, // Red
    "30002": { name: "LCL", bic: "LCLFRPP", color: "#2563eb" },               // Blue
    "30066": { name: "CIC", bic: "CMCIFRPP", color: "#ea580c" },              // Orange
    "10278": { name: "CREDIT MUTUEL", bic: "CMCIFRPP", color: "#ef4444" },    // Red/Orange
    "10207": { name: "BANQUE POPULAIRE RIVES DE PARIS", bic: "BPOPFRPP", color: "#0284c7" }, // Light Blue
    "20041": { name: "LA BANQUE POSTALE", bic: "LBPFRPP", color: "#fbbf24" }, // Yellow
    "16006": { name: "FORTUNEO", bic: "FTNOFRPP", color: "#4ade80" },         // Light Green
    "10907": { name: "BOURSORAMA", bic: "BOUSFRPP", color: "#ec4899" },       // Pink
    "28233": { name: "REVOLUT", bic: "REVOFRPP", color: "#000000" },          // Black
    "19499": { name: "QONTO", bic: "QNTOFRP1", color: "#8b5cf6" },            // Purple
    "16958": { name: "QONTO", bic: "QNTOFRP1", color: "#6B4FBB" },            // Qonto (Nouveau code ?)
    "16598": { name: "SHINE", bic: "SABOROPP", color: "#f59e0b" },            // Amber
    "23605": { name: "AXA BANQUE", bic: "AXABFRPP", color: "#1d4ed8" },       // Dark Blue
    "14505": { name: "ING", bic: "INGBFRPP", color: "#f97316" },              // Orange
    "10107": { name: "BANQUE POPULAIRE", bic: "BPOPFRPP", color: "#0284c7" }  // Generic BP
};

// --- UTILS ---

/**
 * Formate l'IBAN par groupes de 4 caractères
 */
const formatIBAN = (val: string) => {
    // Retire tout ce qui n'est pas alphanumérique
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Groupe par 4
    const chunks = clean.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : clean;
};

/**
 * Calcul du Modulo 97 pour validation IBAN
 * (Déplace les 4 premiers caractères à la fin, remplace les lettres, calcule le reste)
 */
const isValidIBANFR = (ibanClean: string): boolean => {
    if (ibanClean.length !== 27) return false;
    if (!ibanClean.startsWith('FR')) return false;

    // Déplacer les 4 premiers caractères (FRkk) à la fin
    const rearranged = ibanClean.substring(4) + ibanClean.substring(0, 4);

    // Remplacer lettres par chiffres (A=10, B=11, ..., Z=35)
    let numeric = "";
    for (let char of rearranged) {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) {
            numeric += (code - 55).toString();
        } else {
            numeric += char;
        }
    }

    // Calculer mod 97 (par morceaux car le nombre est trop grand pour JS)
    let remainder = 0;
    for (let i = 0; i < numeric.length; i++) {
        const digit = parseInt(numeric[i], 10);
        remainder = (remainder * 10 + digit) % 97;
    }

    return remainder === 1;
};

interface BankingInfoFormProps {
    onChange?: (data: { iban: string; bic: string; banque: string }) => void;
    onSave?: () => void;
    initialData?: { iban: string; bic: string; banque: string };
}

export default function BankingInfoForm({ onChange, onSave, initialData }: BankingInfoFormProps) {
    const [ibanDisplay, setIbanDisplay] = useState(initialData?.iban || "");
    const [bic, setBic] = useState(initialData?.bic || "");
    const [bankName, setBankName] = useState(initialData?.banque || "");

    // États de gestion
    const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'warning' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState("");
    const [bankColor, setBankColor] = useState<string | null>(null);

    // --- Gestion changement IBAN ---
    const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const formatted = formatIBAN(val);
        setIbanDisplay(formatted);

        // Version nettoyée pour logique
        const clean = formatted.replace(/\s/g, '');

        // Reset si vidé
        if (clean.length === 0) {
            setStatus('idle');
            setStatusMessage("");
            setBankName("");
            setBic("");
            setBankColor(null);
            notifyParent(formatted, "", "");
            return;
        }

        // Si on atteint 27 caractères -> Validation
        if (clean.length === 27) {
            validateIban(clean);
        } else {
            // En cours de saisie ou trop long/court
            if (clean.length > 27) {
                // Trop long
                setStatus('error');
                setStatusMessage("❌ IBAN trop long (max 27 caractères pour FR)");
            } else {
                // En cours
                setStatus('idle');
                setStatusMessage("");
                // On garde les champs vides si incomplet, sauf si saisie manuelle précédente ?
                // Le prompt demande reset bankName + bic si invalide, mais ici c'est "incomplet".
                // On laisse tel quel pour pas gêner la saisie.
            }
        }

        notifyParent(formatted, bic, bankName);
    };

    const validateIban = (clean: string) => {
        setStatus('validating');

        // Simuler latence réseau/calcul
        setTimeout(() => {
            if (!clean.startsWith('FR')) {
                setStatus('error');
                setStatusMessage("❌ Seuls les IBAN français (FR) sont acceptés ici.");
                return;
            }

            if (!isValidIBANFR(clean)) {
                setStatus('error');
                setStatusMessage("❌ IBAN invalide - Vérifiez le numéro saisi (checksum incorrect).");
                setBankName("");
                setBic("");
                setBankColor(null);
            } else {
                // IBAN Valide -> Extraction code banque
                const bankCode = clean.substring(4, 9);
                const detected = BANK_DATABASE[bankCode];

                if (detected) {
                    // SUCCÈS : Banque trouvée
                    setStatus('success');
                    setBankName(detected.name);
                    setBic(detected.bic);
                    setBankColor(detected.color);
                    setStatusMessage(`✅ ${detected.name} détectée automatiquement !`);
                    notifyParent(formatIBAN(clean), detected.bic, detected.name);
                } else {
                    // WARNING : Banque inconnue
                    setStatus('warning');
                    setStatusMessage(`⚠️ IBAN valide (code banque: ${bankCode}). Banque inconnue, veuillez renseigner le nom et BIC manuellement.`);
                    setBankColor(null);
                    // On ne vide pas bankName/bic pour laisser l'utilisateur saisir
                }
            }
        }, 300);
    };

    // --- Autres Inputs ---
    const handleBicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); // AlphaNum Only
        setBic(val);
        notifyParent(ibanDisplay, val, bankName);
    };

    const handleBankNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setBankName(val);
        notifyParent(ibanDisplay, bic, val);
    };

    const notifyParent = (i: string, b: string, n: string) => {
        if (onChange) {
            onChange({ iban: i, bic: b, banque: n });
        }
    };

    // --- Submit ---
    const handleSubmit = () => {
        // Vérification simple champs vides
        if (!ibanDisplay || !bic || !bankName) {
            // On peut mettre un status error global
            setStatus('error');
            setStatusMessage("❌ Veuillez remplir tous les champs");
            return;
        }

        // Si tout est ok
        console.log("=== DONNÉES BANCAIRES ===");
        console.log("IBAN:", ibanDisplay.replace(/\s/g, ''));
        console.log("BIC:", bic);
        console.log("Banque:", bankName);

        setStatus('success');
        setStatusMessage("✅ Informations bancaires enregistrées avec succès !");

        if (onSave) onSave();
    };

    const getStatusAlert = () => {
        if (status === 'idle' || status === 'validating') return null;

        let variant: "default" | "destructive" | "success" | "warning" = "default";
        let Icon = Info;

        if (status === 'success') { variant = 'success'; Icon = CheckCircle2; }
        if (status === 'warning') { variant = 'warning'; Icon = AlertTriangle; }
        if (status === 'error') { variant = 'destructive'; Icon = AlertTriangle; }

        return (
            <Alert variant={variant} className="mt-4 text-white">
                <Icon className="h-4 w-4" />
                <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
        );
    };

    return (
        <div className="w-full space-y-8">
            {/* Header with Standardized Layout */}
            <div className="space-y-1 mb-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Coordonnées Bancaires</h2>
                    <span className="text-[10px] font-medium text-white/40 bg-white/5 px-2 py-1 rounded-full border border-white/5">Étape 3 sur 4</span>
                </div>
                <div className="text-sm text-muted-foreground">
                    Saisissez votre IBAN pour une détection automatique de la banque.
                </div>
            </div>

            <div className="space-y-6">

                {/* --- IBAN FIELD (HERO) --- */}
                <div className="space-y-3">
                    <Label htmlFor="iban" className="text-white/80 uppercase tracking-wider text-xs font-semibold">
                        IBAN (FR)
                    </Label>
                    <div className="relative group">
                        <Input
                            id="iban"
                            placeholder="FR76 ..."
                            value={ibanDisplay}
                            onChange={handleIbanChange}
                            maxLength={34}
                            className={`
                                h-16 text-2xl font-mono tracking-[0.15em] uppercase 
                                bg-white/5 border-white/10 text-white placeholder:text-white/10
                                focus:ring-0 focus:border-blue-500/50 transition-all rounded-xl pl-6
                                ${status === 'error' ? 'border-red-500/50 focus:border-red-500' : ''}
                                ${status === 'success' ? 'border-green-500/50 focus:border-green-500' : ''}
                            `}
                        />
                        {/* Status Icon Indicator inside input */}
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                            {status === 'validating' && <Loader2 className="h-6 w-6 animate-spin text-blue-400" />}
                            {status === 'success' && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                            {status === 'error' && <AlertTriangle className="h-6 w-6 text-red-500" />}
                        </div>
                    </div>

                    {/* Feedback Message */}
                    <div className="min-h-[20px]">
                        {statusMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                className={`text-sm flex items-center gap-2 
                                    ${status === 'error' ? 'text-red-400' :
                                        status === 'success' ? 'text-green-400' :
                                            status === 'warning' ? 'text-orange-400' : 'text-muted-foreground'}`}
                            >
                                {statusMessage}
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* --- SECONDARY FIELDS (Read-only feel if detected) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="bic" className="text-white/60">Code BIC</Label>
                        <Input
                            id="bic"
                            placeholder="XXXXXXXX"
                            value={bic}
                            onChange={handleBicChange}
                            maxLength={11}
                            className={`bg-white/5 border-white/10 text-white placeholder:text-white/10 rounded-xl h-12 font-mono uppercase transition-colors
                                ${status === 'success' ? 'opacity-80' : ''}`}
                        />
                    </div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="bankName" className="text-white/60">Nom de la Banque</Label>
                        <Input
                            id="bankName"
                            placeholder="Ma Banque"
                            value={bankName}
                            onChange={handleBankNameChange}
                            className={`bg-white/5 border-white/10 text-white placeholder:text-white/10 rounded-xl h-12 transition-colors
                                ${status === 'success' ? 'opacity-80' : ''}`}
                        />
                        {bankColor && (
                            <div
                                className="absolute right-4 top-[42px] h-3 w-3 rounded-full shadow-sm ring-1 ring-white/20"
                                style={{ backgroundColor: bankColor }}
                                title="Couleur banque"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* --- ACTION BUTTON --- */}
            <div className="pt-6">
                <Button
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white h-14 rounded-xl text-lg font-medium shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSubmit}
                    disabled={!ibanDisplay || !bic || !bankName || status === 'validating'}
                >
                    Enregistrer l&apos;IBAN
                </Button>
            </div>

        </div>
    );
}
