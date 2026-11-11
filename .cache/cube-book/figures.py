from pathlib import Path
import math, html
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).parent
OUT=ROOT/'figures';OUT.mkdir(exist_ok=True)
BLUE='#245e87'; CORAL='#b64d3b'; GREEN='#287569'; GREY='#60727e'; PALE='#eef4f8'; INK='#172f40'
class Figure:
    def __init__(self,name,w=1600,h=880):
        self.name=name;self.w=w;self.h=h;self.parts=[]
        self.im=Image.new('RGB',(w,h),'white');self.d=ImageDraw.Draw(self.im)
    def line(self,points,color=BLUE,width=3):
        points=[tuple(map(float,p)) for p in points]
        self.d.line(points,fill=color,width=width)
        self.parts.append(f'<polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x,y in points)}" fill="none" stroke="{color}" stroke-width="{width}"/>')
    def rect(self,box,fill=PALE,stroke=BLUE,width=3):
        x,y,x1,y1=box;self.d.rectangle(box,fill=fill,outline=stroke,width=width)
        self.parts.append(f'<rect x="{x}" y="{y}" width="{x1-x}" height="{y1-y}" fill="{fill or "none"}" stroke="{stroke}" stroke-width="{width}"/>')
    def dot(self,x,y,r=7,color=CORAL):
        self.d.ellipse((x-r,y-r,x+r,y+r),fill=color)
        self.parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>')
    def text(self,x,y,s,size=29,color=INK,bold=False,anchor='la'):
        font=ImageFont.truetype('C:/Windows/Fonts/calibrib.ttf' if bold else 'C:/Windows/Fonts/calibri.ttf',size)
        self.d.text((x,y),s,font=font,fill=color,anchor=anchor)
        align='middle' if anchor.startswith('m') else 'start'
        self.parts.append(f'<text x="{x}" y="{y+size*.8}" fill="{color}" font-family="Calibri,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" text-anchor="{align}">{html.escape(s)}</text>')
    def arrow(self,start,end,color=CORAL,width=4):
        self.line([start,end],color,width);a=math.atan2(end[1]-start[1],end[0]-start[0]);r=17
        self.line([(end[0]-r*math.cos(a-.5),end[1]-r*math.sin(a-.5)),end,(end[0]-r*math.cos(a+.5),end[1]-r*math.sin(a+.5))],color,width)
    def circle(self,cx,cy,r,color=BLUE,width=3):
        self.line([(cx+r*math.cos(t),cy+r*math.sin(t)) for t in np.linspace(0,2*math.pi,240)],color,width)
    def save(self):
        self.im.save(OUT/f'{self.name}.png',dpi=(240,240))
        (OUT/f'{self.name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}"><rect width="100%" height="100%" fill="white"/>'+''.join(self.parts)+'</svg>',encoding='utf8')

f=Figure('01-poles',1600,760)
for x,title in [(55,'Carte géographique'),(580,'Vue polaire'),(1100,'Face cubique polaire')]:f.text(x,30,title,34,bold=True)
f.rect((60,155,480,570),'white')
for i in range(9):f.line([(60+i*52.5,155),(60+i*52.5,570)],'#91aabc',2)
for i in range(5):f.line([(60,155+i*103.75),(480,155+i*103.75)],'#91aabc',2)
f.line([(60,155),(480,155)],CORAL,7);f.text(70,590,'Un seul pôle, toute une ligne',27)
for r in [45,90,135,185]:f.circle(790,360,r,'#91aabc',2)
for a in np.linspace(0,2*math.pi,16,endpoint=False):f.line([(790,360),(790+185*math.cos(a),360+185*math.sin(a))],'#91aabc',2)
f.dot(790,360,10);f.text(640,590,'Les méridiens convergent',27)
f.rect((1130,170,1500,540),'white')
for i in range(1,8):
    f.line([(1130+i*370/8,170),(1130+i*370/8,540)],'#91aabc',2)
    f.line([(1130,170+i*370/8),(1500,170+i*370/8)],'#91aabc',2)
