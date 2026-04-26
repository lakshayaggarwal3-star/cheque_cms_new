import xml.etree.ElementTree as ET
from collections import defaultdict

file_path = r"C:\Users\laksh\Downloads\PART1\Master\CHM_31122025_223711_000001.xml"

tree = ET.parse(file_path)
root = tree.getroot()

# Extract namespace
def get_namespace(tag):
    if "}" in tag:
        return tag.split("}")[0] + "}"
    return ""

ns = get_namespace(root.tag)

tag_counts = defaultdict(int)
tag_attributes = defaultdict(set)

def traverse(node):
    tag = node.tag.replace(ns, "")
    
    # Count tag occurrences
    tag_counts[tag] += 1

    # Collect attributes
    for attr in node.attrib:
        tag_attributes[tag].add(attr)

    # Traverse children
    for child in node:
        traverse(child)

traverse(root)

print("\n=== TAG SUMMARY (like tables) ===")
for tag, count in tag_counts.items():
    print(f"{tag}: {count} rows")

print("\n=== ATTRIBUTES (like columns) ===")
for tag, attrs in tag_attributes.items():
    print(f"\n{tag}:")
    for attr in attrs:
        print(f"  - {attr}")