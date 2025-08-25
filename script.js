/*************************************
 * CONFIG
 *************************************/
const IMG_DIR = "img";
const EXT = ".jpg"; // si usas PNG, cambia a ".png"
const SRC = n => `${IMG_DIR}/page${String(n).padStart(2,"0")}${EXT}`;

/* Duración y geometría del “corner peel” inferior */
const DURATION = 650;      // ms (velocidad)
const CURL_X   = 220;      // px -> cuánto entra horizontal desde la esquina
const CURL_Y   = 220;      // px -> cuánto sube verticalmente
const CURL_ANG = 25;       // deg -> inclinación del pliegue

/*************************************
 * Elementos
 *************************************/
const book = document.getElementById("book");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const zoomRange = document.getElementById("zoomRange");
const soundToggle = document.getElementById("soundToggle");
const flipSnd = document.getElementById("flipSnd");

/*************************************
 * Plan de hojas EXACTO:
 *  0: portada (der=01)
 *  1: [izq=02 | der=03]
 *  2: [izq=04 | der=05]
 *  3: [izq=06 | der=07]
 *  4: [izq=08 | der=09]
 *  5: contraportada (izq=10)
 *************************************/
const sheetsPlan = [
  { left: null, right:  1 },
  { left:  2,   right:  3 },
  { left:  4,   right:  5 },
  { left:  6,   right:  7 },
  { left:  8,   right:  9 },
  { left: 10,   right: null }
];

const SHEETS = sheetsPlan.length;
const LAST   = SHEETS - 1;
const sheets = [];
let current = 0;            // 0..LAST
let isAnimating = false;

/*************************************
 * Construcción del DOM
 *************************************/
for (let i = 0; i < SHEETS; i++) {
  const plan = sheetsPlan[i];
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.style.setProperty("--z", SHEETS - i);

  // IZQUIERDA
  const left = document.createElement("div");
  left.className = "page left";
  if (plan.left) {
    const img = document.createElement("img");
    img.alt = `Página ${plan.left}`;
    img.loading = "lazy";
    img.src = SRC(plan.left);
    left.appendChild(img);
  }
  const curlL = document.createElement("div");
  curlL.className = "curl";
  left.appendChild(curlL);

  // DERECHA
  const right = document.createElement("div");
  right.className = "page right";
  if (plan.right) {
    const img = document.createElement("img");
    img.alt = `Página ${plan.right}`;
    img.loading = "lazy";
    img.src = SRC(plan.right);
    right.appendChild(img);
  }
  const curlR = document.createElement("div");
  curlR.className = "curl";
  right.appendChild(curlR);

  sheet.appendChild(left);
  sheet.appendChild(right);
  book.appendChild(sheet);
  sheets.push(sheet);
}

/*************************************
 * Portada/contraportada y visibilidad
 *************************************/
function setBookCovers() {
  book.classList.toggle("cover-start", current === 0);
  book.classList.toggle("cover-end",   current === LAST);
}

/* Mostrar SOLO la hoja actual cuando no animamos */
function refreshVisibility() {
  sheets.forEach((s, idx) => {
    if (idx === current) {
      s.classList.add("show");
      s.style.visibility = "visible";
    } else {
      s.classList.remove("show");
      s.style.visibility = "hidden";
    }
  });
  setBookCovers();
}

function updateUI() {
  btnPrev.disabled = current === 0;
  btnNext.disabled = current === LAST;
  refreshVisibility();
}

/*************************************
 * Sonido
 *************************************/
function playFlipSound() {
  if (!soundToggle || !soundToggle.checked || !flipSnd) return;
  try {
    flipSnd.currentTime = 0;
    const p = flipSnd.play();
    if (p && typeof p.then === "function") p.catch(() => {});
  } catch {}
}
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  try { flipSnd.play().then(()=>{ flipSnd.pause(); audioUnlocked=true; }).catch(()=>{}); } catch {}
}
["click","keydown","touchstart"].forEach(ev => window.addEventListener(ev, unlockAudio, { once:true }));

/*************************************
 * Easing
 *************************************/
