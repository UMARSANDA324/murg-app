import os
import re

def replace_in_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        try:
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read()
        except:
            print(f"Skipping binary file: {file_path}")
            return

    original_content = content

    # 1. DANSARKi GENERAL ENTERPRISES -> MURG TEXTILE ENTERPRISES
    content = re.sub(r'DANSARKi GENERAL ENTERPRISES', 'MURG TEXTILE ENTERPRISES', content, flags=re.IGNORECASE)
    
    # 2. H ALAVES FASHION TEXTILE / H ALAVES TEXTILE -> MURG TEXTILE ENTERPRISES
    content = re.sub(r'H\.? ALAVES (FASHION )?TEXTILE', 'MURG TEXTILE ENTERPRISES', content, flags=re.IGNORECASE)
    
    # 3. Danzango -> MURG
    # We use a word boundary or specific context to avoid over-replacing if "Danzango" is part of something else, 
    # but based on the search results, it's mostly in titles or IDs.
    content = re.sub(r'Danzango', 'MURG', content, flags=re.IGNORECASE)
    
    # 4. DSK -> MURG
    content = re.sub(r'\bDSK\b', 'MURG', content)

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {file_path}")

def walk_and_replace(root_dir):
    exclude_dirs = {'.git', 'assets', 'bootstrap', 'plugins', 'cgi-bin'}
    exclude_files = {'replace_all.py', 'debug.txt'}
    
    for root, dirs, files in os.walk(root_dir):
        # Modify dirs in place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file in exclude_files:
                continue
            if file.endswith(('.php', '.html', '.js', '.css', '.sql', '.py')):
                file_path = os.path.join(root, file)
                replace_in_file(file_path)

if __name__ == "__main__":
    target_dir = r'c:\xampp\htdocs\murg'
    walk_and_replace(target_dir)