f.dot(1315,355,10);f.text(1120,590,'Le pôle est un point intérieur',27)
f.text(65,680,'La singularité est dans la carte, pas dans le terrain.',31,bold=True);f.save()

f=Figure('02-geometries',1600,850)
cx,cy=460,470
f.circle(cx,cy,250,'#b7c6d0',3)
f.line([(cx+360*math.cos(t),cy+205*math.sin(t)) for t in np.linspace(0,2*math.pi,240)],BLUE,5)
for angle in np.linspace(-2.8,.8,13):f.line([(cx,cy),(cx+360*math.cos(angle),cy+360*math.sin(angle))],'#d9e2e8',2)
a=-.7;d=np.array([math.cos(a),math.sin(a)]);r=1/math.sqrt(d[0]**2/360**2+d[1]**2/205**2)
p=np.array([cx,cy])+r*d;q=np.array([cx,cy])+(r+90)*d
f.arrow((cx,cy),q,CORAL,5);f.dot(*p,9,BLUE);f.dot(*q,9,GREEN)
normal=np.array([(p[0]-cx)/360**2,(p[1]-cy)/205**2]);normal/=np.linalg.norm(normal)
f.arrow(p,p+normal*115,GREEN);f.text(510,540,'Centre',28);f.text(q[0]+12,q[1]-40,'P',32,bold=True)
f.text(960,145,'1  Sphère des directions',35,bold=True);f.text(960,200,'Elle choisit la face et la tuile.',29)
f.text(960,310,'2  Surface de référence',35,BLUE,True);f.text(960,365,'Elle fixe le zéro des hauteurs.',29)
f.text(960,475,'3  Surface physique',35,GREEN,True);f.text(960,530,'Elle ajoute le relief mesuré.',29)
f.text(960,670,'La normale et le rayon diffèrent',28);f.text(960,710,'sur un ellipsoïde aplati.',28)
f.text(75,55,'Une adresse indépendante de la forme du corps',38,bold=True);f.save()

f=Figure('03-faces',1600,980)
size=240;xs=[100,390,680,970];ys=355
for face,x in [(3,xs[0]),(0,xs[1]),(1,xs[2]),(2,xs[3]),(4,xs[1]),(5,xs[1])]:
    y=ys if face<4 else 70 if face==4 else 640
    f.rect((x,y,x+size,y+size),'#e7f0f7' if face<4 else '#e6f2ed')
    labels={0:'+X  ·  0°',1:'+Y  ·  90° E',2:'−X  ·  180°',3:'−Y  ·  90° O',4:'+Z  ·  Nord',5:'−Z  ·  Sud'}
    f.text(x+120,y+52,f'Face {face}',37,bold=True,anchor='ma');f.text(x+120,y+105,labels[face],28,anchor='ma')
    f.arrow((x+45,y+180),(x+160,y+180),BLUE,3);f.text(x+170,y+160,'u',28)
    f.arrow((x+45,y+180),(x+45,y+225),CORAL,3);f.text(x+65,y+195,'v',28)
f.text(1280,355,'u vers la droite',27);f.text(1280,410,'v vers le bas',27)
f.text(1280,510,'Dépliage',31,bold=True);f.text(1280,555,'topologique',31,bold=True)
f.text(75,925,'Six racines. Une convention explicite. Des rotations aux raccords.',30);f.save()

f=Figure('04-equiangulaire',1600,850)
for offset,title,equi in [(100,'Cube gnomonique',False),(900,'Cube équiangulaire',True)]:
    f.text(offset,40,title,38,bold=True);a=offset;b=170;s=520
    f.rect((a,b,a+s,b+s),'white')
    positions=np.tan(np.linspace(-math.pi/4,math.pi/4,9)) if equi else np.linspace(-1,1,9)
    for p0 in positions:
        px=a+(p0+1)*s/2;py=b+(p0+1)*s/2
        f.line([(px,b),(px,b+s)],BLUE,3);f.line([(a,py),(a+s,py)],BLUE,3)
    f.text(offset,725,'Pas constants sur le cube' if not equi else 'Angles constants vus du centre',29)
