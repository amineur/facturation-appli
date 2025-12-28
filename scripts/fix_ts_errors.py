#!/usr/bin/env python3
"""Quick fix for security patch errors"""

import re

with open('src/app/actions.ts', 'r') as f:
    content = f.read()

# Fix: Remove duplicate toggleInvoiceLock (keep first occurrence)
pattern = r'(export async function toggleInvoiceLock.*?}\n}\n)(.*?export async function toggleInvoiceLock.*?}\n}\n)'
content = re.sub(pattern, r'\1', content, flags=re.DOTALL)

# Fix: Replace 'where: { id: id }' with proper parameter names in security blocks
# Pattern: In security blocks that use 'id' parameter but reference wrong variable
lines = content.split('\n')
fixed_lines = []
in_security_block = False
function_param = None

for i, line in enumerate(lines):
    # Detect function signature to get parameter name
    func_match = re.match(r'^export async function (\w+)\((\w+):', line)
    if func_match:
        function_param = func_match.group(2)
    
    # Detect security block start
    if '// 🔒 SECURITY' in line:
        in_security_block = True
    
    # Fix parameter references in security blocks
    if in_security_block and 'where: { id: id }' in line and function_param:
        line = line.replace('where: { id: id }', f'where: {{ id: {function_param} }}')
    
    # Security block ends at actual DB operation
    if in_security_block and ('await prisma.' in line and 'findUnique' not in line and 'findFirst' not in line):
        in_security_block = False
        function_param = None
    
    fixed_lines.append(line)

content = '\n'.join(fixed_lines)

# Fix: societeId type issues (can be null initially)
content = content.replace(
    'let societeId: string | null = null;',
    'let societeId: string | undefined = undefined;'
)

# Write back
with open('src/app/actions.ts', 'w') as f:
    f.write(content)

print("✅ Fixed TypeScript errors")
