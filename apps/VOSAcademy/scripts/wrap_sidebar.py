#!/usr/bin/env python3
import re

pages = [
    "/home/ubuntu/vos-education-hub/client/src/pages/AITutor.tsx",
    "/home/ubuntu/vos-education-hub/client/src/pages/Certifications.tsx",
    "/home/ubuntu/vos-education-hub/client/src/pages/Resources.tsx",
    "/home/ubuntu/vos-education-hub/client/src/pages/Profile.tsx",
    "/home/ubuntu/vos-education-hub/client/src/pages/PillarOverview.tsx",
]

for page_path in pages:
    try:
        with open(page_path, 'r') as f:
            content = f.read()
        
        # Skip if already has SidebarLayout
        if 'SidebarLayout' in content:
            print(f"✓ {page_path.split('/')[-1]} already has SidebarLayout")
            continue
        
        # Add import at the top (after first import line)
        lines = content.split('\n')
        import_added = False
        for i, line in enumerate(lines):
            if line.startswith('import ') and not import_added:
                lines.insert(i + 1, 'import { SidebarLayout } from "@/components/SidebarLayout";')
                import_added = True
                break
        
        content = '\n'.join(lines)
        
        # Find the main return statement (look for "return (" followed by opening div/fragment)
        # Wrap the first child element with SidebarLayout
        pattern = r'(export\s+(?:default\s+)?function\s+\w+[^{]*\{[\s\S]*?return\s+\()(\s*<)'
        
        def add_sidebar_start(match):
            return match.group(1) + '\n    <SidebarLayout>' + match.group(2)
        
        content = re.sub(pattern, add_sidebar_start, content, count=1)
        
        # Find the closing of the return statement and add </SidebarLayout>
        # Look for the pattern: closing tag followed by );
        pattern_end = r'(\n\s*</[^>]+>)(\s*\);\s*\})'
        
        def add_sidebar_end(match):
            return match.group(1) + '\n    </SidebarLayout>' + match.group(2)
        
        # Find the last occurrence
        matches = list(re.finditer(pattern_end, content))
        if matches:
            last_match = matches[-1]
            content = content[:last_match.start()] + add_sidebar_end(last_match) + content[last_match.end():]
        
        with open(page_path, 'w') as f:
            f.write(content)
        
        print(f"✓ Updated {page_path.split('/')[-1]}")
    
    except Exception as e:
        print(f"✗ Error updating {page_path.split('/')[-1]}: {e}")

print("\nAll pages updated!")
