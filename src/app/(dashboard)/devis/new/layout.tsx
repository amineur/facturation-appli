import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Nouveau devis",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
