#!/usr/bin/env python3
"""
SAFE cleanup script - Remove all console.time/timeEnd that cause conflicts
"""

import re
from pathlib import Path

ACTIONS_PATH = Path(__file__).parent.parent / "src" / "app" / "actions.ts"

def safe_cleanup():
    """Remove console.time/timeEnd safely"""
    
    if not ACTIONS_PATH.exists():
        print(f"❌ File not found: {ACTIONS_PATH}")
        return False
    
    content = ACTIONS_PATH.read_text()
    
    # Create backup with timestamp
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = ACTIONS_PATH.with_suffix(f'.ts.backup_{timestamp}')
    backup_path.write_text(content)
    print(f"✅ Backup: {backup_path.name}")
    
    # Remove console.time and console.timeEnd lines
    lines = content.split('\n')
    cleaned_lines = []
    removed_count = 0
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Check if line is ONLY a console.time/timeEnd call
        if (stripped.startswith('console.time(') or 
            stripped.startswith('console.timeEnd(')):
            print(f"   Line {i+1}: Removing {stripped[:50]}...")
            removed_count += 1
            continue
            
        cleaned_lines.append(line)
    
    # Write cleaned content
    cleaned_content = '\n'.join(cleaned_lines)
    ACTIONS_PATH.write_text(cleaned_content)
    
    print(f"\n✅ Cleanup complete!")
    print(f"   Removed {removed_count} timer calls")
    print(f"   File size: {len(content)} → {len(cleaned_content)} bytes")
    
    return True

if __name__ == "__main__":
    print("🧹 Starting SAFE cleanup...")
    print("=" * 50)
    success = safe_cleanup()
    print("=" * 50)
    
    if success:
        print("\n✅ All done! Restart your dev server:")
        print("   npm run dev")
    else:
        print("\n❌ Cleanup failed")
