import xml.etree.ElementTree as ET
from collections import defaultdict, Counter

file_path = r"C:\Users\laksh\Downloads\PART1\Master\CHM_31122025_223711_000001.xml"

tree = ET.parse(file_path)
root = tree.getroot()

def strip_ns(tag):
    return tag.split("}")[-1]

# Store data per tag
tag_data = defaultdict(list)

# Extract all attributes
for elem in root.iter():
    tag = strip_ns(elem.tag)
    if elem.attrib:
        tag_data[tag].append(elem.attrib)

print("\n=== UNIQUE CHECK REPORT ===\n")

def check_uniqueness(tag, records):
    print(f"\n--- {tag} ({len(records)} rows) ---")

    if not records:
        print("No data")
        return

    # Collect all attribute names
    fields = set()
    for r in records:
        fields.update(r.keys())

    for field in fields:
        values = [r.get(field) for r in records if field in r]

        counter = Counter(values)
        duplicates = [v for v, c in counter.items() if c > 1]

        if len(duplicates) == 0:
            print(f"✅ {field} → UNIQUE (good candidate for PK)")
        else:
            print(f"❌ {field} → NOT UNIQUE ({len(duplicates)} duplicates)")

            # Show sample duplicates (max 5)
            print("   Sample duplicate values:", duplicates[:5])

# Run check for all tags
for tag, records in tag_data.items():
    check_uniqueness(tag, records)