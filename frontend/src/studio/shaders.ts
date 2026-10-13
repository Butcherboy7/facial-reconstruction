// GLSL snippets injected into three.js PBR materials (onBeforeCompile) so the face keeps real lighting
// while every facial feature is painted procedurally in the head's own object space (conforms to the scan).

export const VARY = /* glsl */ `varying vec3 vObj; varying vec3 vObjN; varying vec2 vDet;`
export const FUNCS = /* glsl */ `
float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
const float X0 = -0.07;
const float EYE_Y = 1.79;
const float BROW_Y = 2.34;
#define MOUTH_Y uMouthY   // the lip parting, measured on the reshaped mesh (rig.ts)
uniform float uHairline; uniform float uRecede; uniform float uBackEdge; uniform float uSideLong; uniform float uStyle;
float hairEdgeY(vec3 q){
  float ax = abs(q.x);
  float front = 3.05 + uHairline - 0.95*smoothstep(1.35,2.35,ax) + uRecede*0.7*smoothstep(0.3,1.5,ax)*smoothstep(-0.2,1.2,q.z);
  float t = smoothstep(1.3,-0.7,q.z);
  float e = mix(front, uBackEdge, t);
  // long hair also hangs beside the face / over the shoulders
  if (uSideLong > 0.5) e = mix(e, min(e, -0.9), smoothstep(1.55, 1.95, ax) * smoothstep(1.4, 0.7, q.z));
  return e;
}
float hairMask(vec3 pos){
  if (uStyle < 0.5) return 0.0;
  vec3 q = vec3(pos.x - X0, pos.y, pos.z);
  // same irregular edge as the hairline painted on the skin (paintFace), so the shell ends where the painted hair is densest
  float e = hairEdgeY(q) + (vnoise(q.xy*9.0 + q.z*3.0) - 0.5)*0.08 + (vnoise(q.xy*31.0) - 0.5)*0.035;
  return step(e, q.y);
}
float hairMaskSoft(vec3 pos){
  if (uStyle < 0.5) return 0.0;
  vec3 q = vec3(pos.x - X0, pos.y, pos.z);
  return smoothstep(hairEdgeY(q) - 0.02, hairEdgeY(q) + 0.4, q.y);   // shell thickness fades to zero at the edge: no helmet rim
}
`

