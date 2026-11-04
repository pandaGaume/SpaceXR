# Premiere version spectrale physique

Le mode `Spectral physique` du rendu HD calcule 24 ou 48 longueurs d'onde entre 380 et 780 nm. Les couleurs ne dependent d'aucune teinte cible par planete. Le nom de planete selectionne les axes de l'ellipsoide. Les presets remplissent des parametres physiques visibles; leurs poussières sont des hypotheses experimentales.

## Calcul

- Gaz : fractions molaires normalisees N2/O2/CO2/Ar, pression, temperature et gravite. Nombre de molecules P/(kT), hauteur isotherme kT/(masse*g), diffusion Rayleigh depuis les volumes de polarisabilite statique experimentaux du NIST, sigma = (8*pi/3)*(2*pi/lambda)^4*alpha^2. Dispersion et anisotropie moleculaires ne sont pas modelisees.
- Poussiere : spheres homogenes, rayon median et distribution lognormale (13 points entre +/-3 sigma), indice complexe n+i*k. Coefficients de Mie par recurrence descendante des derivees logarithmiques de Riccati-Bessel. Sections d'extinction et de diffusion et phase angulaire calculees, sans asymetrie RGB choisie pour obtenir du bleu. Population normalisee par une epaisseur optique de reference a 550 nm et un profil exponentiel.
- Source : corps noir de Planck avec rayon solaire fixe, temperature et distance modifiables; ou bande gaussienne experimentale avec centre et largeur FWHM en nm. La bande n'est pas renormalisee a puissance totale constante. Un changement de temperature change aussi l'energie emise.
- Transport : diffusion simple spectrale, transmission vers la camera et vers le Soleil, occultation analytique par l'ellipsoide. Les colonnes de densite de la LUT solaire sont reutilisables pour les differentes longueurs d'onde.
- Image : integration spectrale CIE XYZ (approximation analytique de Wyman et al.), matrice XYZ vers sRGB, exposition sur la luminance, encodage sRGB et limitation au gamut de l'ecran. Pas de balance des blancs par planete. Le disque solaire a un rayon angulaire dependant de la distance. Le sol reste un ellipsoide uniforme, pre-eclaire, avec un coefficient neutre de demonstration.

Trois textures 2D array RGBA16F contiennent Rayleigh, Mie et transmission, avec trois longueurs d'onde par couche. La phase Mie est echantillonnee dans une table angulaire issue du calcul CPU, concentree vers la diffusion avant. Pour 24 longueurs d'onde et 256 x 128 : 6 Mio pour ces trois textures, contre 12 Mio pour 48 longueurs d'onde. Le calcul d'image n'effectue pas de lecture retour CPU.

## Voir la premiere version

`npm start`, puis http://127.0.0.1:8096/. Choisir `Spectral physique`, `Mars, poussiere experimentale`, garder la source Planck, puis `Rendu HD`. `Plein ecran` agrandit le rendu, `Animer le regard` ne reconstruit pas le cache, `PNG natif` et `Rapport JSON` exportent les resultats. L'elevation solaire accepte des valeurs negatives pour le crepuscule. Les changements de parametres demandent un nouveau clic sur `Rendu HD`.

Les comparatifs RGB historiques restent disponibles en changeant le mode Transport. La calibration de reutilisation en translation du mode RGB n'est pas applicable au nouvel affichage spectral et reste desactivee dans ce mode. Les variantes internes et spatiales sont compilees. Le cadrage du limbe spectral utilise l'horizon de l'ellipsoide reel.

## Resultats et verification

Le PNG `outputs/mars-spectral-24.png` montre le premier essai : halo bleu pale proche du Soleil, ciel plus brun/gris a distance. Il ne reproduit pas encore quantitativement la photographie du rover. Les indices n=1.5, k=0.003 constants avec lambda, rayon median 0.7 micrometre et sigma_ln=0.3 sont des hypotheses, pas des constantes martiennes validees. La photographie utilisateur est conservee comme reference qualitative dans `references/mars-rover-sunset-user.png`, provenance et traitement instrumentaux non etablis.

