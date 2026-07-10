import re
from xml.sax.saxutils import escape

md_path = 'docs/SecurePatrol_PRD_v2.0.md'
with open(md_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

body = []
table_rows = []


def flush_table():
    global table_rows
    if not table_rows:
        return
    body.append('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">')
    for i, row in enumerate(table_rows):
        tag = 'th' if i == 0 else 'td'
        body.append('<tr>' + ''.join(f'<{tag}>{escape(c.strip())}</{tag}>' for c in row) + '</tr>')
    body.append('</table>')
    table_rows = []


def fmt(text):
    text = escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    return text


for line in lines:
    line = line.rstrip('\n')
    if line.startswith('|') and '|' in line[1:]:
        if re.match(r'^\|[-: |]+\|$', line):
            continue
        cells = [c for c in line.split('|')[1:-1]]
        table_rows.append(cells)
        continue
    flush_table()
    if line.startswith('# '):
        body.append(f'<h1>{escape(line[2:])}</h1>')
    elif line.startswith('## '):
        body.append(f'<h2>{escape(line[3:])}</h2>')
    elif line.startswith('### '):
        body.append(f'<h3>{escape(line[4:])}</h3>')
    elif line.startswith('- [x] '):
        body.append(f'<p>☑ {fmt(line[6:])}</p>')
    elif line.startswith('- '):
        body.append(f'<p>• {fmt(line[2:])}</p>')
    elif line.strip() == '---':
        body.append('<hr/>')
    elif line.strip():
        body.append(f'<p>{fmt(line)}</p>')
    else:
        body.append('<br/>')

flush_table()

html_doc = (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SecurePatrol PRD v2.0</title>'
    '<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px;line-height:1.5}'
    'h1{color:#0a1628}h2{color:#1e3a5f;margin-top:24px}h3{color:#334155}'
    'table{margin:12px 0;font-size:11pt}th{background:#f1f5f9}</style></head><body>'
    + ''.join(body)
    + '</body></html>'
)

with open('docs/SecurePatrol_PRD_v2.0.html', 'w', encoding='utf-8') as f:
    f.write(html_doc)

print('done')
