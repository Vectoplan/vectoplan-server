import{$ as F,F as w,K as V,L as G,O as K,T as k,W as Z,_,b as Q,q as j,s as tt}from"./three-XZE9Igie.js";var et=8;function v(t){try{return typeof t=="object"&&t!==null&&!Array.isArray(t)}catch{return!1}}function H(t){try{return typeof t=="string"&&t.trim().length>0}catch{return!1}}function y(t,e=""){try{if(typeof t=="number"||typeof t=="boolean"||typeof t=="bigint")return String(t);if(typeof t!="string")return e;const n=t.trim();return n.length>0?n:e}catch{return e}}function M(t,e=null){try{if(t==null)return e;if(typeof t=="number"||typeof t=="boolean"||typeof t=="bigint")return String(t);if(typeof t!="string")return e;const n=t.trim();return n.length>0?n:e}catch{return e}}function B(t,e=0,n){try{const o=typeof t=="number"?t:typeof t=="string"?Number.parseFloat(t.trim()):NaN;if(!Number.isFinite(o))return e;const r=n?.min??Number.NEGATIVE_INFINITY,s=n?.max??Number.POSITIVE_INFINITY;return Math.min(s,Math.max(r,o))}catch{return e}}function Dt(t,e=0,n){try{return Math.trunc(B(t,e,n))}catch{return e}}function bt(t,e=!1){try{if(typeof t=="boolean")return t;if(typeof t=="number"&&Number.isFinite(t)){if(t===1)return!0;if(t===0)return!1}if(typeof t!="string")return e;const n=t.trim().toLowerCase();return["1","true","t","yes","y","on","enabled"].includes(n)?!0:["0","false","f","no","n","off","disabled"].includes(n)?!1:e}catch{return e}}function Et(t){try{return Array.isArray(t)?t:[]}catch{return[]}}function Nt(t){try{return v(t)?t:{}}catch{return{}}}function Ct(t){try{const e=new Set,n=[];for(const o of t){if(typeof o!="string")continue;const r=o.trim();r.length===0||e.has(r)||(e.add(r),n.push(r))}return n}catch{return[]}}function nt(t,e,n,o=e){try{const r=B(t,o);return Math.min(n,Math.max(e,r))}catch{return o}}function At(t,e,n,o=e){try{return Math.trunc(nt(t,e,n,o))}catch{return o}}function J(t){try{if(!v(t))return null;const e={};for(const[n,o]of Object.entries(t))n&&(e[n]=S(o));return Object.keys(e).length>0?e:null}catch{return null}}function L(t,e){try{return M(t[e],null)}catch{return null}}function ot(t){try{return t.cause??null}catch{return null}}function rt(t){try{return J(t.details)}catch{return null}}function it(t){return{name:y(t.name,"UnknownError"),message:y(t.message,"Unknown error."),stack:M(t.stack,null),code:M(t.code,null),type:M(t.type,null),cause:t.cause??null,details:J(t.details??t)}}function _t(t){try{return t instanceof Error?{name:y(t.name,"Error"),message:y(t.message,"Unknown error."),stack:M(t.stack,null),code:L(t,"code"),type:L(t,"type"),cause:ot(t),details:rt(t)}:v(t)?it(t):typeof t=="string"?{name:"Error",message:y(t,"Unknown error."),stack:null,code:null,type:null,cause:null,details:null}:{name:"UnknownError",message:"Unknown error.",stack:null,code:null,type:null,cause:t,details:null}}catch{return{name:"UnknownError",message:"Unknown error.",stack:null,code:null,type:null,cause:null,details:null}}}function It(t,e="Unknown error."){try{return t instanceof Error&&H(t.message)?t.message.trim():typeof t=="string"&&t.trim().length>0?t.trim():v(t)&&H(t.message)?t.message.trim():e}catch{return e}}function S(t,e=0){try{if(e>et)return"[max-depth]";if(t===null)return null;if(typeof t=="string"||typeof t=="boolean")return t;if(typeof t=="number")return Number.isFinite(t)?t:null;if(typeof t=="bigint")return String(t);if(t instanceof Date)return t.toISOString();if(Array.isArray(t)){const n=[];for(const o of t)n.push(S(o,e+1));return n}if(v(t)){const n={};for(const[o,r]of Object.entries(t))n[o]=S(r,e+1);return n}return t===void 0?null:String(t)}catch{return null}}function at(t,e){try{if(typeof t!="string")return e;const n=t.trim();return n.length===0?e:JSON.parse(n)}catch{return e}}function zt(t,e=500){try{if(t==null||typeof t=="string"||typeof t=="number"||typeof t=="boolean")return typeof t=="string"&&t.length>e?`${t.slice(0,e)}…`:S(t);const n=JSON.stringify(S(t));return n.length<=e?at(n,null):`${n.slice(0,e)}…`}catch{return"[unserializable]"}}var st="1970-01-01T00:00:00.000Z";function xt(){try{return new Date().toISOString()}catch{return st}}var x=Math.PI/180,I=180/Math.PI,ct=6,lt=28,ut=16,mt=48,ft=51.1657,dt=10.4515,Y=`
  varying vec3 vCloudDirection;

  void main() {
    vCloudDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,ht=`
  uniform float uTime;
  uniform float uDaylight;
  varying vec3 vCloudDirection;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int octave = 0; octave < 5; octave += 1) {
      value += amplitude * valueNoise(point);
      point = rotation * point * 2.03 + 17.17;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vCloudDirection);
    float longitude = atan(direction.z, direction.x) / 6.2831853 + 0.5;
    float latitude = asin(clamp(direction.y, -1.0, 1.0)) / 3.1415926 + 0.5;
    vec2 cloudUv = vec2(longitude * 8.0 + uTime, latitude * 4.2 - uTime * 0.18);
    float broad = fbm(cloudUv);
    float detail = fbm(cloudUv * 2.35 + vec2(7.4, -3.1));
    float density = smoothstep(0.49, 0.7, broad * 0.76 + detail * 0.34);
    float horizonMask = smoothstep(0.015, 0.15, direction.y);
    float zenithSoftening = 1.0 - smoothstep(0.82, 0.98, direction.y);
    float alpha = density * horizonMask * mix(1.0, 0.72, zenithSoftening) * 0.58;
    alpha *= mix(0.18, 1.0, uDaylight);

    vec3 shadowColor = vec3(0.55, 0.66, 0.75);
    vec3 lightColor = vec3(1.0, 0.985, 0.94);
    vec3 cloudColor = mix(shadowColor, lightColor, smoothstep(0.56, 0.82, broad));
    cloudColor *= mix(0.36, 1.0, uDaylight);
    gl_FragColor = vec4(cloudColor, alpha);
  }
