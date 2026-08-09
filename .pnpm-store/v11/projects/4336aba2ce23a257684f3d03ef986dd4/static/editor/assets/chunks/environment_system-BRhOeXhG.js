import{F as v,G as Y,H as Q,I as j,O as tt,T as P,W as B,X as _,_ as I,b as et,s as nt}from"./three-XJx36d2_.js";var ot=8;function D(t){try{return typeof t=="object"&&t!==null&&!Array.isArray(t)}catch{return!1}}function V(t){try{return typeof t=="string"&&t.trim().length>0}catch{return!1}}function S(t,e=""){try{if(typeof t=="number"||typeof t=="boolean"||typeof t=="bigint")return String(t);if(typeof t!="string")return e;const n=t.trim();return n.length>0?n:e}catch{return e}}function w(t,e=null){try{if(t==null)return e;if(typeof t=="number"||typeof t=="boolean"||typeof t=="bigint")return String(t);if(typeof t!="string")return e;const n=t.trim();return n.length>0?n:e}catch{return e}}function J(t,e=0,n){try{const o=typeof t=="number"?t:typeof t=="string"?Number.parseFloat(t.trim()):NaN;if(!Number.isFinite(o))return e;const r=n?.min??Number.NEGATIVE_INFINITY,c=n?.max??Number.POSITIVE_INFINITY;return Math.min(c,Math.max(r,o))}catch{return e}}function At(t,e=0,n){try{return Math.trunc(J(t,e,n))}catch{return e}}function Ct(t,e=!1){try{if(typeof t=="boolean")return t;if(typeof t=="number"&&Number.isFinite(t)){if(t===1)return!0;if(t===0)return!1}if(typeof t!="string")return e;const n=t.trim().toLowerCase();return["1","true","t","yes","y","on","enabled"].includes(n)?!0:["0","false","f","no","n","off","disabled"].includes(n)?!1:e}catch{return e}}function _t(t){try{return Array.isArray(t)?t:[]}catch{return[]}}function It(t){try{return D(t)?t:{}}catch{return{}}}function Ot(t){try{const e=new Set,n=[];for(const o of t){if(typeof o!="string")continue;const r=o.trim();r.length===0||e.has(r)||(e.add(r),n.push(r))}return n}catch{return[]}}function rt(t,e,n,o=e){try{const r=J(t,o);return Math.min(n,Math.max(e,r))}catch{return o}}function zt(t,e,n,o=e){try{return Math.trunc(rt(t,e,n,o))}catch{return o}}function W(t){try{if(!D(t))return null;const e={};for(const[n,o]of Object.entries(t))n&&(e[n]=T(o));return Object.keys(e).length>0?e:null}catch{return null}}function G(t,e){try{return w(t[e],null)}catch{return null}}function it(t){try{return t.cause??null}catch{return null}}function at(t){try{return W(t.details)}catch{return null}}function st(t){return{name:S(t.name,"UnknownError"),message:S(t.message,"Unknown error."),stack:w(t.stack,null),code:w(t.code,null),type:w(t.type,null),cause:t.cause??null,details:W(t.details??t)}}function Rt(t){try{return t instanceof Error?{name:S(t.name,"Error"),message:S(t.message,"Unknown error."),stack:w(t.stack,null),code:G(t,"code"),type:G(t,"type"),cause:it(t),details:at(t)}:D(t)?st(t):typeof t=="string"?{name:"Error",message:S(t,"Unknown error."),stack:null,code:null,type:null,cause:null,details:null}:{name:"UnknownError",message:"Unknown error.",stack:null,code:null,type:null,cause:t,details:null}}catch{return{name:"UnknownError",message:"Unknown error.",stack:null,code:null,type:null,cause:null,details:null}}}function Ut(t,e="Unknown error."){try{return t instanceof Error&&V(t.message)?t.message.trim():typeof t=="string"&&t.trim().length>0?t.trim():D(t)&&V(t.message)?t.message.trim():e}catch{return e}}function T(t,e=0){try{if(e>ot)return"[max-depth]";if(t===null)return null;if(typeof t=="string"||typeof t=="boolean")return t;if(typeof t=="number")return Number.isFinite(t)?t:null;if(typeof t=="bigint")return String(t);if(t instanceof Date)return t.toISOString();if(Array.isArray(t)){const n=[];for(const o of t)n.push(T(o,e+1));return n}if(D(t)){const n={};for(const[o,r]of Object.entries(t))n[o]=T(r,e+1);return n}return t===void 0?null:String(t)}catch{return null}}function ct(t,e){try{if(typeof t!="string")return e;const n=t.trim();return n.length===0?e:JSON.parse(n)}catch{return e}}function xt(t,e=500){try{if(t==null||typeof t=="string"||typeof t=="number"||typeof t=="boolean")return typeof t=="string"&&t.length>e?`${t.slice(0,e)}…`:T(t);const n=JSON.stringify(T(t));return n.length<=e?ct(n,null):`${n.slice(0,e)}…`}catch{return"[unserializable]"}}var lt="1970-01-01T00:00:00.000Z";function Ft(){try{return new Date().toISOString()}catch{return lt}}var R=Math.PI/180,O=180/Math.PI,ut=6,mt=28,ft=16,dt=48,ht=51.1657,pt=10.4515,gt=6,yt=250,X=`
  varying vec3 vCloudDirection;

  void main() {
    vCloudDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,Mt=`
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
`,St=`
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
`;function wt(t){const e=new B({name:"vectoplan-atmosphere-tint-material",vertexShader:X,fragmentShader:St,transparent:!0,depthTest:!0,depthWrite:!1,side:1,blending:1,toneMapped:!1}),n=new j(new Y(t,48,24),e);return n.name="vectoplan-atmosphere-tint",n.frustumCulled=!1,n.renderOrder=-999.5,{mesh:n,material:e}}function vt(t){const e=new B({name:"vectoplan-atmospheric-cloud-material",uniforms:{uTime:{value:0},uDaylight:{value:1}},vertexShader:X,fragmentShader:Mt,transparent:!0,depthTest:!0,depthWrite:!1,side:1,blending:1,toneMapped:!1}),n=new j(new Y(t,64,32),e);return n.name="vectoplan-atmospheric-clouds",n.frustumCulled=!1,n.renderOrder=-999,{mesh:n,material:e}}function Tt(t){return t&&typeof t=="object"?t:null}function z(t,e){for(const n of e){let o=t;for(const c of n)o=Tt(o)?.[c];const r=Number(o);if(Number.isFinite(r))return r}return null}function Dt(t){const e=z(t,[["environment","latitude"],["environment","location","latitude"],["world","earthReference","latitude"],["world","globalReference","latitude"],["earthReference","latitude"]])??ht,n=z(t,[["environment","longitude"],["environment","location","longitude"],["world","earthReference","longitude"],["world","globalReference","longitude"],["earthReference","longitude"]])??pt,o=z(t,[["environment","trueNorthDegrees"],["world","earthReference","trueNorthDegrees"],["world","globalReference","trueNorthDegrees"]])??0;return{latitude:v.clamp(e,-89.9,89.9),longitude:v.clamp(n,-180,180),trueNorthDegrees:o}}function Et(t){const e=new Date(t.getFullYear(),0,0);return Math.floor((t.getTime()-e.getTime())/864e5)}function L(t,e,n){const o=t.getHours()+t.getMinutes()/60+t.getSeconds()/3600,r=2*Math.PI/365*(Et(t)-1+(o-12)/24),c=229.18*(75e-6+.001868*Math.cos(r)-.032077*Math.sin(r)-.014615*Math.cos(2*r)-.040849*Math.sin(2*r)),d=.006918-.399912*Math.cos(r)+.070257*Math.sin(r)-.006758*Math.cos(2*r)+907e-6*Math.sin(2*r)-.002697*Math.cos(3*r)+.00148*Math.sin(3*r),N=-t.getTimezoneOffset()/60,h=((o*60+c+4*n-60*N+1440)%1440/4-180)*R,l=e*R,s=v.clamp(Math.sin(l)*Math.sin(d)+Math.cos(l)*Math.cos(d)*Math.cos(h),-1,1);return{elevation:Math.asin(s),azimuth:Math.atan2(Math.sin(h),Math.cos(h)*Math.sin(l)-Math.tan(d)*Math.cos(l))+Math.PI}}function Nt(){return new Date(new Date().getFullYear(),ut,mt,ft,dt,0,0)}function kt(t){const{scene:e,renderer:n,camera:o}=t,r=Dt(t.bootstrap),c=Nt().getTime(),d=!1,N=0;let h=!0,l=!1,s=L(new Date,r.latitude,r.longitude);const q=e.background,Z=e.fog;n.outputColorSpace=Q,n.toneMapping=4,n.toneMappingExposure=1.05,n.shadowMap.enabled=!0,n.shadowMap.type=1,n.shadowMap.autoUpdate=!1;const a=new nt;a.name="vectoplan-physical-sky";const b=Math.max(4,o.far*.94);a.scale.setScalar(b),a.frustumCulled=!1,a.renderOrder=-1e3,a.material.uniforms.turbidity.value=2,a.material.uniforms.rayleigh.value=4,a.material.uniforms.mieCoefficient.value=.002,a.material.uniforms.mieDirectionalG.value=.72;const u=vt(b*.82),y=wt(b*.88),E=new tt(13165823,4866099,.7);E.name="vectoplan-sky-fill-light";const i=new et(16773583,3.4);i.name="vectoplan-sun-light",i.castShadow=!0,i.shadow.mapSize.set(1024,1024),i.shadow.camera.near=1,i.shadow.camera.far=180,i.shadow.camera.left=-48,i.shadow.camera.right=48,i.shadow.camera.top=48,i.shadow.camera.bottom=-48,i.shadow.bias=-2e-4,i.shadow.normalBias=.025,i.target.name="vectoplan-sun-target";const U=new I(6072798),x=new P(9422824,55e-5);e.background=U,e.fog=x,e.add(a,y.mesh,u.mesh,E,i,i.target),t.controlsHost.hidden=!1,t.controlsHost.removeAttribute("hidden"),t.controlsHost.dataset.environmentMode="physical-sky-clouds",t.controlsHost.dataset.environmentTime="07-28T16:48";const A=new _,C=new _,M=new _(Number.POSITIVE_INFINITY,0,0);let F=-1/0;const $=new I(1120295),K=new I(9422824);function k(p,g){C.set(o.position.x,o.position.y-1.6,o.position.z);const m=!Number.isFinite(M.x)||M.distanceToSquared(C)>=gt**2,f=p-F>=yt;!g&&!m&&!f||(M.copy(C),i.position.copy(M).addScaledVector(A,130),i.target.position.copy(M),i.target.updateMatrixWorld(),n.shadowMap.needsUpdate=!0,F=p)}function H(p){s=L(new Date(c),r.latitude,r.longitude);const g=s.azimuth+r.trueNorthDegrees*R,m=Math.cos(s.elevation);A.set(Math.sin(g)*m,Math.sin(s.elevation),Math.cos(g)*m).normalize(),a.material.uniforms.sunPosition.value.copy(A);const f=v.smoothstep(s.elevation*O,-6,8);i.intensity=f*3.4,E.intensity=.1+f*.64,n.toneMappingExposure=.5+f*.44,u.material.uniforms.uDaylight.value=f,e.fog instanceof P&&e.fog.color.copy($).lerp(K,f),k(p,!0),h=!1}return H(performance.now()),{update(p){if(l)return;const g=v.clamp(p,0,.1);u.material.uniforms.uTime.value+=g*.012,a.position.copy(o.position),u.mesh.position.copy(o.position),y.mesh.position.copy(o.position);const m=performance.now();h||d?H(m):k(m,!1)},getSnapshot:()=>({simulatedTimeIso:new Date(c).toISOString(),latitude:r.latitude,longitude:r.longitude,sunElevationDegrees:s.elevation*O,sunAzimuthDegrees:s.azimuth*O,running:d,timeScale:N}),destroy(){l||(l=!0,e.remove(a,y.mesh,u.mesh,E,i,i.target),e.background===U&&(e.background=q),e.fog===x&&(e.fog=Z),a.geometry.dispose(),a.material.dispose(),u.mesh.geometry.dispose(),y.mesh.geometry.dispose(),y.material.dispose(),u.material.dispose(),i.shadow.map?.dispose())}}}export{D as a,_t as c,J as d,It as f,Ut as i,Ct as l,Ot as m,Ft as n,Rt as o,S as p,zt as r,xt as s,kt as t,At as u};