Le rapport martien a 24 longueurs d'onde contient 34 sondes confrontees a une integration CPU independante, sans LUT solaire GPU : erreur maximale RGB lineaire 0.00071225. La reference utilise 256 pas de vue et 96 pas solaires. Sur l'axe solaire, doubler ces nombres change au maximum 0.00003051 en radiance lineaire. Une execution a 48 longueurs d'onde differe de celle a 24 d'au plus 0.0018674 sur les 19 sondes communes, soit environ 2.2 % de la composante bleue sur l'axe solaire. Cela verifie l'implementation et sa discretisation, pas sa fidelite a l'atmosphere martienne reelle.

Mesures de passes GPU sur cette machine, non garanties de cadence moteur : environ 32 a 40 ms pour construire la Sky-View a 24 longueurs d'onde et 1 a 2.5 ms pour la presentation Full HD avec cache persistant. A 48 longueurs d'onde, environ 47 a 62 ms de construction et 2 ms de presentation. La rotation peut reutiliser le cache; les translations demandent encore sa reconstruction.

`npm test` : 59 tests. Les nouveaux tests verifient Mie contre une reference independante SciPy par fonctions de Bessel (`mie-reference.py`, fixtures fournies), la normalisation de la phase sur l'angle solide, la limite Rayleigh, la passivite, les lois de densite et de distance, et le crepuscule. SciPy n'est pas une dependance du rendu ni des tests Node, seulement du script facultatif qui regenere les fixtures.

`node twilight.js` mesure la luminance apres le coucher sans imposer une duree. A elevation solaire -12 degres, le maximum des cinq rayons testes vaut 0.0001382 pour une hauteur de poussiere de 10 km et 0.001108 pour 20 km, a epaisseur optique de reference identique. Le fichier `outputs/mars-twilight.json` conserve les valeurs. L'atmosphere est tronquee vers 130 km dans ce cas; les profils exponentiels et l'absence de diffusion multiple limitent l'interpretation d'un crepuscule tardif. Aucun parametre « deux heures » n'intervient.

## Validation scientifique restante

Il manque les indices optiques de poussiere dependants de la longueur d'onde, des profils verticaux mesures, la diffusion multiple, les raies d'absorption, la polarisation et les particules non spheriques. L'epaisseur optique reference est celle du profil exponentiel non tronque; une faible partie peut etre retranchee par la limite superieure de l'atmosphere. L'observateur CIE est une approximation analytique et l'ecran peut ecreter des couleurs hors gamut.

La prochaine comparaison devra utiliser des produits PDS calibres en radiance et les reponses spectrales des filtres, avant tone mapping, et avec la geometrie de l'observation. Les produits Mastcam-Z scientifiques sont a distinguer des versions operationnelles de diagnostic; les produits PNG/JPEG de consultation ne remplacent pas les tableaux radiometriques. Aucun ajustement PDS n'a encore ete effectue. Il ne faut pas assimiler la reference utilisateur a une observation Mastcam-Z sans identifier son instrument.

## Sources

- Polarisabilites experimentales NIST : https://cccbdb.nist.gov/pollistx.asp
- Equations et references Mie : https://miepython.readthedocs.io/en/latest/07_algorithm.html
- Observateur CIE analytique : https://jcgt.org/published/0002/02/01/
- Etat et composition de Mars : https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html et https://www.nasa.gov/missions/with-mars-methane-mystery-unsolved-curiosity-serves-scientists-a-new-one-oxygen/
- Observation qualitative du halo : https://science.nasa.gov/resource/sunset-in-mars-gale-crater/
- Crepuscule jusqu'a deux heures, observations NASA : https://www.nasa.gov/image-article/sunset-mars/
- Acces aux produits calibres Mastcam-Z : https://mastcamz.asu.edu/mastcam-z-data-for-all/
- Calibration instrumentale Mastcam-Z : https://pmc.ncbi.nlm.nih.gov/articles/PMC7892537/
