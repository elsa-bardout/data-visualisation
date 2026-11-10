import sys,json,zipfile,xml.etree.ElementTree as E
from pathlib import Path
import openpyxl
root=Path('.review-tools/story-sources')
def read(name):
 p=root/name
 if p.suffix=='.xlsx':
  w=openpyxl.load_workbook(p,read_only=True,data_only=True)
  return {s.title:[list(r) for r in s.iter_rows(max_row=min(s.max_row,1000),max_col=min(s.max_column,100),values_only=True)] for s in w}
 ns={'t':'urn:oasis:names:tc:opendocument:xmlns:table:1.0','o':'urn:oasis:names:tc:opendocument:xmlns:office:1.0'}
 x=E.fromstring(zipfile.ZipFile(p).read('content.xml'));out={}
 for t in x.findall('.//t:table',ns):
  rows=[]
  for r in t.findall('t:table-row',ns):
   row=[]
   for c in r:
    value=c.get('{'+ns['o']+'}value')
    value=float(value) if value is not None else ''.join(c.itertext()).strip()
    repeat=int(c.get('{'+ns['t']+'}number-columns-repeated','1'))
    row.extend([value]*min(repeat,150))
   while row and row[-1]=='':row.pop()
   if row:rows.append(row)
  out[t.get('{'+ns['t']+'}name')]=rows
 return out
if __name__=='__main__':
 data=read(sys.argv[1]);print(list(data))
 if len(sys.argv)>2:
  rows=data[sys.argv[2]];start=int(sys.argv[3]) if len(sys.argv)>3 else 0;end=int(sys.argv[4]) if len(sys.argv)>4 else start+35
  for i,row in enumerate(rows[start:end],start):
   if any(v is not None and v!='' for v in row):print(i,json.dumps({j:v for j,v in enumerate(row) if v is not None and v!=''},ensure_ascii=False))
