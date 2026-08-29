// ══════════════════════════════════════════════════════════════════════
// LE SCHÉMA EN IMAGE
// ══════════════════════════════════════════════════════════════════════
// Envoyé par messagerie, le schéma décrit en texte se lit plus mal que la
// recette elle-même : des flèches, des numéros, des renvois. Ce qui se
// regarde doit être regardé. On en fait donc une image, que la messagerie
// affiche directement dans la conversation.
//
// L'image est reconstruite à partir des positions réellement calculées à
// l'écran — pas d'une seconde mise en page qui divergerait de la première.
// On mesure le schéma tel qu'il est rendu, puis on redessine chaque boîte
// et chaque flèche dans un SVG autonome, qu'un canevas transforme en PNG.
//
// Pourquoi PNG et non PDF : une messagerie affiche une image dans le fil de
// la conversation, tandis qu'un PDF arrive en pièce jointe qu'il faut ouvrir.
// Pour quelqu'un qui cuisine, la différence est celle entre voir et chercher.

const ECHELLE = 2;          // deux pixels par point : net sur écran dense
const MARGE   = 24;

const lire = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// Le texte des boîtes est replié à la même largeur qu'à l'écran. Le SVG sera
// rasterisé hors de la page, sans accès à ses polices : on mesure donc, et on
// dessine, avec la même famille générique.
function replier(ctx, texte, largeur){
  const mots = String(texte||'').split(/\s+/).filter(Boolean);
  const lignes = [];
  let ligne = '';
  for(const mot of mots){
    const essai = ligne ? ligne + ' ' + mot : mot;
    if(ligne && ctx.measureText(essai).width > largeur){ lignes.push(ligne); ligne = mot; }
    else ligne = essai;
  }
  if(ligne) lignes.push(ligne);
  return lignes.length ? lignes : [''];
}

const echapper = s => String(s??'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Dessine une boîte : rectangle arrondi + texte centré, replié.
function boiteSvg(ctx, r, texte, opts){
  const pad = 9, interligne = 14, taille = 11.5;
  ctx.font = taille + 'px sans-serif';
  const lignes = replier(ctx, texte, r.w - pad*2);
  const hTexte = lignes.length * interligne;
  const y0 = r.y + r.h/2 - hTexte/2 + interligne*0.72;
  const tspans = lignes.map((l,i)=>
    `<tspan x="${(r.x + r.w/2).toFixed(1)}" y="${(y0 + i*interligne).toFixed(1)}">${echapper(l)}</tspan>`).join('');
  return `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}"
      rx="${opts.rayon}" fill="${opts.fond}" stroke="${opts.trait}" stroke-width="2"
      ${opts.tirets ? 'stroke-dasharray="6 4"' : ''}/>
    <text font-family="sans-serif" font-size="${taille}" fill="${opts.encre}" text-anchor="middle">${tspans}</text>`;
}

// Fabrique le PNG. `wrap` est le cadre du schéma tel qu'il est dans la page.
export async function schemaEnPng(wrap, titre){
  const svgSource = wrap.querySelector('svg.schema-connectors');
  const cadre = wrap.getBoundingClientRect();
  const brut = el => {
    const r = el.getBoundingClientRect();
    return { x: r.left - cadre.left + wrap.scrollLeft,
             y: r.top  - cadre.top  + wrap.scrollTop,
             w: r.width, h: r.height };
  };

  // Le cadre de mesure est plus large que le dessin — il faut bien lui donner
  // de la place pour qu'il s'étale sans se replier. On recadre donc sur le
  // contenu réel, sinon l'image partirait avec des hectares de vide à droite.
  const pieces = [...wrap.querySelectorAll('.schema-ing-item, .schema-box, .schema-ing-part-label')];
  if(!pieces.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pieces.forEach(el=>{ const r = brut(el);
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); });
  const dx = MARGE - x0, dy = MARGE - y0;
  const L = (x1 - x0), H = (y1 - y0);
  const local = el => { const r = brut(el); return {x:r.x + dx, y:r.y + dy, w:r.w, h:r.h}; };

  const C = { fond: lire('--bg') || '#FFFBF3', carte: lire('--card') || '#fff',
              carteHi: lire('--card-hi') || '#FAF4EC', accent: lire('--accent') || '#D8446E',
              bord: '#DAD3C8', encre: '#3B2A20', discret: '#8A7F70' };

  const mesure = document.createElement('canvas').getContext('2d');

  // Les flèches sont déjà tracées à l'écran : on reprend le même SVG, en
  // remplaçant seulement les couleurs nommées, qui n'existeront plus hors
  // de la page.
  let fleches = svgSource ? svgSource.innerHTML : '';
  fleches = fleches.replace(/var\(--accent\)/g, C.accent);

  let corps = '';
  wrap.querySelectorAll('.schema-ing-item').forEach(el=>{
    corps += boiteSvg(mesure, local(el), el.textContent,
      {rayon:10, fond:C.carteHi, trait:C.accent, encre:C.encre, tirets:true});
  });
  wrap.querySelectorAll('.schema-box').forEach(el=>{
    const cible = el.hasAttribute('data-merge-target');
    corps += boiteSvg(mesure, local(el), el.textContent,
      {rayon:12, fond: cible ? C.carteHi : C.carte, trait: cible ? C.accent : C.bord, encre:C.encre});
  });
  wrap.querySelectorAll('.schema-ing-part-label').forEach(el=>{
    const r = local(el);
    corps += `<text x="${r.x.toFixed(1)}" y="${(r.y + r.h - 3).toFixed(1)}" font-family="sans-serif"
      font-size="9.5" fill="${C.discret}" letter-spacing="0.5">${echapper(el.textContent.toUpperCase())}</text>`;
  });

  const largeur = L + MARGE*2;
  const hauteur = H + MARGE*2 + (titre ? 34 : 0);
  const decalage = titre ? 34 : 0;
  const enTete = titre
    ? `<text x="${MARGE}" y="22" font-family="Georgia,serif" font-size="16" font-weight="600"
         fill="${C.encre}">${echapper(titre)}</text>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}"
      viewBox="0 0 ${largeur} ${hauteur}">
    <rect width="${largeur}" height="${hauteur}" fill="${C.fond}"/>
    ${enTete}
    <g transform="translate(0,${decalage})">
      <defs><marker id="fl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5"
        orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.accent}"/></marker></defs>
      <g transform="translate(${dx.toFixed(1)},${dy.toFixed(1)})">${fleches.replace(/schema-arrowhead/g,'fl')}</g>
      ${corps}
    </g>
  </svg>`;

  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image();
  await new Promise((ok, ko)=>{ img.onload = ok; img.onerror = ()=>ko(new Error('rendu impossible')); img.src = url; });

  const toile = document.createElement('canvas');
  toile.width = Math.round(largeur * ECHELLE);
  toile.height = Math.round(hauteur * ECHELLE);
  const ctx = toile.getContext('2d');
  ctx.scale(ECHELLE, ECHELLE);
  ctx.drawImage(img, 0, 0);
  return await new Promise(ok=>toile.toBlob(ok, 'image/png'));
}