f.text(100,795,'Le cube équiangulaire réduit la variation des aires sans la supprimer.',30,bold=True);f.save()

f=Figure('05-polaire-lod',1600,920)
for x,title,n in [(85,'Face 5 au niveau 2',4),(900,'Détail au niveau 5',32)]:
    f.text(x,35,title,36,bold=True);s=570;y=170
    f.rect((x,y,x+s,y+s),'white')
    for i in range(n+1):
        f.line([(x+i*s/n,y),(x+i*s/n,y+s)],'#9aaebb',2)
        f.line([(x,y+i*s/n),(x+s,y+i*s/n)],'#9aaebb',2)
    if n==4:f.rect((x+s/4,y+s/4,x+3*s/4,y+3*s/4),'#dbece7',GREEN,4)
    else:f.rect((x+15*s/32,y+15*s/32,x+17*s/32,y+17*s/32),'#f7e5de',CORAL,4)
    f.dot(x+s/2,y+s/2,9);f.text(x+20,y+s+35,'Quatre sous-arbres centraux',28)
f.arrow((700,450),(840,450),CORAL,5);f.text(90,850,'On raffine une emprise utile, pas la face polaire entière.',31,bold=True);f.save()

f=Figure('06-registration',1600,830)
for x,title,point in [(100,'Registration area',False),(900,'Registration point',True)]:
    f.text(x,40,title,37,bold=True);y=180;s=500
    f.rect((x,y,x+s,y+s),'white')
    for i in range(5):
        f.line([(x+i*s/4,y),(x+i*s/4,y+s)],'#91aabc',2);f.line([(x,y+i*s/4),(x+s,y+i*s/4)],'#91aabc',2)
    for i in range(5 if point else 4):
        for j in range(5 if point else 4):f.dot(x+(i+(0 if point else .5))*s/4,y+(j+(0 if point else .5))*s/4,8,GREEN if point else CORAL)
    f.text(x,y+s+32,'4 × 4 cellules, 4 × 4 centres' if not point else '4 × 4 cellules, 5 × 5 sommets',29)
f.text(100,785,'Pour 256 cellules, la grille point contient 257 × 257 échantillons.',30,bold=True);f.save()

f=Figure('07-raccord',1600,900);cols=[CORAL,'#cc8a3b',GREEN,BLUE,'#785b9b']
for x,title in [(90,'Face 1  ·  bord nord'),(950,'Face 4  ·  bord est')]:
    f.text(x,45,title,36,bold=True);f.rect((x,230,x+500,730),'white')
    for i in range(1,4):f.line([(x+i*125,230),(x+i*125,730)],'#c3d0d9',2);f.line([(x,230+i*125),(x+500,230+i*125)],'#c3d0d9',2)
for i,c in enumerate(cols):
    f.dot(90+i*125,230,13,c);f.text(90+i*125,175,str(i),31,c,True,anchor='ma')
    f.dot(1450,730-i*125,13,c);f.text(1480,710-i*125,str(i),31,c,True)
f.arrow((660,420),(860,420),INK,4);f.text(665,470,'Tourner puis',28);f.text(665,510,'inverser',28)
f.text(100,795,'Sommet i ↔ N − i. Pour les tuiles : position k ↔ 2^lod − 1 − k.',29);f.save()

