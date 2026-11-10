from pathlib import Path
from copy import deepcopy
import re,json,hashlib,zipfile
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).parent
REFERENCE=Path(r'C:/Users/GuillaumePelletier/OneDrive - DotVision/Microsoft Teams Chat Files/Terrain 3D - chapitre coordonée.docx')
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest()=='740d6778dc0c89957397bd2da80710091afd1ce881777448d06463eb0594bd3c'
FINAL=ROOT/'Projection cubique des terrains planetaires.docx'
doc=Document(REFERENCE)
body=doc.element.body
for child in list(body):
    if child.tag!=qn('w:sectPr'):body.remove(child)
for rid,rel in list(doc.part.rels.items()):
    if any(x in rel.reltype for x in ['/image','/hyperlink']):doc.part.drop_rel(rid)
for sec in doc.sections:
    sec.page_width=Cm(21);sec.page_height=Cm(29.7)
    sec.left_margin=sec.right_margin=Cm(1.727)
    sec.top_margin=sec.bottom_margin=Cm(2.54)
    for part in [sec.header,sec.footer]:
        for p in part.paragraphs:p.clear()
normal=doc.styles['Normal'];normal.font.name='Calibri';normal.font.size=Pt(11)
normal.font.color.rgb=RGBColor(0,0,0)
normal.paragraph_format.line_spacing=1.2;normal.paragraph_format.space_after=Pt(7)
normal.paragraph_format.widow_control=True;normal.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
for name,size in [('Title',28),('Subtitle',14),('Heading 1',16),('Heading 2',13),('Heading 3',12),('Caption',9)]:
    if name not in doc.styles:
        created=doc.styles.add_style(name,WD_STYLE_TYPE.PARAGRAPH);created.base_style=normal
    style=doc.styles[name];style.font.name='Calibri';style.font.size=Pt(size);style.font.color.rgb=RGBColor(0,0,0)
    for color in style.element.xpath('.//w:color'):
        for attr in ['themeColor','themeTint','themeShade']:color.attrib.pop(qn('w:'+attr),None)
    for border in style.element.xpath('.//w:pBdr'):border.getparent().remove(border)
    style.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.LEFT
    style.paragraph_format.line_spacing=1.1
    style.paragraph_format.space_before=Pt(16 if name.startswith('Heading') else 0)
    style.paragraph_format.space_after=Pt(8)
    if name.startswith('Heading'):style.paragraph_format.keep_with_next=True
doc.styles['Title'].paragraph_format.space_after=Pt(16)
doc.styles['Caption'].font.italic=True
doc.styles['Caption'].paragraph_format.space_after=Pt(12)
contents_style=doc.styles.add_style('Contents Heading',WD_STYLE_TYPE.PARAGRAPH)
contents_style.base_style=doc.styles['Heading 1']
outline=OxmlElement('w:outlineLvl');outline.set(qn('w:val'),'9');contents_style.element.get_or_add_pPr().append(outline)
code_style=doc.styles['Code'];code_style.font.name='Consolas';code_style.font.size=Pt(8.5);code_style.font.italic=False;code_style.font.color.rgb=RGBColor(255,255,255)
code_style.paragraph_format.line_spacing=1.0;code_style.paragraph_format.space_after=Pt(0);code_style.paragraph_format.space_before=Pt(0)
code_style.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.LEFT
code_style.paragraph_format.left_indent=Cm(.25);code_style.paragraph_format.right_indent=Cm(.25)
for lang in doc.styles.element.xpath('.//w:lang'):lang.set(qn('w:val'),'fr-FR')
# Source-inspired styles are retained, but no original body text or images survive.
doc.core_properties.title='La projection cubique des terrains planétaires'
doc.core_properties.subject='Terrain 3D, régions polaires et données NASA Trek'
doc.core_properties.author='';doc.core_properties.last_modified_by=''
doc.core_properties.comments='';doc.core_properties.keywords='cube;terrain;NASA Trek;LOLA;Shackleton'
settings=doc.settings.element
for node in settings.xpath('./w:trackRevisions'):settings.remove(node)
update=OxmlElement('w:updateFields');update.set(qn('w:val'),'true');settings.append(update)