function easeInOutCubic(t){ return t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

/*************************************
 * Animación “corner peel” desde abajo
 *************************************/
function animateCorner(el) {
  // Detectar si es derecha o izquierda para el ángulo
  const isRight = el.closest(".page").classList.contains("right");
  const angSign = isRight ? 1 : -1;

  return new Promise(resolve => {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const k = easeInOutCubic(t);

      const ex = CURL_X * k;  // 0 → CURL_X
      const ey = CURL_Y * k;  // 0 → CURL_Y (sube desde abajo por el clip-path)

      el.style.setProperty("--t",  k);
      el.style.setProperty("--ex", ex + "px");
      el.style.setProperty("--ey", ey + "px");
      el.style.setProperty("--ang", (angSign * CURL_ANG * k) + "deg");

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Reset para siguiente animación
        requestAnimationFrame(() => {
          el.style.setProperty("--t",  0);
          el.style.setProperty("--ex", "0px");
          el.style.setProperty("--ey", "0px");
          el.style.setProperty("--ang","0deg");
        });
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

/*************************************
 * Navegación (una hoja visible; peel inferior)
 *************************************/
async function nextPage() {
  if (isAnimating || current >= LAST) return;
  isAnimating = true;

  const sheet = sheets[current];
  const rightCurl = sheet.querySelector(".page.right .curl");

  // Si vamos a la contraportada, mantener abierto durante la animación
  const goingToEnd = (current + 1 === LAST);
  if (goingToEnd) book.classList.remove("cover-start", "cover-end");

  sheet.classList.add("show");
  sheet.style.visibility = "visible";
  sheet.classList.add("curling-next");

  await animateCorner(rightCurl);
  playFlipSound();

  sheet.classList.remove("curling-next");
  sheet.classList.add("passed");

  current++;
  isAnimating = false;
  updateUI();
}

async function prevPage() {
  if (isAnimating || current <= 0) return;
  isAnimating = true;

  const toIdx   = current - 1;
  const toSheet = sheets[toIdx];

  // Traer la hoja anterior al frente y visible
  toSheet.classList.remove("passed");
  toSheet.classList.add("show");
  toSheet.style.visibility = "visible";

  // z-index temporal alto para que el pliegue quede por encima
  const oldZ = toSheet.style.zIndex;
  toSheet.style.zIndex = String(SHEETS + 10);

  // Si vamos a la portada, mantener abierto durante la animación
  const goingToCover = (toIdx === 0);
  if (goingToCover) book.classList.remove("cover-start", "cover-end");

  // Fuerza reflow antes de animar
  void toSheet.offsetWidth;
  toSheet.classList.add("curling-prev");

  // Doblamos la IZQUIERDA desde la esquina inferior izquierda
  const leftCurl = toSheet.querySelector(".page.left .curl");
  await animateCorner(leftCurl);
  playFlipSound();

  toSheet.classList.remove("curling-prev");
  toSheet.style.zIndex = oldZ || "";

  current = toIdx;
  isAnimating = false;
  updateUI();
}

/*************************************
 * Controles
 *************************************/
btnNext.addEventListener("click", nextPage);
btnPrev.addEventListener("click", prevPage);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") nextPage();
  if (e.key === "ArrowLeft")  prevPage();
});

let startX = null;
book.addEventListener("pointerdown", (e) => (startX = e.clientX));
book.addEventListener("pointerup", (e) => {
  if (startX === null) return;
  const dx = e.clientX - startX;
  if (dx < -30) nextPage();
  if (dx >  30) prevPage();
  startX = null;
});

/* Zoom */
zoomRange.addEventListener("input", () => {
  const z = parseFloat(zoomRange.value);
  book.style.transform = `scale(${z})`;
});
book.addEventListener("dblclick", () => {
  const z = parseFloat(zoomRange.value);
  const next = (z < 1.4) ? Math.min(1.4, z + 0.2) : 1;
  zoomRange.value = String(next);
  book.style.transform = `scale(${next})`;
});

/* Estado inicial */
updateUI();
