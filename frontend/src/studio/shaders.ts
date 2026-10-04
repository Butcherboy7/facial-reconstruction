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
const float MOUTH_Y = 0.44;
uniform float uHairline; uniform float uRecede; uniform float uBackEdge; uniform float uSideLong; uniform float uStyle;
float hairEdgeY(vec3 q){
  float ax = abs(q.x);
  float front = 3.05 + uHairline - 0.95*smoothstep(1.35,2.35,ax) + uRecede*0.7*smoothstep(0.3,1.5,ax)*smoothstep(-0.2,1.2,q.z);
  float t = smoothstep(1.3,-0.7,q.z);
  float e = mix(front, uBackEdge, t);
  // long hair also hangs beside the face / over the shoulders
  if (uSideLong > 0.5 && ax > 1.7) e = min(e, -0.9);
  return e;
}
float hairMask(vec3 pos){
  if (uStyle < 0.5) return 0.0;
  vec3 q = vec3(pos.x - X0, pos.y, pos.z);
  float n = vnoise(q.xy*14.0 + q.z*5.0);
  float e = hairEdgeY(q) + (n-0.5)*0.02;
  return step(e, q.y);
}
float hairMaskSoft(vec3 pos){
  if (uStyle < 0.5) return 0.0;
  vec3 q = vec3(pos.x - X0, pos.y, pos.z);
  return smoothstep(hairEdgeY(q) - 0.18, hairEdgeY(q) + 0.12, q.y);
}
`

export const SKIN_FRAG = /* glsl */ `
uniform vec3 uSkin; uniform vec3 uHair; uniform vec3 uIris; uniform vec3 uLip; uniform sampler2D uDetail;
uniform float uEyeX, uEyeSpacing, uEyeW, uEyeH, uEyeTilt, uEyeLid;
uniform float uBrowT, uBrowArch, uBrowUp;
uniform float uMouthW, uLipUp, uLipLo;
uniform float uBeard, uMust, uSide, uGoatee;
uniform float uAge, uGrey, uFemale;
uniform float uScarL, uScarR, uMole, uBirth, uFreckle, uWrinkleMark, uScarBrow;

float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }

vec3 paintFace(vec3 pos, vec3 nrm, vec3 base){
  vec2 p = vec2(pos.x - X0, pos.y);
  float front = smoothstep(0.1, 0.55, nrm.z);
  vec3 col = base;
  float skinLum = dot(base, vec3(0.3,0.59,0.11));
  // real skin micro-variation from the scan's own albedo (high-pass), then pores + gentle mottling
  col *= mix(1.0, clamp(texture2D(uDetail, vDet).r*2.0, 0.55, 1.6), 0.25);
  col *= 0.99 + 0.02*vnoise(p*55.0);
  col *= 0.97 + 0.06*vnoise(p*7.0 + 3.0);
  // warm flush on cheeks / nose, cooler forehead
  float cheek = exp(-pow(length(vec2((abs(p.x)-1.25)*0.9, p.y-1.0)),2.0)*1.6);
  float noseF = exp(-pow(length(vec2(p.x*1.4, p.y-1.3)),2.0)*3.2);
  col = mix(col, col*vec3(1.08,0.9,0.88), (cheek*0.45+noseF*0.5)*front);

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
    float up = hh*prof*(1.0-0.25*uEyeLid), lo = hh*prof*0.7;
    float yn = d.y>0.0 ? d.y/max(up,1e-4) : -d.y/max(lo,1e-4);
    float inside = 1.0 - smoothstep(0.9, 1.0, max(yn, abs(d.x)/hw));
    socket = max(socket, exp(-pow(length(vec2(d.x/(hw*2.2), d.y/(hh*5.0))),2.0)*1.2));
    if (inside > 0.0){
      vec3 scl = mix(vec3(0.8,0.77,0.74), vec3(0.58,0.48,0.45), pow(abs(ax),1.6));
      scl *= 1.0 - 0.45*smoothstep(0.0,1.0,yn)*step(0.0,d.y);   // lid shadow on the white
      float ir = hh*1.3; float rr = length(d - vec2(0.0, 0.02));   // iris tucked under the upper lid
      float irisM = 1.0 - smoothstep(ir*0.9, ir, rr);
      float ang = atan(d.y, d.x);
      vec3 ic = uIris * (0.7 + 0.5*vnoise(vec2(ang*3.0, rr*30.0)));
      ic = mix(ic, ic*0.45, smoothstep(ir*0.62, ir, rr)); ic *= 1.0 - 0.35*smoothstep(0.1,0.9,yn)*step(0.0,d.y);
      float pup = 1.0 - smoothstep(ir*0.36, ir*0.42, rr);
      vec3 e = mix(scl, ic, irisM); e = mix(e, vec3(0.02), pup*irisM);
      e += vec3(1.0) * (1.0 - smoothstep(0.0, ir*0.13, length(d - vec2(-ir*0.3, ir*0.25)))) * 0.75;
      float rim = smoothstep(0.78, 1.0, max(yn, abs(d.x)/hw*0.9));
      e = mix(e, vec3(0.05,0.03,0.03), rim*(d.y>0.0?0.95:0.45));
      eyeCol = mix(eyeCol, e, inside); eyeA = max(eyeA, inside);
    }
    float cr = exp(-pow((d.y - (up + 0.07 + 0.05*uEyeLid))/0.022, 2.0)) * smoothstep(1.0,0.5,abs(ax));
    col *= 1.0 - 0.28*cr*front;
    float lash = exp(-pow((d.y - up)/0.016, 2.0)) * (1.0 - smoothstep(0.85,1.0,abs(ax)));
    col = mix(col, vec3(0.04,0.03,0.03), lash*0.85*front*(0.55+0.45*uFemale));
  }
  col *= 1.0 - (0.12 + 0.10*uAge)*socket*front;
  col = mix(col, eyeCol, eyeA*front);

  // ---- eyebrows ----
  float browA = 0.0;
  for (int k=0;k<2;k++){
    float s = k==0 ? -1.0 : 1.0;
    float sp = uEyeX/0.615; float inner = 0.28*sp, outer = 1.3*sp;
    float t = (abs(p.x) - inner) / (outer - inner);
    if (p.x*s > 0.0 && t > 0.0 && t < 1.0){
      float yc = BROW_Y + uBrowUp + uBrowArch*0.05*sin(t*3.1416*0.9) - 0.08*t*t;
      float th = (0.05 + 0.03*uBrowT) * (1.0 - 0.55*t*t) * (0.6+0.4*smoothstep(0.0,0.2,t));
      float m = 1.0 - smoothstep(th*0.5, th, abs(p.y - yc));
      float st = vnoise(vec2(p.x*45.0, p.y*160.0));
      browA = max(browA, m * (0.55 + 0.45*st));
    }
  }
  vec3 bc = mix(uHair, vec3(0.1), 0.15);
  col = mix(col, bc*(0.8+0.3*vnoise(p*60.0)), browA*front*0.92);

  // ---- lips ----
  float hw = 0.52*uMouthW; float my = p.y - MOUTH_Y;
  float lx = 1.0 - smoothstep(0.78, 1.0, abs(p.x)/hw);
  float uh = 0.07*uLipUp, lh = 0.085*uLipLo;
  float lipV = my > 0.0 ? 1.0 - smoothstep(0.7,1.0,my/uh) : 1.0 - smoothstep(0.7,1.0,-my/lh);
  float lip = lx*lipV*front;
  col = mix(col, mix(col, uLip, 0.75), lip*(0.55 + 0.25*(1.0-smoothstep(0.0,0.9,abs(p.x)/hw))));
  col *= 1.0 - 0.45*exp(-pow(my/0.012,2.0))*lx*front;                      // mouth line
  col *= 1.0 - 0.1*exp(-pow((my+lh*1.55)/0.05,2.0))*lx*front;               // shadow under lower lip

  // ---- facial hair ----
  float below = smoothstep(1.0 - 0.25*pow(abs(p.x)/1.6,2.0), 0.7 - 0.25*pow(abs(p.x)/1.6,2.0), p.y);
  float jaw = (1.0 - smoothstep(1.35, 1.6, abs(p.x))) * smoothstep(-0.95, -0.55, p.y) * below * smoothstep(0.1, 0.5, nrm.z);
  float lipHole = 1.0 - smoothstep(0.0, 0.05, 0.0) ;
  float hole = (1.0 - smoothstep(0.85, 1.05, abs(p.x)/hw)) * (1.0 - smoothstep(0.0, 0.35, abs(my+0.02)/0.22));
  jaw *= 1.0 - hole*0.95;
  float gjaw = (1.0 - smoothstep(0.5,0.9,abs(p.x))) * (1.0 - smoothstep(MOUTH_Y-0.15, MOUTH_Y-0.5, p.y)*0.0) * step(p.y, MOUTH_Y-0.12) * smoothstep(-0.8,-0.4,p.y);
  float bm = mix(jaw, gjaw*(1.0-hole), uGoatee);
  float dens = uBeard;                                                    // 0..1 (stubble .35, short .7, full 1)
  float dots = step(hash21(floor(p*170.0)), dens*0.95);
  float strand = vnoise(vec2(p.x*60.0, p.y*18.0));
  float bA = bm * clamp(pow(dens,0.6)*(0.8+0.2*vnoise(p*vec2(30.0,12.0))), 0.0, 1.0) * step(0.02, dens);
  vec3 hc = uHair*0.78;
  col = mix(col, hc, clamp(bA,0.,1.)*front*0.8);
  // moustache
  float mu = (1.0 - smoothstep(0.45*uMouthW,0.75*uMouthW, abs(p.x))) * smoothstep(MOUTH_Y+0.04, MOUTH_Y+0.1, p.y) * (1.0 - smoothstep(MOUTH_Y+0.3, MOUTH_Y+0.4, p.y));
  float mdots = 0.75+0.25*vnoise(p*vec2(40.0,18.0));
  col = mix(col, hc*0.9, mu*uMust*mdots*front*0.92);
  // sideburns
  float sb = (1.0 - smoothstep(0.0,0.25, abs(abs(p.x)-1.9) - 0.2)) * step(1.0,p.y) * (1.0 - smoothstep(1.6 + uSide*0.8, 2.0 + uSide*0.8, p.y)) * step(0.01, uSide);
  col = mix(col, hc, sb*0.8*front);

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
  col = mix(col, uHair*0.55, hairMask(pos));
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
