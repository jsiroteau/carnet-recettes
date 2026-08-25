// État des lieux des durées : ce que le texte des étapes permet de calculer,
// recette par recette, pour choisir les intervalles en connaissance de cause.
//
//   node outils/etat-des-lieux.mjs            → écrit etat-des-lieux-durees.html
//   node outils/etat-des-lieux.mjs --ecrire   → écrit aussi `duration` dans le seed
//
// Le calcul ne décide de rien : il propose. C'est la colonne « Retenu » du
// tableau, remplie à la main sur le papier, qui fait foi.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detailDuree, formatDuree, niveauDepuisMinutes, DUREES, DUREES_BORNES } from '../duree.js';
import { SEED } from '../recipes-seed.js';

const ici    = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');
const ecrire = process.argv.includes('--ecrire');
const ech    = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const lignes = SEED.map(r=>{
  const d = detailDuree(r);
  const n = niveauDepuisMinutes(d.total);
  return {r, d, n, propose: DUREES[n-1] || '', ecart: r.duration && r.duration !== DUREES[n-1]};
});

// ── le tableau imprimable ──
const corps = lignes.map((l,i)=>`<tr class="${l.n?'':'muette'}">
  <td class="num">${i+1}</td>
  <td>${ech(l.r.title)}</td>
  <td class="cat">${ech(l.r.category||'')}</td>
  <td class="min">${l.d.repos||'·'}</td>
  <td class="min">${l.d.cuisson||'·'}</td>
  <td class="tot">${formatDuree(l.d.total) || '—'}</td>
  <td class="prop n${l.n}">${l.n ? ech(l.propose) : 'rien de chiffré'}</td>
  <td class="actuel">${ech(l.r.duration||'')}</td>
  <td class="retenu"></td>
</tr>`).join('\n');

const compte = {};
lignes.forEach(l=>{ const c = l.propose||'non chiffrée'; compte[c] = (compte[c]||0)+1; });
const resume = [...DUREES,'non chiffrée'].filter(c=>compte[c])
  .map(c=>`${c} : ${compte[c]}`).join(' · ');

const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Durées — état des lieux</title><style>
@page{size:A4 portrait;margin:12mm 10mm}
*{box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#2b2822;margin:0;padding:16px;font-size:11px}
h1{font-size:17px;margin:0 0 2px}
.sous{color:#7a7266;font-size:10.5px;margin-bottom:3px}
.resume{color:#7a7266;font-size:10px;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.6px;color:#7a7266;
   border-bottom:1.2px solid #2b2822;padding:0 4px 4px}
td{padding:3.5px 4px;border-bottom:.5px solid #e2dcd2;vertical-align:top}
tr{break-inside:avoid}
thead{display:table-header-group}
.num{color:#a89a82;width:20px;text-align:right}
.cat{color:#7a7266;width:52px}
.min,.tot{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.min{width:34px;color:#7a7266}
.tot{width:48px;font-weight:600}
.prop{width:62px;font-weight:600;white-space:nowrap}
.actuel{width:60px;color:#7a7266;white-space:nowrap}
.retenu{width:78px;border-bottom:.5px solid #b9b0a2;background:#faf7f2}
.muette td{color:#a89a82}
.muette .prop{font-weight:400;font-style:italic}
.n1{color:#3E8A5C}.n2{color:#7A8F3C}.n3{color:#A96A00}.n4{color:#C0512F}.n5{color:#B32E58}
.pied{margin-top:10px;color:#7a7266;font-size:9.5px;line-height:1.5}
@media print{body{padding:0}.pied{break-inside:avoid}}
</style></head><body>
<h1>Durées des recettes — état des lieux</h1>
<div class="sous">Somme des temps de <b>repos</b> et de <b>cuisson</b> relevés dans le texte des étapes. La préparation active (pétrir, battre, fouetter) est exclue.</div>
<div class="resume">${SEED.length} recettes — ${resume}</div>
<table><thead><tr>
  <th></th><th>Recette</th><th>Catégorie</th><th>Repos</th><th>Cuis.</th><th>Total lu</th>
  <th>Proposé</th><th>Actuel</th><th>Retenu</th>
</tr></thead><tbody>
${corps}
</tbody></table>
<div class="pied">
<b>Intervalles</b> — ${DUREES.map((d,i)=>`${d} : ${DUREES_BORNES[i]}`).join(' · ')}<br>
<b>Repos / Cuis.</b> en minutes. <b>Total lu</b> peut être sous-évalué : une étape qui dit « laisser reposer » sans chiffre compte pour zéro. Une fourchette (« 6 à 10 min ») retient le haut, « une nuit » vaut 12 h.<br>
<b>Retenu</b> — colonne à remplir à la main, puis à reporter dans le menu déroulant du formulaire.
</div>
</body></html>`;

const sortie = path.join(racine, 'etat-des-lieux-durees.html');
fs.writeFileSync(sortie, html, 'utf8');
console.log(`✓ ${sortie}`);
console.log(`  ${SEED.length} recettes — ${resume}`);

if(!ecrire) process.exit(0);

// ── pré-remplissage du seed avec l'intervalle proposé ──
const json = lignes.map(({r, propose})=>JSON.stringify({
  title:r.title||'', category:r.category||'Plat',
  difficulty:r.difficulty||'', duration:propose,
  servingsBase:r.servingsBase||0, servingsUnit:r.servingsUnit||'',
  source:r.source||'', notes:r.notes||'', labels:r.labels||[],
  photoUrl:r.photoUrl||'',
  parts:(r.parts||[]).map(p=>({name:p.name||'', ingredients:p.ingredients||[], steps:p.steps||[]})),
  ...(r.schemaGraph ? {schemaGraph:r.schemaGraph} : {})
}));

const entete = `// Contenu de vos recettes — séparé du code de l'application (index.html).
// Ce fichier est réécrit par le bouton « Exporter mes recettes » de l'application.
// « duration » est l'intervalle choisi à la saisie. Le pré-remplissage vient de
// outils/etat-des-lieux.mjs, qui le déduit du texte des étapes : à vérifier.
// Dernière mise à jour : ${new Date().toLocaleString('fr-FR')}

export const SEED = [
`;
fs.writeFileSync(path.join(racine,'recipes-seed.js'), entete + json.join(',\n') + '\n];\n', 'utf8');
console.log('✓ recipes-seed.js pré-rempli (intervalles proposés).');
