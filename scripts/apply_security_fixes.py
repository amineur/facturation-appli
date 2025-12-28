#!/usr/bin/env python3
"""
🔒 COMPREHENSIVE SECURITY PATCHER
Automatically adds security checks to all unprotected server actions
"""

import re
import sys

def add_security_check_societe_scoped(content, func_name, param_name='societeId'):
    """Add security check for functions with societeId parameter"""
    
    security_block = f"""        // 🔒 SECURITY: Verify membership
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return {{ success: false, error: "Non authentifié" }};
        const hasAccess = await prisma.societe.findFirst({{ 
            where: {{ id: {param_name}, members: {{ some: {{ id: userRes.data.id }} }} }} 
        }});
        if (!hasAccess) return {{ success: false, error: "Accès refusé" }};

"""
    
    # Pattern: export async function funcName(...) {\n    try {
    pattern = rf'(export async function {func_name}\([^{{]+\{{\s*try \{{)'
    
    def replacement(match):
        # Check if already has security check
        next_200_chars = content[match.end():match.end()+200]
        if '🔒 SECURITY' in next_200_chars or 'getCurrentUser()' in next_200_chars:
            return match.group(0)  # Already secured
        return match.group(1) + '\n' + security_block
    
    return re.sub(pattern, replacement, content, count=1)

def add_security_check_resource_scoped(content, func_name, table_name, id_param, resource_label):
    """Add security check for functions that fetch by ID then verify societe"""
    
    security_block = f"""        // 🔒 SECURITY: Verify access
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return {{ success: false, error: "Non authentifié" }};
        
        const existing = await prisma.{table_name}.findUnique({{ 
            where: {{ id: {id_param} }},
            select: {{ societeId: true }}
        }});
        if (!existing) return {{ success: false, error: "{resource_label} introuvable" }};
        
        const hasAccess = await prisma.societe.findFirst({{ 
            where: {{ id: existing.societeId, members: {{ some: {{ id: userRes.data.id }} }} }} 
        }});
        if (!hasAccess) return {{ success: false, error: "Accès refusé" }};

"""
    
    pattern = rf'(export async function {func_name}\([^{{]+\{{\s*(?:if[^{{]+\{{\s*return[^}}]+\}}\s*)?try \{{)'
    
    def replacement(match):
        next_200_chars = content[match.end():match.end()+200]
        if '🔒 SECURITY' in next_200_chars or 'getCurrentUser()' in next_200_chars:
            return match.group(0)
        return match.group(1) + '\n' + security_block
    
    return re.sub(pattern, replacement, content, count=1)

# Read file
print("📖 Reading src/app/actions.ts...")
with open('src/app/actions.ts', 'r', encoding='utf-8') as f:
    content = f.read()

original_length = len(content)
patch_count = 0

# Define all patches
patches = [
    # Fetch operations (societeId scoped)
    ('fetchDashboardMetrics', 'societe', None, None, None),
    ('fetchDeletedInvoices', 'societe', None, None, None),
    ('fetchDeletedQuotes', 'societe', None, None, None),
    ('fetchArchivedInvoices', 'societe', None, None, None),
    ('fetchArchivedQuotes', 'societe', None, None, None),
    ('emptyTrash', 'societe', None, None, None),
    
    # CRUD operations (resource scoped)
    ('createProduct', 'resource', 'produit', 'product.societeId', 'Produit'),
    ('updateProduct', 'resource', 'produit', 'product.id', 'Produit'),
    ('createInvoice', 'resource', 'facture', 'invoice.societeId', 'Facture'),
    ('updateInvoice', 'resource', 'facture', 'invoice.id', 'Facture'),
    ('createQuote', 'resource', 'devis', 'quote.societeId', 'Devis'),
    ('updateQuote', 'resource', 'devis', 'quote.id', 'Devis'),
    
    # Status mutations (resource scoped - ID only)
    ('markInvoiceAsSent', 'resource', 'facture', 'invoiceId', 'Facture'),
    ('markInvoiceAsDownloaded', 'resource', 'facture', 'invoiceId', 'Facture'),
    ('toggleInvoiceLock', 'resource', 'facture', 'invoiceId', 'Facture'),
    ('toggleQuoteLock', 'resource', 'devis', 'quoteId', 'Devis'),
    ('convertQuoteToInvoice', 'resource', 'devis', 'quoteId', 'Devis'),
    ('updateQuoteStatus', 'resource', 'devis', 'quoteId', 'Devis'),
    
    # Archive operations (resource scoped)
    ('archiveRecord', 'resource', None, 'id', 'Enregistrement'),
    ('unarchiveRecord', 'resource', None, 'id', 'Enregistrement'),
    ('restoreRecord', 'resource', None, 'id', 'Enregistrement'),
    ('permanentlyDeleteRecord', 'resource', None, 'id', 'Enregistrement'),
]

# Apply patches
for patch in patches:
    func_name, patch_type, table, id_param, label = patch
    
    try:
        if patch_type == 'societe':
            new_content = add_security_check_societe_scoped(content, func_name)
        elif patch_type == 'resource':
            new_content = add_security_check_resource_scoped(content, func_name, table or 'TABLE', id_param, label)
        
        if len(new_content) > len(content):
            content = new_content
            patch_count += 1
            print(f"  ✅ {func_name}")
        else:
            print(f"  ⏭️  {func_name} (already secured or not found)")
    except Exception as e:
        print(f"  ❌ {func_name}: {e}")

# Write back
if patch_count > 0:
    print(f"\n💾 Writing {patch_count} patches...")
    with open('src/app/actions.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Done! Patched {patch_count} functions")
    print(f"📊 File size: {original_length} → {len(content)} (+{len(content)-original_length} bytes)")
else:
    print("\n⚠️  No patches applied (all functions already secured)")

sys.exit(0)
