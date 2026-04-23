import os

def replace_in_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content.replace('material-symbols-rounded', 'material-icons')
        new_content = new_content.replace('Material Symbols Rounded', 'Material Icons')
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated: {file_path}")
    except Exception as e:
        print(f"Error in {file_path}: {e}")

src_dir = r'c:\Users\laksh\OneDrive\Desktop\new  cms applaiton\scb_cms_new\CPS.Frontend\src'

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css', '.html')):
            replace_in_file(os.path.join(root, file))