def mr(text):
    r=OxmlElement('m:r');t=OxmlElement('m:t');t.text=text;t.set(qn('xml:space'),'preserve');r.append(t);return r
def content(node,value):
    for item in value if isinstance(value,list) else [value]:node.append(mr(item) if isinstance(item,str) else deepcopy(item))
    return node
def frac(a,b):
    f=OxmlElement('m:f');content0=OxmlElement('m:num');content(content0,a);f.append(content0);content0=OxmlElement('m:den');content(content0,b);f.append(content0);return f
def sup(base,power):
    s=OxmlElement('m:sSup');s.append(content(OxmlElement('m:e'),base));s.append(content(OxmlElement('m:sup'),power));return s
def sub(base,index):
    s=OxmlElement('m:sSub');s.append(content(OxmlElement('m:e'),base));s.append(content(OxmlElement('m:sub'),index));return s
def sqrt(value):
    r=OxmlElement('m:rad');pr=OxmlElement('m:radPr');hide=OxmlElement('m:degHide');hide.set(qn('m:val'),'1');pr.append(hide);r.append(pr);r.append(OxmlElement('m:deg'));r.append(content(OxmlElement('m:e'),value));return r
def equation(items):
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(5);p.paragraph_format.space_after=Pt(10);p.paragraph_format.keep_together=True;p.paragraph_format.line_spacing=None
    mp=OxmlElement('m:oMathPara');m=OxmlElement('m:oMath');content(m,items);mp.append(m);p._p.append(mp)
E={
'longitude':[['ℓ(φ) ≈ R cos(φ) Δλ']],
'mercator':[['y = R ln tan(',frac('π','4'),' + ',frac('φ','2'),')']],
'radius':[[sub('r','ref'),'(d) = ',frac('1',sqrt([frac(sup(sub('d','x'),'2'),sup('a','2')),' + ',frac(sup(sub('d','y'),'2'),sup('b','2')),' + ',frac(sup(sub('d','z'),'2'),sup('c','2'))]))]],
'position':[['P = (',sub('r','ref'),'(d) + h) d']],
'normal':[['n = normalize(',frac(sub('p','x'),sup('a','2')),', ',frac(sub('p','y'),sup('b','2')),', ',frac(sub('p','z'),sup('c','2')),')']],
'mapping':[['α = ',frac('π','4'),'(2u − 1)     β = ',frac('π','4'),'(2v − 1)'],['d = normalize(C + tan(α) U + tan(β) V)']],
'inverse':[['u = ',frac('1','2'),' + ',frac('2','π'),' atan(',frac('d · U','d · C'),')'],['v = ',frac('1','2'),' + ',frac('2','π'),' atan(',frac('d · V','d · C'),')']],
'address':[['n = ',sup('2','lod'),'     x = min(n − 1, ⌊un⌋)'],['y = min(n − 1, ⌊vn⌋)']],
'lattice':[['u = ',frac(['x + ',frac('i','N')],sup('2','lod')),'     v = ',frac(['y + ',frac('j','N')],sup('2','lod'))]],
'geographic':[['λ = atan2(',sub('d','y'),', ',sub('d','x'),')'],['φ = atan2(',sub('d','z'),', ',sqrt([sup(sub('d','x'),'2'),' + ',sup(sub('d','y'),'2')]),')']],
'polar':[[sub('x','sud'),' = ',frac(['2R ',sub('d','y')],['1 − ',sub('d','z')]),'     ',sub('y','sud'),' = ',frac(['2R ',sub('d','x')],['1 − ',sub('d','z')])]],
'pixel':[[sub('p','x'),' = ',frac(['x − ',sub('o','x')],'s'),' − 0,5'],[sub('p','y'),' = ',frac([sub('o','y'),' − y'],'s'),' − 0,5']],
'spacing':[[sub('s','L'),' ≈ ',frac('πR',['2N ',sup('2','L')])]],
'rebase':[[sub('h','cible'),' = ',sub('h','source'),' + ',sub('R','source'),' − ',sub('r','ref'),'(d)']],
'terrarium':[['q = round(256(h + 32768))'],['h = 256R + G + ',frac('B','256'),' − 32768']],
'blend':[['h = (1 − w) ',sub('h','global'),' + w ',sub('h','polaire')],['w = 3',sup('t','2'),' − 2',sup('t','3'),'     t = clamp(',frac(['|φ| − ',sub('φ','0')],[sub('φ','1'),' − ',sub('φ','0')]),', 0, 1)']],
'sse':[[sub('f','y'),' = ',frac('H',['2 tan(',frac(sub('θ','v'),'2'),')']),'     SSE ≈ ',frac(['e ',sub('f','y')],'D')]],
'count':[[sub('T','L'),' = 6 · ',sup('4','L'),'     ',sub('P','L'),' = 2(',sup('4',['L + 1']),' − 1)']]
}