f=Figure('08-bilineaire',1600,850)
x,y,s=150,180,470
f.rect((x,y,x+s,y+s),'white')
for px,py,label in [(x,y,'h00'),(x+s,y,'h10'),(x,y+s,'h01'),(x+s,y+s,'h11')]:f.dot(px,py,12,BLUE);f.text(px+18,py+12,label,32)
p=(x+.35*s,y+.6*s);f.dot(*p,13,CORAL)
for corner in [(x,y),(x+s,y),(x,y+s),(x+s,y+s)]:f.line([corner,p],'#a6b8c4',3)
f.text(100,45,'Une valeur entre quatre pixels sources',38,bold=True)
f.text(850,205,'fx = 0,35   fy = 0,60',33,bold=True)
for i,line in enumerate(['poids h00 = 0,26','poids h10 = 0,14','poids h01 = 0,39','poids h11 = 0,21']):f.text(850,300+i*70,line,33)
f.text(100,755,'Un voisin sans donnée est exclu ; les poids restants sont renormalisés.',29);f.save()

f=Figure('09-produits',1600,1070)
src=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-tile-service/.local/nasa-sources')
img=Image.open(src/'lroc_color_2k.jpg').convert('RGB').resize((720,360))
f.im.paste(img,(80,150));f.text(80,35,'Deux produits NASA, deux significations',36,bold=True)
f.text(850,205,'LROC : image de surface',31,bold=True)
f.text(850,270,'Exemple préparé pour le rendu',28)
f.text(850,330,'Couleurs et exposition ajustées',28)
f.text(850,390,'Complément aux régions polaires',28)
# An actual numeric LOLA raster, visualized at low resolution without implying new precision.
heights=np.asarray(Image.open(src/'ldem_4.tif'),dtype=float)*1000
small=Image.fromarray(np.uint8(np.clip((heights+9000)/20000,0,1)*255)).convert('RGB').resize((720,360))
f.im.paste(small,(80,680));f.text(850,715,'LOLA : valeurs numériques',31,bold=True);f.text(850,775,'Affichage en niveaux de gris',28)
f.text(850,830,'Le gris est une visualisation.',28);f.text(850,875,'La hauteur reste un nombre en mètres.',28)
f.text(850,950,'Sources NASA SVS  ·  exemples basse résolution',23)
# Raster content is preserved in the PNG. SVG is not used for this composite.
f.im.save(OUT/'09-produits.png',dpi=(240,240))

f=Figure('10-trek',1600,920)
f.text(80,35,'Deux chemins pour deux types de données',38,bold=True)
for x,title in [(100,'WMTS'),(900,'ImageServer ou fichier source')]:f.rect((x,170,x+580,315),PALE);f.text(x+28,205,title,32,bold=True)
f.arrow((390,330),(390,445),BLUE,5);f.arrow((1190,330),(1190,445),GREEN,5)
f.rect((100,465,680,635),'#edf3fa');f.text(130,490,'JPEG ou PNG de présentation',29);f.text(130,550,'Image, ombrage, pente, couleurs',28)
f.rect((900,465,1480,635),'#e7f2ee');f.text(930,490,'TIFF F32 et métadonnées',29);f.text(930,550,'Altitudes, NoData, unités, datum',28)
f.arrow((390,650),(390,750),BLUE,5);f.arrow((1190,650),(1190,750),GREEN,5)
f.text(190,780,'IMAGERIE CUBIQUE',33,BLUE,True);f.text(1030,780,'DEM CUBIQUE',33,GREEN,True)
f.save()

f=Figure('11-chaine',1600,930)
items=[('1  Adresse cube','face / lod / x / y'),('2  Directions','257 × 257 rayons'),('3  Projection source','géographique ou polaire'),('4  Pixels sources','blocs alignés et halo'),('5  Valeurs physiques','unités puis datum'),('6  Encodage','PNG Terrarium ou image')]
positions=[(70,125),(590,125),(1110,125),(1110,500),(590,500),(70,500)]
for (title,sub),(x,y) in zip(items,positions):
    f.rect((x,y,x+420,y+230),PALE);f.text(x+25,y+45,title,29,bold=True);f.text(x+25,y+120,sub,26)
