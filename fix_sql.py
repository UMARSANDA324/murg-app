import re
import os

input_file = r'c:\xampp\htdocs\danzango\merged_data.sql'
output_file = r'c:\xampp\htdocs\danzango\safe_merged_data.sql'

def process_sql():
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace INSERT INTO with INSERT IGNORE INTO
    content = content.replace('INSERT INTO', 'INSERT IGNORE INTO')

    # 2. Fix stocks table
    # Column match: id, facilityID, name, buying, selling, quantity, [opening_quantity, closing_quantity, new_order, out_stocks], Bsubtotal, Ssubtotal, expiry, creation, updation, sync_status, last_sync
    
    # Old columns in merged_data.sql:
    # (`id`, `facilityID`, `name`, `buying`, `selling`, `quantity`, `Bsubtotal`, `Ssubtotal`, `expiry`, `creation`, `updation`, `sync_status`, `last_sync`)
    
    stocks_col_pattern = r'INSERT IGNORE INTO `stocks` \(`id`, `facilityID`, `name`, `buying`, `selling`, `quantity`,'
    stocks_col_replacement = r'INSERT IGNORE INTO `stocks` (`id`, `facilityID`, `name`, `buying`, `selling`, `quantity`, `opening_quantity`, `closing_quantity`, `new_order`, `out_stocks`,'
    content = content.replace(stocks_col_pattern, stocks_col_replacement)

    # Values for stocks:
    # (ID, FID, Name, B, S, Q, [0, 0, 0, 0], BS, SS, E, C, U, S, L)
    # We need to find rows that look like: (123, '...', '...', '...', '...', '...', '...', '...', ...)
    # This is tricky because of possible commas in strings. But these are SQL values.
    
    # Let's try to target only the stocks section. 
    # The stocks section starts with "Dumping data for table `stocks`" and ends with next table or end of file.
    
    parts = re.split(r'(-- Dumping data for table `stocks`|-- Table structure for table `stocks`)', content)
    if len(parts) > 2:
        for i in range(len(parts)):
            if 'INSERT IGNORE INTO `stocks` (`id`, `facilityID`, `name`, `buying`, `selling`, `quantity`, `opening_quantity`, `closing_quantity`, `new_order`, `out_stocks`,' in parts[i]:
                # This part contains the values. We need to add four '0' after the 6th value.
                # Lines look like (id, fid, name, b, s, q, bs, ss, e, c, u, s, l)
                # Regex to match values: (val1, val2, val3, val4, val5, val6, val7, ...)
                # Strategy: Replace the 6th comma with ", '0', '0', '0', '0',"
                
                rows = parts[i].split('\n')
                new_rows = []
                for row in rows:
                    if row.strip().startswith('(') and row.strip().endswith(('),', ');')):
                        # Split by comma but respect quotes
                        # Simple regex for comma-separated values in SQL
                        # This is very hard with just split. Let's use a counter for commas not inside single quotes.
                        commas_found = 0
                        new_row = ""
                        in_quote = False
                        for char in row:
                            if char == "'":
                                in_quote = not in_quote
                            if char == ',' and not in_quote:
                                commas_found += 1
                                if commas_found == 6:
                                    new_row += ", '0', '0', '0', '0'"
                            new_row += char
                        new_rows.append(new_row)
                    else:
                        new_rows.append(row)
                parts[i] = '\n'.join(new_rows)
        content = "".join(parts)

    # 3. Fix orders table
    # Column match: id, facilityID, staffID, stockID, item, price, quantity, subtotal, [item_discount], staff, payment, ...
    
    orders_col_pattern = r'INSERT IGNORE INTO `orders` \(`id`, `facilityID`, `staffID`, `stockID`, `item`, `price`, `quantity`, `subtotal`,'
    orders_col_replacement = r'INSERT IGNORE INTO `orders` (`id`, `facilityID`, `staffID`, `stockID`, `item`, `price`, `quantity`, `subtotal`, `item_discount`,'
    content = content.replace(orders_col_pattern, orders_col_replacement)

    # Target values for orders
    # Add '0' after the 8th value (after subtotal)
    parts = re.split(r'(-- Dumping data for table `orders`)', content)
    if len(parts) > 2:
        for i in range(len(parts)):
            if 'INSERT IGNORE INTO `orders` (`id`, `facilityID`, `staffID`, `stockID`, `item`, `price`, `quantity`, `subtotal`, `item_discount`,' in parts[i]:
                rows = parts[i].split('\n')
                new_rows = []
                for row in rows:
                    if row.strip().startswith('(') and row.strip().endswith(('),', ');')):
                        commas_found = 0
                        new_row = ""
                        in_quote = False
                        for char in row:
                            if char == "'":
                                in_quote = not in_quote
                            if char == ',' and not in_quote:
                                commas_found += 1
                                if commas_found == 8:
                                    new_row += ", '0'"
                            new_row += char
                        new_rows.append(new_row)
                    else:
                        new_rows.append(row)
                parts[i] = '\n'.join(new_rows)
        content = "".join(parts)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully created {output_file}")

if __name__ == "__main__":
    process_sql()
