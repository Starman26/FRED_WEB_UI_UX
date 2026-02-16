"""
fix_add_gemini_dropdown.py
Adds Gemini models to the LLM dropdown in Dashboard.

Run: python fix_add_gemini_dropdown.py src/pages/Dashboard.tsx
"""

import sys, os

TARGET = sys.argv[1] if len(sys.argv) > 1 else "src/pages/Dashboard.tsx"
if not os.path.exists(TARGET):
    for p in ["src/pages/Dashboard.tsx", "Dashboard.tsx"]:
        if os.path.exists(p):
            TARGET = p
            break

if not os.path.exists(TARGET):
    print(f"ERROR: Cannot find {TARGET}")
    sys.exit(1)

with open(TARGET, "r", encoding="utf-8") as f:
    content = f.read()

nl = "\r\n" if "\r\n" in content[:500] else "\n"
changes = 0

# Add Gemini to LLM options
OLD_LLM = '{ value: "gpt-4o-mini", label: "GPT-4o Mini" },'
NEW_LLM = (
    '{ value: "gpt-4o-mini", label: "GPT-4o Mini" },' + nl +
    '    { value: "gemini-2.0-flash", label: "Gemini Flash" },'
)

if "gemini" not in content and OLD_LLM in content:
    content = content.replace(OLD_LLM, NEW_LLM, 1)
    changes += 1
    print("  + Added Gemini Flash to LLM dropdown")

# Change default from claude to gemini
OLD_DEFAULT = 'useState<string>("claude-sonnet-4-20250514")'
NEW_DEFAULT = 'useState<string>("gemini-2.0-flash")'

if OLD_DEFAULT in content:
    content = content.replace(OLD_DEFAULT, NEW_DEFAULT, 1)
    changes += 1
    print("  + Changed default LLM to Gemini Flash")

if changes > 0:
    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\n  {changes} changes saved to {TARGET}")
else:
    print("\n  No changes needed")

print("Done!")