for a,b in [((500,240),(565,240)),((1020,240),(1085,240)),((1320,375),(1320,475)),((1085,615),(1030,615)),((565,615),(510,615))]:f.arrow(a,b,CORAL,5)
f.text(80,40,'Du catalogue NASA à une tuile exploitable',38,bold=True);f.text(80,825,'À chaque étape, le référentiel et la registration restent explicites.',30);f.save()

f=Figure('12-fusion',1600,900)
x0,y0,w,h=150,650,1300,470
f.arrow((x0,y0),(x0+w+20,y0),INK,3);f.arrow((x0,y0),(x0,y0-h-35),INK,3)
for deg in [70,75,80,85,90]:
    x=x0+(deg-70)/20*w;f.line([(x,y0),(x,y0-h)],'#d9e2e8',2);f.text(x,y0+20,f'{deg}°',28,anchor='ma')
for value in [0,.5,1]:f.text(x0-65,y0-value*h-10,str(value).replace('.',','),26)
def smooth(a,b,x):t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
lats=np.linspace(70,90,401);w1=smooth(76,78,lats);w2=smooth(87.6,88.6,lats)
for values,color in [((1-w1),BLUE),(w1*(1-w2),GREEN),(w1*w2,CORAL)]:f.line([(x0+(lat-70)/20*w,y0-val*h) for lat,val in zip(lats,values)],color,6)
f.text(100,35,'Une transition commune à toutes les tuiles',38,bold=True)
for x,label,col in [(180,'Global',BLUE),(610,'Polaire 30 m',GREEN),(1100,'Polaire 5 m',CORAL)]:f.text(x,770,label,31,col,True)
f.text(100,835,'Exemple de pondération, à appliquer après harmonisation des hauteurs.',28);f.save()

f=Figure('13-precision',1600,850)
f.text(75,30,'Trois résolutions à ne pas confondre',38,bold=True)
for x,n,title,subtitle in [(90,4,'Grille du maillage','4 cellules représentées'),(625,16,'Grille des altitudes','16 cellules représentées'),(1160,8,'Image de surface','8 pixels représentés')]:
    s=350;y=230;f.text(x,120,title,29,bold=True);f.rect((x,y,x+s,y+s),'white')
    for i in range(1,n):f.line([(x+i*s/n,y),(x+i*s/n,y+s)],'#8fa9b9',2);f.line([(x,y+i*s/n),(x+s,y+i*s/n)],'#8fa9b9',2)
    f.text(x,630,subtitle,27)
f.text(90,755,'Une altitude détaillée ne crée pas automatiquement des triangles supplémentaires.',28);f.save()

f=Figure('14-cache',1600,970)
f.text(65,35,'Une donnée calculée une fois, distribuée plusieurs fois',37,bold=True)
for box,title,sub in [((70,150,440,345),'Client','descripteur puis tuiles'),((610,150,980,345),'Worker et CDN','autoriser et retrouver'),((1150,150,1520,345),'R2','résultats immuables'),((610,560,980,755),'Préparation','file de tâches'),((1150,560,1520,755),'Sources Trek','images et valeurs')]:
    f.rect(box,PALE);f.text(box[0]+22,box[1]+43,title,31,bold=True);f.text(box[0]+22,box[1]+112,sub,24)
f.arrow((455,245),(590,245),BLUE,5);f.arrow((995,245),(1135,245),BLUE,5)
f.arrow((790,365),(790,540),CORAL,5);f.text(820,430,'si préparation nécessaire',24)
f.arrow((995,625),(1135,625),GREEN,5);f.arrow((1135,710),(995,710),GREEN,5)
f.line([(1000,560),(1060,470),(1340,470)],GREEN,4);f.arrow((1340,470),(1340,365),GREEN,4)
f.text(75,865,'Le cache CDN peut expirer sans effacer la tuile calculée dans R2.',30,bold=True);f.save()
print('Generated',len(list(OUT.glob('*.png'))),'illustrations')