`,pt=`
  varying vec3 vCloudDirection;

  void main() {
    vec3 direction = normalize(vCloudDirection);
    float elevation = clamp(direction.y, 0.0, 1.0);
    float gradient = pow(elevation, 0.58);
    vec3 horizonColor = vec3(0.47, 0.72, 0.88);
    vec3 zenithColor = vec3(0.10, 0.42, 0.75);
    vec3 atmosphereColor = mix(horizonColor, zenithColor, gradient);
    float alpha = mix(0.68, 0.82, gradient);
    gl_FragColor = vec4(atmosphereColor, alpha);
  }
`;function gt(t){const e=new V({name:"vectoplan-atmosphere-tint-material",vertexShader:Y,fragmentShader:pt,transparent:!0,depthTest:!0,depthWrite:!1,side:1,blending:1,toneMapped:!1}),n=new G(new j(t,48,24),e);return n.name="vectoplan-atmosphere-tint",n.frustumCulled=!1,n.renderOrder=-999.5,{mesh:n,material:e}}function yt(t){const e=new V({name:"vectoplan-atmospheric-cloud-material",uniforms:{uTime:{value:0},uDaylight:{value:1}},vertexShader:Y,fragmentShader:ht,transparent:!0,depthTest:!0,depthWrite:!1,side:1,blending:1,toneMapped:!1}),n=new G(new j(t,64,32),e);return n.name="vectoplan-atmospheric-clouds",n.frustumCulled=!1,n.renderOrder=-999,{mesh:n,material:e}}function Mt(t){return t&&typeof t=="object"?t:null}function z(t,e){for(const n of e){let o=t;for(const s of n)o=Mt(o)?.[s];const r=Number(o);if(Number.isFinite(r))return r}return null}function wt(t){const e=z(t,[["environment","latitude"],["environment","location","latitude"],["world","earthReference","latitude"],["world","globalReference","latitude"],["earthReference","latitude"]])??ft,n=z(t,[["environment","longitude"],["environment","location","longitude"],["world","earthReference","longitude"],["world","globalReference","longitude"],["earthReference","longitude"]])??dt,o=z(t,[["environment","trueNorthDegrees"],["world","earthReference","trueNorthDegrees"],["world","globalReference","trueNorthDegrees"]])??0;return{latitude:w.clamp(e,-89.9,89.9),longitude:w.clamp(n,-180,180),trueNorthDegrees:o}}function St(t){const e=new Date(t.getFullYear(),0,0);return Math.floor((t.getTime()-e.getTime())/864e5)}function P(t,e,n){const o=t.getHours()+t.getMinutes()/60+t.getSeconds()/3600,r=2*Math.PI/365*(St(t)-1+(o-12)/24),s=229.18*(75e-6+.001868*Math.cos(r)-.032077*Math.sin(r)-.014615*Math.cos(2*r)-.040849*Math.sin(2*r)),d=.006918-.399912*Math.cos(r)+.070257*Math.sin(r)-.006758*Math.cos(2*r)+907e-6*Math.sin(2*r)-.002697*Math.cos(3*r)+.00148*Math.sin(3*r),N=-t.getTimezoneOffset()/60,m=((o*60+s+4*n-60*N+1440)%1440/4-180)*x,c=e*x,T=w.clamp(Math.sin(c)*Math.sin(d)+Math.cos(c)*Math.cos(d)*Math.cos(m),-1,1);return{elevation:Math.asin(T),azimuth:Math.atan2(Math.sin(m),Math.cos(m)*Math.sin(c)-Math.tan(d)*Math.cos(c))+Math.PI}}function vt(){return new Date(new Date().getFullYear(),ct,lt,ut,mt,0,0)}function Rt(t){const{scene:e,renderer:n,camera:o}=t,r=wt(t.bootstrap),s=vt().getTime(),d=!1,N=0;let m=!0,c=!1,T=-1/0,l=P(new Date,r.latitude,r.longitude);const W=e.background,q=e.fog;n.outputColorSpace=Z,n.toneMapping=4,n.toneMappingExposure=1.05,n.shadowMap.enabled=!0,n.shadowMap.type=2;const a=new tt;a.name="vectoplan-physical-sky";const C=Math.max(4,o.far*.94);a.scale.setScalar(C),a.frustumCulled=!1,a.renderOrder=-1e3,a.material.uniforms.turbidity.value=2,a.material.uniforms.rayleigh.value=4,a.material.uniforms.mieCoefficient.value=.002,a.material.uniforms.mieDirectionalG.value=.72;const u=yt(C*.82),h=gt(C*.88),D=new K(13165823,4866099,.7);D.name="vectoplan-sky-fill-light";const i=new Q(16773583,3.4);i.name="vectoplan-sun-light",i.castShadow=!0,i.shadow.mapSize.set(2048,2048),i.shadow.camera.near=1,i.shadow.camera.far=260,i.shadow.camera.left=-72,i.shadow.camera.right=72,i.shadow.camera.top=72,i.shadow.camera.bottom=-72,i.shadow.bias=-2e-4,i.shadow.normalBias=.025,i.target.name="vectoplan-sun-target";const R=new _(6072798),U=new k(9422824,55e-5);e.background=R,e.fog=U,e.add(a,h.mesh,u.mesh,D,i,i.target),t.controlsHost.hidden=!1,t.controlsHost.removeAttribute("hidden"),t.controlsHost.dataset.environmentMode="physical-sky-clouds",t.controlsHost.dataset.environmentTime="07-28T16:48";const b=new F,f=new F,X=new _(1120295),$=new _(9422824);function O(A){l=P(new Date(s),r.latitude,r.longitude);const E=l.azimuth+r.trueNorthDegrees*x,p=Math.cos(l.elevation);b.set(Math.sin(E)*p,Math.sin(l.elevation),Math.cos(E)*p).normalize(),a.material.uniforms.sunPosition.value.copy(b);const g=w.smoothstep(l.elevation*I,-6,8);i.intensity=g*3.4,D.intensity=.1+g*.64,n.toneMappingExposure=.5+g*.44,u.material.uniforms.uDaylight.value=g,e.fog instanceof k&&e.fog.color.copy(X).lerp($,g),f.set(o.position.x,o.position.y-1.6,o.position.z),i.position.copy(f).addScaledVector(b,130),i.target.position.copy(f),i.target.updateMatrixWorld(),T=A,m=!1}return O(performance.now()),{update(A){if(c)return;const E=w.clamp(A,0,.1);u.material.uniforms.uTime.value+=E*.012,a.position.copy(o.position),u.mesh.position.copy(o.position),h.mesh.position.copy(o.position);const p=performance.now();m||p-T>=200?O(p):(f.set(o.position.x,o.position.y-1.6,o.position.z),i.position.copy(f).addScaledVector(b,130),i.target.position.copy(f),i.target.updateMatrixWorld())},getSnapshot:()=>({simulatedTimeIso:new Date(s).toISOString(),latitude:r.latitude,longitude:r.longitude,sunElevationDegrees:l.elevation*I,sunAzimuthDegrees:l.azimuth*I,running:d,timeScale:N}),destroy(){c||(c=!0,e.remove(a,h.mesh,u.mesh,D,i,i.target),e.background===R&&(e.background=W),e.fog===U&&(e.fog=q),a.geometry.dispose(),a.material.dispose(),u.mesh.geometry.dispose(),h.mesh.geometry.dispose(),h.material.dispose(),u.material.dispose(),i.shadow.map?.dispose())}}}export{v as a,Et as c,B as d,Nt as f,It as i,bt as l,Ct as m,xt as n,_t as o,y as p,At as r,zt as s,Rt as t,Dt as u};
