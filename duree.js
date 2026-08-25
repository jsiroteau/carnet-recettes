// ══════════════════════════════════════════════════════════════════════
// DURÉE D'UNE RECETTE = REPOS + CUISSON
// ══════════════════════════════════════════════════════════════════════
// Rien n'est saisi à la main : la durée est lue dans le texte des étapes,
// exactement là où elle est déjà écrite (« Cuire 25 minutes à 160°C »,
// « Laisser lever une nuit »). Le même module sert à l'application et au
// script qui remplit le seed : une seule règle, un seul résultat.
//
// Ce qui compte : les attentes. Le four, la casserole, la pousse, le frigo,
// le trempage — tout ce pendant quoi on n'a rien à faire.
// Ce qui ne compte pas : le travail actif. Pétrir 10 minutes ou fouetter
// 5 minutes, c'est du temps de préparation, pas du repos ni de la cuisson.

// Cinq unités de temps qui se disent toutes seules : lues hors contexte, sur
// une vignette, elles ne peuvent désigner qu'une durée. « Modéré » ou « Moyen »
// auraient pu passer pour de la difficulté ; « Demi-heure », non.
export const DUREES        = ['Minute','Demi-heure','Heure','Demi-journée','Journée'];
export const DUREES_BORNES = ['≤ 15 min','16-45 min','46-90 min','1 h 30-4 h','> 4 h'];
const SEUILS = [15, 45, 90, 240];        // bornes hautes des crans 1 à 4

const sansAccent = s => String(s||'').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/’/g,"'")
  // « Cela peut prendre entre 12 et 30 minutes » parle du temps que met un
  // geste, pas d'une attente : on neutralise le verbe pour ne pas le compter.
  .replace(/\b(?:cela\s+)?peut\s+prendre\b/g,'dure environ');

// Une nuit de pousse ou de trempage : 12 heures, la convention la plus
// courante en pâtisserie et la seule qui rende « une nuit » comparable au
// reste. Une journée entière (J-1 → J) vaut 24 heures.
const NUIT = 12*60, JOUR = 24*60;

const CHIFFRES = {un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,
  neuf:9,dix:10,onze:11,douze:12,quinze:15,vingt:20,trente:30,quarante:40};

// Les verbes d'attente : leur durée est du repos ou de la cuisson.
const ATTENTE = new RegExp('\\b(?:'+[
  // cuisson
  'cui[rst]\\w*','cuisson','enfourn\\w*','four\\b','mijot\\w*','fri[rt]\\w*','grill\\w*',
  'bouilli\\w*','bouillir','ebullition','bouillon\\w*','blanchi\\w*','torref\\w*','seche\\w*','secher',
  'reveni\\w*','dor[ea]\\w*','poch\\w*','vapeur','air fryer','caramelis\\w*','reduire','reduise\\w*',
  // repos
  'repos\\w*','lev[eé]\\w*','lever','pouss\\w*','gonfl\\w*','refriger\\w*','frigo','refrigerateur',
  'congel\\w*','tremp\\w*','imbib\\w*','macer\\w*','refroid\\w*','infus\\w*','prendre','prise',
  'degel\\w*','attend\\w*','laisser','patient\\w*','conserv\\w*','degorg\\w*','compter','reserv\\w*'
].join('|')+')');

// Les verbes de travail actif : leur durée n'est ni du repos ni de la cuisson.
const ACTIF = new RegExp('\\b(?:'+[
  'petri\\w*','petrir','batt\\w*','battre','fouett\\w*','mix\\w*','melang\\w*','remu\\w*',
  'crem\\w*','macaronn\\w*','hach\\w*','travaill\\w*','emulsionn\\w*','rac[lk]\\w*',
  'mont[eé]\\w*','monter','concass\\w*','ecras\\w*','tourn\\w*','plier','replier','etal\\w*'
].join('|')+')');

