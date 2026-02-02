
with open('migration_output.log', 'r') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'ERROR' in line:
            print(f"Line {i+1}: {line.strip()}")
            for j in range(max(0, i-2), min(len(lines), i+3)):
                if i != j:
                    print(f"  Context {j+1}: {lines[j].strip()}")
            break # Only first error