def hyperlink(paragraph,label,url):
    rid=paragraph.part.relate_to(url,'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',is_external=True)
    h=OxmlElement('w:hyperlink');h.set(qn('r:id'),rid);r=OxmlElement('w:r');pr=OxmlElement('w:rPr');c=OxmlElement('w:color');c.set(qn('w:val'),'245E87');pr.append(c);r.append(pr);t=OxmlElement('w:t');t.text=label;r.append(t);h.append(r);paragraph._p.append(h)
def add_text(text,style=None):
    p=doc.add_paragraph(style=style)
    # Actual URLs are linked with short labels, avoiding unbreakable page-wide paths.
    at=0
    for i,match in enumerate(re.finditer(r'https?://[^\s]+',text)):
        p.add_run(text[at:match.start()]);url=match.group().rstrip('.');hyperlink(p,'Consulter la source' if i==0 else 'Autre référence',url);at=match.end()
    p.add_run(text[at:]);return p
def table(rows,widths=None):
    t=doc.add_table(rows=1,cols=len(rows[0]));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    total=17.546; widths=widths or [total/len(rows[0])]*len(rows[0])
    for c,w in zip(t.columns,widths):c.width=Cm(w)
    borders=OxmlElement('w:tblBorders')
    for edge in ['top','left','bottom','right','insideH','insideV']:
        n=OxmlElement('w:'+edge);n.set(qn('w:val'),'single');n.set(qn('w:sz'),'4');n.set(qn('w:color'),'D9D9D9');borders.append(n)
    t._tbl.tblPr.append(borders)
    for ri,row in enumerate(rows):
        cells=t.rows[0].cells if ri==0 else t.add_row().cells
        trpr=cells[0]._tc.getparent().get_or_add_trPr()
        cant=OxmlElement('w:cantSplit');trpr.append(cant)
        if ri==0:trpr.append(OxmlElement('w:tblHeader'))
        for ci,(cell,text) in enumerate(zip(cells,row)):
            cell.width=Cm(widths[ci]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr=cell._tc.get_or_add_tcPr();margins=OxmlElement('w:tcMar')
            for edge in ['top','left','bottom','right']:
                n=OxmlElement('w:'+edge);n.set(qn('w:w'),'90');n.set(qn('w:type'),'dxa');margins.append(n)
            tcpr.append(margins);shd=OxmlElement('w:shd');shd.set(qn('w:fill'),'245E87' if ri==0 else ('F0F4F7' if ri%2==0 else 'FFFFFF'));tcpr.append(shd)
            p=cell.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.LEFT if len(row)==2 or ci==0 else WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing=1.05;p.paragraph_format.space_after=Pt(3);p.paragraph_format.space_before=Pt(3)
            r=p.add_run(text);r.font.size=Pt(9);r.bold=ri==0;r.font.color.rgb=RGBColor.from_string('FFFFFF' if ri==0 else '000000')
    doc.add_paragraph().paragraph_format.space_after=Pt(2)
    return t

figure_number=0;source=(ROOT/'chapter.md').read_text(encoding='utf8')
if (ROOT/'appendix.md').exists():source+='\n\n'+(ROOT/'appendix.md').read_text(encoding='utf8')
lines=source.splitlines();i=0;in_code=False;code=[]
while i<len(lines):
    line=lines[i].strip();i+=1
    if line.startswith('```'):
        if not in_code:in_code=True;code=[]
        else:
            for k,code_line in enumerate(code):
                p=doc.add_paragraph(style='Code');p.paragraph_format.keep_with_next=k<len(code)-1;p.paragraph_format.keep_together=True;p.add_run(code_line or ' ')
            doc.add_paragraph().paragraph_format.space_after=Pt(2);in_code=False
        continue
    if in_code:code.append(lines[i-1]);continue
    if not line:continue
    if line=='[[pagebreak]]':doc.add_page_break();continue
    if line.startswith('# '):doc.add_paragraph(line[2:],style='Title');continue
    if line.startswith('## Des régions'):doc.add_paragraph(line[3:],style='Subtitle');continue
    if line=='[[sommaire]]':
        doc.add_page_break();p=doc.add_paragraph('Parcours de lecture',style='Contents Heading')
        p=doc.add_paragraph();r=p.add_run();beg=OxmlElement('w:fldChar');beg.set(qn('w:fldCharType'),'begin');r._r.append(beg)
        ins=OxmlElement('w:instrText');ins.set(qn('xml:space'),'preserve');ins.text=' TOC \\o "1-1" \\h \\z ';r._r.append(ins)
        sep=OxmlElement('w:fldChar');sep.set(qn('w:fldCharType'),'separate');r._r.append(sep);r.add_text('Le sommaire sera mis à jour à l’ouverture dans Word.')
        end=OxmlElement('w:fldChar');end.set(qn('w:fldCharType'),'end');r._r.append(end)
        doc.add_page_break();continue
    if line.startswith('### '):add_text(line[4:],'Heading 2');continue
    if line.startswith('## '):
        p=add_text(line[3:],'Heading 1');continue
    if line.startswith('[[eq:'):
        for items in E[line[5:-2]]:equation(items)
        continue
    if line.startswith('!['):
        match=re.fullmatch(r'!\[(.*)\]\((.*)\)',line);assert match
        caption,name=match.groups();figure_number+=1
        p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.keep_with_next=True;p.paragraph_format.space_after=Pt(3)
        picture=p.add_run().add_picture(str(ROOT/'figures'/name),width=Cm(17.2))
        picture._inline.docPr.set('descr',caption)
        add_text(f'Figure {figure_number}  {caption}',style='Caption');continue
    if line.startswith('|'):
        rows=[[x.strip() for x in line.strip('|').split('|')]]
        while i<len(lines) and lines[i].startswith('|'):
            rows.append([x.strip() for x in lines[i].strip().strip('|').split('|')]);i+=1
        table(rows,[2.3,5.08,5.08,5.08] if len(rows[0])==4 else [4.2,13.346]);continue
    if line=='[[table:budget]]':
        rows=[['Niveau maximal','Nombre de tuiles','Float32 en Go','Images en Go']]
        for lod in [6,8,9,11]:
            n=2*(4**(lod+1)-1);rows.append([str(lod),f'{n:,}'.replace(',',' '),f'{n*264196/1e9:.2f}'.replace('.',','),f'{n*50000/1e9:.2f}'.replace('.',',')])
        table(rows,[3.7,5,4.4,4.446]);continue
    add_text(line)

# Page numbers only, matching the chapter's restrained page furniture.
fp=doc.sections[0].footer.paragraphs[0];fp.alignment=WD_ALIGN_PARAGRAPH.RIGHT
fr=fp.add_run();fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');rr=OxmlElement('w:r');tt=OxmlElement('w:t');tt.text='1';rr.append(tt);fld.append(rr);fp._p.append(fld)
doc.save(FINAL)
stats={'words':len(re.findall(r'\S+',source)),'figures':figure_number,'equationBlocks':len(doc.element.xpath('.//m:oMath')),'tables':len(doc.tables),'output':str(FINAL)}
(ROOT/'build-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf8');print(json.dumps(stats))
