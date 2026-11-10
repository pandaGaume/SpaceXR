from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).parent
OUT=ROOT/'figures'
BLUE='#245e87';CORAL='#b64d3b';GREEN='#287569';PALE='#eef4f8';INK='#172f40'
def font(size,bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/calibrib.ttf' if bold else 'C:/Windows/Fonts/calibri.ttf',size)
def text(d,xy,s,size=29,bold=False,color=INK):d.text(xy,s,font=font(size,bold),fill=color)
def arrow(d,start,end,color=CORAL):
    d.line([start,end],fill=color,width=4)
    a=math.atan2(end[1]-start[1],end[0]-start[0]);r=16
    d.line([(end[0]-r*math.cos(a-.5),end[1]-r*math.sin(a-.5)),end,(end[0]-r*math.cos(a+.5),end[1]-r*math.sin(a+.5))],fill=color,width=4)

# Read both native numeric sources in one nominal south-polar map window.
source=Path('F:/LunarData')
trek=np.empty((1024,1024),dtype=np.float32)
for row in range(2):
    for col in range(2):
        data=np.array(Image.open(source/f'cache/lola-south-5m/{29+col}/{29+row}.tif'),dtype=np.float32)
        trek[row*512:(row+1)*512,col*512:(col+1)*512]=data
a=trek[120:576,64:576]
regional=np.array(Image.open(source/'sources/moon/pgda/Site04_final_adj_5mpp_surf.tif'),dtype=np.float32)
b=regional[0:456,1544:2056]
assert a.shape==b.shape==(456,512)
assert np.isfinite(a).all() and np.isfinite(b).all()
lo=float(min(a.min(),b.min()));hi=float(max(a.max(),b.max()))
im=Image.new('RGB',(1600,1000),'white');d=ImageDraw.Draw(im)
text(d,(65,30),'Deux produits LOLA sur une emprise commune',40,True)
for x,label,data in [(65,'Export numérique Trek',a),(855,'PGDA Site04 ajusté',b)]:
    text(d,(x,115),label,34,True)
    grey=np.rint(np.clip((data-lo)/(hi-lo),0,1)*255).astype(np.uint8)
    im.paste(Image.fromarray(grey).convert('RGB').resize((680,606),Image.Resampling.NEAREST),(x,175))
    d.rectangle((x,175,x+679,780),outline=BLUE,width=2)
text(d,(65,825),'Même emprise cartographique nominale et même échelle de gris.',31,True)
text(d,(65,875),f'Hauteurs natives : {lo:.1f} à {hi:.1f} m. Valeurs représentées sans filtre de suppression des traces.',27)
text(d,(65,925),'La comparaison visuelle ne constitue pas une mesure de précision absolue.',28,color=CORAL)
im.save(OUT/'15-comparaison-lola.png',dpi=(240,240))
(ROOT/'appendix-source-comparison.json').write_text(json.dumps({'bbox':[-1280,-1280,1280,1000],'pixelSize':5,'shape':list(a.shape),'range':[lo,hi],'differenceRmsMetres':float(np.sqrt(np.mean((a.astype(float)-b)**2))),'meaning':'Product differences in a nominal shared map grid, not an accuracy estimate'},indent=2),encoding='utf8')

im=Image.new('RGB',(1600,800),'white');d=ImageDraw.Draw(im)
text(d,(65,30),'Du produit scientifique aux fichiers distribués',40,True)
boxes=[(65,140,'1  Identifier','Produit, label et repère','Unité, échelle et NoData'),
       (605,140,'2  Importer','Originaux vérifiés sur F:','SHA-256 et reprise contrôlée'),
       (1145,140,'3  Lire la grille','Projection et registration','Blocs ou fenêtres natives'),
       (1145,470,'4  Convertir','Directions du cube','Hauteurs sur la surface cible'),
       (605,470,'5  Contrôler','Bords et valeurs encodées','Qualité et couverture'),
       (65,470,'6  Distribuer','Révision et disponibilité','HTTP local puis publication')]
for x,y,title,line1,line2 in boxes:
    d.rectangle((x,y,x+390,y+195),fill=PALE,outline=BLUE,width=3)
    text(d,(x+18,y+22),title,32,True);text(d,(x+18,y+90),line1,27);text(d,(x+18,y+135),line2,25)
arrow(d,(465,235),(595,235));arrow(d,(1005,235),(1135,235));arrow(d,(1340,345),(1340,460))
arrow(d,(1135,565),(1005,565));arrow(d,(595,565),(465,565))
text(d,(65,720),'Les erreurs de téléchargement restent des erreurs, jamais des hauteurs absentes.',31,True)
im.save(OUT/'16-import-lola.png',dpi=(240,240))

im=Image.new('RGB',(1600,810),'white');d=ImageDraw.Draw(im)
text(d,(65,30),'Un relief et plusieurs informations de qualité',40,True)
cards=[(65,145,'LDEC','Retours ou densité documentée','Le mélange peut donner des valeurs non entières.'),
       (845,145,'EFFRES','Résolution effective','Elle ne se déduit pas du nombre de pixels.'),
       (65,420,'ERR','Incertitude documentée','Son sens dépend du modèle et de la méthode.'),
       (845,420,'Masques et provenance','Couverture et mode de production','Une information absente reste inconnue.')]
for x,y,title,line1,line2 in cards:
    d.rectangle((x,y,x+690,y+210),fill=PALE,outline=BLUE,width=3)
    text(d,(x+25,y+20),title,35,True,color=GREEN)
    text(d,(x+25,y+88),line1,30,True)
    text(d,(x+25,y+145),line2,25)
text(d,(65,695),'Pas de grille ≠ résolution effective ≠ incertitude de hauteur',35,True)
text(d,(65,755),'Le client utilise ces informations sans modifier les mesures pour embellir le terrain.',27)
im.save(OUT/'17-qualite-lola.png',dpi=(240,240))
print('Three appendix figures generated from native data and documented semantics.')
