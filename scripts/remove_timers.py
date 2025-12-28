#!/usr/bin/env python3
"""
Remove ALL console.time/timeEnd from actions.ts to fix duplicate timer errors
"""

import re
from pathlib import Path

ACTIONS_PATH = Path(__file__).parent.parent / "src" / "app" / "actions.ts"

def remove_all_timers():
    """Remove all console.time and console.timeEnd calls"""
    
    content = ACTIONS_PATH.read_text()
    
    # Backup
    backup_path = ACTIONS_PATH.with_suffix('.ts.backup2')
    backup_path.write_text(content)
    print(f"✅ Backup: {backup_path}")
    
    # Remove all console.time and console.timeEnd lines
    lines = content.split('\n')
    cleaned_lines = []
    
    for line in lines:
        # Skip lines that are only console.time or console.timeEnd
        if 'console.time' in line or 'console.timeEnd' in line:
            if line.strip().startswith('console.'):
                print(f"   Removing: {line.strip()[:60]}...")
                continue
        cleaned_lines.append(line)
    
    cleaned_content = '\n'.join(cleaned_lines)
    
    ACTIONS_PATH.write_text(cleaned_content)
    print(f"\n✅ All performance timers removed!")
    print(f"   This will fix the duplicate console.time() errors")

if __name__ == "__main__":
    print("🧹 Removing ALL performance timers...")
    remove_all_timers()