export const SKIN_FRAG = /* glsl */ `
uniform vec3 uSkin; uniform vec3 uHair; uniform vec3 uIris; uniform vec3 uLip; uniform sampler2D uDetail;
uniform float uEyeX, uEyeSpacing, uEyeW, uEyeH, uEyeTilt, uEyeLid;
uniform float uBrowT, uBrowArch, uBrowUp;
uniform float uMouthW, uLipUp, uLipLo, uMouthY, uMouthS;   // uMouthY / uMouthS: lip parting height and mouth half-width, measured on the reshaped mesh
uniform float uBeard, uMust, uSide, uGoatee;
uniform float uAge, uGrey, uFemale;
uniform float uScarL, uScarR, uMole, uBirth, uFreckle, uWrinkleMark, uScarBrow;

float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
// procedural hair strands: one jittered stroke per grid cell (sc cells per unit), direction dir, length len cells,
// width wid cells, filled with probability dens. Anti-aliased with fwidth so fine hairs don't shimmer.
float strokes(vec2 q, float sc, vec2 dir, float len, float wid, float dens, float seed){
  vec2 g = q*sc + seed; vec2 cell = floor(g), f = fract(g);
  float aa = fwidth(g.x) * 1.2, w = max(wid, aa), fade = wid / w;
  float acc = 0.0;
  for (int dx=-1; dx<=1; dx++) for (int dy=-1; dy<=1; dy++){
    vec2 c = cell + vec2(float(dx), float(dy));
    float h = hash21(c + seed*1.7);
    if (h > dens) continue;
    vec2 ctr = vec2(float(dx), float(dy)) + vec2(hash21(c+3.7), hash21(c+8.1));
    vec2 dd = normalize(dir + (vec2(hash21(c+9.1), hash21(c+1.3)) - 0.5)*0.45);
    float l = len*(0.65 + 0.7*hash21(c+4.4));
    float d = seg(f, ctr - dd*l*0.5, ctr + dd*l*0.5);
    acc = max(acc, (1.0 - smoothstep(w*0.35, w, d)) * fade * (0.6 + 0.4*hash21(c+2.2)));
  }
  return acc;
}

float skinRough(vec3 pos, float r){           // T-zone (forehead, nose) is shinier than the cheeks
  vec2 p = vec2(pos.x - X0, pos.y);
  float tz = exp(-pow(length(vec2(p.x*0.9, (p.y-2.9)*0.8)), 2.0)*1.5) + exp(-pow(length(vec2(p.x*2.2, p.y-1.3)), 2.0)*2.5);
  float rr = r * (1.0 - 0.28*clamp(tz, 0.0, 1.0)) * (0.95 + 0.1*vnoise(p*40.0));
  // hair is matte: no skin sheen on brows, beard or moustache (a shiny black beard reads grey)
  float ax = abs(p.x);
  float brow = (1.0 - smoothstep(0.08, 0.16, abs(p.y - (BROW_Y + uBrowUp)))) * smoothstep(0.15, 0.3, ax) * (1.0 - smoothstep(1.25, 1.45, ax));
  float lips = (1.0 - smoothstep(0.12, 0.2, abs(p.y - uMouthY))) * (1.0 - smoothstep(uMouthS*0.9, uMouthS*1.05, ax));
  float beard = uBeard * smoothstep(1.3, 0.9, p.y) * smoothstep(-1.0, -0.6, p.y) * (1.0 - smoothstep(1.7, 1.95, ax)) * (1.0 - lips);
  float must = uMust * smoothstep(uMouthY + 0.08, uMouthY + 0.14, p.y) * (1.0 - smoothstep(uMouthY + 0.32, uMouthY + 0.4, p.y)) * (1.0 - smoothstep(uMouthS, uMouthS*1.35, ax));
  return mix(rr, 1.0, clamp(max(brow, max(beard, must)), 0.0, 1.0));
}

vec3 paintFace(vec3 pos, vec3 nrm, vec3 base){
  vec2 p = vec2(pos.x - X0, pos.y);
  float front = smoothstep(0.1, 0.55, nrm.z);
  vec3 col = base;
  float skinLum = dot(base, vec3(0.3,0.59,0.11));
  // real skin micro-variation from the scan's own albedo (high-pass), then pores + gentle mottling
  col *= mix(1.0, clamp(texture2D(uDetail, vDet).r*2.0, 0.55, 1.6), 0.25 - 0.1*uFemale);
  col *= 0.99 + 0.02*vnoise(p*55.0);
  col *= 0.97 + 0.06*vnoise(p*7.0 + 3.0);
  // warm flush on cheeks / nose, cooler forehead
  float cheek = exp(-pow(length(vec2((abs(p.x)-1.25)*0.9, p.y-1.0)),2.0)*1.6);
  float noseF = exp(-pow(length(vec2(p.x*1.4, p.y-1.3)),2.0)*3.2);
  col = mix(col, col*vec3(1.08,0.9,0.88), (cheek*0.45+noseF*0.5)*front);
  col = mix(col, col*vec3(1.07,0.86,0.88), uFemale*cheek*0.45*front);          // soft blush
  float earR = smoothstep(1.9, 2.3, abs(p.x)) * smoothstep(0.5, 1.4, p.y) * (1.0 - smoothstep(2.6, 3.3, p.y));
  col = mix(col, col*vec3(1.06,0.88,0.86), earR*0.6 + noseF*0.25);                          // blood-rich ears and nose tip

  // ---- eyes (painted on the sculpted closed lids so shape/colour/size are fully controllable) ----
  float ex = EYE_Y;
  vec3 eyeCol = vec3(0.0); float eyeA = 0.0; float socket = 0.0;
  for (int k=0;k<2;k++){
    float s = k==0 ? -1.0 : 1.0;
    vec2 d = p - vec2(s*uEyeX, ex);
    float ca = cos(uEyeTilt*s*-1.0), sa = sin(uEyeTilt*s*-1.0);
    d = vec2(ca*d.x - sa*d.y, sa*d.x + ca*d.y);
    float hw = 0.34*uEyeW, hh = 0.14*uEyeH;
    float ax = clamp(d.x/hw, -1.0, 1.0);
    float prof = pow(max(1.0-ax*ax,0.0), 0.8);
    float up = hh*prof*(1.0-0.25*uEyeLid), lo = hh*prof*0.95;   // lower edge sits on the scan's real lower lid (y ~1.62), no bare strip under the eye
    float yn = d.y>0.0 ? d.y/max(up,1e-4) : -d.y/max(lo,1e-4);
    float inside = 1.0 - smoothstep(0.9, 1.0, max(yn, abs(d.x)/hw));
    socket = max(socket, exp(-pow(length(vec2(d.x/(hw*2.2), d.y/(hh*5.0))),2.0)*1.2));
    if (inside > 0.0){
      vec3 scl = mix(vec3(0.8,0.77,0.74), vec3(0.58,0.48,0.45), pow(abs(ax),1.6));
      scl *= 1.0 - 0.45*smoothstep(0.0,1.0,yn)*step(0.0,d.y);   // lid shadow on the white
      float ir = hh*1.3; float rr = length(d - vec2(0.0, 0.02));   // iris tucked under the upper lid
      float irisM = 1.0 - smoothstep(ir*0.9, ir, rr);
      float ang = atan(d.y, d.x);
      vec2 rdir = vec2(cos(ang), sin(ang));                                              // seamless round the iris
      vec3 ic = uIris * (0.72 + 0.5*vnoise(rdir*16.0 + rr*4.0) + 0.15*vnoise(rdir*40.0));        // fine radial fibres
      ic *= 1.0 + 0.22*exp(-pow((rr/ir - 0.52)/0.09, 2.0));                                          // lighter collarette ring round the pupil
      ic = mix(ic, ic*0.45, smoothstep(ir*0.62, ir, rr)); ic *= 1.0 - 0.35*smoothstep(0.1,0.9,yn)*step(0.0,d.y);
      float pup = 1.0 - smoothstep(ir*0.36, ir*0.42, rr);
      vec3 e = mix(scl, ic, irisM); e = mix(e, vec3(0.02), pup*irisM);
      e += vec3(1.0) * (1.0 - smoothstep(0.0, ir*0.13, length(d - vec2(-ir*0.3, ir*0.25)))) * 0.75;
      float rim = smoothstep(0.78, 1.0, max(yn, abs(d.x)/hw*0.9));
      vec3 rimC = d.y > 0.0 ? vec3(0.05,0.03,0.03) : base*vec3(0.95,0.7,0.66);         // dark upper lid line, pink lower waterline
      e = mix(e, rimC, rim*(d.y>0.0?0.95:0.75));
      float car = smoothstep(0.72, 1.0, -d.x*s/hw) * (1.0 - irisM);                      // caruncle at the inner corner
      e = mix(e, vec3(0.8,0.48,0.45), car*0.75);
      eyeCol = mix(eyeCol, e, inside); eyeA = max(eyeA, inside);
    }
    float cr = exp(-pow((d.y - (up + 0.07 + 0.05*uEyeLid))/0.022, 2.0)) * smoothstep(1.0,0.5,abs(ax));
    col *= 1.0 - 0.28*cr*front;
    float lash = exp(-pow((d.y - up)/0.016, 2.0)) * (1.0 - smoothstep(0.85,1.0,abs(ax)));
    col = mix(col, vec3(0.04,0.03,0.03), lash*0.85*front*(0.55+0.45*uFemale));
    // upper lashes: short curved strands, longer and more outward toward the outer corner
    float lb = smoothstep(up + 0.065 + 0.03*uFemale, up, d.y) * step(up - 0.012, d.y) * (1.0 - smoothstep(0.75, 1.05, abs(ax)));
    if (lb > 0.0){
      vec2 ldir = vec2(clamp(d.x/hw, -1.0, 1.0)*0.9, 1.0);
      float ls = max(strokes(d, 150.0, ldir, 2.6 + 1.2*uFemale, 0.13, 0.9, 41.0), strokes(d, 200.0, ldir, 2.6 + 1.2*uFemale, 0.12, 0.9, 43.0));
      col = mix(col, vec3(0.03,0.02,0.02), ls*lb*front*(0.7 + 0.3*uFemale));
    }
    // lower lashes: sparse and fine
    float lbl = smoothstep(-lo - 0.035, -lo, d.y) * step(d.y, -lo + 0.005) * (1.0 - smoothstep(0.6, 0.95, abs(ax)));
    if (lbl > 0.0) col = mix(col, vec3(0.08,0.05,0.04), strokes(d, 170.0, vec2(0.0,-1.0), 1.6, 0.1, 0.55, 47.0)*lbl*front*0.6);
  }
  col *= 1.0 - (0.12 + 0.10*uAge + 0.06*uFemale)*socket*front;
  col = mix(col, eyeCol, eyeA*front);

  // ---- eyebrows: individual hairs (inner ones grow upward, the rest sweep outward), skin showing through ----
  float browA = 0.0, browBase = 0.0, browFill = 0.0;
  for (int k=0;k<2;k++){
    float s = k==0 ? -1.0 : 1.0;
    float sp = uEyeX/0.615; float inner = 0.26*sp, outer = 1.3*sp;
    float t = (abs(p.x) - inner) / (outer - inner);
    if (p.x*s > 0.0 && t > -0.08 && t < 1.08){
      // every brow has a slight arch (peaking about two-thirds out) and a tail that dips and thins
      float yc = BROW_Y + uBrowUp + (0.025 + uBrowArch*0.05)*sin(t*3.1416*0.9) - 0.11*t*t;
      float th = max(0.05 + 0.03*uBrowT, 0.043) * (1.0 - 0.6*t*t) * (0.7+0.3*smoothstep(-0.05,0.15,t));
      float v = (p.y - yc) / th;
      float env = (1.0 - smoothstep(0.55, 1.15, abs(v + 0.1*vnoise(p*30.0)))) * smoothstep(-0.08, 0.06, t) * (1.0 - smoothstep(0.92, 1.08, t));
      if (env > 0.0){
        float ang = mix(1.25, 0.2, smoothstep(0.0, 0.45, t));            // radians from horizontal
        vec2 dir = vec2(cos(ang)*s, sin(ang)) + vec2(0.0, -0.25*v*smoothstep(0.3,1.0,t));
        float dn = clamp(0.7 + 0.2*uBrowT, 0.64, 0.98);
        float hairs = max(strokes(p, 38.0, dir, 1.6, 0.11, dn, 1.0), strokes(p, 52.0, dir, 1.7, 0.1, dn, 7.0));
        hairs = max(hairs, strokes(p, 30.0, dir, 1.5, 0.12, dn*0.8, 13.0));
        browA = max(browA, hairs * env);
        browBase = max(browBase, env);
        browFill = max(browFill, env * smoothstep(-0.05, 0.25, t) * (1.0 - 0.6*smoothstep(0.55, 1.0, t)) * (1.0 - 0.45*abs(v)));   // soft head, dense body, thinning tail
      }
    }
  }
  vec3 bc = mix(uHair, vec3(0.08,0.06,0.05), 0.5);                        // brows read a shade darker than scalp hair
  col = mix(col, col*mix(vec3(1.0), bc*2.2, 0.45), browBase*0.6*front);   // faint tint where the brow grows
  col = mix(col, bc*(0.75+0.5*vnoise(p*90.0)), clamp(browA,0.,1.)*front*0.95);
  // from a normal viewing distance single hairs are smaller than a pixel: fill in their combined density so brows don't fade to a pale bar
  float far = smoothstep(0.004, 0.016, fwidth(p.x));
  col = mix(col, bc*0.85, browFill*far*front*(0.62 + 0.12*uBrowT));

  // ---- lips: cupid's bow, soft vermilion border, darker towards the mouth line, highlight on the lower lip ----
  float hw = uMouthS; float my = p.y - MOUTH_Y;   // half-width measured from the mesh
  float u = p.x / hw, au = abs(u);
  float body = sqrt(max(1.0 - au*au, 0.0));
  float bow = 1.0 - 0.28*exp(-pow(u/0.13, 2.0)) + 0.08*exp(-pow((au-0.28)/0.12, 2.0));   // dip in the middle, peaks either side
  float ml = -0.006*u*u;                                                                    // mouth line, corners slightly lower
  // heights match the scan's vermilion (about 0.17 each at the centre), tapering to nothing at the corners
  float uh = 0.16*(1.0 + 0.45*(uLipUp - 1.0))*bow*pow(body, 0.9), lh = 0.17*(1.0 + 0.45*(uLipLo - 1.2))*pow(body, 0.75);
  float yUp = my - ml, inUp = (1.0 - smoothstep(uh - 0.025, uh + 0.008, yUp)) * step(0.0, yUp);
  float inLo = (1.0 - smoothstep(lh - 0.04, lh + 0.01, -yUp)) * step(yUp, 0.0);
  float lipM = clamp(inUp + inLo, 0.0, 1.0) * (1.0 - smoothstep(0.88, 1.0, au)) * front;
  vec3 lipC = mix(col, uLip, 0.6 + 0.18*uFemale);
  lipC *= 1.0 - 0.25*exp(-pow(yUp/0.04, 2.0));                                              // darker near the parting
  lipC *= 1.0 - 0.1*smoothstep(0.0, 0.6, yUp/max(uh, 1e-3)) * step(0.0, yUp);               // the upper lip faces down, so it reads darker
  lipC += vec3(0.07,0.05,0.05) * exp(-pow((yUp + lh*0.45)/(lh*0.28+0.001), 2.0)) * exp(-pow(u/0.45, 2.0)) * step(yUp, 0.0); // lower-lip sheen
  lipC *= 0.92 + 0.08*vnoise(vec2(p.x*120.0, p.y*18.0));                                     // fine vertical lip lines
  col = mix(col, lipC, lipM);
  col *= 1.0 - 0.12*exp(-pow((yUp - uh - 0.012)/0.012, 2.0)) * (1.0 - smoothstep(0.8,1.0,au)) * front;    // vermilion border
  col *= 1.0 - 0.55*exp(-pow(yUp/0.009, 2.0)) * (1.0 - smoothstep(0.92, 1.08, au)) * front;            // mouth line
  col *= 1.0 - 0.3*exp(-pow(length(vec2((au-1.0)*hw, yUp))/0.03, 2.0)) * front;                     // corners
  col *= 1.0 - 0.6*smoothstep(0.3, 0.7, nrm.y)*exp(-pow(yUp/0.035, 2.0))*(1.0 - smoothstep(0.9, 1.05, au)); // inner lip surface in the parting stays in shadow
  col *= 1.0 - 0.12*exp(-pow((yUp + lh + 0.06)/0.05, 2.0)) * (1.0 - smoothstep(0.5, 1.1, au)) * front; // shadow under lower lip

  // ---- facial hair ----
  // cheek line: under the nose in the middle, dipping to the mouth corners, then rising diagonally to the sideburns
  float bax = abs(p.x);
  float edgeY = mix(0.84, 0.62, smoothstep(0.3, 0.7, bax)) + 0.85*smoothstep(0.7, 1.9, bax) + (vnoise(p*9.0)-0.5)*0.12;
  float below = smoothstep(edgeY + 0.08, edgeY - 0.22, p.y);
  float bfront = smoothstep(-0.35, 0.15, nrm.z);                          // beards wrap the jaw round to the ears
  float xl = mix(1.95, 1.72, smoothstep(0.4, 0.8, p.y));                  // stop short of the ear
  float jaw = (1.0 - smoothstep(xl - 0.3, xl, bax)) * smoothstep(-0.95, -0.55, p.y) * below * bfront;
  // hair coordinates wrapped round the head (arc length), so strands don't smear into streaks on the jaw sides or under the chin
  vec2 bq = vec2(atan(p.x, pos.z + 0.4)*2.4, p.y - pos.z*0.7*smoothstep(0.3, 0.8, -nrm.y));
  // no hair on the lips themselves, except that a beard's moustache hangs a little over the top of the upper lip
  float hole = clamp(inUp * smoothstep(uh*1.05, uh*0.65, yUp) + inLo, 0.0, 1.0) * (1.0 - smoothstep(0.92, 1.06, au));
  jaw *= 1.0 - hole;
  float gjaw = (1.0 - smoothstep(0.5,0.9,abs(p.x))) * step(p.y, MOUTH_Y-0.18) * smoothstep(-0.8,-0.4,p.y);
  float bm = mix(jaw, gjaw*(1.0-hole), uGoatee);
  float dens = uBeard;                                                    // 0..1 (stubble .38, short .72, full 1)
  vec3 hc = uHair*0.78;
  float bmF = clamp(bm, 0.0, 1.0) * bfront * step(0.02, dens);
  float bCore = bmF*bmF;                                                   // solid fill only well inside the edge; strands thin out toward it
  // cheeks: hair grows down; under the jaw it turns toward the neck
  vec2 bdir = vec2(-0.25*sign(p.x)*smoothstep(0.2, 1.2, abs(p.x)), -1.0);
  col = mix(col, col*vec3(0.72,0.74,0.8), mix(bmF, bCore, 0.6)*clamp(dens*1.6,0.0,1.0)*0.7);              // shaved-skin shadow
  float fol = bmF <= 0.0 ? 0.0 : max(strokes(bq, 120.0, bdir, 0.6, 0.24, 0.9, 3.0), strokes(bq, 170.0, bdir, 0.6, 0.22, 0.9, 4.0));                            // stubble follicles
  float stub = smoothstep(0.02, 0.3, dens);
  col = mix(col, hc*0.5, mix(bmF, bCore, 0.5)*stub*0.32);                                // average stubble tone, so it still reads when the follicles are sub-pixel
  col = mix(col, hc*0.45, fol*bmF*stub*0.95);
  float longH = smoothstep(0.5, 0.75, dens);                                             // short and full beards
  if (longH > 0.0){
    float bh = max(strokes(bq, 70.0, bdir, 2.4, 0.16, 0.95, 5.0), strokes(bq, 95.0, bdir, 2.2, 0.14, 0.95, 11.0));
    bh = max(bh, strokes(bq, 55.0, bdir, 2.6, 0.15, 0.9, 17.0));
    float fill = smoothstep(0.7, 1.0, dens);
    col = mix(col, hc*0.75, bCore*longH*(0.3 + 0.3*fill));
    col = mix(col, mix(hc*0.45, hc*1.6 + 0.05, vnoise(bq*55.0)), bh*bmF*longH*0.9);
  }
  // moustache: strands fanning down and outward from the philtrum
  float mu = (1.0 - smoothstep(0.85*hw, 1.35*hw, abs(p.x))) * smoothstep(MOUTH_Y+0.1, MOUTH_Y+0.16, p.y) * (1.0 - smoothstep(MOUTH_Y+0.3, MOUTH_Y+0.38, p.y)) * front;   // from the lip border up to the nose
  if (uMust > 0.0 && mu > 0.0){
    vec2 mdir = vec2(sign(p.x)*0.55, -1.0);
    float ms = max(strokes(p, 75.0, mdir, 2.2, 0.15, 0.95, 21.0), strokes(p, 100.0, mdir, 2.0, 0.13, 0.95, 23.0));
    col = mix(col, hc*0.7, mu*uMust*0.6);
    col = mix(col, hc*(0.6+0.6*vnoise(p*65.0)), ms*mu*uMust*0.9);
  }
  // sideburns
  float sb = (1.0 - smoothstep(0.0,0.25, abs(abs(p.x)-1.9) - 0.2)) * step(1.0,p.y) * (1.0 - smoothstep(1.6 + uSide*0.8, 2.0 + uSide*0.8, p.y)) * step(0.01, uSide) * bfront;
  if (sb > 0.0){
    float ss = strokes(bq, 70.0, vec2(0.0,-1.0), 2.2, 0.15, 0.95, 31.0);
    col = mix(col, hc*0.7, sb*0.5); col = mix(col, hc, ss*sb*0.8);
  }

  // ---- ageing ----
  float wr = 0.0;
  for (int k=0;k<5;k++){ float yy = 2.62 + 0.17*float(k); wr += exp(-pow((p.y - yy - 0.05*sin(p.x*3.0+float(k)))/0.012,2.0)) * (1.0 - smoothstep(1.4,1.9,abs(p.x))) * step(0.45, vnoise(vec2(p.x*5.0, float(k)*3.0))); }
  for (int k=0;k<2;k++){ float s = k==0?-1.0:1.0; vec2 a = vec2(s*0.95, 1.18), b = vec2(s*1.15, 0.38);
     wr += (1.0 - smoothstep(0.0,0.03, seg(p,a,b))) * 0.9;                                // nasolabial
     for (int j=0;j<3;j++){ float oj = float(j)*0.11; wr += (1.0 - smoothstep(0.0,0.014, seg(p, vec2(s*(1.55),EYE_Y+0.05-oj*0.2), vec2(s*(1.95),EYE_Y+0.2-oj*0.9)))) * 0.8; } // crow's feet
     wr += exp(-pow((p.y-(EYE_Y-0.3))/0.02,2.0)) * (1.0 - smoothstep(0.2,0.6,abs(abs(p.x)-0.8)))*0.9; // under-eye bag line
  }
  col *= 1.0 - clamp(wr,0.0,1.0)*(0.03 + 0.12*uAge)*uWrinkleMark*front*smoothstep(0.0,0.2,uAge);
  col = mix(col, vec3(dot(col,vec3(0.33))), 0.15*uAge);   // dulling

  // ---- marks ----
  vec2 sl = vec2(1.1, 0.78), sl2 = vec2(1.45, 1.35);
  float scarL = (1.0 - smoothstep(0.0,0.022, seg(p, sl, sl2)));
  for (int j=0;j<4;j++){ float tj = 0.2 + 0.2*float(j); vec2 c = mix(sl, sl2, tj); scarL += (1.0 - smoothstep(0.0,0.014, seg(p, c+vec2(-0.07,-0.03), c+vec2(0.07,0.03)))) * 0.7; }
  float scarR = (1.0 - smoothstep(0.0,0.022, seg(p, vec2(-sl.x, sl.y), vec2(-sl2.x, sl2.y))));
  float scarB = (1.0 - smoothstep(0.0,0.02, seg(p, vec2(0.95, EYE_Y+0.4), vec2(1.1, EYE_Y+0.8))));
  vec3 scarC = mix(base, vec3(0.88,0.6,0.58), 0.55);
  col = mix(col, scarC, clamp(scarL*uScarL + scarR*uScarR + scarB*uScarBrow, 0.,1.)*front);
  col = mix(col, vec3(0.1,0.06,0.05), (1.0 - smoothstep(0.03,0.055, length(p - vec2(1.35,0.45))))*uMole*front);
  col = mix(col, base*vec3(0.62,0.42,0.34), (1.0 - smoothstep(0.1,0.22, length((p - vec2(0.55,3.0))*vec2(1.0,1.5))))*uBirth*front*0.75);
  float fr = step(0.93, hash21(floor(p*85.0))) * exp(-pow(length(vec2(p.x*0.7,(p.y-1.55)*1.2)),2.0)*1.2);
  col = mix(col, base*vec3(0.62,0.45,0.35), fr*uFreckle*front*0.8);
  // soft hairline painted on the scalp so the hair edge fades in like real hair, not a helmet rim
  if (uStyle > 0.5) {
    vec3 hq = vec3(pos.x - X0, pos.y, pos.z);
    float he = hairEdgeY(hq) + (vnoise(hq.xy*9.0 + hq.z*3.0) - 0.5)*0.08 + (vnoise(hq.xy*31.0) - 0.5)*0.035;
    float band = smoothstep(he - 0.22, he + 0.04, hq.y);
    col = mix(col, uHair*0.62, band*band * 0.8);                                              // scalp shows hair colour under the edge, densest where the hair begins
    float wisps = band <= 0.0 || band >= 1.0 ? 0.0 : max(strokes(p, 90.0, vec2(0.15*sign(p.x), 1.0), 2.4, 0.13, 0.9, 51.0), strokes(p, 130.0, vec2(-0.1*sign(p.x), 1.0), 2.2, 0.12, 0.9, 53.0));
    col = mix(col, uHair*0.8, wisps * smoothstep(he - 0.18, he + 0.02, hq.y) * 0.85);         // fine baby hairs along the hairline
    col = mix(col, uHair*0.62, smoothstep(he + 0.0, he + 0.08, hq.y));
  }
  return col;
}
`

export const HAIR_FRAG = /* glsl */ `
uniform vec3 uHair; uniform float uGrey; uniform float uCurl;
vec3 hairColor(vec3 pos){
  vec2 p = vec2(pos.x - X0, pos.y);
  float st = vnoise(vec2(p.x*38.0 + pos.z*6.0, p.y*5.0 + pos.z*5.0));
  float st2 = vnoise(vec2(p.x*90.0, p.y*16.0 + pos.z*9.0));
  vec3 c = uHair * (0.82 + 0.3*st + 0.14*st2);
  c = mix(c, vec3(0.6,0.6,0.62) * (0.8+0.3*st2), uGrey * 0.75 * smoothstep(0.2,0.8,st+0.4*st2));
  return c;
}
`
