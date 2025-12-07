"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dataService } from "@/lib/data-service";
import { Client, Facture, Devis, Produit, Societe } from "@/types";

interface DataContextType {
    clients: Client[];
    products: Produit[];
    invoices: Facture[];
    quotes: Devis[];
    societe: Societe;
    societes: Societe[]; // Available societes
    user: any; // Using any to avoid circular type dependency for now, ideally 'User'
    switchSociete: (id: string) => void;
    createSociete: (nom: string) => void;
    refreshData: () => void;
    isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Produit[]>([]);
    const [invoices, setInvoices] = useState<Facture[]>([]);
    const [quotes, setQuotes] = useState<Devis[]>([]);
    const [societe, setSociete] = useState<Societe>({} as Societe);
    const [societes, setSocietes] = useState<Societe[]>([]);
    const [user, setUser] = useState<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [version, setVersion] = useState(0); // Trigger re-fetches

    useEffect(() => {
        // Initialize service on mount
        dataService.initialize();

        refreshData();
        setIsLoading(false);
    }, []);

    const refreshData = () => {
        setClients(dataService.getClients());
        setProducts(dataService.getProducts());
        setInvoices(dataService.getInvoices());
        setQuotes(dataService.getQuotes());
        setSociete(dataService.getSociete());
        setSocietes(dataService.getSocietes());
        setUser(dataService.getCurrentUser());
    };

    // Listen for version changes if we want to force updates from outside
    useEffect(() => {
        refreshData();
    }, [version]);

    const handleRefresh = () => {
        setVersion(v => v + 1);
    };

    const handleSwitchSociete = (id: string) => {
        dataService.switchSociete(id); // This triggers reload, but just in case
        handleRefresh();
    };

    const handleCreateSociete = (nom: string) => {
        const newSociete = dataService.createSociete(nom);
        handleSwitchSociete(newSociete.id); // Auto switch
    };

    return (
        <DataContext.Provider value={{
            clients,
            products,
            invoices,
            quotes,
            societe,
            societes,
            user,
            switchSociete: handleSwitchSociete,
            createSociete: handleCreateSociete,
            refreshData: handleRefresh,
            isLoading
        }}>
            {children}
        </DataContext.Provider>
    );
}

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error("useData must be used within a DataProvider");
    }
    return context;
};