// Toutes les façons d'écrire une durée, de la plus précise à la plus vague.
// L'ordre compte : « 1 heure 30 » doit se lire avant « 1 heure ».
const CH = Object.keys(CHIFFRES).join('|');
const MOTIFS = [
  // « 1/2 heure », « 3/4 d'heure » : la barre de fraction se lit avant tout,
  // sinon « 1/2 heure » se lirait « 2 heures ».
  [/\b(\d+)\s*\/\s*(\d+)\s*(?:d')?\s*(?:h\b|heures?)/g,        m=>Math.round(60*+m[1]/+m[2])],
  [/\b(\d+)\s*(?:h|heures?)\s*(\d{1,2})\b(?!\s*(?:°|degres))/g, m=>+m[1]*60 + +m[2]],
  [new RegExp('\\b('+CH+')\\s+(?:a|ou)\\s+('+CH+')\\s+(heures?|minutes?)\\b','g'),
     m=>Math.max(CHIFFRES[m[1]],CHIFFRES[m[2]]) * (m[3][0]==='h'?60:1)],
  [/\b(\d+)\s*(?:a|ou|-)\s*(\d+)\s*(?:h\b|heures?)/g,           m=>Math.max(+m[1],+m[2])*60],
  [/\b(\d+)\s*(?:a|ou|-)\s*(\d+)\s*(?:mn\b|min\b|minutes?)/g,   m=>Math.max(+m[1],+m[2])],
  [/\b(\d+)\s*(?:h\b|heures?)/g,                                m=>+m[1]*60],
  [/\b(\d+)\s*(?:mn\b|min\b|minutes?)/g,                        m=>+m[1]],
  [/\b(\d+)\s*(?:jours?)\b/g,                                   m=>+m[1]*JOUR],
  [/\b(?:une?\s+)?demi[- ]?heure/g,                             ()=>30],
  [/\b(?:une?\s+)?(?:demi[- ]?)?journee/g,                      ()=>JOUR/2],
  [/\b(?:toute\s+la|une|la|pour\s+une)\s+nuit/g,                ()=>NUIT],
  [/\bune\s+dizaine\s+de\s+minutes/g,                           ()=>10],
  [/\bquelques\s+minutes/g,                                     ()=>5],
  [new RegExp('\\b('+CH+')\\s+(heures?|minutes?)\\b','g'),
                                                                m=>CHIFFRES[m[1]] * (m[2][0]==='h'?60:1)]
];

// Une étape peut mêler les deux registres (« Pétrir 5 minutes, puis laisser
// reposer 1 heure »). Chaque durée est donc rattachée au dernier verbe qui la
// précède, et non à l'étape entière. C'est ce verbe-là, et lui seul, qui dit
// ensuite s'il s'agit de cuisson ou de repos : dans « Cuire 30 minutes.
// Laisser reposer 4 heures », les 4 heures relèvent de « reposer ».
function dernier(motif, texte){
  const re = new RegExp(motif.source, 'g');
  let i = -1, m;
  while((m = re.exec(texte))) i = m.index;
  return i;
}
function gouverneur(texte, position, fin, precedent){
  const avant = texte.slice(0, position);
  const iAttente = dernier(ATTENTE, avant), iActif = dernier(ACTIF, avant);
  if(iAttente < 0 && iActif < 0){
    // « Six à douze heures avant, mettre les pois chiches à tremper » : la
    // durée ouvre la phrase, le verbe la suit. Sinon, on prolonge la durée
    // précédente de la même étape.
    if(/^[\s,]*avant\b/.test(texte.slice(fin))) return {genre:'attente', verbe:-1};
    return {genre:precedent, verbe:-1};
  }
  if(iActif < 0)   return {genre:'attente', verbe:iAttente};
  if(iAttente < 0) return {genre:'actif',   verbe:-1};
  return iAttente > iActif ? {genre:'attente', verbe:iAttente} : {genre:'actif', verbe:-1};
}

// Repos ou cuisson ? La distinction ne change pas le total, mais elle se lit
// dans la fiche et elle rend le calcul vérifiable. On regarde le verbe qui
// gouverne la durée, et le décor autour : un feu, un four, une casserole.
const RE_CUISSON = /\b(?:cui[rst]|cuisson|enfourn|four\b|mijot|fri[rt]|grill|bouill|ebullition|blanchi|torref|seche|secher|reveni|dor[ea]|poch|vapeur|air fryer|caramelis|reduire|feu\b|casserole|cocotte|marmite|poele|micro-ondes|bain-marie)/;

// Le détail de ce qui a été compté, étape par étape.
export function detailDuree(recette){
  const etapes = (recette && recette.parts || []).flatMap(p=>p.steps||[]);
  const lignes = [];
  let repos = 0, cuisson = 0, jours = 0;

  for(const brut of etapes){
    const t = sansAccent(brut);

    // « J-4 », « J-2 » : une recette étalée sur plusieurs jours. Le décalage
    // le plus lointain donne l'étendue réelle, qu'aucune durée d'étape ne dit.
    const j = t.match(/\bj\s*-\s*(\d+)/g);
    if(j) j.forEach(x=>{ jours = Math.max(jours, +x.replace(/\D/g,'')); });

    let trouves = [];
    for(const [motif, valeur] of MOTIFS){
      motif.lastIndex = 0;
      let m;
      while((m = motif.exec(t))){
        // une position déjà couverte par un motif plus précis ne compte pas
        if(trouves.some(f => m.index < f.fin && m.index + m[0].length > f.debut)) continue;
        trouves.push({debut:m.index, fin:m.index+m[0].length, min:valeur(m), txt:m[0]});
      }
    }
    trouves.sort((a,b)=>a.debut-b.debut);

    // Une durée entre parenthèses reformule celle de la phrase (« toute la
    // nuit (au moins 4 heures) ») : elle ne s'y ajoute pas. Seule compte
    // celle du dehors — sauf si la parenthèse est la seule à chiffrer
    // (« Cuire jusqu'à ce que ce soit doré (environ 25 minutes) »).
    const parentheses = [...t.matchAll(/\([^)]*\)/g)].map(m=>[m.index, m.index+m[0].length]);
    const dedans = f => parentheses.some(([a,b])=>f.debut>=a && f.fin<=b);
    if(trouves.some(f=>!dedans(f))) trouves = trouves.filter(f=>!dedans(f));

    // « 7 minutes de chaque côté » : la poêle tourne deux fois.
    const parCote = /de chaque cote/.test(t) ? 2 : 1;

    let genre = null;
    for(const f of trouves){
      // « Au bout de 20 minutes » ou « 10 minutes plus tard » repèrent un
      // instant à l'intérieur d'une cuisson déjà comptée : ce n'est pas une
      // durée de plus.
      if(/(?:au bout de|apres|au bout d')\s*$/.test(t.slice(Math.max(0,f.debut-14), f.debut))) continue;
      if(/^\s*(?:plus tard|apres)/.test(t.slice(f.fin))) continue;

      const g = gouverneur(t, f.debut, f.fin, genre);
      genre = g.genre;
      if(genre !== 'attente') continue;
      // du verbe qui commande jusqu'à la durée : c'est là que se lit le four,
      // le feu ou la casserole.
      const portee = g.verbe >= 0 ? t.slice(g.verbe, f.debut) : '';
      const estCuisson = RE_CUISSON.test(portee);
      const min = f.min * parCote;
      if(estCuisson) cuisson += min; else repos += min;
      lignes.push({etape:brut, expression:f.txt, minutes:min, type:estCuisson?'cuisson':'repos'});
    }
  }

  // Une recette sur 4 jours dure au moins 4 jours, même si les étapes
  // chiffrées ne totalisent qu'une heure de four.
  const somme = repos + cuisson;
  const total = jours ? Math.max(somme, jours*JOUR) : somme;
  return {repos, cuisson, total, jours, lignes};
}

// Le total en minutes : c'est lui qu'on écrit dans le champ `duration`.
export function minutesRecette(recette){ return detailDuree(recette).total; }

// Le cran de 1 à 5 (0 si la recette ne dit aucune durée).
export function niveauDepuisMinutes(min){
  if(!min || min <= 0) return 0;
  for(let i=0;i<SEUILS.length;i++) if(min <= SEUILS[i]) return i+1;
  return 5;
}

// « 2 h 05 », « 45 min », « 4 j » — lisible d'un coup d'œil sur une vignette.
export function formatDuree(min){
  if(!min || min <= 0) return '';
  if(min >= 2*JOUR)  return Math.round(min/JOUR) + ' j';
  if(min < 60)       return min + ' min';
  const h = Math.floor(min/60), m = min%60;
  return m ? `${h} h ${String(m).padStart(2,'0')}` : `${h} h`;
}
