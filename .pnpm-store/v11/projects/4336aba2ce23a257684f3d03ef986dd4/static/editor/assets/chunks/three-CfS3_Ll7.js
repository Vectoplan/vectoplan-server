var Ph="attached";var Gi=1e3,Ht=1001,Rs=1002,Ot=1003,$l=1004,Ql=1005,It=1006,ec=1007,Ki=1008,Hn=1009,Lh=1010,Dh=1011,tc=1012,Nh=1013,ri=1014,Ji=1015,si=1016,nc=1017,ic=1018,rc=1020,Uh=35902,Oh=35899,Fh=1021,Bh=1022,Hi=1023,Tr=1026,sc=1027,ac=1028,oc=1029,Cs=1030,lc=1031,cc=1033,kh=33776,zh=33777,Vh=33778,Gh=33779,Hh=35840,Wh=35841,Xh=35842,qh=35843,Yh=36196,jh=37492,Kh=37496,Jh=37488,Zh=37489,$h=37490,Qh=37491,eu=37808,tu=37809,nu=37810,iu=37811,ru=37812,su=37813,au=37814,ou=37815,lu=37816,cu=37817,hu=37818,uu=37819,fu=37820,du=37821,pu=36492,mu=36494,gu=36495,vu=36283,_u=36284,yu=36285,xu=36286;var Mu=2201,Su=2202,Er=2300,br=2301,qs=2302,To=2303,Ni=2400,Ui=2401,Is=2402,to=2500,Tu=2501,Eu=3200;var rt="srgb",qt="srgb-linear",Ps="linear",Ls="srgb",Ys=7680;var hc=35044,Mv=35048;var Wi=2e3;function bu(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function Au(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Ar(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function wu(){const e=Ar("canvas");return e.style.display="block",e}var Eo={},Xi=null;function Ds(...e){const t="THREE."+e.shift();Xi?Xi("log",t,...e):console.log(t,...e)}function uc(e){const t=e[0];if(typeof t=="string"&&t.startsWith("TSL:")){const n=e[1];n&&n.isStackTrace?e[0]+=" "+n.getLocation():e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Le(...e){e=uc(e);const t="THREE."+e.shift();if(Xi)Xi("warn",t,...e);else{const n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function ke(...e){e=uc(e);const t="THREE."+e.shift();if(Xi)Xi("error",t,...e);else{const n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Ns(...e){const t=e.join(" ");t in Eo||(Eo[t]=!0,Le(...e))}function Ru(e,t,n){return new Promise(function(i,r){function s(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:r();break;case e.TIMEOUT_EXPIRED:setTimeout(s,n);break;default:i()}}setTimeout(s,n)})}var Cu={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},ci=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const i=n[e];if(i!==void 0){const r=i.indexOf(t);r!==-1&&i.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const i=n.slice(0);for(let r=0,s=i.length;r<s;r++)i[r].call(this,e);e.target=null}}},Dt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],bo=1234567,Bi=Math.PI/180,qi=180/Math.PI;function Zt(){const e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Dt[e&255]+Dt[e>>8&255]+Dt[e>>16&255]+Dt[e>>24&255]+"-"+Dt[t&255]+Dt[t>>8&255]+"-"+Dt[t>>16&15|64]+Dt[t>>24&255]+"-"+Dt[n&63|128]+Dt[n>>8&255]+"-"+Dt[n>>16&255]+Dt[n>>24&255]+Dt[i&255]+Dt[i>>8&255]+Dt[i>>16&255]+Dt[i>>24&255]).toLowerCase()}function et(e,t,n){return Math.max(t,Math.min(n,e))}function no(e,t){return(e%t+t)%t}function Iu(e,t,n,i,r){return i+(e-t)*(r-i)/(n-t)}function Pu(e,t,n){return e!==t?(n-e)/(t-e):0}function yr(e,t,n){return(1-n)*e+n*t}function Lu(e,t,n,i){return yr(e,t,1-Math.exp(-n*i))}function Du(e,t=1){return t-Math.abs(no(e,t*2)-t)}function Nu(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*(3-2*e))}function Uu(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10))}function Ou(e,t){return e+Math.floor(Math.random()*(t-e+1))}function Fu(e,t){return e+Math.random()*(t-e)}function Bu(e){return e*(.5-Math.random())}function ku(e){e!==void 0&&(bo=e);let t=bo+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function zu(e){return e*Bi}function Vu(e){return e*qi}function Gu(e){return(e&e-1)===0&&e!==0}function Hu(e){return Math.pow(2,Math.ceil(Math.log(e)/Math.LN2))}function Wu(e){return Math.pow(2,Math.floor(Math.log(e)/Math.LN2))}function Xu(e,t,n,i,r){const s=Math.cos,a=Math.sin,o=s(n/2),l=a(n/2),c=s((t+i)/2),h=a((t+i)/2),u=s((t-i)/2),f=a((t-i)/2),d=s((i-t)/2),g=a((i-t)/2);switch(r){case"XYX":e.set(o*h,l*u,l*f,o*c);break;case"YZY":e.set(l*f,o*h,l*u,o*c);break;case"ZXZ":e.set(l*u,l*f,o*h,o*c);break;case"XZX":e.set(o*h,l*g,l*d,o*c);break;case"YXY":e.set(l*d,o*h,l*g,o*c);break;case"ZYZ":e.set(l*g,l*d,o*h,o*c);break;default:Le("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function on(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw new Error("Invalid component type.")}}function at(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw new Error("Invalid component type.")}}var Ut={DEG2RAD:Bi,RAD2DEG:qi,generateUUID:Zt,clamp:et,euclideanModulo:no,mapLinear:Iu,inverseLerp:Pu,lerp:yr,damp:Lu,pingpong:Du,smoothstep:Nu,smootherstep:Uu,randInt:Ou,randFloat:Fu,randFloatSpread:Bu,seededRandom:ku,degToRad:zu,radToDeg:Vu,isPowerOfTwo:Gu,ceilPowerOfTwo:Hu,floorPowerOfTwo:Wu,setQuaternionFromProperEuler:Xu,normalize:at,denormalize:on},oe=class fc{constructor(t=0,n=0){fc.prototype.isVector2=!0,this.x=t,this.y=n}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,n){return this.x=t,this.y=n,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const n=this.x,i=this.y,r=t.elements;return this.x=r[0]*n+r[3]*i+r[6],this.y=r[1]*n+r[4]*i+r[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,n){return this.x=et(this.x,t.x,n.x),this.y=et(this.y,t.y,n.y),this}clampScalar(t,n){return this.x=et(this.x,t,n),this.y=et(this.y,t,n),this}clampLength(t,n){const i=this.length();return this.divideScalar(i||1).multiplyScalar(et(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;const i=this.dot(t)/n;return Math.acos(et(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const n=this.x-t.x,i=this.y-t.y;return n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this}rotateAround(t,n){const i=Math.cos(n),r=Math.sin(n),s=this.x-t.x,a=this.y-t.y;return this.x=s*i-a*r+t.x,this.y=s*r+a*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},St=class{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,s,a){let o=n[i+0],l=n[i+1],c=n[i+2],h=n[i+3],u=r[s+0],f=r[s+1],d=r[s+2],g=r[s+3];if(h!==g||o!==u||l!==f||c!==d){let v=o*u+l*f+c*d+h*g;v<0&&(u=-u,f=-f,d=-d,g=-g,v=-v);let p=1-a;if(v<.9995){const m=Math.acos(v),y=Math.sin(m);p=Math.sin(p*m)/y,a=Math.sin(a*m)/y,o=o*p+u*a,l=l*p+f*a,c=c*p+d*a,h=h*p+g*a}else{o=o*p+u*a,l=l*p+f*a,c=c*p+d*a,h=h*p+g*a;const m=1/Math.sqrt(o*o+l*l+c*c+h*h);o*=m,l*=m,c*=m,h*=m}}e[t]=o,e[t+1]=l,e[t+2]=c,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,i,r,s){const a=n[i],o=n[i+1],l=n[i+2],c=n[i+3],h=r[s],u=r[s+1],f=r[s+2],d=r[s+3];return e[t]=a*d+c*h+o*f-l*u,e[t+1]=o*d+c*u+l*h-a*f,e[t+2]=l*d+c*f+a*u-o*h,e[t+3]=c*d-a*h-o*u-l*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,i=e._y,r=e._z,s=e._order,a=Math.cos,o=Math.sin,l=a(n/2),c=a(i/2),h=a(r/2),u=o(n/2),f=o(i/2),d=o(r/2);switch(s){case"XYZ":this._x=u*c*h+l*f*d,this._y=l*f*h-u*c*d,this._z=l*c*d+u*f*h,this._w=l*c*h-u*f*d;break;case"YXZ":this._x=u*c*h+l*f*d,this._y=l*f*h-u*c*d,this._z=l*c*d-u*f*h,this._w=l*c*h+u*f*d;break;case"ZXY":this._x=u*c*h-l*f*d,this._y=l*f*h+u*c*d,this._z=l*c*d+u*f*h,this._w=l*c*h-u*f*d;break;case"ZYX":this._x=u*c*h-l*f*d,this._y=l*f*h+u*c*d,this._z=l*c*d-u*f*h,this._w=l*c*h+u*f*d;break;case"YZX":this._x=u*c*h+l*f*d,this._y=l*f*h+u*c*d,this._z=l*c*d-u*f*h,this._w=l*c*h-u*f*d;break;case"XZY":this._x=u*c*h-l*f*d,this._y=l*f*h-u*c*d,this._z=l*c*d+u*f*h,this._w=l*c*h+u*f*d;break;default:Le("Quaternion: .setFromEuler() encountered an unknown order: "+s)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],i=t[4],r=t[8],s=t[1],a=t[5],o=t[9],l=t[2],c=t[6],h=t[10],u=n+a+h;if(u>0){const f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(c-o)*f,this._y=(r-l)*f,this._z=(s-i)*f}else if(n>a&&n>h){const f=2*Math.sqrt(1+n-a-h);this._w=(c-o)/f,this._x=.25*f,this._y=(i+s)/f,this._z=(r+l)/f}else if(a>h){const f=2*Math.sqrt(1+a-n-h);this._w=(r-l)/f,this._x=(i+s)/f,this._y=.25*f,this._z=(o+c)/f}else{const f=2*Math.sqrt(1+h-n-a);this._w=(s-i)/f,this._x=(r+l)/f,this._y=(o+c)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(et(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,i=e._y,r=e._z,s=e._w,a=t._x,o=t._y,l=t._z,c=t._w;return this._x=n*c+s*a+i*l-r*o,this._y=i*c+s*o+r*a-n*l,this._z=r*c+s*l+n*o-i*a,this._w=s*c-n*a-i*o-r*l,this._onChangeCallback(),this}slerp(e,t){let n=e._x,i=e._y,r=e._z,s=e._w,a=this.dot(e);a<0&&(n=-n,i=-i,r=-r,s=-s,a=-a);let o=1-t;if(a<.9995){const l=Math.acos(a),c=Math.sin(l);o=Math.sin(o*l)/c,t=Math.sin(t*l)/c,this._x=this._x*o+n*t,this._y=this._y*o+i*t,this._z=this._z*o+r*t,this._w=this._w*o+s*t,this._onChangeCallback()}else this._x=this._x*o+n*t,this._y=this._y*o+i*t,this._z=this._z*o+r*t,this._w=this._w*o+s*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},P=class dc{constructor(t=0,n=0,i=0){dc.prototype.isVector3=!0,this.x=t,this.y=n,this.z=i}set(t,n,i){return i===void 0&&(i=this.z),this.x=t,this.y=n,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,n){return this.x=t.x*n.x,this.y=t.y*n.y,this.z=t.z*n.z,this}applyEuler(t){return this.applyQuaternion(Ao.setFromEuler(t))}applyAxisAngle(t,n){return this.applyQuaternion(Ao.setFromAxisAngle(t,n))}applyMatrix3(t){const n=this.x,i=this.y,r=this.z,s=t.elements;return this.x=s[0]*n+s[3]*i+s[6]*r,this.y=s[1]*n+s[4]*i+s[7]*r,this.z=s[2]*n+s[5]*i+s[8]*r,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const n=this.x,i=this.y,r=this.z,s=t.elements,a=1/(s[3]*n+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*n+s[4]*i+s[8]*r+s[12])*a,this.y=(s[1]*n+s[5]*i+s[9]*r+s[13])*a,this.z=(s[2]*n+s[6]*i+s[10]*r+s[14])*a,this}applyQuaternion(t){const n=this.x,i=this.y,r=this.z,s=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*r-o*i),h=2*(o*n-s*r),u=2*(s*i-a*n);return this.x=n+l*c+a*u-o*h,this.y=i+l*h+o*c-s*u,this.z=r+l*u+s*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const n=this.x,i=this.y,r=this.z,s=t.elements;return this.x=s[0]*n+s[4]*i+s[8]*r,this.y=s[1]*n+s[5]*i+s[9]*r,this.z=s[2]*n+s[6]*i+s[10]*r,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,n){return this.x=et(this.x,t.x,n.x),this.y=et(this.y,t.y,n.y),this.z=et(this.z,t.z,n.z),this}clampScalar(t,n){return this.x=et(this.x,t,n),this.y=et(this.y,t,n),this.z=et(this.z,t,n),this}clampLength(t,n){const i=this.length();return this.divideScalar(i||1).multiplyScalar(et(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,n){const i=t.x,r=t.y,s=t.z,a=n.x,o=n.y,l=n.z;return this.x=r*l-s*o,this.y=s*a-i*l,this.z=i*o-r*a,this}projectOnVector(t){const n=t.lengthSq();if(n===0)return this.set(0,0,0);const i=t.dot(this)/n;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return js.copy(this).projectOnVector(t),this.sub(js)}reflect(t){return this.sub(js.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const n=Math.sqrt(this.lengthSq()*t.lengthSq());if(n===0)return Math.PI/2;const i=this.dot(t)/n;return Math.acos(et(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const n=this.x-t.x,i=this.y-t.y,r=this.z-t.z;return n*n+i*i+r*r}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,n,i){const r=Math.sin(n)*t;return this.x=r*Math.sin(i),this.y=Math.cos(n)*t,this.z=r*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,n,i){return this.x=t*Math.sin(n),this.y=i,this.z=t*Math.cos(n),this}setFromMatrixPosition(t){const n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(t){const n=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),r=this.setFromMatrixColumn(t,2).length();return this.x=n,this.y=i,this.z=r,this}setFromMatrixColumn(t,n){return this.fromArray(t.elements,n*4)}setFromMatrix3Column(t,n){return this.fromArray(t.elements,n*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(t),this.y=n,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},js=new P,Ao=new St,Ke=class pc{constructor(t,n,i,r,s,a,o,l,c){pc.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,n,i,r,s,a,o,l,c)}set(t,n,i,r,s,a,o,l,c){const h=this.elements;return h[0]=t,h[1]=r,h[2]=o,h[3]=n,h[4]=s,h[5]=l,h[6]=i,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(t,n,i){return t.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const n=t.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){const i=t.elements,r=n.elements,s=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],h=i[4],u=i[7],f=i[2],d=i[5],g=i[8],v=r[0],p=r[3],m=r[6],y=r[1],S=r[4],M=r[7],I=r[2],w=r[5],C=r[8];return s[0]=a*v+o*y+l*I,s[3]=a*p+o*S+l*w,s[6]=a*m+o*M+l*C,s[1]=c*v+h*y+u*I,s[4]=c*p+h*S+u*w,s[7]=c*m+h*M+u*C,s[2]=f*v+d*y+g*I,s[5]=f*p+d*S+g*w,s[8]=f*m+d*M+g*C,this}multiplyScalar(t){const n=this.elements;return n[0]*=t,n[3]*=t,n[6]*=t,n[1]*=t,n[4]*=t,n[7]*=t,n[2]*=t,n[5]*=t,n[8]*=t,this}determinant(){const t=this.elements,n=t[0],i=t[1],r=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return n*a*h-n*o*c-i*s*h+i*o*l+r*s*c-r*a*l}invert(){const t=this.elements,n=t[0],i=t[1],r=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,f=o*l-h*s,d=c*s-a*l,g=n*u+i*f+r*d;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/g;return t[0]=u*v,t[1]=(r*c-h*i)*v,t[2]=(o*i-r*a)*v,t[3]=f*v,t[4]=(h*n-r*l)*v,t[5]=(r*s-o*n)*v,t[6]=d*v,t[7]=(i*l-c*n)*v,t[8]=(a*n-i*s)*v,this}transpose(){let t;const n=this.elements;return t=n[1],n[1]=n[3],n[3]=t,t=n[2],n[2]=n[6],n[6]=t,t=n[5],n[5]=n[7],n[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const n=this.elements;return t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8],this}setUvTransform(t,n,i,r,s,a,o){const l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*a+c*o)+a+t,-r*c,r*l,-r*(-c*a+l*o)+o+n,0,0,1),this}scale(t,n){return this.premultiply(Ks.makeScale(t,n)),this}rotate(t){return this.premultiply(Ks.makeRotation(-t)),this}translate(t,n){return this.premultiply(Ks.makeTranslation(t,n)),this}makeTranslation(t,n){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,n,0,0,1),this}makeRotation(t){const n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(t,n){return this.set(t,0,0,0,n,0,0,0,1),this}equals(t){const n=this.elements,i=t.elements;for(let r=0;r<9;r++)if(n[r]!==i[r])return!1;return!0}fromArray(t,n=0){for(let i=0;i<9;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){const i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}},Ks=new Ke,wo=new Ke().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ro=new Ke().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function qu(){const e={enabled:!0,workingColorSpace:qt,spaces:{},convert:function(r,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer==="srgb"&&(r.r=Cn(r.r),r.g=Cn(r.g),r.b=Cn(r.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer==="srgb"&&(r.r=ki(r.r),r.g=ki(r.g),r.b=ki(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===""?Ps:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,a){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ns("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ns("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(r,s)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return e.define({[qt]:{primaries:t,whitePoint:i,transfer:Ps,toXYZ:wo,fromXYZ:Ro,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:rt},outputColorSpaceConfig:{drawingBufferColorSpace:rt}},[rt]:{primaries:t,whitePoint:i,transfer:Ls,toXYZ:wo,fromXYZ:Ro,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:rt}}}),e}var qe=qu();function Cn(e){return e<.04045?e*.0773993808:Math.pow(e*.9478672986+.0521327014,2.4)}function ki(e){return e<.0031308?e*12.92:1.055*Math.pow(e,.41666)-.055}var fi,Yu=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{fi===void 0&&(fi=Ar("canvas")),fi.width=e.width,fi.height=e.height;const i=fi.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),n=fi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Ar("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let s=0;s<r.length;s++)r[s]=Cn(r[s]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Cn(t[n]/255)*255):t[n]=Cn(t[n]);return{data:t,width:e.width,height:e.height}}else return Le("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},ju=0,io=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:ju++}),this.uuid=Zt(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let s=0,a=i.length;s<a;s++)i[s].isDataTexture?r.push(Js(i[s].image)):r.push(Js(i[s]))}else r=Js(i);n.url=r}return t||(e.images[this.uuid]=n),n}};function Js(e){return typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap?Yu.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(Le("Texture: Unable to serialize Texture."),{})}var Ku=0,Zs=new P,Ft=class Es extends ci{constructor(t=Es.DEFAULT_IMAGE,n=Es.DEFAULT_MAPPING,i=Ht,r=Ht,s=It,a=Ki,o=Hi,l=Hn,c=Es.DEFAULT_ANISOTROPY,h=""){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Ku++}),this.uuid=Zt(),this.name="",this.source=new io(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new oe(0,0),this.repeat=new oe(1,1),this.center=new oe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ke,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(Zs).x}get height(){return this.source.getSize(Zs).y}get depth(){return this.source.getSize(Zs).z}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,n){this.updateRanges.push({start:t,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(const n in t){const i=t[n];if(i===void 0){Le(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}const r=this[n];if(r===void 0){Le(`Texture.setValues(): property '${n}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[n]=i}}toJSON(t){const n=t===void 0||typeof t=="string";if(!n&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==300)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Gi:t.x=t.x-Math.floor(t.x);break;case Ht:t.x=t.x<0?0:1;break;case Rs:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Gi:t.y=t.y-Math.floor(t.y);break;case Ht:t.y=t.y<0?0:1;break;case Rs:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};Ft.DEFAULT_IMAGE=null;Ft.DEFAULT_MAPPING=300;Ft.DEFAULT_ANISOTROPY=1;var ct=class mc{constructor(t=0,n=0,i=0,r=1){mc.prototype.isVector4=!0,this.x=t,this.y=n,this.z=i,this.w=r}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,n,i,r){return this.x=t,this.y=n,this.z=i,this.w=r,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,n){switch(t){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;case 3:this.w=n;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,n){return this.x=t.x+n.x,this.y=t.y+n.y,this.z=t.z+n.z,this.w=t.w+n.w,this}addScaledVector(t,n){return this.x+=t.x*n,this.y+=t.y*n,this.z+=t.z*n,this.w+=t.w*n,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,n){return this.x=t.x-n.x,this.y=t.y-n.y,this.z=t.z-n.z,this.w=t.w-n.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const n=this.x,i=this.y,r=this.z,s=this.w,a=t.elements;return this.x=a[0]*n+a[4]*i+a[8]*r+a[12]*s,this.y=a[1]*n+a[5]*i+a[9]*r+a[13]*s,this.z=a[2]*n+a[6]*i+a[10]*r+a[14]*s,this.w=a[3]*n+a[7]*i+a[11]*r+a[15]*s,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const n=Math.sqrt(1-t.w*t.w);return n<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/n,this.y=t.y/n,this.z=t.z/n),this}setAxisAngleFromRotationMatrix(t){let n,i,r,s;const l=t.elements,c=l[0],h=l[4],u=l[8],f=l[1],d=l[5],g=l[9],v=l[2],p=l[6],m=l[10];if(Math.abs(h-f)<.01&&Math.abs(u-v)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+f)<.1&&Math.abs(u+v)<.1&&Math.abs(g+p)<.1&&Math.abs(c+d+m-3)<.1)return this.set(1,0,0,0),this;n=Math.PI;const S=(c+1)/2,M=(d+1)/2,I=(m+1)/2,w=(h+f)/4,C=(u+v)/4,_=(g+p)/4;return S>M&&S>I?S<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(S),r=w/i,s=C/i):M>I?M<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(M),i=w/r,s=_/r):I<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(I),i=C/s,r=_/s),this.set(i,r,s,n),this}let y=Math.sqrt((p-g)*(p-g)+(u-v)*(u-v)+(f-h)*(f-h));return Math.abs(y)<.001&&(y=1),this.x=(p-g)/y,this.y=(u-v)/y,this.z=(f-h)/y,this.w=Math.acos((c+d+m-1)/2),this}setFromMatrixPosition(t){const n=t.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this.w=n[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,n){return this.x=et(this.x,t.x,n.x),this.y=et(this.y,t.y,n.y),this.z=et(this.z,t.z,n.z),this.w=et(this.w,t.w,n.w),this}clampScalar(t,n){return this.x=et(this.x,t,n),this.y=et(this.y,t,n),this.z=et(this.z,t,n),this.w=et(this.w,t,n),this}clampLength(t,n){const i=this.length();return this.divideScalar(i||1).multiplyScalar(et(i,t,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,n){return this.x+=(t.x-this.x)*n,this.y+=(t.y-this.y)*n,this.z+=(t.z-this.z)*n,this.w+=(t.w-this.w)*n,this}lerpVectors(t,n,i){return this.x=t.x+(n.x-t.x)*i,this.y=t.y+(n.y-t.y)*i,this.z=t.z+(n.z-t.z)*i,this.w=t.w+(n.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,n=0){return this.x=t[n],this.y=t[n+1],this.z=t[n+2],this.w=t[n+3],this}toArray(t=[],n=0){return t[n]=this.x,t[n+1]=this.y,t[n+2]=this.z,t[n+3]=this.w,t}fromBufferAttribute(t,n){return this.x=t.getX(n),this.y=t.getY(n),this.z=t.getZ(n),this.w=t.getW(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Ju=class extends ci{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:It,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new ct(0,0,e,t),this.scissorTest=!1,this.viewport=new ct(0,0,e,t),this.textures=[];const i=new Ft({width:e,height:t,depth:n.depth}),r=n.count;for(let s=0;s<r;s++)this.textures[s]=i.clone(),this.textures[s].isRenderTargetTexture=!0,this.textures[s].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){const t={minFilter:It,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0&&(this.textures[i].isArrayTexture=this.textures[i].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const i=Object.assign({},e.textures[t].image);this.textures[t].source=new io(i)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},vn=class extends Ju{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},gc=class extends Ft{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=Ht,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Zu=class extends Ft{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Ot,this.minFilter=Ot,this.wrapR=Ht,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Ie=class Va{constructor(t,n,i,r,s,a,o,l,c,h,u,f,d,g,v,p){Va.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,n,i,r,s,a,o,l,c,h,u,f,d,g,v,p)}set(t,n,i,r,s,a,o,l,c,h,u,f,d,g,v,p){const m=this.elements;return m[0]=t,m[4]=n,m[8]=i,m[12]=r,m[1]=s,m[5]=a,m[9]=o,m[13]=l,m[2]=c,m[6]=h,m[10]=u,m[14]=f,m[3]=d,m[7]=g,m[11]=v,m[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Va().fromArray(this.elements)}copy(t){const n=this.elements,i=t.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(t){const n=this.elements,i=t.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(t){const n=t.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(t,n,i){return this.determinant()===0?(t.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(t.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(t,n,i){return this.set(t.x,n.x,i.x,0,t.y,n.y,i.y,0,t.z,n.z,i.z,0,0,0,0,1),this}extractRotation(t){if(t.determinant()===0)return this.identity();const n=this.elements,i=t.elements,r=1/di.setFromMatrixColumn(t,0).length(),s=1/di.setFromMatrixColumn(t,1).length(),a=1/di.setFromMatrixColumn(t,2).length();return n[0]=i[0]*r,n[1]=i[1]*r,n[2]=i[2]*r,n[3]=0,n[4]=i[4]*s,n[5]=i[5]*s,n[6]=i[6]*s,n[7]=0,n[8]=i[8]*a,n[9]=i[9]*a,n[10]=i[10]*a,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(t){const n=this.elements,i=t.x,r=t.y,s=t.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(r),c=Math.sin(r),h=Math.cos(s),u=Math.sin(s);if(t.order==="XYZ"){const f=a*h,d=a*u,g=o*h,v=o*u;n[0]=l*h,n[4]=-l*u,n[8]=c,n[1]=d+g*c,n[5]=f-v*c,n[9]=-o*l,n[2]=v-f*c,n[6]=g+d*c,n[10]=a*l}else if(t.order==="YXZ"){const f=l*h,d=l*u,g=c*h,v=c*u;n[0]=f+v*o,n[4]=g*o-d,n[8]=a*c,n[1]=a*u,n[5]=a*h,n[9]=-o,n[2]=d*o-g,n[6]=v+f*o,n[10]=a*l}else if(t.order==="ZXY"){const f=l*h,d=l*u,g=c*h,v=c*u;n[0]=f-v*o,n[4]=-a*u,n[8]=g+d*o,n[1]=d+g*o,n[5]=a*h,n[9]=v-f*o,n[2]=-a*c,n[6]=o,n[10]=a*l}else if(t.order==="ZYX"){const f=a*h,d=a*u,g=o*h,v=o*u;n[0]=l*h,n[4]=g*c-d,n[8]=f*c+v,n[1]=l*u,n[5]=v*c+f,n[9]=d*c-g,n[2]=-c,n[6]=o*l,n[10]=a*l}else if(t.order==="YZX"){const f=a*l,d=a*c,g=o*l,v=o*c;n[0]=l*h,n[4]=v-f*u,n[8]=g*u+d,n[1]=u,n[5]=a*h,n[9]=-o*h,n[2]=-c*h,n[6]=d*u+g,n[10]=f-v*u}else if(t.order==="XZY"){const f=a*l,d=a*c,g=o*l,v=o*c;n[0]=l*h,n[4]=-u,n[8]=c*h,n[1]=f*u+v,n[5]=a*h,n[9]=d*u-g,n[2]=g*u-d,n[6]=o*h,n[10]=v*u+f}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(t){return this.compose($u,t,Qu)}lookAt(t,n,i){const r=this.elements;return Wt.subVectors(t,n),Wt.lengthSq()===0&&(Wt.z=1),Wt.normalize(),Ln.crossVectors(i,Wt),Ln.lengthSq()===0&&(Math.abs(i.z)===1?Wt.x+=1e-4:Wt.z+=1e-4,Wt.normalize(),Ln.crossVectors(i,Wt)),Ln.normalize(),Br.crossVectors(Wt,Ln),r[0]=Ln.x,r[4]=Br.x,r[8]=Wt.x,r[1]=Ln.y,r[5]=Br.y,r[9]=Wt.y,r[2]=Ln.z,r[6]=Br.z,r[10]=Wt.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,n){const i=t.elements,r=n.elements,s=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],h=i[1],u=i[5],f=i[9],d=i[13],g=i[2],v=i[6],p=i[10],m=i[14],y=i[3],S=i[7],M=i[11],I=i[15],w=r[0],C=r[4],_=r[8],b=r[12],N=r[1],A=r[5],O=r[9],H=r[13],k=r[2],L=r[6],B=r[10],U=r[14],$=r[3],j=r[7],J=r[11],re=r[15];return s[0]=a*w+o*N+l*k+c*$,s[4]=a*C+o*A+l*L+c*j,s[8]=a*_+o*O+l*B+c*J,s[12]=a*b+o*H+l*U+c*re,s[1]=h*w+u*N+f*k+d*$,s[5]=h*C+u*A+f*L+d*j,s[9]=h*_+u*O+f*B+d*J,s[13]=h*b+u*H+f*U+d*re,s[2]=g*w+v*N+p*k+m*$,s[6]=g*C+v*A+p*L+m*j,s[10]=g*_+v*O+p*B+m*J,s[14]=g*b+v*H+p*U+m*re,s[3]=y*w+S*N+M*k+I*$,s[7]=y*C+S*A+M*L+I*j,s[11]=y*_+S*O+M*B+I*J,s[15]=y*b+S*H+M*U+I*re,this}multiplyScalar(t){const n=this.elements;return n[0]*=t,n[4]*=t,n[8]*=t,n[12]*=t,n[1]*=t,n[5]*=t,n[9]*=t,n[13]*=t,n[2]*=t,n[6]*=t,n[10]*=t,n[14]*=t,n[3]*=t,n[7]*=t,n[11]*=t,n[15]*=t,this}determinant(){const t=this.elements,n=t[0],i=t[4],r=t[8],s=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],f=t[10],d=t[14],g=t[3],v=t[7],p=t[11],m=t[15],y=l*d-c*f,S=o*d-c*u,M=o*f-l*u,I=a*d-c*h,w=a*f-l*h,C=a*u-o*h;return n*(v*y-p*S+m*M)-i*(g*y-p*I+m*w)+r*(g*S-v*I+m*C)-s*(g*M-v*w+p*C)}transpose(){const t=this.elements;let n;return n=t[1],t[1]=t[4],t[4]=n,n=t[2],t[2]=t[8],t[8]=n,n=t[6],t[6]=t[9],t[9]=n,n=t[3],t[3]=t[12],t[12]=n,n=t[7],t[7]=t[13],t[13]=n,n=t[11],t[11]=t[14],t[14]=n,this}setPosition(t,n,i){const r=this.elements;return t.isVector3?(r[12]=t.x,r[13]=t.y,r[14]=t.z):(r[12]=t,r[13]=n,r[14]=i),this}invert(){const t=this.elements,n=t[0],i=t[1],r=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],f=t[10],d=t[11],g=t[12],v=t[13],p=t[14],m=t[15],y=n*o-i*a,S=n*l-r*a,M=n*c-s*a,I=i*l-r*o,w=i*c-s*o,C=r*c-s*l,_=h*v-u*g,b=h*p-f*g,N=h*m-d*g,A=u*p-f*v,O=u*m-d*v,H=f*m-d*p,k=y*H-S*O+M*A+I*N-w*b+C*_;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const L=1/k;return t[0]=(o*H-l*O+c*A)*L,t[1]=(r*O-i*H-s*A)*L,t[2]=(v*C-p*w+m*I)*L,t[3]=(f*w-u*C-d*I)*L,t[4]=(l*N-a*H-c*b)*L,t[5]=(n*H-r*N+s*b)*L,t[6]=(p*M-g*C-m*S)*L,t[7]=(h*C-f*M+d*S)*L,t[8]=(a*O-o*N+c*_)*L,t[9]=(i*N-n*O-s*_)*L,t[10]=(g*w-v*M+m*y)*L,t[11]=(u*M-h*w-d*y)*L,t[12]=(o*b-a*A-l*_)*L,t[13]=(n*A-i*b+r*_)*L,t[14]=(v*S-g*I-p*y)*L,t[15]=(h*I-u*S+f*y)*L,this}scale(t){const n=this.elements,i=t.x,r=t.y,s=t.z;return n[0]*=i,n[4]*=r,n[8]*=s,n[1]*=i,n[5]*=r,n[9]*=s,n[2]*=i,n[6]*=r,n[10]*=s,n[3]*=i,n[7]*=r,n[11]*=s,this}getMaxScaleOnAxis(){const t=this.elements,n=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],r=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(n,i,r))}makeTranslation(t,n,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(t){const n=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(t){const n=Math.cos(t),i=Math.sin(t);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(t){const n=Math.cos(t),i=Math.sin(t);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,n){const i=Math.cos(n),r=Math.sin(n),s=1-i,a=t.x,o=t.y,l=t.z,c=s*a,h=s*o;return this.set(c*a+i,c*o-r*l,c*l+r*o,0,c*o+r*l,h*o+i,h*l-r*a,0,c*l-r*o,h*l+r*a,s*l*l+i,0,0,0,0,1),this}makeScale(t,n,i){return this.set(t,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,n,i,r,s,a){return this.set(1,i,s,0,t,1,a,0,n,r,1,0,0,0,0,1),this}compose(t,n,i){const r=this.elements,s=n._x,a=n._y,o=n._z,l=n._w,c=s+s,h=a+a,u=o+o,f=s*c,d=s*h,g=s*u,v=a*h,p=a*u,m=o*u,y=l*c,S=l*h,M=l*u,I=i.x,w=i.y,C=i.z;return r[0]=(1-(v+m))*I,r[1]=(d+M)*I,r[2]=(g-S)*I,r[3]=0,r[4]=(d-M)*w,r[5]=(1-(f+m))*w,r[6]=(p+y)*w,r[7]=0,r[8]=(g+S)*C,r[9]=(p-y)*C,r[10]=(1-(f+v))*C,r[11]=0,r[12]=t.x,r[13]=t.y,r[14]=t.z,r[15]=1,this}decompose(t,n,i){const r=this.elements;t.x=r[12],t.y=r[13],t.z=r[14];const s=this.determinant();if(s===0)return i.set(1,1,1),n.identity(),this;let a=di.set(r[0],r[1],r[2]).length();const o=di.set(r[4],r[5],r[6]).length(),l=di.set(r[8],r[9],r[10]).length();s<0&&(a=-a),tn.copy(this);const c=1/a,h=1/o,u=1/l;return tn.elements[0]*=c,tn.elements[1]*=c,tn.elements[2]*=c,tn.elements[4]*=h,tn.elements[5]*=h,tn.elements[6]*=h,tn.elements[8]*=u,tn.elements[9]*=u,tn.elements[10]*=u,n.setFromRotationMatrix(tn),i.x=a,i.y=o,i.z=l,this}makePerspective(t,n,i,r,s,a,o=Wi,l=!1){const c=this.elements,h=2*s/(n-t),u=2*s/(i-r),f=(n+t)/(n-t),d=(i+r)/(i-r);let g,v;if(l)g=s/(a-s),v=a*s/(a-s);else if(o===2e3)g=-(a+s)/(a-s),v=-2*a*s/(a-s);else if(o===2001)g=-a/(a-s),v=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=f,c[12]=0,c[1]=0,c[5]=u,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,n,i,r,s,a,o=Wi,l=!1){const c=this.elements,h=2/(n-t),u=2/(i-r),f=-(n+t)/(n-t),d=-(i+r)/(i-r);let g,v;if(l)g=1/(a-s),v=a/(a-s);else if(o===2e3)g=-2/(a-s),v=-(a+s)/(a-s);else if(o===2001)g=-1/(a-s),v=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=f,c[1]=0,c[5]=u,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=g,c[14]=v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){const n=this.elements,i=t.elements;for(let r=0;r<16;r++)if(n[r]!==i[r])return!1;return!0}fromArray(t,n=0){for(let i=0;i<16;i++)this.elements[i]=t[i+n];return this}toArray(t=[],n=0){const i=this.elements;return t[n]=i[0],t[n+1]=i[1],t[n+2]=i[2],t[n+3]=i[3],t[n+4]=i[4],t[n+5]=i[5],t[n+6]=i[6],t[n+7]=i[7],t[n+8]=i[8],t[n+9]=i[9],t[n+10]=i[10],t[n+11]=i[11],t[n+12]=i[12],t[n+13]=i[13],t[n+14]=i[14],t[n+15]=i[15],t}},di=new P,tn=new Ie,$u=new P(0,0,0),Qu=new P(1,1,1),Ln=new P,Br=new P,Wt=new P,Co=new Ie,Io=new St,Ct=class vc{constructor(t=0,n=0,i=0,r=vc.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=i,this._order=r}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,n,i,r=this._order){return this._x=t,this._y=n,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,n=this._order,i=!0){const r=t.elements,s=r[0],a=r[4],o=r[8],l=r[1],c=r[5],h=r[9],u=r[2],f=r[6],d=r[10];switch(n){case"XYZ":this._y=Math.asin(et(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-et(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,s),this._z=0);break;case"ZXY":this._x=Math.asin(et(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-u,d),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-et(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(f,d),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(et(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,s)):(this._x=0,this._y=Math.atan2(o,d));break;case"XZY":this._z=Math.asin(-et(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-h,d),this._y=0);break;default:Le("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,n,i){return Co.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Co,n,i)}setFromVector3(t,n=this._order){return this.set(t.x,t.y,t.z,n)}reorder(t){return Io.setFromEuler(this),this.setFromQuaternion(Io,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],n=0){return t[n]=this._x,t[n+1]=this._y,t[n+2]=this._z,t[n+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Ct.DEFAULT_ORDER="XYZ";var ro=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},ef=0,Po=new P,pi=new St,Sn=new Ie,kr=new P,ir=new P,tf=new P,nf=new St,Lo=new P(1,0,0),Do=new P(0,1,0),No=new P(0,0,1),Uo={type:"added"},rf={type:"removed"},mi={type:"childadded",child:null},$s={type:"childremoved",child:null},ft=class bs extends ci{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:ef++}),this.uuid=Zt(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=bs.DEFAULT_UP.clone();const t=new P,n=new Ct,i=new St,r=new P(1,1,1);function s(){i.setFromEuler(n,!1)}function a(){n.setFromQuaternion(i,void 0,!1)}n._onChange(s),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Ie},normalMatrix:{value:new Ke}}),this.matrix=new Ie,this.matrixWorld=new Ie,this.matrixAutoUpdate=bs.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=bs.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ro,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,n){this.quaternion.setFromAxisAngle(t,n)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,n){return pi.setFromAxisAngle(t,n),this.quaternion.multiply(pi),this}rotateOnWorldAxis(t,n){return pi.setFromAxisAngle(t,n),this.quaternion.premultiply(pi),this}rotateX(t){return this.rotateOnAxis(Lo,t)}rotateY(t){return this.rotateOnAxis(Do,t)}rotateZ(t){return this.rotateOnAxis(No,t)}translateOnAxis(t,n){return Po.copy(t).applyQuaternion(this.quaternion),this.position.add(Po.multiplyScalar(n)),this}translateX(t){return this.translateOnAxis(Lo,t)}translateY(t){return this.translateOnAxis(Do,t)}translateZ(t){return this.translateOnAxis(No,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Sn.copy(this.matrixWorld).invert())}lookAt(t,n,i){t.isVector3?kr.copy(t):kr.set(t,n,i);const r=this.parent;this.updateWorldMatrix(!0,!1),ir.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Sn.lookAt(ir,kr,this.up):Sn.lookAt(kr,ir,this.up),this.quaternion.setFromRotationMatrix(Sn),r&&(Sn.extractRotation(r.matrixWorld),pi.setFromRotationMatrix(Sn),this.quaternion.premultiply(pi.invert()))}add(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return t===this?(ke("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Uo),mi.child=t,this.dispatchEvent(mi),mi.child=null):ke("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const n=this.children.indexOf(t);return n!==-1&&(t.parent=null,this.children.splice(n,1),t.dispatchEvent(rf),$s.child=t,this.dispatchEvent($s),$s.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Sn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Sn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Sn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Uo),mi.child=t,this.dispatchEvent(mi),mi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,n){if(this[t]===n)return this;for(let i=0,r=this.children.length;i<r;i++){const s=this.children[i].getObjectByProperty(t,n);if(s!==void 0)return s}}getObjectsByProperty(t,n,i=[]){this[t]===n&&i.push(this);const r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].getObjectsByProperty(t,n,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,t,tf),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,nf,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const n=this.matrixWorld.elements;return t.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(t){t(this);const n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverseVisible(t)}traverseAncestors(t){const n=this.parent;n!==null&&(t(n),n.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const t=this.pivot;if(t!==null){const n=t.x,i=t.y,r=t.z,s=this.matrix.elements;s[12]+=n-s[0]*n-s[4]*i-s[8]*r,s[13]+=i-s[1]*n-s[5]*i-s[9]*r,s[14]+=r-s[2]*n-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].updateMatrixWorld(t)}updateWorldMatrix(t,n){const i=this.parent;if(t===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),n===!0){const r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(t){const n=t===void 0||typeof t=="string",i={};n&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(o=>({...o})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(t),r.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];s(t.shapes,u)}else s(t.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(t.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(t.materials,this.material[l]));r.material=o}else r.material=s(t.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];r.animations.push(s(t.animations,l))}}if(n){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),f=a(t.skeletons),d=a(t.animations),g=a(t.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),u.length>0&&(i.shapes=u),f.length>0&&(i.skeletons=f),d.length>0&&(i.animations=d),g.length>0&&(i.nodes=g)}return i.object=r,i;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,n=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),t.pivot!==null&&(this.pivot=t.pivot.clone()),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),n===!0)for(let i=0;i<t.children.length;i++){const r=t.children[i];this.add(r.clone())}return this}};ft.DEFAULT_UP=new P(0,1,0);ft.DEFAULT_MATRIX_AUTO_UPDATE=!0;ft.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var gn=class extends ft{constructor(){super(),this.isGroup=!0,this.type="Group"}},sf={type:"move"},Qs=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new gn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new gn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new P,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new P),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new gn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new P,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new P),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,r=null,s=null;const a=this._targetRay,o=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){s=!0;for(const g of e.hand.values()){const v=t.getJointPose(g,n),p=this._getHandJoint(l,g);v!==null&&(p.matrix.fromArray(v.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=v.radius),p.visible=v!==null}const c=l.joints["index-finger-tip"],h=l.joints["thumb-tip"],u=c.position.distanceTo(h.position),f=.02,d=.005;l.inputState.pinching&&u>f+d?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&u<=f-d&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else o!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1));a!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(sf)))}return a!==null&&(a.visible=i!==null),o!==null&&(o.visible=r!==null),l!==null&&(l.visible=s!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new gn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},_c={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Dn={h:0,s:0,l:0},zr={h:0,s:0,l:0};function ea(e,t,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var Ee=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=rt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,qe.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=qe.workingColorSpace){return this.r=e,this.g=t,this.b=n,qe.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=qe.workingColorSpace){if(e=no(e,1),t=et(t,0,1),n=et(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,s=2*n-r;this.r=ea(s,r,e+1/3),this.g=ea(s,r,e),this.b=ea(s,r,e-1/3)}return qe.colorSpaceToWorking(this,i),this}setStyle(e,t=rt){function n(r){r!==void 0&&parseFloat(r)<1&&Le("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const s=i[1],a=i[2];switch(s){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Le("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=i[1],s=r.length;if(s===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(s===6)return this.setHex(parseInt(r,16),t);Le("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=rt){const n=_c[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Le("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Cn(e.r),this.g=Cn(e.g),this.b=Cn(e.b),this}copyLinearToSRGB(e){return this.r=ki(e.r),this.g=ki(e.g),this.b=ki(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=rt){return qe.workingToColorSpace(Nt.copy(this),e),Math.round(et(Nt.r*255,0,255))*65536+Math.round(et(Nt.g*255,0,255))*256+Math.round(et(Nt.b*255,0,255))}getHexString(e=rt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=qe.workingColorSpace){qe.workingToColorSpace(Nt.copy(this),t);const n=Nt.r,i=Nt.g,r=Nt.b,s=Math.max(n,i,r),a=Math.min(n,i,r);let o,l;const c=(a+s)/2;if(a===s)o=0,l=0;else{const h=s-a;switch(l=c<=.5?h/(s+a):h/(2-s-a),s){case n:o=(i-r)/h+(i<r?6:0);break;case i:o=(r-n)/h+2;break;case r:o=(n-i)/h+4;break}o/=6}return e.h=o,e.s=l,e.l=c,e}getRGB(e,t=qe.workingColorSpace){return qe.workingToColorSpace(Nt.copy(this),t),e.r=Nt.r,e.g=Nt.g,e.b=Nt.b,e}getStyle(e=rt){qe.workingToColorSpace(Nt.copy(this),e);const t=Nt.r,n=Nt.g,i=Nt.b;return e!=="srgb"?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(Dn),this.setHSL(Dn.h+e,Dn.s+t,Dn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Dn),e.getHSL(zr);const n=yr(Dn.h,zr.h,t),i=yr(Dn.s,zr.s,t),r=yr(Dn.l,zr.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Nt=new Ee;Ee.NAMES=_c;var Sv=class yc{constructor(t,n=25e-5){this.isFogExp2=!0,this.name="",this.color=new Ee(t),this.density=n}clone(){return new yc(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}},Tv=class xc{constructor(t,n=1,i=1e3){this.isFog=!0,this.name="",this.color=new Ee(t),this.near=n,this.far=i}clone(){return new xc(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},Ev=class extends ft{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ct,this.environmentIntensity=1,this.environmentRotation=new Ct,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},nn=new P,Tn=new P,ta=new P,En=new P,gi=new P,vi=new P,Oo=new P,na=new P,ia=new P,ra=new P,sa=new ct,aa=new ct,oa=new ct,ni=class Li{constructor(t=new P,n=new P,i=new P){this.a=t,this.b=n,this.c=i}static getNormal(t,n,i,r){r.subVectors(i,n),nn.subVectors(t,n),r.cross(nn);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(t,n,i,r,s){nn.subVectors(r,n),Tn.subVectors(i,n),ta.subVectors(t,n);const a=nn.dot(nn),o=nn.dot(Tn),l=nn.dot(ta),c=Tn.dot(Tn),h=Tn.dot(ta),u=a*c-o*o;if(u===0)return s.set(0,0,0),null;const f=1/u,d=(c*l-o*h)*f,g=(a*h-o*l)*f;return s.set(1-d-g,g,d)}static containsPoint(t,n,i,r){return this.getBarycoord(t,n,i,r,En)===null?!1:En.x>=0&&En.y>=0&&En.x+En.y<=1}static getInterpolation(t,n,i,r,s,a,o,l){return this.getBarycoord(t,n,i,r,En)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,En.x),l.addScaledVector(a,En.y),l.addScaledVector(o,En.z),l)}static getInterpolatedAttribute(t,n,i,r,s,a){return sa.setScalar(0),aa.setScalar(0),oa.setScalar(0),sa.fromBufferAttribute(t,n),aa.fromBufferAttribute(t,i),oa.fromBufferAttribute(t,r),a.setScalar(0),a.addScaledVector(sa,s.x),a.addScaledVector(aa,s.y),a.addScaledVector(oa,s.z),a}static isFrontFacing(t,n,i,r){return nn.subVectors(i,n),Tn.subVectors(t,n),nn.cross(Tn).dot(r)<0}set(t,n,i){return this.a.copy(t),this.b.copy(n),this.c.copy(i),this}setFromPointsAndIndices(t,n,i,r){return this.a.copy(t[n]),this.b.copy(t[i]),this.c.copy(t[r]),this}setFromAttributeAndIndices(t,n,i,r){return this.a.fromBufferAttribute(t,n),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,r),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return nn.subVectors(this.c,this.b),Tn.subVectors(this.a,this.b),nn.cross(Tn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Li.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return Li.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,i,r,s){return Li.getInterpolation(t,this.a,this.b,this.c,n,i,r,s)}containsPoint(t){return Li.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Li.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,n){const i=this.a,r=this.b,s=this.c;let a,o;gi.subVectors(r,i),vi.subVectors(s,i),na.subVectors(t,i);const l=gi.dot(na),c=vi.dot(na);if(l<=0&&c<=0)return n.copy(i);ia.subVectors(t,r);const h=gi.dot(ia),u=vi.dot(ia);if(h>=0&&u<=h)return n.copy(r);const f=l*u-h*c;if(f<=0&&l>=0&&h<=0)return a=l/(l-h),n.copy(i).addScaledVector(gi,a);ra.subVectors(t,s);const d=gi.dot(ra),g=vi.dot(ra);if(g>=0&&d<=g)return n.copy(s);const v=d*c-l*g;if(v<=0&&c>=0&&g<=0)return o=c/(c-g),n.copy(i).addScaledVector(vi,o);const p=h*g-d*u;if(p<=0&&u-h>=0&&d-g>=0)return Oo.subVectors(s,r),o=(u-h)/(u-h+(d-g)),n.copy(r).addScaledVector(Oo,o);const m=1/(p+v+f);return a=v*m,o=f*m,n.copy(i).addScaledVector(gi,a).addScaledVector(vi,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},In=class{constructor(e=new P(1/0,1/0,1/0),t=new P(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(rn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(rn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=rn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let s=0,a=r.count;s<a;s++)e.isMesh===!0?e.getVertexPosition(s,rn):rn.fromBufferAttribute(r,s),rn.applyMatrix4(e.matrixWorld),this.expandByPoint(rn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Vr.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Vr.copy(n.boundingBox)),Vr.applyMatrix4(e.matrixWorld),this.union(Vr)}const i=e.children;for(let r=0,s=i.length;r<s;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,rn),rn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(rr),Gr.subVectors(this.max,rr),_i.subVectors(e.a,rr),yi.subVectors(e.b,rr),xi.subVectors(e.c,rr),Nn.subVectors(yi,_i),Un.subVectors(xi,yi),jn.subVectors(_i,xi);let t=[0,-Nn.z,Nn.y,0,-Un.z,Un.y,0,-jn.z,jn.y,Nn.z,0,-Nn.x,Un.z,0,-Un.x,jn.z,0,-jn.x,-Nn.y,Nn.x,0,-Un.y,Un.x,0,-jn.y,jn.x,0];return!la(t,_i,yi,xi,Gr)||(t=[1,0,0,0,1,0,0,0,1],!la(t,_i,yi,xi,Gr))?!1:(Hr.crossVectors(Nn,Un),t=[Hr.x,Hr.y,Hr.z],la(t,_i,yi,xi,Gr))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,rn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(rn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(bn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),bn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),bn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),bn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),bn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),bn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),bn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),bn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(bn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},bn=[new P,new P,new P,new P,new P,new P,new P,new P],rn=new P,Vr=new In,_i=new P,yi=new P,xi=new P,Nn=new P,Un=new P,jn=new P,rr=new P,Gr=new P,Hr=new P,Kn=new P;function la(e,t,n,i,r){for(let s=0,a=e.length-3;s<=a;s+=3){Kn.fromArray(e,s);const o=r.x*Math.abs(Kn.x)+r.y*Math.abs(Kn.y)+r.z*Math.abs(Kn.z),l=t.dot(Kn),c=n.dot(Kn),h=i.dot(Kn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var Mt=new P,Wr=new oe,af=0,wt=class{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:af++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=hc,this.updateRanges=[],this.gpuType=Ji,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Wr.fromBufferAttribute(this,t),Wr.applyMatrix3(e),this.setXY(t,Wr.x,Wr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.applyMatrix3(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.applyMatrix4(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.applyNormalMatrix(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Mt.fromBufferAttribute(this,t),Mt.transformDirection(e),this.setXYZ(t,Mt.x,Mt.y,Mt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=on(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=at(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=on(t,this.array)),t}setX(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=on(t,this.array)),t}setY(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=on(t,this.array)),t}setZ(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=on(t,this.array)),t}setW(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=at(t,this.array),n=at(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=at(t,this.array),n=at(n,this.array),i=at(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=at(t,this.array),n=at(n,this.array),i=at(i,this.array),r=at(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==35044&&(e.usage=this.usage),e}},so=class extends wt{constructor(e,t,n){super(new Uint16Array(e),t,n)}},Mc=class extends wt{constructor(e,t,n){super(new Uint32Array(e),t,n)}},Ye=class extends wt{constructor(e,t,n){super(new Float32Array(e),t,n)}},of=new In,sr=new P,ca=new P,yn=class{constructor(e=new P,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):of.setFromPoints(e).getCenter(n);let i=0;for(let r=0,s=e.length;r<s;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;sr.subVectors(e,this.center);const t=sr.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(sr,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(ca.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(sr.copy(e.center).add(ca)),this.expandByPoint(sr.copy(e.center).sub(ca))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},lf=0,Yt=new Ie,ha=new ft,Mi=new P,Xt=new In,ar=new In,At=new P,dt=class Sc extends ci{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:lf++}),this.uuid=Zt(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(bu(t)?Mc:so)(t,1):this.index=t,this}setIndirect(t,n=0){return this.indirect=t,this.indirectOffset=n,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,n){return this.attributes[t]=n,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,n,i=0){this.groups.push({start:t,count:n,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,n){this.drawRange.start=t,this.drawRange.count=n}applyMatrix4(t){const n=this.attributes.position;n!==void 0&&(n.applyMatrix4(t),n.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const s=new Ke().getNormalMatrix(t);i.applyNormalMatrix(s),i.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(t),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Yt.makeRotationFromQuaternion(t),this.applyMatrix4(Yt),this}rotateX(t){return Yt.makeRotationX(t),this.applyMatrix4(Yt),this}rotateY(t){return Yt.makeRotationY(t),this.applyMatrix4(Yt),this}rotateZ(t){return Yt.makeRotationZ(t),this.applyMatrix4(Yt),this}translate(t,n,i){return Yt.makeTranslation(t,n,i),this.applyMatrix4(Yt),this}scale(t,n,i){return Yt.makeScale(t,n,i),this.applyMatrix4(Yt),this}lookAt(t){return ha.lookAt(t),ha.updateMatrix(),this.applyMatrix4(ha.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Mi).negate(),this.translate(Mi.x,Mi.y,Mi.z),this}setFromPoints(t){const n=this.getAttribute("position");if(n===void 0){const i=[];for(let r=0,s=t.length;r<s;r++){const a=t[r];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Ye(i,3))}else{const i=Math.min(t.length,n.count);for(let r=0;r<i;r++){const s=t[r];n.setXYZ(r,s.x,s.y,s.z||0)}t.length>n.count&&Le("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),n.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new In);const t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){ke("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new P(-1/0,-1/0,-1/0),new P(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),n)for(let i=0,r=n.length;i<r;i++){const s=n[i];Xt.setFromBufferAttribute(s),this.morphTargetsRelative?(At.addVectors(this.boundingBox.min,Xt.min),this.boundingBox.expandByPoint(At),At.addVectors(this.boundingBox.max,Xt.max),this.boundingBox.expandByPoint(At)):(this.boundingBox.expandByPoint(Xt.min),this.boundingBox.expandByPoint(Xt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&ke('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new yn);const t=this.attributes.position,n=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){ke("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new P,1/0);return}if(t){const i=this.boundingSphere.center;if(Xt.setFromBufferAttribute(t),n)for(let s=0,a=n.length;s<a;s++){const o=n[s];ar.setFromBufferAttribute(o),this.morphTargetsRelative?(At.addVectors(Xt.min,ar.min),Xt.expandByPoint(At),At.addVectors(Xt.max,ar.max),Xt.expandByPoint(At)):(Xt.expandByPoint(ar.min),Xt.expandByPoint(ar.max))}Xt.getCenter(i);let r=0;for(let s=0,a=t.count;s<a;s++)At.fromBufferAttribute(t,s),r=Math.max(r,i.distanceToSquared(At));if(n)for(let s=0,a=n.length;s<a;s++){const o=n[s],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)At.fromBufferAttribute(o,c),l&&(Mi.fromBufferAttribute(t,c),At.add(Mi)),r=Math.max(r,i.distanceToSquared(At))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&ke('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,n=this.attributes;if(t===null||n.position===void 0||n.normal===void 0||n.uv===void 0){ke("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=n.position,r=n.normal,s=n.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new wt(new Float32Array(4*i.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let _=0;_<i.count;_++)o[_]=new P,l[_]=new P;const c=new P,h=new P,u=new P,f=new oe,d=new oe,g=new oe,v=new P,p=new P;function m(_,b,N){c.fromBufferAttribute(i,_),h.fromBufferAttribute(i,b),u.fromBufferAttribute(i,N),f.fromBufferAttribute(s,_),d.fromBufferAttribute(s,b),g.fromBufferAttribute(s,N),h.sub(c),u.sub(c),d.sub(f),g.sub(f);const A=1/(d.x*g.y-g.x*d.y);isFinite(A)&&(v.copy(h).multiplyScalar(g.y).addScaledVector(u,-d.y).multiplyScalar(A),p.copy(u).multiplyScalar(d.x).addScaledVector(h,-g.x).multiplyScalar(A),o[_].add(v),o[b].add(v),o[N].add(v),l[_].add(p),l[b].add(p),l[N].add(p))}let y=this.groups;y.length===0&&(y=[{start:0,count:t.count}]);for(let _=0,b=y.length;_<b;++_){const N=y[_],A=N.start,O=N.count;for(let H=A,k=A+O;H<k;H+=3)m(t.getX(H+0),t.getX(H+1),t.getX(H+2))}const S=new P,M=new P,I=new P,w=new P;function C(_){I.fromBufferAttribute(r,_),w.copy(I);const b=o[_];S.copy(b),S.sub(I.multiplyScalar(I.dot(b))).normalize(),M.crossVectors(w,b);const N=M.dot(l[_])<0?-1:1;a.setXYZW(_,S.x,S.y,S.z,N)}for(let _=0,b=y.length;_<b;++_){const N=y[_],A=N.start,O=N.count;for(let H=A,k=A+O;H<k;H+=3)C(t.getX(H+0)),C(t.getX(H+1)),C(t.getX(H+2))}}computeVertexNormals(){const t=this.index,n=this.getAttribute("position");if(n!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new wt(new Float32Array(n.count*3),3),this.setAttribute("normal",i);else for(let f=0,d=i.count;f<d;f++)i.setXYZ(f,0,0,0);const r=new P,s=new P,a=new P,o=new P,l=new P,c=new P,h=new P,u=new P;if(t)for(let f=0,d=t.count;f<d;f+=3){const g=t.getX(f+0),v=t.getX(f+1),p=t.getX(f+2);r.fromBufferAttribute(n,g),s.fromBufferAttribute(n,v),a.fromBufferAttribute(n,p),h.subVectors(a,s),u.subVectors(r,s),h.cross(u),o.fromBufferAttribute(i,g),l.fromBufferAttribute(i,v),c.fromBufferAttribute(i,p),o.add(h),l.add(h),c.add(h),i.setXYZ(g,o.x,o.y,o.z),i.setXYZ(v,l.x,l.y,l.z),i.setXYZ(p,c.x,c.y,c.z)}else for(let f=0,d=n.count;f<d;f+=3)r.fromBufferAttribute(n,f+0),s.fromBufferAttribute(n,f+1),a.fromBufferAttribute(n,f+2),h.subVectors(a,s),u.subVectors(r,s),h.cross(u),i.setXYZ(f+0,h.x,h.y,h.z),i.setXYZ(f+1,h.x,h.y,h.z),i.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let n=0,i=t.count;n<i;n++)At.fromBufferAttribute(t,n),At.normalize(),t.setXYZ(n,At.x,At.y,At.z)}toNonIndexed(){function t(o,l){const c=o.array,h=o.itemSize,u=o.normalized,f=new c.constructor(l.length*h);let d=0,g=0;for(let v=0,p=l.length;v<p;v++){o.isInterleavedBufferAttribute?d=l[v]*o.data.stride+o.offset:d=l[v]*h;for(let m=0;m<h;m++)f[g++]=c[d++]}return new wt(f,h,u)}if(this.index===null)return Le("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const n=new Sc,i=this.index.array,r=this.attributes;for(const o in r){const l=r[o],c=t(l,i);n.setAttribute(o,c)}const s=this.morphAttributes;for(const o in s){const l=[],c=s[o];for(let h=0,u=c.length;h<u;h++){const f=c[h],d=t(f,i);l.push(d)}n.morphAttributes[o]=l}n.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];n.addGroup(c.start,c.count,c.materialIndex)}return n}toJSON(){const t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const n=this.index;n!==null&&(t.data.index={type:n.array.constructor.name,array:Array.prototype.slice.call(n.array)});const i=this.attributes;for(const l in i){const c=i[l];t.data.attributes[l]=c.toJSON(t.data)}const r={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,f=c.length;u<f;u++){const d=c[u];h.push(d.toJSON(t.data))}h.length>0&&(r[l]=h,s=!0)}s&&(t.data.morphAttributes=r,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const n={};this.name=t.name;const i=t.index;i!==null&&this.setIndex(i.clone());const r=t.attributes;for(const c in r){const h=r[c];this.setAttribute(c,h.clone(n))}const s=t.morphAttributes;for(const c in s){const h=[],u=s[c];for(let f=0,d=u.length;f<d;f++)h.push(u[f].clone(n));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},Tc=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=hc,this.updateRanges=[],this.version=0,this.uuid=Zt()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Zt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Zt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},Bt=new P,Ga=class Ec{constructor(t,n,i,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=n,this.offset=i,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let n=0,i=this.data.count;n<i;n++)Bt.fromBufferAttribute(this,n),Bt.applyMatrix4(t),this.setXYZ(n,Bt.x,Bt.y,Bt.z);return this}applyNormalMatrix(t){for(let n=0,i=this.count;n<i;n++)Bt.fromBufferAttribute(this,n),Bt.applyNormalMatrix(t),this.setXYZ(n,Bt.x,Bt.y,Bt.z);return this}transformDirection(t){for(let n=0,i=this.count;n<i;n++)Bt.fromBufferAttribute(this,n),Bt.transformDirection(t),this.setXYZ(n,Bt.x,Bt.y,Bt.z);return this}getComponent(t,n){let i=this.array[t*this.data.stride+this.offset+n];return this.normalized&&(i=on(i,this.array)),i}setComponent(t,n,i){return this.normalized&&(i=at(i,this.array)),this.data.array[t*this.data.stride+this.offset+n]=i,this}setX(t,n){return this.normalized&&(n=at(n,this.array)),this.data.array[t*this.data.stride+this.offset]=n,this}setY(t,n){return this.normalized&&(n=at(n,this.array)),this.data.array[t*this.data.stride+this.offset+1]=n,this}setZ(t,n){return this.normalized&&(n=at(n,this.array)),this.data.array[t*this.data.stride+this.offset+2]=n,this}setW(t,n){return this.normalized&&(n=at(n,this.array)),this.data.array[t*this.data.stride+this.offset+3]=n,this}getX(t){let n=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(n=on(n,this.array)),n}getY(t){let n=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(n=on(n,this.array)),n}getZ(t){let n=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(n=on(n,this.array)),n}getW(t){let n=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(n=on(n,this.array)),n}setXY(t,n,i){return t=t*this.data.stride+this.offset,this.normalized&&(n=at(n,this.array),i=at(i,this.array)),this.data.array[t+0]=n,this.data.array[t+1]=i,this}setXYZ(t,n,i,r){return t=t*this.data.stride+this.offset,this.normalized&&(n=at(n,this.array),i=at(i,this.array),r=at(r,this.array)),this.data.array[t+0]=n,this.data.array[t+1]=i,this.data.array[t+2]=r,this}setXYZW(t,n,i,r,s){return t=t*this.data.stride+this.offset,this.normalized&&(n=at(n,this.array),i=at(i,this.array),r=at(r,this.array),s=at(s,this.array)),this.data.array[t+0]=n,this.data.array[t+1]=i,this.data.array[t+2]=r,this.data.array[t+3]=s,this}clone(t){if(t===void 0){Ds("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const n=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)n.push(this.data.array[r+s])}return new wt(new this.array.constructor(n),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new Ec(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){Ds("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const n=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)n.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:n,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},cf=0,Gt=class extends ci{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:cf++}),this.uuid=Zt(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ee(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ys,this.stencilZFail=Ys,this.stencilZPass=Ys,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){Le(`Material: parameter '${t}' has value of undefined.`);continue}const i=this[t];if(i===void 0){Le(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==0&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==204&&(n.blendSrc=this.blendSrc),this.blendDst!==205&&(n.blendDst=this.blendDst),this.blendEquation!==100&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==7680&&(n.stencilFail=this.stencilFail),this.stencilZFail!==7680&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==7680&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){const s=[];for(const a in r){const o=r[a];delete o.metadata,s.push(o)}return s}if(t){const r=i(e.textures),s=i(e.images);r.length>0&&(n.textures=r),s.length>0&&(n.images=s)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const i=t.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}},hf=class extends Gt{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Ee(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Si,or=new P,Ti=new P,Ei=new P,bi=new oe,lr=new oe,bc=new Ie,Xr=new P,cr=new P,qr=new P,Fo=new oe,ua=new oe,Bo=new oe,bv=class extends ft{constructor(e=new hf){if(super(),this.isSprite=!0,this.type="Sprite",Si===void 0){Si=new dt;const t=new Tc(new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),5);Si.setIndex([0,1,2,0,2,3]),Si.setAttribute("position",new Ga(t,3,0,!1)),Si.setAttribute("uv",new Ga(t,2,3,!1))}this.geometry=Si,this.material=e,this.center=new oe(.5,.5),this.count=1}raycast(e,t){e.camera===null&&ke('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Ti.setFromMatrixScale(this.matrixWorld),bc.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Ei.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Ti.multiplyScalar(-Ei.z);const n=this.material.rotation;let i,r;n!==0&&(r=Math.cos(n),i=Math.sin(n));const s=this.center;Yr(Xr.set(-.5,-.5,0),Ei,s,Ti,i,r),Yr(cr.set(.5,-.5,0),Ei,s,Ti,i,r),Yr(qr.set(.5,.5,0),Ei,s,Ti,i,r),Fo.set(0,0),ua.set(1,0),Bo.set(1,1);let a=e.ray.intersectTriangle(Xr,cr,qr,!1,or);if(a===null&&(Yr(cr.set(-.5,.5,0),Ei,s,Ti,i,r),ua.set(0,1),a=e.ray.intersectTriangle(Xr,qr,cr,!1,or),a===null))return;const o=e.ray.origin.distanceTo(or);o<e.near||o>e.far||t.push({distance:o,point:or.clone(),uv:ni.getInterpolation(or,Xr,cr,qr,Fo,ua,Bo,new oe),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}};function Yr(e,t,n,i,r,s){bi.subVectors(e,n).addScalar(.5).multiply(i),r!==void 0?(lr.x=s*bi.x-r*bi.y,lr.y=r*bi.x+s*bi.y):lr.copy(bi),e.copy(t),e.x+=lr.x,e.y+=lr.y,e.applyMatrix4(bc)}var An=new P,fa=new P,jr=new P,On=new P,da=new P,Kr=new P,pa=new P,Lr=class{constructor(e=new P,t=new P(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,An)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=An.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(An.copy(this.origin).addScaledVector(this.direction,t),An.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){fa.copy(e).add(t).multiplyScalar(.5),jr.copy(t).sub(e).normalize(),On.copy(this.origin).sub(fa);const r=e.distanceTo(t)*.5,s=-this.direction.dot(jr),a=On.dot(this.direction),o=-On.dot(jr),l=On.lengthSq(),c=Math.abs(1-s*s);let h,u,f,d;if(c>0)if(h=s*o-a,u=s*a-o,d=r*c,h>=0)if(u>=-d)if(u<=d){const g=1/c;h*=g,u*=g,f=h*(h+s*u+2*a)+u*(s*h+u+2*o)+l}else u=r,h=Math.max(0,-(s*u+a)),f=-h*h+u*(u+2*o)+l;else u=-r,h=Math.max(0,-(s*u+a)),f=-h*h+u*(u+2*o)+l;else u<=-d?(h=Math.max(0,-(-s*r+a)),u=h>0?-r:Math.min(Math.max(-r,-o),r),f=-h*h+u*(u+2*o)+l):u<=d?(h=0,u=Math.min(Math.max(-r,-o),r),f=u*(u+2*o)+l):(h=Math.max(0,-(s*r+a)),u=h>0?r:Math.min(Math.max(-r,-o),r),f=-h*h+u*(u+2*o)+l);else u=s>0?-r:r,h=Math.max(0,-(s*u+a)),f=-h*h+u*(u+2*o)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,h),i&&i.copy(fa).addScaledVector(jr,u),f}intersectSphere(e,t){An.subVectors(e.center,this.origin);const n=An.dot(this.direction),i=An.dot(An)-n*n,r=e.radius*e.radius;if(i>r)return null;const s=Math.sqrt(r-i),a=n-s,o=n+s;return o<0?null:a<0?this.at(o,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,r,s,a,o;const l=1/this.direction.x,c=1/this.direction.y,h=1/this.direction.z,u=this.origin;return l>=0?(n=(e.min.x-u.x)*l,i=(e.max.x-u.x)*l):(n=(e.max.x-u.x)*l,i=(e.min.x-u.x)*l),c>=0?(r=(e.min.y-u.y)*c,s=(e.max.y-u.y)*c):(r=(e.max.y-u.y)*c,s=(e.min.y-u.y)*c),n>s||r>i||((r>n||isNaN(n))&&(n=r),(s<i||isNaN(i))&&(i=s),h>=0?(a=(e.min.z-u.z)*h,o=(e.max.z-u.z)*h):(a=(e.max.z-u.z)*h,o=(e.min.z-u.z)*h),n>o||a>i)||((a>n||n!==n)&&(n=a),(o<i||i!==i)&&(i=o),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,An)!==null}intersectTriangle(e,t,n,i,r){da.subVectors(t,e),Kr.subVectors(n,e),pa.crossVectors(da,Kr);let s=this.direction.dot(pa),a;if(s>0){if(i)return null;a=1}else if(s<0)a=-1,s=-s;else return null;On.subVectors(this.origin,e);const o=a*this.direction.dot(Kr.crossVectors(On,Kr));if(o<0)return null;const l=a*this.direction.dot(da.cross(On));if(l<0||o+l>s)return null;const c=-a*On.dot(pa);return c<0?null:this.at(c/s,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},zn=class extends Gt{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ee(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ct,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},ko=new Ie,Jn=new Lr,Jr=new yn,zo=new P,Zr=new P,$r=new P,Qr=new P,ma=new P,es=new P,Vo=new P,ts=new P,Pt=class extends ft{constructor(e=new dt,t=new zn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){const n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let i=0,r=n.length;i<r;i++){const s=n[i].name||String(i);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=i}}}}getVertexPosition(e,t){const n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,s=n.morphTargetsRelative;t.fromBufferAttribute(i,e);const a=this.morphTargetInfluences;if(r&&a){es.set(0,0,0);for(let o=0,l=r.length;o<l;o++){const c=a[o],h=r[o];c!==0&&(ma.fromBufferAttribute(h,e),s?es.addScaledVector(ma,c):es.addScaledVector(ma.sub(t),c))}t.add(es)}return t}raycast(e,t){const n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Jr.copy(n.boundingSphere),Jr.applyMatrix4(r),Jn.copy(e.ray).recast(e.near),!(Jr.containsPoint(Jn.origin)===!1&&(Jn.intersectSphere(Jr,zo)===null||Jn.origin.distanceToSquared(zo)>(e.far-e.near)**2))&&(ko.copy(r).invert(),Jn.copy(e.ray).applyMatrix4(ko),!(n.boundingBox!==null&&Jn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Jn)))}_computeIntersections(e,t,n){let i;const r=this.geometry,s=this.material,a=r.index,o=r.attributes.position,l=r.attributes.uv,c=r.attributes.uv1,h=r.attributes.normal,u=r.groups,f=r.drawRange;if(a!==null)if(Array.isArray(s))for(let d=0,g=u.length;d<g;d++){const v=u[d],p=s[v.materialIndex],m=Math.max(v.start,f.start),y=Math.min(a.count,Math.min(v.start+v.count,f.start+f.count));for(let S=m,M=y;S<M;S+=3){const I=a.getX(S),w=a.getX(S+1),C=a.getX(S+2);i=ns(this,p,e,n,l,c,h,I,w,C),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=v.materialIndex,t.push(i))}}else{const d=Math.max(0,f.start),g=Math.min(a.count,f.start+f.count);for(let v=d,p=g;v<p;v+=3){const m=a.getX(v),y=a.getX(v+1),S=a.getX(v+2);i=ns(this,s,e,n,l,c,h,m,y,S),i&&(i.faceIndex=Math.floor(v/3),t.push(i))}}else if(o!==void 0)if(Array.isArray(s))for(let d=0,g=u.length;d<g;d++){const v=u[d],p=s[v.materialIndex],m=Math.max(v.start,f.start),y=Math.min(o.count,Math.min(v.start+v.count,f.start+f.count));for(let S=m,M=y;S<M;S+=3){const I=S,w=S+1,C=S+2;i=ns(this,p,e,n,l,c,h,I,w,C),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=v.materialIndex,t.push(i))}}else{const d=Math.max(0,f.start),g=Math.min(o.count,f.start+f.count);for(let v=d,p=g;v<p;v+=3){const m=v,y=v+1,S=v+2;i=ns(this,s,e,n,l,c,h,m,y,S),i&&(i.faceIndex=Math.floor(v/3),t.push(i))}}}};function uf(e,t,n,i,r,s,a,o){let l;if(t.side===1?l=i.intersectTriangle(a,s,r,!0,o):l=i.intersectTriangle(r,s,a,t.side===0,o),l===null)return null;ts.copy(o),ts.applyMatrix4(e.matrixWorld);const c=n.ray.origin.distanceTo(ts);return c<n.near||c>n.far?null:{distance:c,point:ts.clone(),object:e}}function ns(e,t,n,i,r,s,a,o,l,c){e.getVertexPosition(o,Zr),e.getVertexPosition(l,$r),e.getVertexPosition(c,Qr);const h=uf(e,t,n,i,Zr,$r,Qr,Vo);if(h){const u=new P;ni.getBarycoord(Vo,Zr,$r,Qr,u),r&&(h.uv=ni.getInterpolatedAttribute(r,o,l,c,u,new oe)),s&&(h.uv1=ni.getInterpolatedAttribute(s,o,l,c,u,new oe)),a&&(h.normal=ni.getInterpolatedAttribute(a,o,l,c,u,new P),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));const f={a:o,b:l,c,normal:new P,materialIndex:0};ni.getNormal(Zr,$r,Qr,f.normal),h.face=f,h.barycoord=u}return h}var Go=new P,Ho=new ct,Wo=new ct,ff=new P,Xo=new Ie,is=new P,ga=new yn,qo=new Ie,va=new Lr,Ac=class extends Pt{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Ph,this.bindMatrix=new Ie,this.bindMatrixInverse=new Ie,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new In),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,is),this.boundingBox.expandByPoint(is)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new yn),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,is),this.boundingSphere.expandByPoint(is)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ga.copy(this.boundingSphere),ga.applyMatrix4(i),e.ray.intersectsSphere(ga)!==!1&&(qo.copy(i).invert(),va.copy(e.ray).applyMatrix4(qo),!(this.boundingBox!==null&&va.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,va)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new ct,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);const r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode==="attached"?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode==="detached"?this.bindMatrixInverse.copy(this.bindMatrix).invert():Le("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const n=this.skeleton,i=this.geometry;Ho.fromBufferAttribute(i.attributes.skinIndex,e),Wo.fromBufferAttribute(i.attributes.skinWeight,e),Go.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let r=0;r<4;r++){const s=Wo.getComponent(r);if(s!==0){const a=Ho.getComponent(r);Xo.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),t.addScaledVector(ff.copy(Go).applyMatrix4(Xo),s)}}return t.applyMatrix4(this.bindMatrixInverse)}},Us=class extends ft{constructor(){super(),this.isBone=!0,this.type="Bone"}},zs=class extends Ft{constructor(e=null,t=1,n=1,i,r,s,a,o,l=Ot,c=Ot,h,u){super(null,s,a,o,l,c,i,r,h,u),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Yo=new Ie,df=new Ie,wc=class Rc{constructor(t=[],n=[]){this.uuid=Zt(),this.bones=t.slice(0),this.boneInverses=n,this.boneMatrices=null,this.previousBoneMatrices=null,this.boneTexture=null,this.init()}init(){const t=this.bones,n=this.boneInverses;if(this.boneMatrices=new Float32Array(t.length*16),n.length===0)this.calculateInverses();else if(t.length!==n.length){Le("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new Ie)}}calculateInverses(){this.boneInverses.length=0;for(let t=0,n=this.bones.length;t<n;t++){const i=new Ie;this.bones[t]&&i.copy(this.bones[t].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let t=0,n=this.bones.length;t<n;t++){const i=this.bones[t];i&&i.matrixWorld.copy(this.boneInverses[t]).invert()}for(let t=0,n=this.bones.length;t<n;t++){const i=this.bones[t];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const t=this.bones,n=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,a=t.length;s<a;s++){const o=t[s]?t[s].matrixWorld:df;Yo.multiplyMatrices(o,n[s]),Yo.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new Rc(this.bones,this.boneInverses)}computeBoneTexture(){let t=Math.sqrt(this.bones.length*4);t=Math.ceil(t/4)*4,t=Math.max(t,4);const n=new Float32Array(t*t*4);n.set(this.boneMatrices);const i=new zs(n,t,t,Hi,Ji);return i.needsUpdate=!0,this.boneMatrices=n,this.boneTexture=i,this}getBoneByName(t){for(let n=0,i=this.bones.length;n<i;n++){const r=this.bones[n];if(r.name===t)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(t,n){this.uuid=t.uuid;for(let i=0,r=t.bones.length;i<r;i++){const s=t.bones[i];let a=n[s];a===void 0&&(Le("Skeleton: No bone found with UUID:",s),a=new Us),this.bones.push(a),this.boneInverses.push(new Ie().fromArray(t.boneInverses[i]))}return this.init(),this}toJSON(){const t={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};t.uuid=this.uuid;const n=this.bones,i=this.boneInverses;for(let r=0,s=n.length;r<s;r++){const a=n[r];t.bones.push(a.uuid);const o=i[r];t.boneInverses.push(o.toArray())}return t}},Ha=class extends wt{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Ai=new Ie,jo=new Ie,rs=[],Ko=new In,pf=new Ie,hr=new Pt,ur=new yn,mf=class extends Pt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Ha(new Float32Array(n*16),16),this.previousInstanceMatrix=null,this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,pf)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new In),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ai),Ko.copy(e.boundingBox).applyMatrix4(Ai),this.boundingBox.union(Ko)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new yn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ai),ur.copy(e.boundingSphere).applyMatrix4(Ai),this.boundingSphere.union(ur)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.previousInstanceMatrix!==null&&(this.previousInstanceMatrix=e.previousInstanceMatrix.clone()),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,r=e*(n.length+1)+1;for(let s=0;s<n.length;s++)n[s]=i[r+s]}raycast(e,t){const n=this.matrixWorld,i=this.count;if(hr.geometry=this.geometry,hr.material=this.material,hr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ur.copy(this.boundingSphere),ur.applyMatrix4(n),e.ray.intersectsSphere(ur)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,Ai),jo.multiplyMatrices(n,Ai),hr.matrixWorld=jo,hr.raycast(e,rs);for(let s=0,a=rs.length;s<a;s++){const o=rs[s];o.instanceId=r,o.object=this,t.push(o)}rs.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Ha(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new zs(new Float32Array(i*this.count),i,this.count,ac,Ji));const r=this.morphTexture.source.data.data;let s=0;for(let l=0;l<n.length;l++)s+=n[l];const a=this.geometry.morphTargetsRelative?1:1-s,o=i*e;r[o]=a,r.set(n,o+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},_a=new P,gf=new P,vf=new Ke,ti=class{constructor(e=new P(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const i=_a.subVectors(n,t).cross(gf.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(_a),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||vf.getNormalMatrix(e),i=this.coplanarPoint(_a).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Zn=new yn,_f=new oe(.5,.5),ss=new P,ao=class{constructor(e=new ti,t=new ti,n=new ti,i=new ti,r=new ti,s=new ti){this.planes=[e,t,n,i,r,s]}set(e,t,n,i,r,s){const a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(i),a[4].copy(r),a[5].copy(s),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Wi,n=!1){const i=this.planes,r=e.elements,s=r[0],a=r[1],o=r[2],l=r[3],c=r[4],h=r[5],u=r[6],f=r[7],d=r[8],g=r[9],v=r[10],p=r[11],m=r[12],y=r[13],S=r[14],M=r[15];if(i[0].setComponents(l-s,f-c,p-d,M-m).normalize(),i[1].setComponents(l+s,f+c,p+d,M+m).normalize(),i[2].setComponents(l+a,f+h,p+g,M+y).normalize(),i[3].setComponents(l-a,f-h,p-g,M-y).normalize(),n)i[4].setComponents(o,u,v,S).normalize(),i[5].setComponents(l-o,f-u,p-v,M-S).normalize();else if(i[4].setComponents(l-o,f-u,p-v,M-S).normalize(),t===2e3)i[5].setComponents(l+o,f+u,p+v,M+S).normalize();else if(t===2001)i[5].setComponents(o,u,v,S).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Zn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Zn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Zn)}intersectsSprite(e){return Zn.center.set(0,0,0),Zn.radius=.7071067811865476+_f.distanceTo(e.center),Zn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Zn)}intersectsSphere(e){const t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const i=t[n];if(ss.x=i.normal.x>0?e.max.x:e.min.x,ss.y=i.normal.y>0?e.max.y:e.min.y,ss.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(ss)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},Wn=class extends Gt{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ee(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Os=new P,Fs=new P,Jo=new Ie,fr=new Lr,as=new yn,ya=new P,Zo=new P,Dr=class extends ft{constructor(e=new dt,t=new Wn){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)Os.fromBufferAttribute(t,i-1),Fs.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Os.distanceTo(Fs);e.setAttribute("lineDistance",new Ye(n,1))}else Le("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,s=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),as.copy(n.boundingSphere),as.applyMatrix4(i),as.radius+=r,e.ray.intersectsSphere(as)===!1)return;Jo.copy(i).invert(),fr.copy(e.ray).applyMatrix4(Jo);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),o=a*a,l=this.isLineSegments?2:1,c=n.index,h=n.attributes.position;if(c!==null){const u=Math.max(0,s.start),f=Math.min(c.count,s.start+s.count);for(let d=u,g=f-1;d<g;d+=l){const v=c.getX(d),p=c.getX(d+1),m=os(this,e,fr,o,v,p,d);m&&t.push(m)}if(this.isLineLoop){const d=c.getX(f-1),g=c.getX(u),v=os(this,e,fr,o,d,g,f-1);v&&t.push(v)}}else{const u=Math.max(0,s.start),f=Math.min(h.count,s.start+s.count);for(let d=u,g=f-1;d<g;d+=l){const v=os(this,e,fr,o,d,d+1,d);v&&t.push(v)}if(this.isLineLoop){const d=os(this,e,fr,o,f-1,u,f-1);d&&t.push(d)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){const n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let i=0,r=n.length;i<r;i++){const s=n[i].name||String(i);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=i}}}}};function os(e,t,n,i,r,s,a){const o=e.geometry.attributes.position;if(Os.fromBufferAttribute(o,r),Fs.fromBufferAttribute(o,s),n.distanceSqToSegment(Os,Fs,ya,Zo)>i)return;ya.applyMatrix4(e.matrixWorld);const l=t.ray.origin.distanceTo(ya);if(!(l<t.near||l>t.far))return{distance:l,point:Zo.clone().applyMatrix4(e.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:e}}var $o=new P,Qo=new P,Bs=class extends Dr{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let i=0,r=t.count;i<r;i+=2)$o.fromBufferAttribute(t,i),Qo.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+$o.distanceTo(Qo);e.setAttribute("lineDistance",new Ye(n,1))}else Le("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},yf=class extends Dr{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},Oi=class extends Gt{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ee(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},el=new Ie,Wa=new Lr,ls=new yn,cs=new P,As=class extends ft{constructor(e=new dt,t=new Oi){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,s=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ls.copy(n.boundingSphere),ls.applyMatrix4(i),ls.radius+=r,e.ray.intersectsSphere(ls)===!1)return;el.copy(i).invert(),Wa.copy(e.ray).applyMatrix4(el);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),o=a*a,l=n.index,c=n.attributes.position;if(l!==null){const h=Math.max(0,s.start),u=Math.min(l.count,s.start+s.count);for(let f=h,d=u;f<d;f++){const g=l.getX(f);cs.fromBufferAttribute(c,g),tl(cs,g,o,i,e,t,this)}}else{const h=Math.max(0,s.start),u=Math.min(c.count,s.start+s.count);for(let f=h,d=u;f<d;f++)cs.fromBufferAttribute(c,f),tl(cs,f,o,i,e,t,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){const n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let i=0,r=n.length;i<r;i++){const s=n[i].name||String(i);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=i}}}}};function tl(e,t,n,i,r,s,a){const o=Wa.distanceSqToPoint(e);if(o<n){const l=new P;Wa.closestPointToPoint(e,l),l.applyMatrix4(i);const c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:a})}}var Cc=class extends Ft{constructor(e=[],t=301,n,i,r,s,a,o,l,c){super(e,t,n,i,r,s,a,o,l,c),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Av=class extends Ft{constructor(e,t,n,i,r,s,a,o,l){super(e,t,n,i,r,s,a,o,l),this.isCanvasTexture=!0,this.needsUpdate=!0}},wr=class extends Ft{constructor(e,t,n=ri,i,r,s,a=Ot,o=Ot,l,c=Tr,h=1){if(c!==1026&&c!==1027)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");super({width:e,height:t,depth:h},i,r,s,a,o,c,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new io(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},xf=class extends wr{constructor(e,t=ri,n=301,i,r,s=Ot,a=Ot,o,l=Tr){const c={width:e,height:e,depth:1},h=[c,c,c,c,c,c];super(e,e,t,n,i,r,s,a,o,l),this.image=h,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Ic=class extends Ft{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},oo=class Pc extends dt{constructor(t=1,n=1,i=1,r=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:n,depth:i,widthSegments:r,heightSegments:s,depthSegments:a};const o=this;r=Math.floor(r),s=Math.floor(s),a=Math.floor(a);const l=[],c=[],h=[],u=[];let f=0,d=0;g("z","y","x",-1,-1,i,n,t,a,s,0),g("z","y","x",1,-1,i,n,-t,a,s,1),g("x","z","y",1,1,t,i,n,r,a,2),g("x","z","y",1,-1,t,i,-n,r,a,3),g("x","y","z",1,-1,t,n,i,r,s,4),g("x","y","z",-1,-1,t,n,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new Ye(c,3)),this.setAttribute("normal",new Ye(h,3)),this.setAttribute("uv",new Ye(u,2));function g(v,p,m,y,S,M,I,w,C,_,b){const N=M/C,A=I/_,O=M/2,H=I/2,k=w/2,L=C+1,B=_+1;let U=0,$=0;const j=new P;for(let J=0;J<B;J++){const re=J*A-H;for(let Q=0;Q<L;Q++)j[v]=(Q*N-O)*y,j[p]=re*S,j[m]=k,c.push(j.x,j.y,j.z),j[v]=0,j[p]=0,j[m]=w>0?1:-1,h.push(j.x,j.y,j.z),u.push(Q/C),u.push(1-J/_),U+=1}for(let J=0;J<_;J++)for(let re=0;re<C;re++){const Q=f+re+L*J,pe=f+re+L*(J+1),de=f+(re+1)+L*(J+1),F=f+(re+1)+L*J;l.push(Q,pe,F),l.push(pe,de,F),$+=6}o.addGroup(d,$,b),d+=$,f+=U}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Pc(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},wv=class Lc extends dt{constructor(t=1,n=1,i=4,r=8,s=1){super(),this.type="CapsuleGeometry",this.parameters={radius:t,height:n,capSegments:i,radialSegments:r,heightSegments:s},n=Math.max(0,n),i=Math.max(1,Math.floor(i)),r=Math.max(3,Math.floor(r)),s=Math.max(1,Math.floor(s));const a=[],o=[],l=[],c=[],h=n/2,u=Math.PI/2*t,f=n,d=2*u+f,g=i*2+s,v=r+1,p=new P,m=new P;for(let y=0;y<=g;y++){let S=0,M=0,I=0,w=0;if(y<=i){const b=y/i,N=b*Math.PI/2;M=-h-t*Math.cos(N),I=t*Math.sin(N),w=-t*Math.cos(N),S=b*u}else if(y<=i+s){const b=(y-i)/s;M=-h+b*n,I=t,w=0,S=u+b*f}else{const b=(y-i-s)/i,N=b*Math.PI/2;M=h+t*Math.sin(N),I=t*Math.cos(N),w=t*Math.sin(N),S=u+f+b*u}const C=Math.max(0,Math.min(1,S/d));let _=0;y===0?_=.5/r:y===g&&(_=-.5/r);for(let b=0;b<=r;b++){const N=b/r,A=N*Math.PI*2,O=Math.sin(A),H=Math.cos(A);m.x=-I*H,m.y=M,m.z=I*O,o.push(m.x,m.y,m.z),p.set(-I*H,w,I*O),p.normalize(),l.push(p.x,p.y,p.z),c.push(N+_,C)}if(y>0){const b=(y-1)*v;for(let N=0;N<r;N++){const A=b+N,O=b+N+1,H=y*v+N,k=y*v+N+1;a.push(A,O,H),a.push(O,k,H)}}}this.setIndex(a),this.setAttribute("position",new Ye(o,3)),this.setAttribute("normal",new Ye(l,3)),this.setAttribute("uv",new Ye(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Lc(t.radius,t.height,t.capSegments,t.radialSegments,t.heightSegments)}},Mf=class Dc extends dt{constructor(t=1,n=1,i=1,r=32,s=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:n,height:i,radialSegments:r,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};const c=this;r=Math.floor(r),s=Math.floor(s);const h=[],u=[],f=[],d=[];let g=0;const v=[],p=i/2;let m=0;y(),a===!1&&(t>0&&S(!0),n>0&&S(!1)),this.setIndex(h),this.setAttribute("position",new Ye(u,3)),this.setAttribute("normal",new Ye(f,3)),this.setAttribute("uv",new Ye(d,2));function y(){const M=new P,I=new P;let w=0;const C=(n-t)/i;for(let _=0;_<=s;_++){const b=[],N=_/s,A=N*(n-t)+t;for(let O=0;O<=r;O++){const H=O/r,k=H*l+o,L=Math.sin(k),B=Math.cos(k);I.x=A*L,I.y=-N*i+p,I.z=A*B,u.push(I.x,I.y,I.z),M.set(L,C,B).normalize(),f.push(M.x,M.y,M.z),d.push(H,1-N),b.push(g++)}v.push(b)}for(let _=0;_<r;_++)for(let b=0;b<s;b++){const N=v[b][_],A=v[b+1][_],O=v[b+1][_+1],H=v[b][_+1];(t>0||b!==0)&&(h.push(N,A,H),w+=3),(n>0||b!==s-1)&&(h.push(A,O,H),w+=3)}c.addGroup(m,w,0),m+=w}function S(M){const I=g,w=new oe,C=new P;let _=0;const b=M===!0?t:n,N=M===!0?1:-1;for(let O=1;O<=r;O++)u.push(0,p*N,0),f.push(0,N,0),d.push(.5,.5),g++;const A=g;for(let O=0;O<=r;O++){const H=O/r*l+o,k=Math.cos(H),L=Math.sin(H);C.x=b*L,C.y=p*N,C.z=b*k,u.push(C.x,C.y,C.z),f.push(0,N,0),w.x=k*.5+.5,w.y=L*.5*N+.5,d.push(w.x,w.y),g++}for(let O=0;O<r;O++){const H=I+O,k=A+O;M===!0?h.push(k,k+1,H):h.push(k+1,k,H),_+=3}c.addGroup(m,_,M===!0?1:2),m+=_}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Dc(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Sf=class Nc extends Mf{constructor(t=1,n=1,i=32,r=1,s=!1,a=0,o=Math.PI*2){super(0,t,n,i,r,s,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:n,radialSegments:i,heightSegments:r,openEnded:s,thetaStart:a,thetaLength:o}}static fromJSON(t){return new Nc(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},hs=new P,us=new P,xa=new P,fs=new ni,Rv=class extends dt{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){const n=Math.pow(10,4),i=Math.cos(Bi*t),r=e.getIndex(),s=e.getAttribute("position"),a=r?r.count:s.count,o=[0,0,0],l=["a","b","c"],c=new Array(3),h={},u=[];for(let f=0;f<a;f+=3){r?(o[0]=r.getX(f),o[1]=r.getX(f+1),o[2]=r.getX(f+2)):(o[0]=f,o[1]=f+1,o[2]=f+2);const{a:d,b:g,c:v}=fs;if(d.fromBufferAttribute(s,o[0]),g.fromBufferAttribute(s,o[1]),v.fromBufferAttribute(s,o[2]),fs.getNormal(xa),c[0]=`${Math.round(d.x*n)},${Math.round(d.y*n)},${Math.round(d.z*n)}`,c[1]=`${Math.round(g.x*n)},${Math.round(g.y*n)},${Math.round(g.z*n)}`,c[2]=`${Math.round(v.x*n)},${Math.round(v.y*n)},${Math.round(v.z*n)}`,!(c[0]===c[1]||c[1]===c[2]||c[2]===c[0]))for(let p=0;p<3;p++){const m=(p+1)%3,y=c[p],S=c[m],M=fs[l[p]],I=fs[l[m]],w=`${y}_${S}`,C=`${S}_${y}`;C in h&&h[C]?(xa.dot(h[C].normal)<=i&&(u.push(M.x,M.y,M.z),u.push(I.x,I.y,I.z)),h[C]=null):w in h||(h[w]={index0:o[p],index1:o[m],normal:xa.clone()})}}for(const f in h)if(h[f]){const{index0:d,index1:g}=h[f];hs.fromBufferAttribute(s,d),us.fromBufferAttribute(s,g),u.push(hs.x,hs.y,hs.z),u.push(us.x,us.y,us.z)}this.setAttribute("position",new Ye(u,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}},ln=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Le("Curve: .getPoint() not implemented.")}getPointAt(e,t){const n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){const e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let n,i=this.getPoint(0),r=0;t.push(0);for(let s=1;s<=e;s++)n=this.getPoint(s/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){const n=this.getLengths();let i=0;const r=n.length;let s;t?s=t:s=e*n[r-1];let a=0,o=r-1,l;for(;a<=o;)if(i=Math.floor(a+(o-a)/2),l=n[i]-s,l<0)a=i+1;else if(l>0)o=i-1;else{o=i;break}if(i=o,n[i]===s)return i/(r-1);const c=n[i],h=n[i+1]-c,u=(s-c)/h;return(i+u)/(r-1)}getTangent(e,t){let i=e-1e-4,r=e+1e-4;i<0&&(i=0),r>1&&(r=1);const s=this.getPoint(i),a=this.getPoint(r),o=t||(s.isVector2?new oe:new P);return o.copy(a).sub(s).normalize(),o}getTangentAt(e,t){const n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){const n=new P,i=[],r=[],s=[],a=new P,o=new Ie;for(let f=0;f<=e;f++){const d=f/e;i[f]=this.getTangentAt(d,new P)}r[0]=new P,s[0]=new P;let l=Number.MAX_VALUE;const c=Math.abs(i[0].x),h=Math.abs(i[0].y),u=Math.abs(i[0].z);c<=l&&(l=c,n.set(1,0,0)),h<=l&&(l=h,n.set(0,1,0)),u<=l&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],a),s[0].crossVectors(i[0],r[0]);for(let f=1;f<=e;f++){if(r[f]=r[f-1].clone(),s[f]=s[f-1].clone(),a.crossVectors(i[f-1],i[f]),a.length()>Number.EPSILON){a.normalize();const d=Math.acos(et(i[f-1].dot(i[f]),-1,1));r[f].applyMatrix4(o.makeRotationAxis(a,d))}s[f].crossVectors(i[f],r[f])}if(t===!0){let f=Math.acos(et(r[0].dot(r[e]),-1,1));f/=e,i[0].dot(a.crossVectors(r[0],r[e]))>0&&(f=-f);for(let d=1;d<=e;d++)r[d].applyMatrix4(o.makeRotationAxis(i[d],f*d)),s[d].crossVectors(i[d],r[d])}return{tangents:i,normals:r,binormals:s}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){const e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},lo=class extends ln{constructor(e=0,t=0,n=1,i=1,r=0,s=Math.PI*2,a=!1,o=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=s,this.aClockwise=a,this.aRotation=o}getPoint(e,t=new oe){const n=t,i=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const s=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(s?r=0:r=i),this.aClockwise===!0&&!s&&(r===i?r=-i:r=r-i);const a=this.aStartAngle+e*r;let o=this.aX+this.xRadius*Math.cos(a),l=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const c=Math.cos(this.aRotation),h=Math.sin(this.aRotation),u=o-this.aX,f=l-this.aY;o=u*c-f*h+this.aX,l=u*h+f*c+this.aY}return n.set(o,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},Tf=class extends lo{constructor(e,t,n,i,r,s){super(e,t,n,n,i,r,s),this.isArcCurve=!0,this.type="ArcCurve"}};function co(){let e=0,t=0,n=0,i=0;function r(s,a,o,l){e=s,t=o,n=-3*s+3*a-2*o-l,i=2*s-2*a+o+l}return{initCatmullRom:function(s,a,o,l,c){r(a,o,c*(o-s),c*(l-a))},initNonuniformCatmullRom:function(s,a,o,l,c,h,u){let f=(a-s)/c-(o-s)/(c+h)+(o-a)/h,d=(o-a)/h-(l-a)/(h+u)+(l-o)/u;f*=h,d*=h,r(a,o,f,d)},calc:function(s){const a=s*s,o=a*s;return e+t*s+n*a+i*o}}}var ds=new P,Ma=new co,Sa=new co,Ta=new co,Ef=class extends ln{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new P){const n=t,i=this.points,r=i.length,s=(r-(this.closed?0:1))*e;let a=Math.floor(s),o=s-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:o===0&&a===r-1&&(a=r-2,o=1);let l,c;this.closed||a>0?l=i[(a-1)%r]:(ds.subVectors(i[0],i[1]).add(i[0]),l=ds);const h=i[a%r],u=i[(a+1)%r];if(this.closed||a+2<r?c=i[(a+2)%r]:(ds.subVectors(i[r-1],i[r-2]).add(i[r-1]),c=ds),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let d=Math.pow(l.distanceToSquared(h),f),g=Math.pow(h.distanceToSquared(u),f),v=Math.pow(u.distanceToSquared(c),f);g<1e-4&&(g=1),d<1e-4&&(d=g),v<1e-4&&(v=g),Ma.initNonuniformCatmullRom(l.x,h.x,u.x,c.x,d,g,v),Sa.initNonuniformCatmullRom(l.y,h.y,u.y,c.y,d,g,v),Ta.initNonuniformCatmullRom(l.z,h.z,u.z,c.z,d,g,v)}else this.curveType==="catmullrom"&&(Ma.initCatmullRom(l.x,h.x,u.x,c.x,this.tension),Sa.initCatmullRom(l.y,h.y,u.y,c.y,this.tension),Ta.initCatmullRom(l.z,h.z,u.z,c.z,this.tension));return n.set(Ma.calc(o),Sa.calc(o),Ta.calc(o)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(new P().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function nl(e,t,n,i,r){const s=(i-t)*.5,a=(r-n)*.5,o=e*e,l=e*o;return(2*n-2*i+s+a)*l+(-3*n+3*i-2*s-a)*o+s*e+n}function bf(e,t){const n=1-e;return n*n*t}function Af(e,t){return 2*(1-e)*e*t}function wf(e,t){return e*e*t}function xr(e,t,n,i){return bf(e,t)+Af(e,n)+wf(e,i)}function Rf(e,t){const n=1-e;return n*n*n*t}function Cf(e,t){const n=1-e;return 3*n*n*e*t}function If(e,t){return 3*(1-e)*e*e*t}function Pf(e,t){return e*e*e*t}function Mr(e,t,n,i,r){return Rf(e,t)+Cf(e,n)+If(e,i)+Pf(e,r)}var Uc=class extends ln{constructor(e=new oe,t=new oe,n=new oe,i=new oe){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new oe){const n=t,i=this.v0,r=this.v1,s=this.v2,a=this.v3;return n.set(Mr(e,i.x,r.x,s.x,a.x),Mr(e,i.y,r.y,s.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Lf=class extends ln{constructor(e=new P,t=new P,n=new P,i=new P){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new P){const n=t,i=this.v0,r=this.v1,s=this.v2,a=this.v3;return n.set(Mr(e,i.x,r.x,s.x,a.x),Mr(e,i.y,r.y,s.y,a.y),Mr(e,i.z,r.z,s.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Oc=class extends ln{constructor(e=new oe,t=new oe){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new oe){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new oe){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Df=class extends ln{constructor(e=new P,t=new P){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new P){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new P){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Fc=class extends ln{constructor(e=new oe,t=new oe,n=new oe){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new oe){const n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(xr(e,i.x,r.x,s.x),xr(e,i.y,r.y,s.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Nf=class extends ln{constructor(e=new P,t=new P,n=new P){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new P){const n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(xr(e,i.x,r.x,s.x),xr(e,i.y,r.y,s.y),xr(e,i.z,r.z,s.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Bc=class extends ln{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new oe){const n=t,i=this.points,r=(i.length-1)*e,s=Math.floor(r),a=r-s,o=i[s===0?s:s-1],l=i[s],c=i[s>i.length-2?i.length-1:s+1],h=i[s>i.length-3?i.length-1:s+2];return n.set(nl(a,o.x,l.x,c.x,h.x),nl(a,o.y,l.y,c.y,h.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(i.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const i=e.points[t];this.points.push(new oe().fromArray(i))}return this}},Xa=Object.freeze({__proto__:null,ArcCurve:Tf,CatmullRomCurve3:Ef,CubicBezierCurve:Uc,CubicBezierCurve3:Lf,EllipseCurve:lo,LineCurve:Oc,LineCurve3:Df,QuadraticBezierCurve:Fc,QuadraticBezierCurve3:Nf,SplineCurve:Bc}),Uf=class extends ln{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){const n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Xa[n](t,e))}return this}getPoint(e,t){const n=e*this.getLength(),i=this.getCurveLengths();let r=0;for(;r<i.length;){if(i[r]>=n){const s=i[r]-n,a=this.curves[r],o=a.getLength(),l=o===0?0:1-s/o;return a.getPointAt(l,t)}r++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let n=0,i=this.curves.length;n<i;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let n;for(let i=0,r=this.curves;i<r.length;i++){const s=r[i],a=s.isEllipseCurve?e*2:s.isLineCurve||s.isLineCurve3?1:s.isSplineCurve?e*s.points.length:e,o=s.getPoints(a);for(let l=0;l<o.length;l++){const c=o[l];n&&n.equals(c)||(t.push(c),n=c)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const i=e.curves[t];this.curves.push(i.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){const i=this.curves[t];e.curves.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const i=e.curves[t];this.curves.push(new Xa[i.type]().fromJSON(i))}return this}},il=class extends Uf{constructor(e){super(),this.type="Path",this.currentPoint=new oe,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const n=new Oc(this.currentPoint.clone(),new oe(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,i){const r=new Fc(this.currentPoint.clone(),new oe(e,t),new oe(n,i));return this.curves.push(r),this.currentPoint.set(n,i),this}bezierCurveTo(e,t,n,i,r,s){const a=new Uc(this.currentPoint.clone(),new oe(e,t),new oe(n,i),new oe(r,s));return this.curves.push(a),this.currentPoint.set(r,s),this}splineThru(e){const t=new Bc([this.currentPoint.clone()].concat(e));return this.curves.push(t),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,i,r,s){const a=this.currentPoint.x,o=this.currentPoint.y;return this.absarc(e+a,t+o,n,i,r,s),this}absarc(e,t,n,i,r,s){return this.absellipse(e,t,n,n,i,r,s),this}ellipse(e,t,n,i,r,s,a,o){const l=this.currentPoint.x,c=this.currentPoint.y;return this.absellipse(e+l,t+c,n,i,r,s,a,o),this}absellipse(e,t,n,i,r,s,a,o){const l=new lo(e,t,n,i,r,s,a,o);if(this.curves.length>0){const h=l.getPoint(0);h.equals(this.currentPoint)||this.lineTo(h.x,h.y)}this.curves.push(l);const c=l.getPoint(1);return this.currentPoint.copy(c),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},kc=class extends il{constructor(e){super(e),this.uuid=Zt(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let n=0,i=this.holes.length;n<i;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const i=e.holes[t];this.holes.push(i.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){const i=this.holes[t];e.holes.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const i=e.holes[t];this.holes.push(new il().fromJSON(i))}return this}};function Of(e,t,n=2){const i=t&&t.length,r=i?t[0]*n:e.length;let s=zc(e,0,r,n,!0);const a=[];if(!s||s.next===s.prev)return a;let o,l,c;if(i&&(s=Vf(e,t,s,n)),e.length>80*n){o=e[0],l=e[1];let h=o,u=l;for(let f=n;f<r;f+=n){const d=e[f],g=e[f+1];d<o&&(o=d),g<l&&(l=g),d>h&&(h=d),g>u&&(u=g)}c=Math.max(h-o,u-l),c=c!==0?32767/c:0}return Rr(s,a,n,o,l,c,0),a}function zc(e,t,n,i,r){let s;if(r===$f(e,t,n,i)>0)for(let a=t;a<n;a+=i)s=rl(a/i|0,e[a],e[a+1],s);else for(let a=n-i;a>=t;a-=i)s=rl(a/i|0,e[a],e[a+1],s);return s&&Yi(s,s.next)&&(Ir(s),s=s.next),s}function ai(e,t){if(!e)return e;t||(t=e);let n=e,i;do if(i=!1,!n.steiner&&(Yi(n,n.next)||mt(n.prev,n,n.next)===0)){if(Ir(n),n=t=n.prev,n===n.next)break;i=!0}else n=n.next;while(i||n!==t);return t}function Rr(e,t,n,i,r,s,a){if(!e)return;!a&&s&&qf(e,i,r,s);let o=e;for(;e.prev!==e.next;){const l=e.prev,c=e.next;if(s?Bf(e,i,r,s):Ff(e)){t.push(l.i,e.i,c.i),Ir(e),e=c.next,o=c.next;continue}if(e=c,e===o){a?a===1?(e=kf(ai(e),t),Rr(e,t,n,i,r,s,2)):a===2&&zf(e,t,n,i,r,s):Rr(ai(e),t,n,i,r,s,1);break}}}function Ff(e){const t=e.prev,n=e,i=e.next;if(mt(t,n,i)>=0)return!1;const r=t.x,s=n.x,a=i.x,o=t.y,l=n.y,c=i.y,h=Math.min(r,s,a),u=Math.min(o,l,c),f=Math.max(r,s,a),d=Math.max(o,l,c);let g=i.next;for(;g!==t;){if(g.x>=h&&g.x<=f&&g.y>=u&&g.y<=d&&gr(r,o,s,l,a,c,g.x,g.y)&&mt(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Bf(e,t,n,i){const r=e.prev,s=e,a=e.next;if(mt(r,s,a)>=0)return!1;const o=r.x,l=s.x,c=a.x,h=r.y,u=s.y,f=a.y,d=Math.min(o,l,c),g=Math.min(h,u,f),v=Math.max(o,l,c),p=Math.max(h,u,f),m=qa(d,g,t,n,i),y=qa(v,p,t,n,i);let S=e.prevZ,M=e.nextZ;for(;S&&S.z>=m&&M&&M.z<=y;){if(S.x>=d&&S.x<=v&&S.y>=g&&S.y<=p&&S!==r&&S!==a&&gr(o,h,l,u,c,f,S.x,S.y)&&mt(S.prev,S,S.next)>=0||(S=S.prevZ,M.x>=d&&M.x<=v&&M.y>=g&&M.y<=p&&M!==r&&M!==a&&gr(o,h,l,u,c,f,M.x,M.y)&&mt(M.prev,M,M.next)>=0))return!1;M=M.nextZ}for(;S&&S.z>=m;){if(S.x>=d&&S.x<=v&&S.y>=g&&S.y<=p&&S!==r&&S!==a&&gr(o,h,l,u,c,f,S.x,S.y)&&mt(S.prev,S,S.next)>=0)return!1;S=S.prevZ}for(;M&&M.z<=y;){if(M.x>=d&&M.x<=v&&M.y>=g&&M.y<=p&&M!==r&&M!==a&&gr(o,h,l,u,c,f,M.x,M.y)&&mt(M.prev,M,M.next)>=0)return!1;M=M.nextZ}return!0}function kf(e,t){let n=e;do{const i=n.prev,r=n.next.next;!Yi(i,r)&&Gc(i,n,n.next,r)&&Cr(i,r)&&Cr(r,i)&&(t.push(i.i,n.i,r.i),Ir(n),Ir(n.next),n=e=r),n=n.next}while(n!==e);return ai(n)}function zf(e,t,n,i,r,s){let a=e;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&Kf(a,o)){let l=Hc(a,o);a=ai(a,a.next),l=ai(l,l.next),Rr(a,t,n,i,r,s,0),Rr(l,t,n,i,r,s,0);return}o=o.next}a=a.next}while(a!==e)}function Vf(e,t,n,i){const r=[];for(let s=0,a=t.length;s<a;s++){const o=zc(e,t[s]*i,s<a-1?t[s+1]*i:e.length,i,!1);o===o.next&&(o.steiner=!0),r.push(jf(o))}r.sort(Gf);for(let s=0;s<r.length;s++)n=Hf(r[s],n);return n}function Gf(e,t){let n=e.x-t.x;return n===0&&(n=e.y-t.y,n===0&&(n=(e.next.y-e.y)/(e.next.x-e.x)-(t.next.y-t.y)/(t.next.x-t.x))),n}function Hf(e,t){const n=Wf(e,t);if(!n)return t;const i=Hc(n,e);return ai(i,i.next),ai(n,n.next)}function Wf(e,t){let n=t;const i=e.x,r=e.y;let s=-1/0,a;if(Yi(e,n))return n;do{if(Yi(e,n.next))return n.next;if(r<=n.y&&r>=n.next.y&&n.next.y!==n.y){const u=n.x+(r-n.y)*(n.next.x-n.x)/(n.next.y-n.y);if(u<=i&&u>s&&(s=u,a=n.x<n.next.x?n:n.next,u===i))return a}n=n.next}while(n!==t);if(!a)return null;const o=a,l=a.x,c=a.y;let h=1/0;n=a;do{if(i>=n.x&&n.x>=l&&i!==n.x&&Vc(r<c?i:s,r,l,c,r<c?s:i,r,n.x,n.y)){const u=Math.abs(r-n.y)/(i-n.x);Cr(n,e)&&(u<h||u===h&&(n.x>a.x||n.x===a.x&&Xf(a,n)))&&(a=n,h=u)}n=n.next}while(n!==o);return a}function Xf(e,t){return mt(e.prev,e,t.prev)<0&&mt(t.next,e,e.next)<0}function qf(e,t,n,i){let r=e;do r.z===0&&(r.z=qa(r.x,r.y,t,n,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==e);r.prevZ.nextZ=null,r.prevZ=null,Yf(r)}function Yf(e){let t,n=1;do{let i=e,r;e=null;let s=null;for(t=0;i;){t++;let a=i,o=0;for(let c=0;c<n&&(o++,a=a.nextZ,!!a);c++);let l=n;for(;o>0||l>0&&a;)o!==0&&(l===0||!a||i.z<=a.z)?(r=i,i=i.nextZ,o--):(r=a,a=a.nextZ,l--),s?s.nextZ=r:e=r,r.prevZ=s,s=r;i=a}s.nextZ=null,n*=2}while(t>1);return e}function qa(e,t,n,i,r){return e=(e-n)*r|0,t=(t-i)*r|0,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,e|t<<1}function jf(e){let t=e,n=e;do(t.x<n.x||t.x===n.x&&t.y<n.y)&&(n=t),t=t.next;while(t!==e);return n}function Vc(e,t,n,i,r,s,a,o){return(r-a)*(t-o)>=(e-a)*(s-o)&&(e-a)*(i-o)>=(n-a)*(t-o)&&(n-a)*(s-o)>=(r-a)*(i-o)}function gr(e,t,n,i,r,s,a,o){return!(e===a&&t===o)&&Vc(e,t,n,i,r,s,a,o)}function Kf(e,t){return e.next.i!==t.i&&e.prev.i!==t.i&&!Jf(e,t)&&(Cr(e,t)&&Cr(t,e)&&Zf(e,t)&&(mt(e.prev,e,t.prev)||mt(e,t.prev,t))||Yi(e,t)&&mt(e.prev,e,e.next)>0&&mt(t.prev,t,t.next)>0)}function mt(e,t,n){return(t.y-e.y)*(n.x-t.x)-(t.x-e.x)*(n.y-t.y)}function Yi(e,t){return e.x===t.x&&e.y===t.y}function Gc(e,t,n,i){const r=ms(mt(e,t,n)),s=ms(mt(e,t,i)),a=ms(mt(n,i,e)),o=ms(mt(n,i,t));return!!(r!==s&&a!==o||r===0&&ps(e,n,t)||s===0&&ps(e,i,t)||a===0&&ps(n,e,i)||o===0&&ps(n,t,i))}function ps(e,t,n){return t.x<=Math.max(e.x,n.x)&&t.x>=Math.min(e.x,n.x)&&t.y<=Math.max(e.y,n.y)&&t.y>=Math.min(e.y,n.y)}function ms(e){return e>0?1:e<0?-1:0}function Jf(e,t){let n=e;do{if(n.i!==e.i&&n.next.i!==e.i&&n.i!==t.i&&n.next.i!==t.i&&Gc(n,n.next,e,t))return!0;n=n.next}while(n!==e);return!1}function Cr(e,t){return mt(e.prev,e,e.next)<0?mt(e,t,e.next)>=0&&mt(e,e.prev,t)>=0:mt(e,t,e.prev)<0||mt(e,e.next,t)<0}function Zf(e,t){let n=e,i=!1;const r=(e.x+t.x)/2,s=(e.y+t.y)/2;do n.y>s!=n.next.y>s&&n.next.y!==n.y&&r<(n.next.x-n.x)*(s-n.y)/(n.next.y-n.y)+n.x&&(i=!i),n=n.next;while(n!==e);return i}function Hc(e,t){const n=Ya(e.i,e.x,e.y),i=Ya(t.i,t.x,t.y),r=e.next,s=t.prev;return e.next=t,t.prev=e,n.next=r,r.prev=n,i.next=n,n.prev=i,s.next=i,i.prev=s,i}function rl(e,t,n,i){const r=Ya(e,t,n);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function Ir(e){e.next.prev=e.prev,e.prev.next=e.next,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ)}function Ya(e,t,n){return{i:e,x:t,y:n,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function $f(e,t,n,i){let r=0;for(let s=t,a=n-i;s<n;s+=i)r+=(e[a]-e[s])*(e[s+1]+e[a+1]),a=s;return r}var Qf=class{static triangulate(e,t,n=2){return Of(e,t,n)}},Vn=class Wc{static area(t){const n=t.length;let i=0;for(let r=n-1,s=0;s<n;r=s++)i+=t[r].x*t[s].y-t[s].x*t[r].y;return i*.5}static isClockWise(t){return Wc.area(t)<0}static triangulateShape(t,n){const i=[],r=[],s=[];sl(t),al(i,t);let a=t.length;n.forEach(sl);for(let l=0;l<n.length;l++)r.push(a),a+=n[l].length,al(i,n[l]);const o=Qf.triangulate(i,r);for(let l=0;l<o.length;l+=3)s.push(o.slice(l,l+3));return s}};function sl(e){const t=e.length;t>2&&e[t-1].equals(e[0])&&e.pop()}function al(e,t){for(let n=0;n<t.length;n++)e.push(t[n].x),e.push(t[n].y)}var Cv=class Xc extends dt{constructor(t=new kc([new oe(.5,.5),new oe(-.5,.5),new oe(-.5,-.5),new oe(.5,-.5)]),n={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:n},t=Array.isArray(t)?t:[t];const i=this,r=[],s=[];for(let o=0,l=t.length;o<l;o++){const c=t[o];a(c)}this.setAttribute("position",new Ye(r,3)),this.setAttribute("uv",new Ye(s,2)),this.computeVertexNormals();function a(o){const l=[],c=n.curveSegments!==void 0?n.curveSegments:12,h=n.steps!==void 0?n.steps:1,u=n.depth!==void 0?n.depth:1;let f=n.bevelEnabled!==void 0?n.bevelEnabled:!0,d=n.bevelThickness!==void 0?n.bevelThickness:.2,g=n.bevelSize!==void 0?n.bevelSize:d-.1,v=n.bevelOffset!==void 0?n.bevelOffset:0,p=n.bevelSegments!==void 0?n.bevelSegments:3;const m=n.extrudePath,y=n.UVGenerator!==void 0?n.UVGenerator:ed;let S,M=!1,I,w,C,_;if(m){S=m.getSpacedPoints(h),M=!0,f=!1;const Z=m.isCatmullRomCurve3?m.closed:!1;I=m.computeFrenetFrames(h,Z),w=new P,C=new P,_=new P}f||(p=0,d=0,g=0,v=0);const b=o.extractPoints(c);let N=b.shape;const A=b.holes;if(!Vn.isClockWise(N)){N=N.reverse();for(let Z=0,le=A.length;Z<le;Z++){const ce=A[Z];Vn.isClockWise(ce)&&(A[Z]=ce.reverse())}}function O(Z){const ce=10000000000000001e-36;let Me=Z[0];for(let R=1;R<=Z.length;R++){const ze=R%Z.length,ve=Z[ze],Ve=ve.x-Me.x,me=ve.y-Me.y,Xe=Ve*Ve+me*me,E=Math.max(Math.abs(ve.x),Math.abs(ve.y),Math.abs(Me.x),Math.abs(Me.y));if(Xe<=ce*E*E){Z.splice(ze,1),R--;continue}Me=ve}}O(N),A.forEach(O);const H=A.length,k=N;for(let Z=0;Z<H;Z++){const le=A[Z];N=N.concat(le)}function L(Z,le,ce){return le||ke("ExtrudeGeometry: vec does not exist"),Z.clone().addScaledVector(le,ce)}const B=N.length;function U(Z,le,ce){let Me,R,ze;const ve=Z.x-le.x,Ve=Z.y-le.y,me=ce.x-Z.x,Xe=ce.y-Z.y,E=ve*ve+Ve*Ve,x=ve*Xe-Ve*me;if(Math.abs(x)>Number.EPSILON){const V=Math.sqrt(E),K=Math.sqrt(me*me+Xe*Xe),ne=le.x-Ve/V,Y=le.y+ve/V,Te=ce.x-Xe/K,_e=ce.y+me/K,De=((Te-ne)*Xe-(_e-Y)*me)/(ve*Xe-Ve*me);Me=ne+ve*De-Z.x,R=Y+Ve*De-Z.y;const Fe=Me*Me+R*R;if(Fe<=2)return new oe(Me,R);ze=Math.sqrt(Fe/2)}else{let V=!1;ve>Number.EPSILON?me>Number.EPSILON&&(V=!0):ve<-Number.EPSILON?me<-Number.EPSILON&&(V=!0):Math.sign(Ve)===Math.sign(Xe)&&(V=!0),V?(Me=-Ve,R=ve,ze=Math.sqrt(E)):(Me=ve,R=Ve,ze=Math.sqrt(E/2))}return new oe(Me/ze,R/ze)}const $=[];for(let Z=0,le=k.length,ce=le-1,Me=Z+1;Z<le;Z++,ce++,Me++)ce===le&&(ce=0),Me===le&&(Me=0),$[Z]=U(k[Z],k[ce],k[Me]);const j=[];let J,re=$.concat();for(let Z=0,le=H;Z<le;Z++){const ce=A[Z];J=[];for(let Me=0,R=ce.length,ze=R-1,ve=Me+1;Me<R;Me++,ze++,ve++)ze===R&&(ze=0),ve===R&&(ve=0),J[Me]=U(ce[Me],ce[ze],ce[ve]);j.push(J),re=re.concat(J)}let Q;if(p===0)Q=Vn.triangulateShape(k,A);else{const Z=[],le=[];for(let ce=0;ce<p;ce++){const Me=ce/p,R=d*Math.cos(Me*Math.PI/2),ze=g*Math.sin(Me*Math.PI/2)+v;for(let ve=0,Ve=k.length;ve<Ve;ve++){const me=L(k[ve],$[ve],ze);ae(me.x,me.y,-R),Me===0&&Z.push(me)}for(let ve=0,Ve=H;ve<Ve;ve++){const me=A[ve];J=j[ve];const Xe=[];for(let E=0,x=me.length;E<x;E++){const V=L(me[E],J[E],ze);ae(V.x,V.y,-R),Me===0&&Xe.push(V)}Me===0&&le.push(Xe)}}Q=Vn.triangulateShape(Z,le)}const pe=Q.length,de=g+v;for(let Z=0;Z<B;Z++){const le=f?L(N[Z],re[Z],de):N[Z];M?(C.copy(I.normals[0]).multiplyScalar(le.x),w.copy(I.binormals[0]).multiplyScalar(le.y),_.copy(S[0]).add(C).add(w),ae(_.x,_.y,_.z)):ae(le.x,le.y,0)}for(let Z=1;Z<=h;Z++)for(let le=0;le<B;le++){const ce=f?L(N[le],re[le],de):N[le];M?(C.copy(I.normals[Z]).multiplyScalar(ce.x),w.copy(I.binormals[Z]).multiplyScalar(ce.y),_.copy(S[Z]).add(C).add(w),ae(_.x,_.y,_.z)):ae(ce.x,ce.y,u/h*Z)}for(let Z=p-1;Z>=0;Z--){const le=Z/p,ce=d*Math.cos(le*Math.PI/2),Me=g*Math.sin(le*Math.PI/2)+v;for(let R=0,ze=k.length;R<ze;R++){const ve=L(k[R],$[R],Me);ae(ve.x,ve.y,u+ce)}for(let R=0,ze=A.length;R<ze;R++){const ve=A[R];J=j[R];for(let Ve=0,me=ve.length;Ve<me;Ve++){const Xe=L(ve[Ve],J[Ve],Me);M?ae(Xe.x,Xe.y+S[h-1].y,S[h-1].x+ce):ae(Xe.x,Xe.y,u+ce)}}}F(),q();function F(){const Z=r.length/3;if(f){let le=0,ce=B*le;for(let Me=0;Me<pe;Me++){const R=Q[Me];Re(R[2]+ce,R[1]+ce,R[0]+ce)}le=h+p*2,ce=B*le;for(let Me=0;Me<pe;Me++){const R=Q[Me];Re(R[0]+ce,R[1]+ce,R[2]+ce)}}else{for(let le=0;le<pe;le++){const ce=Q[le];Re(ce[2],ce[1],ce[0])}for(let le=0;le<pe;le++){const ce=Q[le];Re(ce[0]+B*h,ce[1]+B*h,ce[2]+B*h)}}i.addGroup(Z,r.length/3-Z,0)}function q(){const Z=r.length/3;let le=0;se(k,le),le+=k.length;for(let ce=0,Me=A.length;ce<Me;ce++){const R=A[ce];se(R,le),le+=R.length}i.addGroup(Z,r.length/3-Z,1)}function se(Z,le){let ce=Z.length;for(;--ce>=0;){const Me=ce;let R=ce-1;R<0&&(R=Z.length-1);for(let ze=0,ve=h+p*2;ze<ve;ze++){const Ve=B*ze,me=B*(ze+1);Oe(le+Me+Ve,le+R+Ve,le+R+me,le+Me+me)}}}function ae(Z,le,ce){l.push(Z),l.push(le),l.push(ce)}function Re(Z,le,ce){Ne(Z),Ne(le),Ne(ce);const Me=r.length/3,R=y.generateTopUV(i,r,Me-3,Me-2,Me-1);Je(R[0]),Je(R[1]),Je(R[2])}function Oe(Z,le,ce,Me){Ne(Z),Ne(le),Ne(Me),Ne(le),Ne(ce),Ne(Me);const R=r.length/3,ze=y.generateSideWallUV(i,r,R-6,R-3,R-2,R-1);Je(ze[0]),Je(ze[1]),Je(ze[3]),Je(ze[1]),Je(ze[2]),Je(ze[3])}function Ne(Z){r.push(l[Z*3+0]),r.push(l[Z*3+1]),r.push(l[Z*3+2])}function Je(Z){s.push(Z.x),s.push(Z.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),n=this.parameters.shapes,i=this.parameters.options;return td(n,i,t)}static fromJSON(t,n){const i=[];for(let s=0,a=t.shapes.length;s<a;s++){const o=n[t.shapes[s]];i.push(o)}const r=t.options.extrudePath;return r!==void 0&&(t.options.extrudePath=new Xa[r.type]().fromJSON(r)),new Xc(i,t.options)}},ed={generateTopUV:function(e,t,n,i,r){const s=t[n*3],a=t[n*3+1],o=t[i*3],l=t[i*3+1],c=t[r*3],h=t[r*3+1];return[new oe(s,a),new oe(o,l),new oe(c,h)]},generateSideWallUV:function(e,t,n,i,r,s){const a=t[n*3],o=t[n*3+1],l=t[n*3+2],c=t[i*3],h=t[i*3+1],u=t[i*3+2],f=t[r*3],d=t[r*3+1],g=t[r*3+2],v=t[s*3],p=t[s*3+1],m=t[s*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new oe(a,1-l),new oe(c,1-u),new oe(f,1-g),new oe(v,1-m)]:[new oe(o,1-l),new oe(h,1-u),new oe(d,1-g),new oe(p,1-m)]}};function td(e,t,n){if(n.shapes=[],Array.isArray(e))for(let i=0,r=e.length;i<r;i++){const s=e[i];n.shapes.push(s.uuid)}else n.shapes.push(e.uuid);return n.options=Object.assign({},t),t.extrudePath!==void 0&&(n.options.extrudePath=t.extrudePath.toJSON()),n}var qc=class Yc extends dt{constructor(t=1,n=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:n,widthSegments:i,heightSegments:r};const s=t/2,a=n/2,o=Math.floor(i),l=Math.floor(r),c=o+1,h=l+1,u=t/o,f=n/l,d=[],g=[],v=[],p=[];for(let m=0;m<h;m++){const y=m*f-a;for(let S=0;S<c;S++){const M=S*u-s;g.push(M,-y,0),v.push(0,0,1),p.push(S/o),p.push(1-m/l)}}for(let m=0;m<l;m++)for(let y=0;y<o;y++){const S=y+c*m,M=y+c*(m+1),I=y+1+c*(m+1),w=y+1+c*m;d.push(S,M,w),d.push(M,I,w)}this.setIndex(d),this.setAttribute("position",new Ye(g,3)),this.setAttribute("normal",new Ye(v,3)),this.setAttribute("uv",new Ye(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Yc(t.width,t.height,t.widthSegments,t.heightSegments)}},Iv=class jc extends dt{constructor(t=new kc([new oe(0,.5),new oe(-.5,-.5),new oe(.5,-.5)]),n=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:n};const i=[],r=[],s=[],a=[];let o=0,l=0;if(Array.isArray(t)===!1)c(t);else for(let h=0;h<t.length;h++)c(t[h]),this.addGroup(o,l,h),o+=l,l=0;this.setIndex(i),this.setAttribute("position",new Ye(r,3)),this.setAttribute("normal",new Ye(s,3)),this.setAttribute("uv",new Ye(a,2));function c(h){const u=r.length/3,f=h.extractPoints(n);let d=f.shape;const g=f.holes;Vn.isClockWise(d)===!1&&(d=d.reverse());for(let p=0,m=g.length;p<m;p++){const y=g[p];Vn.isClockWise(y)===!0&&(g[p]=y.reverse())}const v=Vn.triangulateShape(d,g);for(let p=0,m=g.length;p<m;p++){const y=g[p];d=d.concat(y)}for(let p=0,m=d.length;p<m;p++){const y=d[p];r.push(y.x,y.y,0),s.push(0,0,1),a.push(y.x,y.y)}for(let p=0,m=v.length;p<m;p++){const y=v[p],S=y[0]+u,M=y[1]+u,I=y[2]+u;i.push(S,M,I),l+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),n=this.parameters.shapes;return nd(n,t)}static fromJSON(t,n){const i=[];for(let r=0,s=t.shapes.length;r<s;r++){const a=n[t.shapes[r]];i.push(a)}return new jc(i,t.curveSegments)}};function nd(e,t){if(t.shapes=[],Array.isArray(e))for(let n=0,i=e.length;n<i;n++){const r=e[n];t.shapes.push(r.uuid)}else t.shapes.push(e.uuid);return t}var Pv=class Kc extends dt{constructor(t=1,n=32,i=16,r=0,s=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:n,heightSegments:i,phiStart:r,phiLength:s,thetaStart:a,thetaLength:o},n=Math.max(3,Math.floor(n)),i=Math.max(2,Math.floor(i));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new P,f=new P,d=[],g=[],v=[],p=[];for(let m=0;m<=i;m++){const y=[],S=m/i;let M=0;m===0&&a===0?M=.5/n:m===i&&l===Math.PI&&(M=-.5/n);for(let I=0;I<=n;I++){const w=I/n;u.x=-t*Math.cos(r+w*s)*Math.sin(a+S*o),u.y=t*Math.cos(a+S*o),u.z=t*Math.sin(r+w*s)*Math.sin(a+S*o),g.push(u.x,u.y,u.z),f.copy(u).normalize(),v.push(f.x,f.y,f.z),p.push(w+M,1-S),y.push(c++)}h.push(y)}for(let m=0;m<i;m++)for(let y=0;y<n;y++){const S=h[m][y+1],M=h[m][y],I=h[m+1][y],w=h[m+1][y+1];(m!==0||a>0)&&d.push(S,M,w),(m!==i-1||l<Math.PI)&&d.push(M,I,w)}this.setIndex(d),this.setAttribute("position",new Ye(g,3)),this.setAttribute("normal",new Ye(v,3)),this.setAttribute("uv",new Ye(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Kc(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function ji(e){const t={};for(const n in e){t[n]={};for(const i in e[n]){const r=e[n][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(Le("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null):t[n][i]=r.clone():Array.isArray(r)?t[n][i]=r.slice():t[n][i]=r}}return t}function kt(e){const t={};for(let n=0;n<e.length;n++){const i=ji(e[n]);for(const r in i)t[r]=i[r]}return t}function id(e){const t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function Jc(e){const t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:qe.workingColorSpace}var rd={clone:ji,merge:kt},sd=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ad=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,_n=class extends Gt{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=sd,this.fragmentShader=ad,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ji(e.uniforms),this.uniformsGroups=id(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const i in this.uniforms){const r=this.uniforms[i].value;r&&r.isTexture?t.uniforms[i]={type:"t",value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[i]={type:"c",value:r.getHex()}:r&&r.isVector2?t.uniforms[i]={type:"v2",value:r.toArray()}:r&&r.isVector3?t.uniforms[i]={type:"v3",value:r.toArray()}:r&&r.isVector4?t.uniforms[i]={type:"v4",value:r.toArray()}:r&&r.isMatrix3?t.uniforms[i]={type:"m3",value:r.toArray()}:r&&r.isMatrix4?t.uniforms[i]={type:"m4",value:r.toArray()}:t.uniforms[i]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},od=class extends _n{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},ho=class extends Gt{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ee(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ee(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new oe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ct,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},xn=class extends ho{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new oe(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return et(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ee(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ee(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ee(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}},vr=class extends Gt{constructor(e){super(),this.isMeshPhongMaterial=!0,this.type="MeshPhongMaterial",this.color=new Ee(16777215),this.specular=new Ee(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ee(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new oe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ct,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},ld=class extends Gt{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Ee(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ee(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new oe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ct,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},cd=class extends Gt{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Eu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},hd=class extends Gt{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function gs(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT=="number"?new t(e):Array.prototype.slice.call(e)}function ud(e){function t(r,s){return e[r]-e[s]}const n=e.length,i=new Array(n);for(let r=0;r!==n;++r)i[r]=r;return i.sort(t),i}function ol(e,t,n){const i=e.length,r=new e.constructor(i);for(let s=0,a=0;a!==i;++s){const o=n[s]*t;for(let l=0;l!==t;++l)r[a++]=e[o+l]}return r}function Zc(e,t,n,i){let r=1,s=e[0];for(;s!==void 0&&s[i]===void 0;)s=e[r++];if(s===void 0)return;let a=s[i];if(a!==void 0)if(Array.isArray(a))do a=s[i],a!==void 0&&(t.push(s.time),n.push(...a)),s=e[r++];while(s!==void 0);else if(a.toArray!==void 0)do a=s[i],a!==void 0&&(t.push(s.time),a.toArray(n,n.length)),s=e[r++];while(s!==void 0);else do a=s[i],a!==void 0&&(t.push(s.time),n.push(a)),s=e[r++];while(s!==void 0)}var Zi=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let n=this._cachedIndex,i=t[n],r=t[n-1];e:{t:{let s;n:{i:if(!(e<i)){for(let a=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=i,i=t[++n],e<i)break t}s=t.length;break n}if(!(e>=r)){const a=t[1];e<a&&(n=2,r=a);for(let o=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===o)break;if(i=r,r=t[--n-1],e>=r)break t}s=n,n=0;break n}break e}for(;n<s;){const a=n+s>>>1;e<t[a]?s=a:n=a+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let s=0;s!==i;++s)t[s]=n[r+s];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},fd=class extends Zi{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ni,endingEnd:Ni}}intervalChanged_(e,t,n){const i=this.parameterPositions;let r=e-2,s=e+1,a=i[r],o=i[s];if(a===void 0)switch(this.getSettings_().endingStart){case Ui:r=e,a=2*t-n;break;case Is:r=i.length-2,a=t+i[r]-i[r+1];break;default:r=e,a=n}if(o===void 0)switch(this.getSettings_().endingEnd){case Ui:s=e,o=2*n-t;break;case Is:s=1,o=n+i[1]-i[0];break;default:s=e-1,o=t}const l=(n-t)*.5,c=this.valueSize;this._weightPrev=l/(t-a),this._weightNext=l/(o-n),this._offsetPrev=r*c,this._offsetNext=s*c}interpolate_(e,t,n,i){const r=this.resultBuffer,s=this.sampleValues,a=this.valueSize,o=e*a,l=o-a,c=this._offsetPrev,h=this._offsetNext,u=this._weightPrev,f=this._weightNext,d=(n-t)/(i-t),g=d*d,v=g*d,p=-u*v+2*u*g-u*d,m=(1+u)*v+(-1.5-2*u)*g+(-.5+u)*d+1,y=(-1-f)*v+(1.5+f)*g+.5*d,S=f*v-f*g;for(let M=0;M!==a;++M)r[M]=p*s[c+M]+m*s[l+M]+y*s[o+M]+S*s[h+M];return r}},$c=class extends Zi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const r=this.resultBuffer,s=this.sampleValues,a=this.valueSize,o=e*a,l=o-a,c=(n-t)/(i-t),h=1-c;for(let u=0;u!==a;++u)r[u]=s[l+u]*h+s[o+u]*c;return r}},dd=class extends Zi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},pd=class extends Zi{interpolate_(e,t,n,i){const r=this.resultBuffer,s=this.sampleValues,a=this.valueSize,o=e*a,l=o-a,c=this.settings||this.DefaultSettings_,h=c.inTangents,u=c.outTangents;if(!h||!u){const g=(n-t)/(i-t),v=1-g;for(let p=0;p!==a;++p)r[p]=s[l+p]*v+s[o+p]*g;return r}const f=a*2,d=e-1;for(let g=0;g!==a;++g){const v=s[l+g],p=s[o+g],m=d*f+g*2,y=u[m],S=u[m+1],M=e*f+g*2,I=h[M],w=h[M+1];let C=(n-t)/(i-t),_,b,N,A,O;for(let H=0;H<8;H++){_=C*C,b=_*C,N=1-C,A=N*N,O=A*N;const k=O*t+3*A*C*y+3*N*_*I+b*i-n;if(Math.abs(k)<1e-10)break;const L=3*A*(y-t)+6*N*C*(I-y)+3*_*(i-I);if(Math.abs(L)<1e-10)break;C=C-k/L,C=Math.max(0,Math.min(1,C))}r[g]=O*v+3*A*C*S+3*N*_*w+b*p}return r}},cn=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=gs(t,this.TimeBufferType),this.values=gs(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:gs(e.times,Array),values:gs(e.values,Array)};const i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new dd(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new $c(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new fd(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){const t=new pd(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.settings=this.settings),t}setInterpolation(e){let t;switch(e){case Er:t=this.InterpolantFactoryMethodDiscrete;break;case br:t=this.InterpolantFactoryMethodLinear;break;case qs:t=this.InterpolantFactoryMethodSmooth;break;case To:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){const n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Le("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Er;case this.InterpolantFactoryMethodLinear:return br;case this.InterpolantFactoryMethodSmooth:return qs;case this.InterpolantFactoryMethodBezier:return To}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){const n=this.times,i=n.length;let r=0,s=i-1;for(;r!==i&&n[r]<e;)++r;for(;s!==-1&&n[s]>t;)--s;if(++s,r!==0||s!==i){r>=s&&(s=Math.max(s,1),r=s-1);const a=this.getValueSize();this.times=n.slice(r,s),this.values=this.values.slice(r*a,s*a)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(ke("KeyframeTrack: Invalid value size in track.",this),e=!1);const n=this.times,i=this.values,r=n.length;r===0&&(ke("KeyframeTrack: Track is empty.",this),e=!1);let s=null;for(let a=0;a!==r;a++){const o=n[a];if(typeof o=="number"&&isNaN(o)){ke("KeyframeTrack: Time is not a valid number.",this,a,o),e=!1;break}if(s!==null&&s>o){ke("KeyframeTrack: Out of order keys.",this,a,o,s),e=!1;break}s=o}if(i!==void 0&&Au(i))for(let a=0,o=i.length;a!==o;++a){const l=i[a];if(isNaN(l)){ke("KeyframeTrack: Value is not a valid number.",this,a,l),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===qs,r=e.length-1;let s=1;for(let a=1;a<r;++a){let o=!1;const l=e[a];if(l!==e[a+1]&&(a!==1||l!==e[0]))if(i)o=!0;else{const c=a*n,h=c-n,u=c+n;for(let f=0;f!==n;++f){const d=t[c+f];if(d!==t[h+f]||d!==t[u+f]){o=!0;break}}}if(o){if(a!==s){e[s]=e[a];const c=a*n,h=s*n;for(let u=0;u!==n;++u)t[h+u]=t[c+u]}++s}}if(r>0){e[s]=e[r];for(let a=r*n,o=s*n,l=0;l!==n;++l)t[o+l]=t[a+l];++s}return s!==e.length?(this.times=e.slice(0,s),this.values=t.slice(0,s*n)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}};cn.prototype.ValueTypeName="";cn.prototype.TimeBufferType=Float32Array;cn.prototype.ValueBufferType=Float32Array;cn.prototype.DefaultInterpolation=br;var $i=class extends cn{constructor(e,t,n){super(e,t,n)}};$i.prototype.ValueTypeName="bool";$i.prototype.ValueBufferType=Array;$i.prototype.DefaultInterpolation=Er;$i.prototype.InterpolantFactoryMethodLinear=void 0;$i.prototype.InterpolantFactoryMethodSmooth=void 0;var Qc=class extends cn{constructor(e,t,n,i){super(e,t,n,i)}};Qc.prototype.ValueTypeName="color";var oi=class extends cn{constructor(e,t,n,i){super(e,t,n,i)}};oi.prototype.ValueTypeName="number";var md=class extends Zi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const r=this.resultBuffer,s=this.sampleValues,a=this.valueSize,o=(n-t)/(i-t);let l=e*a;for(let c=l+a;l!==c;l+=4)St.slerpFlat(r,0,s,l-a,s,l,o);return r}},Xn=class extends cn{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new md(this.times,this.values,this.getValueSize(),e)}};Xn.prototype.ValueTypeName="quaternion";Xn.prototype.InterpolantFactoryMethodSmooth=void 0;var Qi=class extends cn{constructor(e,t,n){super(e,t,n)}};Qi.prototype.ValueTypeName="string";Qi.prototype.ValueBufferType=Array;Qi.prototype.DefaultInterpolation=Er;Qi.prototype.InterpolantFactoryMethodLinear=void 0;Qi.prototype.InterpolantFactoryMethodSmooth=void 0;var li=class extends cn{constructor(e,t,n,i){super(e,t,n,i)}};li.prototype.ValueTypeName="vector";var ks=class{constructor(e="",t=-1,n=[],i=to){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=Zt(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){const t=[],n=e.tracks,i=1/(e.fps||1);for(let s=0,a=n.length;s!==a;++s)t.push(vd(n[s]).scale(i));const r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r.userData=JSON.parse(e.userData||"{}"),r}static toJSON(e){const t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let r=0,s=n.length;r!==s;++r)t.push(cn.toJSON(n[r]));return i}static CreateFromMorphTargetSequence(e,t,n,i){const r=t.length,s=[];for(let a=0;a<r;a++){let o=[],l=[];o.push((a+r-1)%r,a,(a+1)%r),l.push(0,1,0);const c=ud(o);o=ol(o,1,c),l=ol(l,1,c),!i&&o[0]===0&&(o.push(r),l.push(l[0])),s.push(new oi(".morphTargetInfluences["+t[a].name+"]",o,l).scale(1/n))}return new this(e,-1,s)}static findByName(e,t){let n=e;if(!Array.isArray(e)){const i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){const i={},r=/^([\w-]*?)([\d]+)$/;for(let a=0,o=e.length;a<o;a++){const l=e[a],c=l.name.match(r);if(c&&c.length>1){const h=c[1];let u=i[h];u||(i[h]=u=[]),u.push(l)}}const s=[];for(const a in i)s.push(this.CreateFromMorphTargetSequence(a,i[a],t,n));return s}static parseAnimation(e,t){if(Le("AnimationClip: parseAnimation() is deprecated and will be removed with r185"),!e)return ke("AnimationClip: No animation in JSONLoader data."),null;const n=function(c,h,u,f,d){if(u.length!==0){const g=[],v=[];Zc(u,g,v,f),g.length!==0&&d.push(new c(h,g,v))}},i=[],r=e.name||"default",s=e.fps||30,a=e.blendMode;let o=e.length||-1;const l=e.hierarchy||[];for(let c=0;c<l.length;c++){const h=l[c].keys;if(!(!h||h.length===0))if(h[0].morphTargets){const u={};let f;for(f=0;f<h.length;f++)if(h[f].morphTargets)for(let d=0;d<h[f].morphTargets.length;d++)u[h[f].morphTargets[d]]=-1;for(const d in u){const g=[],v=[];for(let p=0;p!==h[f].morphTargets.length;++p){const m=h[f];g.push(m.time),v.push(m.morphTarget===d?1:0)}i.push(new oi(".morphTargetInfluence["+d+"]",g,v))}o=u.length*s}else{const u=".bones["+t[c].name+"]";n(li,u+".position",h,"pos",i),n(Xn,u+".quaternion",h,"rot",i),n(li,u+".scale",h,"scl",i)}}return i.length===0?null:new this(r,o,i,a)}resetDuration(){const e=this.tracks;let t=0;for(let n=0,i=e.length;n!==i;++n){const r=this.tracks[n];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let n=0;n<this.tracks.length;n++)e.push(this.tracks[n].clone());const t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}};function gd(e){switch(e.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return oi;case"vector":case"vector2":case"vector3":case"vector4":return li;case"color":return Qc;case"quaternion":return Xn;case"bool":case"boolean":return $i;case"string":return Qi}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+e)}function vd(e){if(e.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const t=gd(e.type);if(e.times===void 0){const n=[],i=[];Zc(e.keys,n,i,"value"),e.times=n,e.values=i}return t.parse!==void 0?t.parse(e):new t(e.name,e.times,e.values,e.interpolation)}var Rn={enabled:!1,files:{},add:function(e,t){this.enabled!==!1&&(ll(e)||(this.files[e]=t))},get:function(e){if(this.enabled!==!1&&!ll(e))return this.files[e]},remove:function(e){delete this.files[e]},clear:function(){this.files={}}};function ll(e){try{const t=e.slice(e.indexOf(":")+1);return new URL(t).protocol==="blob:"}catch{return!1}}var _d=class{constructor(e,t,n){const i=this;let r=!1,s=0,a=0,o;const l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(c){a++,r===!1&&i.onStart!==void 0&&i.onStart(c,s,a),r=!0},this.itemEnd=function(c){s++,i.onProgress!==void 0&&i.onProgress(c,s,a),s===a&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(c){i.onError!==void 0&&i.onError(c)},this.resolveURL=function(c){return o?o(c):c},this.setURLModifier=function(c){return o=c,this},this.addHandler=function(c,h){return l.push(c,h),this},this.removeHandler=function(c){const h=l.indexOf(c);return h!==-1&&l.splice(h,2),this},this.getHandler=function(c){for(let h=0,u=l.length;h<u;h+=2){const f=l[h],d=l[h+1];if(f.global&&(f.lastIndex=0),f.test(c))return d}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},yd=new _d,$t=class{constructor(e){this.manager=e!==void 0?e:yd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){const n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};$t.DEFAULT_MATERIAL_NAME="__DEFAULT";var wn={},xd=class extends Error{constructor(e,t){super(e),this.response=t}},er=class extends $t{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=Rn.get(`file:${e}`);if(r!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0),r;if(wn[e]!==void 0){wn[e].push({onLoad:t,onProgress:n,onError:i});return}wn[e]=[],wn[e].push({onLoad:t,onProgress:n,onError:i});const s=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),a=this.mimeType,o=this.responseType;fetch(s).then(l=>{if(l.status===200||l.status===0){if(l.status===0&&Le("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||l.body===void 0||l.body.getReader===void 0)return l;const c=wn[e],h=l.body.getReader(),u=l.headers.get("X-File-Size")||l.headers.get("Content-Length"),f=u?parseInt(u):0,d=f!==0;let g=0;const v=new ReadableStream({start(p){m();function m(){h.read().then(({done:y,value:S})=>{if(y)p.close();else{g+=S.byteLength;const M=new ProgressEvent("progress",{lengthComputable:d,loaded:g,total:f});for(let I=0,w=c.length;I<w;I++){const C=c[I];C.onProgress&&C.onProgress(M)}p.enqueue(S),m()}},y=>{p.error(y)})}}});return new Response(v)}else throw new xd(`fetch for "${l.url}" responded with ${l.status}: ${l.statusText}`,l)}).then(l=>{switch(o){case"arraybuffer":return l.arrayBuffer();case"blob":return l.blob();case"document":return l.text().then(c=>new DOMParser().parseFromString(c,a));case"json":return l.json();default:if(a==="")return l.text();{const c=/charset="?([^;"\s]*)"?/i.exec(a),h=c&&c[1]?c[1].toLowerCase():void 0,u=new TextDecoder(h);return l.arrayBuffer().then(f=>u.decode(f))}}}).then(l=>{Rn.add(`file:${e}`,l);const c=wn[e];delete wn[e];for(let h=0,u=c.length;h<u;h++){const f=c[h];f.onLoad&&f.onLoad(l)}}).catch(l=>{const c=wn[e];if(c===void 0)throw this.manager.itemError(e),l;delete wn[e];for(let h=0,u=c.length;h<u;h++){const f=c[h];f.onError&&f.onError(l)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}},wi=new WeakMap,Md=class extends $t{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,s=Rn.get(`image:${e}`);if(s!==void 0){if(s.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(s),r.manager.itemEnd(e)},0);else{let h=wi.get(s);h===void 0&&(h=[],wi.set(s,h)),h.push({onLoad:t,onError:i})}return s}const a=Ar("img");function o(){c(),t&&t(this);const h=wi.get(this)||[];for(let u=0;u<h.length;u++){const f=h[u];f.onLoad&&f.onLoad(this)}wi.delete(this),r.manager.itemEnd(e)}function l(h){c(),i&&i(h),Rn.remove(`image:${e}`);const u=wi.get(this)||[];for(let f=0;f<u.length;f++){const d=u[f];d.onError&&d.onError(h)}wi.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function c(){a.removeEventListener("load",o,!1),a.removeEventListener("error",l,!1)}return a.addEventListener("load",o,!1),a.addEventListener("error",l,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),Rn.add(`image:${e}`,a),r.manager.itemStart(e),a.src=e,a}},Sd=class extends $t{constructor(e){super(e)}load(e,t,n,i){const r=this,s=new zs,a=new er(this.manager);return a.setResponseType("arraybuffer"),a.setRequestHeader(this.requestHeader),a.setPath(this.path),a.setWithCredentials(r.withCredentials),a.load(e,function(o){let l;try{l=r.parse(o)}catch(c){if(i!==void 0)i(c);else{c(c);return}}l.image!==void 0?s.image=l.image:l.data!==void 0&&(s.image.width=l.width,s.image.height=l.height,s.image.data=l.data),s.wrapS=l.wrapS!==void 0?l.wrapS:Ht,s.wrapT=l.wrapT!==void 0?l.wrapT:Ht,s.magFilter=l.magFilter!==void 0?l.magFilter:It,s.minFilter=l.minFilter!==void 0?l.minFilter:It,s.anisotropy=l.anisotropy!==void 0?l.anisotropy:1,l.colorSpace!==void 0&&(s.colorSpace=l.colorSpace),l.flipY!==void 0&&(s.flipY=l.flipY),l.format!==void 0&&(s.format=l.format),l.type!==void 0&&(s.type=l.type),l.mipmaps!==void 0&&(s.mipmaps=l.mipmaps,s.minFilter=Ki),l.mipmapCount===1&&(s.minFilter=It),l.generateMipmaps!==void 0&&(s.generateMipmaps=l.generateMipmaps),s.needsUpdate=!0,t&&t(s,l)},n,i),s}},eh=class extends $t{constructor(e){super(e)}load(e,t,n,i){const r=new Ft,s=new Md(this.manager);return s.setCrossOrigin(this.crossOrigin),s.setPath(this.path),s.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},n,i),r}},Nr=class extends ft{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ee(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},Lv=class extends Nr{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(ft.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ee(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){const t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Ea=new Ie,cl=new P,hl=new P,uo=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new oe(512,512),this.mapType=Hn,this.map=null,this.mapPass=null,this.matrix=new Ie,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ao,this._frameExtents=new oe(1,1),this._viewportCount=1,this._viewports=[new ct(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;cl.setFromMatrixPosition(e.matrixWorld),t.position.copy(cl),hl.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(hl),t.updateMatrixWorld(),Ea.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ea,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===2001||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Ea)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},vs=new P,_s=new St,fn=new P,th=class extends ft{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ie,this.projectionMatrix=new Ie,this.projectionMatrixInverse=new Ie,this.coordinateSystem=Wi,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(vs,_s,fn),fn.x===1&&fn.y===1&&fn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(vs,_s,fn.set(1,1,1)).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorld.decompose(vs,_s,fn),fn.x===1&&fn.y===1&&fn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(vs,_s,fn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Fn=new P,ul=new oe,fl=new oe,Vt=class extends th{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=qi*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Bi*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return qi*2*Math.atan(Math.tan(Bi*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Fn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Fn.x,Fn.y).multiplyScalar(-e/Fn.z),Fn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Fn.x,Fn.y).multiplyScalar(-e/Fn.z)}getViewSize(e,t){return this.getViewBounds(e,ul,fl),t.subVectors(fl,ul)}setViewOffset(e,t,n,i,r,s){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Bi*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-.5*i;const s=this.view;if(this.view!==null&&this.view.enabled){const o=s.fullWidth,l=s.fullHeight;r+=s.offsetX*i/o,t-=s.offsetY*n/l,i*=s.width/o,n*=s.height/l}const a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},Td=class extends uo{constructor(){super(new Vt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){const t=this.camera,n=qi*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(n!==t.fov||i!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=i,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}},nh=class extends Nr{constructor(e,t,n=0,i=Math.PI/3,r=0,s=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(ft.DEFAULT_UP),this.updateMatrix(),this.target=new ft,this.distance=n,this.angle=i,this.penumbra=r,this.decay=s,this.map=null,this.shadow=new Td}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},Ed=class extends uo{constructor(){super(new Vt(90,1,.5,500)),this.isPointLightShadow=!0}},ja=class extends Nr{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Ed}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},Vs=class extends th{constructor(e=-1,t=1,n=1,i=-1,r=.1,s=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=s,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,s){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let r=n-e,s=n+e,a=i+t,o=i-t;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,c=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,s=r+l*this.view.width,a-=c*this.view.offsetY,o=a-c*this.view.height}this.projectionMatrix.makeOrthographic(r,s,a,o,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},bd=class extends uo{constructor(){super(new Vs(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},ih=class extends Nr{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ft.DEFAULT_UP),this.updateMatrix(),this.target=new ft,this.shadow=new bd}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},Ad=class extends Nr{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}},zi=class{static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}},ba=new WeakMap,wd=class extends $t{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&Le("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&Le("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,s=Rn.get(`image-bitmap:${e}`);if(s!==void 0){if(r.manager.itemStart(e),s.then){s.then(l=>{if(ba.has(s)===!0)i&&i(ba.get(s)),r.manager.itemError(e),r.manager.itemEnd(e);else return t&&t(l),r.manager.itemEnd(e),l});return}return setTimeout(function(){t&&t(s),r.manager.itemEnd(e)},0),s}const a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader,a.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;const o=fetch(e,a).then(function(l){return l.blob()}).then(function(l){return createImageBitmap(l,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(l){return Rn.add(`image-bitmap:${e}`,l),t&&t(l),r.manager.itemEnd(e),l}).catch(function(l){i&&i(l),ba.set(o,l),Rn.remove(`image-bitmap:${e}`),r.manager.itemError(e),r.manager.itemEnd(e)});Rn.add(`image-bitmap:${e}`,o),r.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}},Ri=-90,Ci=1,Rd=class extends ft{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new Vt(Ri,Ci,e,t);i.layers=this.layers,this.add(i);const r=new Vt(Ri,Ci,e,t);r.layers=this.layers,this.add(r);const s=new Vt(Ri,Ci,e,t);s.layers=this.layers,this.add(s);const a=new Vt(Ri,Ci,e,t);a.layers=this.layers,this.add(a);const o=new Vt(Ri,Ci,e,t);o.layers=this.layers,this.add(o);const l=new Vt(Ri,Ci,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,i,r,s,a,o]=t;for(const l of t)this.remove(l);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),s.up.set(0,0,1),s.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),o.up.set(0,1,0),o.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),s.up.set(0,0,-1),s.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),o.up.set(0,-1,0),o.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,s,a,o,l,c]=this.children,h=e.getRenderTarget(),u=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),d=e.xr.enabled;e.xr.enabled=!1;const g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let v=!1;e.isWebGLRenderer===!0?v=e.state.buffers.depth.getReversed():v=e.reversedDepthBuffer,e.setRenderTarget(n,0,i),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,i),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,2,i),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,3,i),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,4,i),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,i),v&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),e.setRenderTarget(h,u,f),e.xr.enabled=d,n.texture.needsPMREMUpdate=!0}},Cd=class extends Vt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Id=class{constructor(e,t,n){this.binding=e,this.valueSize=n;let i,r,s;switch(t){case"quaternion":i=this._slerp,r=this._slerpAdditive,s=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(n*6),this._workIndex=5;break;case"string":case"bool":i=this._select,r=this._select,s=this._setAdditiveIdentityOther,this.buffer=new Array(n*5);break;default:i=this._lerp,r=this._lerpAdditive,s=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(n*5)}this._mixBufferRegion=i,this._mixBufferRegionAdditive=r,this._setIdentity=s,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){const n=this.buffer,i=this.valueSize,r=e*i+i;let s=this.cumulativeWeight;if(s===0){for(let a=0;a!==i;++a)n[r+a]=n[a];s=t}else{s+=t;const a=t/s;this._mixBufferRegion(n,r,0,a,i)}this.cumulativeWeight=s}accumulateAdditive(e){const t=this.buffer,n=this.valueSize,i=n*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,i,0,e,n),this.cumulativeWeightAdditive+=e}apply(e){const t=this.valueSize,n=this.buffer,i=e*t+t,r=this.cumulativeWeight,s=this.cumulativeWeightAdditive,a=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,r<1){const o=t*this._origIndex;this._mixBufferRegion(n,i,o,1-r,t)}s>0&&this._mixBufferRegionAdditive(n,i,this._addIndex*t,1,t);for(let o=t,l=t+t;o!==l;++o)if(n[o]!==n[o+t]){a.setValue(n,i);break}}saveOriginalState(){const e=this.binding,t=this.buffer,n=this.valueSize,i=n*this._origIndex;e.getValue(t,i);for(let r=n,s=i;r!==s;++r)t[r]=t[i+r%n];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){const e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let n=e;n<t;n++)this.buffer[n]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let n=0;n<this.valueSize;n++)this.buffer[t+n]=this.buffer[e+n]}_select(e,t,n,i,r){if(i>=.5)for(let s=0;s!==r;++s)e[t+s]=e[n+s]}_slerp(e,t,n,i){St.slerpFlat(e,t,e,t,e,n,i)}_slerpAdditive(e,t,n,i,r){const s=this._workIndex*r;St.multiplyQuaternionsFlat(e,s,e,t,e,n),St.slerpFlat(e,t,e,t,e,s,i)}_lerp(e,t,n,i,r){const s=1-i;for(let a=0;a!==r;++a){const o=t+a;e[o]=e[o]*s+e[n+a]*i}}_lerpAdditive(e,t,n,i,r){for(let s=0;s!==r;++s){const a=t+s;e[a]=e[a]+e[n+s]*i}}},fo="\\[\\]\\.:\\/",Pd=new RegExp("["+fo+"]","g"),po="[^"+fo+"]",Ld="[^"+fo.replace("\\.","")+"]",Dd=/((?:WC+[\/:])*)/.source.replace("WC",po),Nd=/(WCOD+)?/.source.replace("WCOD",Ld),Ud=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",po),Od=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",po),Fd=new RegExp("^"+Dd+Nd+Ud+Od+"$"),Bd=["material","materials","bones","map"],kd=class{constructor(e,t,n){const i=n||lt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();const n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){const n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},lt=class Di{constructor(t,n,i){this.path=n,this.parsedPath=i||Di.parseTrackName(n),this.node=Di.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,i){return t&&t.isAnimationObjectGroup?new Di.Composite(t,n,i):new Di(t,n,i)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(Pd,"")}static parseTrackName(t){const n=Fd.exec(t);if(n===null)throw new Error("PropertyBinding: Cannot parse trackName: "+t);const i={nodeName:n[2],objectName:n[3],objectIndex:n[4],propertyName:n[5],propertyIndex:n[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){const s=i.nodeName.substring(r+1);Bd.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+t);return i}static findNode(t,n){if(n===void 0||n===""||n==="."||n===-1||n===t.name||n===t.uuid)return t;if(t.skeleton){const i=t.skeleton.getBoneByName(n);if(i!==void 0)return i}if(t.children){const i=function(s){for(let a=0;a<s.length;a++){const o=s[a];if(o.name===n||o.uuid===n)return o;const l=i(o.children);if(l)return l}return null},r=i(t.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,n){t[n]=this.targetObject[this.propertyName]}_getValue_array(t,n){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)t[n++]=i[r]}_getValue_arrayElement(t,n){t[n]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,n){this.resolvedProperty.toArray(t,n)}_setValue_direct(t,n){this.targetObject[this.propertyName]=t[n]}_setValue_direct_setNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,n){this.targetObject[this.propertyName]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,n){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=t[n++]}_setValue_array_setNeedsUpdate(t,n){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=t[n++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,n){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=t[n++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,n){this.resolvedProperty[this.propertyIndex]=t[n]}_setValue_arrayElement_setNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty[this.propertyIndex]=t[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,n){this.resolvedProperty.fromArray(t,n)}_setValue_fromArray_setNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,n){this.resolvedProperty.fromArray(t,n),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,n){this.bind(),this.getValue(t,n)}_setValue_unbound(t,n){this.bind(),this.setValue(t,n)}bind(){let t=this.node;const n=this.parsedPath,i=n.objectName,r=n.propertyName;let s=n.propertyIndex;if(t||(t=Di.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Le("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=n.objectIndex;switch(i){case"materials":if(!t.material){ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){ke("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){ke("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){ke("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[i]===void 0){ke("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[i]}if(c!==void 0){if(t[c]===void 0){ke("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}const a=t[r];if(a===void 0){const c=n.nodeName;ke("PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!t.geometry){ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[s]!==void 0&&(s=t.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};lt.Composite=kd;lt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};lt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};lt.prototype.GetterByBindingType=[lt.prototype._getValue_direct,lt.prototype._getValue_array,lt.prototype._getValue_arrayElement,lt.prototype._getValue_toArray];lt.prototype.SetterByBindingTypeAndVersioning=[[lt.prototype._setValue_direct,lt.prototype._setValue_direct_setNeedsUpdate,lt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[lt.prototype._setValue_array,lt.prototype._setValue_array_setNeedsUpdate,lt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[lt.prototype._setValue_arrayElement,lt.prototype._setValue_arrayElement_setNeedsUpdate,lt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[lt.prototype._setValue_fromArray,lt.prototype._setValue_fromArray_setNeedsUpdate,lt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var zd=class{constructor(e,t,n=null,i=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=n,this.blendMode=i;const r=t.tracks,s=r.length,a=new Array(s),o={endingStart:Ni,endingEnd:Ni};for(let l=0;l!==s;++l){const c=r[l].createInterpolant(null);a[l]=c,c.settings=o}this._interpolantSettings=o,this._interpolants=a,this._propertyBindings=new Array(s),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=Mu,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,n=!1){if(e.fadeOut(t),this.fadeIn(t),n===!0){const i=this._clip.duration,r=e._clip.duration,s=r/i,a=i/r;e.warp(1,s,t),this.warp(a,1,t)}return this}crossFadeTo(e,t,n=!1){return e.crossFadeFrom(this,t,n)}stopFading(){const e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,n){const i=this._mixer,r=i.time,s=this.timeScale;let a=this._timeScaleInterpolant;a===null&&(a=i._lendControlInterpolant(),this._timeScaleInterpolant=a);const o=a.parameterPositions,l=a.sampleValues;return o[0]=r,o[1]=r+n,l[0]=e/s,l[1]=t/s,this}stopWarping(){const e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,n,i){if(!this.enabled){this._updateWeight(e);return}const r=this._startTime;if(r!==null){const o=(e-r)*n;o<0||n===0?t=0:(this._startTime=null,t=n*o)}t*=this._updateTimeScale(e);const s=this._updateTime(t),a=this._updateWeight(e);if(a>0){const o=this._interpolants,l=this._propertyBindings;switch(this.blendMode){case Tu:for(let c=0,h=o.length;c!==h;++c)o[c].evaluate(s),l[c].accumulateAdditive(a);break;case to:default:for(let c=0,h=o.length;c!==h;++c)o[c].evaluate(s),l[c].accumulate(i,a)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;const n=this._weightInterpolant;if(n!==null){const i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopFading(),i===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;const n=this._timeScaleInterpolant;if(n!==null){const i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){const t=this._clip.duration,n=this.loop;let i=this.time+e,r=this._loopCount;const s=n===Su;if(e===0)return r===-1?i:s&&(r&1)===1?t-i:i;if(n===2200){r===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(i>=t)i=t;else if(i<0)i=0;else{this.time=i;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(r===-1&&(e>=0?(r=0,this._setEndings(!0,this.repetitions===0,s)):this._setEndings(this.repetitions===0,!0,s)),i>=t||i<0){const a=Math.floor(i/t);i-=t*a,r+=Math.abs(a);const o=this.repetitions-r;if(o<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,i=e>0?t:0,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(o===1){const l=e<0;this._setEndings(l,!l,s)}else this._setEndings(!1,!1,s);this._loopCount=r,this.time=i,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:a})}}else this.time=i;if(s&&(r&1)===1)return t-i}return i}_setEndings(e,t,n){const i=this._interpolantSettings;n?(i.endingStart=Ui,i.endingEnd=Ui):(e?i.endingStart=this.zeroSlopeAtStart?Ui:Ni:i.endingStart=Is,t?i.endingEnd=this.zeroSlopeAtEnd?Ui:Ni:i.endingEnd=Is)}_scheduleFading(e,t,n){const i=this._mixer,r=i.time;let s=this._weightInterpolant;s===null&&(s=i._lendControlInterpolant(),this._weightInterpolant=s);const a=s.parameterPositions,o=s.sampleValues;return a[0]=r,o[0]=t,a[1]=r+e,o[1]=n,this}},Vd=new Float32Array(1),Dv=class extends ci{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}_bindAction(e,t){const n=e._localRoot||this._root,i=e._clip.tracks,r=i.length,s=e._propertyBindings,a=e._interpolants,o=n.uuid,l=this._bindingsByRootAndName;let c=l[o];c===void 0&&(c={},l[o]=c);for(let h=0;h!==r;++h){const u=i[h],f=u.name;let d=c[f];if(d!==void 0)++d.referenceCount,s[h]=d;else{if(d=s[h],d!==void 0){d._cacheIndex===null&&(++d.referenceCount,this._addInactiveBinding(d,o,f));continue}const g=t&&t._propertyBindings[h].binding.parsedPath;d=new Id(lt.create(n,f,g),u.ValueTypeName,u.getValueSize()),++d.referenceCount,this._addInactiveBinding(d,o,f),s[h]=d}a[h].resultBuffer=d.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){const n=(e._localRoot||this._root).uuid,i=e._clip.uuid,r=this._actionsByClip[i];this._bindAction(e,r&&r.knownActions[0]),this._addInactiveAction(e,i,n)}const t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){const r=t[n];r.useCount++===0&&(this._lendBinding(r),r.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){const t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){const r=t[n];--r.useCount===0&&(r.restoreOriginalState(),this._takeBackBinding(r))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){const t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,n){const i=this._actions,r=this._actionsByClip;let s=r[t];if(s===void 0)s={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,r[t]=s;else{const a=s.knownActions;e._byClipCacheIndex=a.length,a.push(e)}e._cacheIndex=i.length,i.push(e),s.actionByRoot[n]=e}_removeInactiveAction(e){const t=this._actions,n=t[t.length-1],i=e._cacheIndex;n._cacheIndex=i,t[i]=n,t.pop(),e._cacheIndex=null;const r=e._clip.uuid,s=this._actionsByClip,a=s[r],o=a.knownActions,l=o[o.length-1],c=e._byClipCacheIndex;l._byClipCacheIndex=c,o[c]=l,o.pop(),e._byClipCacheIndex=null;const h=a.actionByRoot,u=(e._localRoot||this._root).uuid;delete h[u],o.length===0&&delete s[r],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){const t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){const r=t[n];--r.referenceCount===0&&this._removeInactiveBinding(r)}}_lendAction(e){const t=this._actions,n=e._cacheIndex,i=this._nActiveActions++,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_takeBackAction(e){const t=this._actions,n=e._cacheIndex,i=--this._nActiveActions,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_addInactiveBinding(e,t,n){const i=this._bindingsByRootAndName,r=this._bindings;let s=i[t];s===void 0&&(s={},i[t]=s),s[n]=e,e._cacheIndex=r.length,r.push(e)}_removeInactiveBinding(e){const t=this._bindings,n=e.binding,i=n.rootNode.uuid,r=n.path,s=this._bindingsByRootAndName,a=s[i],o=t[t.length-1],l=e._cacheIndex;o._cacheIndex=l,t[l]=o,t.pop(),delete a[r],Object.keys(a).length===0&&delete s[i]}_lendBinding(e){const t=this._bindings,n=e._cacheIndex,i=this._nActiveBindings++,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_takeBackBinding(e){const t=this._bindings,n=e._cacheIndex,i=--this._nActiveBindings,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_lendControlInterpolant(){const e=this._controlInterpolants,t=this._nActiveControlInterpolants++;let n=e[t];return n===void 0&&(n=new $c(new Float32Array(2),new Float32Array(2),1,Vd),n.__cacheIndex=t,e[t]=n),n}_takeBackControlInterpolant(e){const t=this._controlInterpolants,n=e.__cacheIndex,i=--this._nActiveControlInterpolants,r=t[i];e.__cacheIndex=i,t[i]=e,r.__cacheIndex=n,t[n]=r}clipAction(e,t,n){const i=t||this._root,r=i.uuid;let s=typeof e=="string"?ks.findByName(i,e):e;const a=s!==null?s.uuid:e,o=this._actionsByClip[a];let l=null;if(n===void 0&&(s!==null?n=s.blendMode:n=to),o!==void 0){const h=o.actionByRoot[r];if(h!==void 0&&h.blendMode===n)return h;l=o.knownActions[0],s===null&&(s=l._clip)}if(s===null)return null;const c=new zd(this,s,t,n);return this._bindAction(c,l),this._addInactiveAction(c,a,r),c}existingAction(e,t){const n=t||this._root,i=n.uuid,r=typeof e=="string"?ks.findByName(n,e):e,s=r?r.uuid:e,a=this._actionsByClip[s];return a!==void 0&&a.actionByRoot[i]||null}stopAllAction(){const e=this._actions,t=this._nActiveActions;for(let n=t-1;n>=0;--n)e[n].stop();return this}update(e){e*=this.timeScale;const t=this._actions,n=this._nActiveActions,i=this.time+=e,r=Math.sign(e),s=this._accuIndex^=1;for(let l=0;l!==n;++l)t[l]._update(i,e,r,s);const a=this._bindings,o=this._nActiveBindings;for(let l=0;l!==o;++l)a[l].apply(s);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){const t=this._actions,n=e.uuid,i=this._actionsByClip,r=i[n];if(r!==void 0){const s=r.knownActions;for(let a=0,o=s.length;a!==o;++a){const l=s[a];this._deactivateAction(l);const c=l._cacheIndex,h=t[t.length-1];l._cacheIndex=null,l._byClipCacheIndex=null,h._cacheIndex=c,t[c]=h,t.pop(),this._removeInactiveBindingsForAction(l)}delete i[n]}}uncacheRoot(e){const t=e.uuid,n=this._actionsByClip;for(const r in n){const s=n[r].actionByRoot[t];s!==void 0&&(this._deactivateAction(s),this._removeInactiveAction(s))}const i=this._bindingsByRootAndName[t];if(i!==void 0)for(const r in i){const s=i[r];s.restoreOriginalState(),this._removeInactiveBinding(s)}}uncacheAction(e,t){const n=this.existingAction(e,t);n!==null&&(this._deactivateAction(n),this._removeInactiveAction(n))}},dl=new Ie,Nv=class{constructor(e,t,n=0,i=1/0){this.ray=new Lr(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new ro,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):ke("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return dl.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(dl),this}intersectObject(e,t=!0,n=[]){return Ka(e,this,n,t),n.sort(pl),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)Ka(e[i],this,n,t);return n.sort(pl),n}};function pl(e,t){return e.distance-t.distance}function Ka(e,t,n,i){let r=!0;if(e.layers.test(t.layers)&&e.raycast(t,n)===!1&&(r=!1),r===!0&&i===!0){const s=e.children;for(let a=0,o=s.length;a<o;a++)Ka(s[a],t,n,!0)}}var Uv=class{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1,Le("THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.")}start(){this.startTime=performance.now(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const t=performance.now();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}},Ov=class extends Bs{constructor(e=10,t=10,n=4473924,i=8947848){n=new Ee(n),i=new Ee(i);const r=t/2,s=e/t,a=e/2,o=[],l=[];for(let u=0,f=0,d=-a;u<=t;u++,d+=s){o.push(-a,0,d,a,0,d),o.push(d,0,-a,d,0,a);const g=u===r?n:i;g.toArray(l,f),f+=3,g.toArray(l,f),f+=3,g.toArray(l,f),f+=3,g.toArray(l,f),f+=3}const c=new dt;c.setAttribute("position",new Ye(o,3)),c.setAttribute("color",new Ye(l,3));const h=new Wn({vertexColors:!0,toneMapped:!1});super(c,h),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}},ml=new P,ys,Aa,Fv=class extends ft{constructor(e=new P(0,0,1),t=new P(0,0,0),n=1,i=16776960,r=n*.2,s=r*.2){super(),this.type="ArrowHelper",ys===void 0&&(ys=new dt,ys.setAttribute("position",new Ye([0,0,0,0,1,0],3)),Aa=new Sf(.5,1,5,1),Aa.translate(0,-.5,0)),this.position.copy(t),this.line=new Dr(ys,new Wn({color:i,toneMapped:!1})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new Pt(Aa,new zn({color:i,toneMapped:!1})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(e),this.setLength(n,r,s)}setDirection(e){if(e.y>.99999)this.quaternion.set(0,0,0,1);else if(e.y<-.99999)this.quaternion.set(1,0,0,0);else{ml.set(e.z,0,-e.x).normalize();const t=Math.acos(e.y);this.quaternion.setFromAxisAngle(ml,t)}}setLength(e,t=e*.2,n=t*.2){this.line.scale.set(1,Math.max(1e-4,e-t),1),this.line.updateMatrix(),this.cone.scale.set(n,t,n),this.cone.position.y=e,this.cone.updateMatrix()}setColor(e){this.line.material.color.set(e),this.cone.material.color.set(e)}copy(e){return super.copy(e,!1),this.line.copy(e.line),this.cone.copy(e.cone),this}dispose(){this.line.geometry.dispose(),this.line.material.dispose(),this.cone.geometry.dispose(),this.cone.material.dispose()}};function gl(e,t,n,i){const r=Gd(i);switch(n){case Fh:return e*t;case ac:return e*t/r.components*r.byteLength;case oc:return e*t/r.components*r.byteLength;case Cs:return e*t*2/r.components*r.byteLength;case lc:return e*t*2/r.components*r.byteLength;case Bh:return e*t*3/r.components*r.byteLength;case Hi:return e*t*4/r.components*r.byteLength;case cc:return e*t*4/r.components*r.byteLength;case kh:case zh:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Vh:case Gh:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Wh:case qh:return Math.max(e,16)*Math.max(t,8)/4;case Hh:case Xh:return Math.max(e,8)*Math.max(t,8)/2;case Yh:case jh:case Jh:case Zh:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Kh:case $h:case Qh:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case eu:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case tu:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case nu:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case iu:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case ru:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case su:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case au:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case ou:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case lu:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case cu:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case hu:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case uu:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case fu:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case du:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case pu:case mu:case gu:return Math.ceil(e/4)*Math.ceil(t/4)*16;case vu:case _u:return Math.ceil(e/4)*Math.ceil(t/4)*8;case yu:case xu:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${n} format.`)}function Gd(e){switch(e){case Hn:case Lh:return{byteLength:1,components:1};case tc:case Dh:case si:return{byteLength:2,components:1};case nc:case ic:return{byteLength:2,components:4};case ri:case Nh:case Ji:return{byteLength:4,components:1};case Uh:case Oh:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"183"}}));typeof window<"u"&&(window.__THREE__?Le("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="183");function rh(){let e=null,t=!1,n=null,i=null;function r(s,a){n(s,a),i=e.requestAnimationFrame(r)}return{start:function(){t!==!0&&n!==null&&(i=e.requestAnimationFrame(r),t=!0)},stop:function(){e.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(s){n=s},setContext:function(s){e=s}}}function Hd(e){const t=new WeakMap;function n(o,l){const c=o.array,h=o.usage,u=c.byteLength,f=e.createBuffer();e.bindBuffer(l,f),e.bufferData(l,c,h),o.onUploadCallback();let d;if(c instanceof Float32Array)d=e.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=e.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?d=e.HALF_FLOAT:d=e.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=e.SHORT;else if(c instanceof Uint32Array)d=e.UNSIGNED_INT;else if(c instanceof Int32Array)d=e.INT;else if(c instanceof Int8Array)d=e.BYTE;else if(c instanceof Uint8Array)d=e.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function i(o,l,c){const h=l.array,u=l.updateRanges;if(e.bindBuffer(c,o),u.length===0)e.bufferSubData(c,0,h);else{u.sort((d,g)=>d.start-g.start);let f=0;for(let d=1;d<u.length;d++){const g=u[f],v=u[d];v.start<=g.start+g.count+1?g.count=Math.max(g.count,v.start+v.count-g.start):(++f,u[f]=v)}u.length=f+1;for(let d=0,g=u.length;d<g;d++){const v=u[d];e.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=t.get(o);l&&(e.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=t.get(o);if(c===void 0)t.set(o,n(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:r,remove:s,update:a}}var je={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:"gl_FragColor = linearToOutputTexel( gl_FragColor );",colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return v;
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},ye={common:{diffuse:{value:new Ee(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ke},alphaMap:{value:null},alphaMapTransform:{value:new Ke},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ke}},envmap:{envMap:{value:null},envMapRotation:{value:new Ke},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ke}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ke}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ke},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ke},normalScale:{value:new oe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ke},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ke}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ke}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ke}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ee(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ee(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ke},alphaTest:{value:0},uvTransform:{value:new Ke}},sprite:{diffuse:{value:new Ee(16777215)},opacity:{value:1},center:{value:new oe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ke},alphaMap:{value:null},alphaMapTransform:{value:new Ke},alphaTest:{value:0}}},mn={basic:{uniforms:kt([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.fog]),vertexShader:je.meshbasic_vert,fragmentShader:je.meshbasic_frag},lambert:{uniforms:kt([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,ye.lights,{emissive:{value:new Ee(0)},envMapIntensity:{value:1}}]),vertexShader:je.meshlambert_vert,fragmentShader:je.meshlambert_frag},phong:{uniforms:kt([ye.common,ye.specularmap,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,ye.lights,{emissive:{value:new Ee(0)},specular:{value:new Ee(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:je.meshphong_vert,fragmentShader:je.meshphong_frag},standard:{uniforms:kt([ye.common,ye.envmap,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.roughnessmap,ye.metalnessmap,ye.fog,ye.lights,{emissive:{value:new Ee(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:je.meshphysical_vert,fragmentShader:je.meshphysical_frag},toon:{uniforms:kt([ye.common,ye.aomap,ye.lightmap,ye.emissivemap,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.gradientmap,ye.fog,ye.lights,{emissive:{value:new Ee(0)}}]),vertexShader:je.meshtoon_vert,fragmentShader:je.meshtoon_frag},matcap:{uniforms:kt([ye.common,ye.bumpmap,ye.normalmap,ye.displacementmap,ye.fog,{matcap:{value:null}}]),vertexShader:je.meshmatcap_vert,fragmentShader:je.meshmatcap_frag},points:{uniforms:kt([ye.points,ye.fog]),vertexShader:je.points_vert,fragmentShader:je.points_frag},dashed:{uniforms:kt([ye.common,ye.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:je.linedashed_vert,fragmentShader:je.linedashed_frag},depth:{uniforms:kt([ye.common,ye.displacementmap]),vertexShader:je.depth_vert,fragmentShader:je.depth_frag},normal:{uniforms:kt([ye.common,ye.bumpmap,ye.normalmap,ye.displacementmap,{opacity:{value:1}}]),vertexShader:je.meshnormal_vert,fragmentShader:je.meshnormal_frag},sprite:{uniforms:kt([ye.sprite,ye.fog]),vertexShader:je.sprite_vert,fragmentShader:je.sprite_frag},background:{uniforms:{uvTransform:{value:new Ke},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:je.background_vert,fragmentShader:je.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ke}},vertexShader:je.backgroundCube_vert,fragmentShader:je.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:je.cube_vert,fragmentShader:je.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:je.equirect_vert,fragmentShader:je.equirect_frag},distance:{uniforms:kt([ye.common,ye.displacementmap,{referencePosition:{value:new P},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:je.distance_vert,fragmentShader:je.distance_frag},shadow:{uniforms:kt([ye.lights,ye.fog,{color:{value:new Ee(0)},opacity:{value:1}}]),vertexShader:je.shadow_vert,fragmentShader:je.shadow_frag}};mn.physical={uniforms:kt([mn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ke},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ke},clearcoatNormalScale:{value:new oe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ke},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ke},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ke},sheen:{value:0},sheenColor:{value:new Ee(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ke},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ke},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ke},transmissionSamplerSize:{value:new oe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ke},attenuationDistance:{value:0},attenuationColor:{value:new Ee(0)},specularColor:{value:new Ee(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ke},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ke},anisotropyVector:{value:new oe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ke}}]),vertexShader:je.meshphysical_vert,fragmentShader:je.meshphysical_frag};var xs={r:0,b:0,g:0},$n=new Ct,Wd=new Ie;function Xd(e,t,n,i,r,s){const a=new Ee(0);let o=r===!0?0:1,l,c,h=null,u=0,f=null;function d(y){let S=y.isScene===!0?y.background:null;if(S&&S.isTexture){const M=y.backgroundBlurriness>0;S=t.get(S,M)}return S}function g(y){let S=!1;const M=d(y);M===null?p(a,o):M&&M.isColor&&(p(M,1),S=!0);const I=e.xr.getEnvironmentBlendMode();I==="additive"?n.buffers.color.setClear(0,0,0,1,s):I==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,s),(e.autoClear||S)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function v(y,S){const M=d(S);M&&(M.isCubeTexture||M.mapping===306)?(c===void 0&&(c=new Pt(new oo(1,1,1),new _n({name:"BackgroundCubeMaterial",uniforms:ji(mn.backgroundCube.uniforms),vertexShader:mn.backgroundCube.vertexShader,fragmentShader:mn.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(I,w,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),$n.copy(S.backgroundRotation),$n.x*=-1,$n.y*=-1,$n.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&($n.y*=-1,$n.z*=-1),c.material.uniforms.envMap.value=M,c.material.uniforms.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Wd.makeRotationFromEuler($n)),c.material.toneMapped=qe.getTransfer(M.colorSpace)!==Ls,(h!==M||u!==M.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,h=M,u=M.version,f=e.toneMapping),c.layers.enableAll(),y.unshift(c,c.geometry,c.material,0,0,null)):M&&M.isTexture&&(l===void 0&&(l=new Pt(new qc(2,2),new _n({name:"BackgroundMaterial",uniforms:ji(mn.background.uniforms),vertexShader:mn.background.vertexShader,fragmentShader:mn.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=M,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=qe.getTransfer(M.colorSpace)!==Ls,M.matrixAutoUpdate===!0&&M.updateMatrix(),l.material.uniforms.uvTransform.value.copy(M.matrix),(h!==M||u!==M.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,h=M,u=M.version,f=e.toneMapping),l.layers.enableAll(),y.unshift(l,l.geometry,l.material,0,0,null))}function p(y,S){y.getRGB(xs,Jc(e)),n.buffers.color.setClear(xs.r,xs.g,xs.b,S,s)}function m(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(y,S=1){a.set(y),o=S,p(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(y){o=y,p(a,o)},render:g,addToRenderList:v,dispose:m}}function qd(e,t){const n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},r=f(null);let s=r,a=!1;function o(A,O,H,k,L){let B=!1;const U=u(A,k,H,O);s!==U&&(s=U,c(s.object)),B=d(A,k,H,L),B&&g(A,k,H,L),L!==null&&t.update(L,e.ELEMENT_ARRAY_BUFFER),(B||a)&&(a=!1,M(A,O,H,k),L!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(L).buffer))}function l(){return e.createVertexArray()}function c(A){return e.bindVertexArray(A)}function h(A){return e.deleteVertexArray(A)}function u(A,O,H,k){const L=k.wireframe===!0;let B=i[O.id];B===void 0&&(B={},i[O.id]=B);const U=A.isInstancedMesh===!0?A.id:0;let $=B[U];$===void 0&&($={},B[U]=$);let j=$[H.id];j===void 0&&(j={},$[H.id]=j);let J=j[L];return J===void 0&&(J=f(l()),j[L]=J),J}function f(A){const O=[],H=[],k=[];for(let L=0;L<n;L++)O[L]=0,H[L]=0,k[L]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:O,enabledAttributes:H,attributeDivisors:k,object:A,attributes:{},index:null}}function d(A,O,H,k){const L=s.attributes,B=O.attributes;let U=0;const $=H.getAttributes();for(const j in $)if($[j].location>=0){const J=L[j];let re=B[j];if(re===void 0&&(j==="instanceMatrix"&&A.instanceMatrix&&(re=A.instanceMatrix),j==="instanceColor"&&A.instanceColor&&(re=A.instanceColor)),J===void 0||J.attribute!==re||re&&J.data!==re.data)return!0;U++}return s.attributesNum!==U||s.index!==k}function g(A,O,H,k){const L={},B=O.attributes;let U=0;const $=H.getAttributes();for(const j in $)if($[j].location>=0){let J=B[j];J===void 0&&(j==="instanceMatrix"&&A.instanceMatrix&&(J=A.instanceMatrix),j==="instanceColor"&&A.instanceColor&&(J=A.instanceColor));const re={};re.attribute=J,J&&J.data&&(re.data=J.data),L[j]=re,U++}s.attributes=L,s.attributesNum=U,s.index=k}function v(){const A=s.newAttributes;for(let O=0,H=A.length;O<H;O++)A[O]=0}function p(A){m(A,0)}function m(A,O){const H=s.newAttributes,k=s.enabledAttributes,L=s.attributeDivisors;H[A]=1,k[A]===0&&(e.enableVertexAttribArray(A),k[A]=1),L[A]!==O&&(e.vertexAttribDivisor(A,O),L[A]=O)}function y(){const A=s.newAttributes,O=s.enabledAttributes;for(let H=0,k=O.length;H<k;H++)O[H]!==A[H]&&(e.disableVertexAttribArray(H),O[H]=0)}function S(A,O,H,k,L,B,U){U===!0?e.vertexAttribIPointer(A,O,H,L,B):e.vertexAttribPointer(A,O,H,k,L,B)}function M(A,O,H,k){v();const L=k.attributes,B=H.getAttributes(),U=O.defaultAttributeValues;for(const $ in B){const j=B[$];if(j.location>=0){let J=L[$];if(J===void 0&&($==="instanceMatrix"&&A.instanceMatrix&&(J=A.instanceMatrix),$==="instanceColor"&&A.instanceColor&&(J=A.instanceColor)),J!==void 0){const re=J.normalized,Q=J.itemSize,pe=t.get(J);if(pe===void 0)continue;const de=pe.buffer,F=pe.type,q=pe.bytesPerElement,se=F===e.INT||F===e.UNSIGNED_INT||J.gpuType===1013;if(J.isInterleavedBufferAttribute){const ae=J.data,Re=ae.stride,Oe=J.offset;if(ae.isInstancedInterleavedBuffer){for(let Ne=0;Ne<j.locationSize;Ne++)m(j.location+Ne,ae.meshPerAttribute);A.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=ae.meshPerAttribute*ae.count)}else for(let Ne=0;Ne<j.locationSize;Ne++)p(j.location+Ne);e.bindBuffer(e.ARRAY_BUFFER,de);for(let Ne=0;Ne<j.locationSize;Ne++)S(j.location+Ne,Q/j.locationSize,F,re,Re*q,(Oe+Q/j.locationSize*Ne)*q,se)}else{if(J.isInstancedBufferAttribute){for(let ae=0;ae<j.locationSize;ae++)m(j.location+ae,J.meshPerAttribute);A.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let ae=0;ae<j.locationSize;ae++)p(j.location+ae);e.bindBuffer(e.ARRAY_BUFFER,de);for(let ae=0;ae<j.locationSize;ae++)S(j.location+ae,Q/j.locationSize,F,re,Q*q,Q/j.locationSize*ae*q,se)}}else if(U!==void 0){const re=U[$];if(re!==void 0)switch(re.length){case 2:e.vertexAttrib2fv(j.location,re);break;case 3:e.vertexAttrib3fv(j.location,re);break;case 4:e.vertexAttrib4fv(j.location,re);break;default:e.vertexAttrib1fv(j.location,re)}}}}y()}function I(){b();for(const A in i){const O=i[A];for(const H in O){const k=O[H];for(const L in k){const B=k[L];for(const U in B)h(B[U].object),delete B[U];delete k[L]}}delete i[A]}}function w(A){if(i[A.id]===void 0)return;const O=i[A.id];for(const H in O){const k=O[H];for(const L in k){const B=k[L];for(const U in B)h(B[U].object),delete B[U];delete k[L]}}delete i[A.id]}function C(A){for(const O in i){const H=i[O];for(const k in H){const L=H[k];if(L[A.id]===void 0)continue;const B=L[A.id];for(const U in B)h(B[U].object),delete B[U];delete L[A.id]}}}function _(A){for(const O in i){const H=i[O],k=A.isInstancedMesh===!0?A.id:0,L=H[k];if(L!==void 0){for(const B in L){const U=L[B];for(const $ in U)h(U[$].object),delete U[$];delete L[B]}delete H[k],Object.keys(H).length===0&&delete i[O]}}}function b(){N(),a=!0,s!==r&&(s=r,c(s.object))}function N(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:o,reset:b,resetDefaultState:N,dispose:I,releaseStatesOfGeometry:w,releaseStatesOfObject:_,releaseStatesOfProgram:C,initAttributes:v,enableAttribute:p,disableUnusedAttributes:y}}function Yd(e,t,n){let i;function r(c){i=c}function s(c,h){e.drawArrays(i,c,h),n.update(h,i,1)}function a(c,h,u){u!==0&&(e.drawArraysInstanced(i,c,h,u),n.update(h,i,u))}function o(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,h,0,u);let f=0;for(let d=0;d<u;d++)f+=h[d];n.update(f,i,1)}function l(c,h,u,f){if(u===0)return;const d=t.get("WEBGL_multi_draw");if(d===null)for(let g=0;g<c.length;g++)a(c[g],h[g],f[g]);else{d.multiDrawArraysInstancedWEBGL(i,c,0,h,0,f,0,u);let g=0;for(let v=0;v<u;v++)g+=h[v]*f[v];n.update(g,i,1)}}this.setMode=r,this.render=s,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function jd(e,t,n,i){let r;function s(){if(r!==void 0)return r;if(t.has("EXT_texture_filter_anisotropic")===!0){const C=t.get("EXT_texture_filter_anisotropic");r=e.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function a(C){return!(C!==1023&&i.convert(C)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(C){const _=C===1016&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==1009&&i.convert(C)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&C!==1015&&!_)}function l(C){if(C==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=n.precision!==void 0?n.precision:"highp";const h=l(c);h!==c&&(Le("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control"),d=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),g=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=e.getParameter(e.MAX_TEXTURE_SIZE),p=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),m=e.getParameter(e.MAX_VERTEX_ATTRIBS),y=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),S=e.getParameter(e.MAX_VARYING_VECTORS),M=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),I=e.getParameter(e.MAX_SAMPLES),w=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reversedDepthBuffer:f,maxTextures:d,maxVertexTextures:g,maxTextureSize:v,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:y,maxVaryings:S,maxFragmentUniforms:M,maxSamples:I,samples:w}}function Kd(e){const t=this;let n=null,i=0,r=!1,s=!1;const a=new ti,o=new Ke,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,f){const d=u.length!==0||f||i!==0||r;return r=f,i=u.length,d},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(u,f){n=h(u,f,0)},this.setState=function(u,f,d){const g=u.clippingPlanes,v=u.clipIntersection,p=u.clipShadows,m=e.get(u);if(!r||g===null||g.length===0||s&&!p)s?h(null):c();else{const y=s?0:i,S=y*4;let M=m.clippingState||null;l.value=M,M=h(g,f,S,d);for(let I=0;I!==S;++I)M[I]=n[I];m.clippingState=M,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=y}};function c(){l.value!==n&&(l.value=n,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(u,f,d,g){const v=u!==null?u.length:0;let p=null;if(v!==0){if(p=l.value,g!==!0||p===null){const m=d+v*4,y=f.matrixWorldInverse;o.getNormalMatrix(y),(p===null||p.length<m)&&(p=new Float32Array(m));for(let S=0,M=d;S!==v;++S,M+=4)a.copy(u[S]).applyMatrix4(y,o),a.normal.toArray(p,M),p[M+3]=a.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=v,t.numIntersection=0,p}}var Gn=4,vl=[.125,.215,.35,.446,.526,.582],ii=20,Jd=256,dr=new Vs,_l=new Ee,wa=null,Ra=0,Ca=0,Ia=!1,Zd=new P,yl=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,i=100,r={}){const{size:s=256,position:a=Zd}=r;wa=this._renderer.getRenderTarget(),Ra=this._renderer.getActiveCubeFace(),Ca=this._renderer.getActiveMipmapLevel(),Ia=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(s);const o=this._allocateTargets();return o.depthBuffer=!0,this._sceneToCubeUV(e,n,i,o,a),t>0&&this._blur(o,0,0,t),this._applyPMREM(o),this._cleanup(o),o}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Sl(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ml(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(wa,Ra,Ca),this._renderer.xr.enabled=Ia,e.scissorTest=!1,Ii(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),wa=this._renderer.getRenderTarget(),Ra=this._renderer.getActiveCubeFace(),Ca=this._renderer.getActiveMipmapLevel(),Ia=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:It,minFilter:It,generateMipmaps:!1,type:si,format:Hi,colorSpace:qt,depthBuffer:!1},i=xl(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=xl(e,t,n);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=$d(r)),this._blurMaterial=ep(r,e,t),this._ggxMaterial=Qd(r,e,t)}return i}_compileMaterial(e){const t=new Pt(new dt,e);this._renderer.compile(t,dr)}_sceneToCubeUV(e,t,n,i,r){const s=new Vt(90,1,t,n),a=[1,-1,1,1,1,1],o=[1,1,1,-1,-1,-1],l=this._renderer,c=l.autoClear,h=l.toneMapping;l.getClearColor(_l),l.toneMapping=0,l.autoClear=!1,l.state.buffers.depth.getReversed()&&(l.setRenderTarget(i),l.clearDepth(),l.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Pt(new oo,new zn({name:"PMREM.Background",side:1,depthWrite:!1,depthTest:!1})));const u=this._backgroundBox,f=u.material;let d=!1;const g=e.background;g?g.isColor&&(f.color.copy(g),e.background=null,d=!0):(f.color.copy(_l),d=!0);for(let v=0;v<6;v++){const p=v%3;p===0?(s.up.set(0,a[v],0),s.position.set(r.x,r.y,r.z),s.lookAt(r.x+o[v],r.y,r.z)):p===1?(s.up.set(0,0,a[v]),s.position.set(r.x,r.y,r.z),s.lookAt(r.x,r.y+o[v],r.z)):(s.up.set(0,a[v],0),s.position.set(r.x,r.y,r.z),s.lookAt(r.x,r.y,r.z+o[v]));const m=this._cubeSize;Ii(i,p*m,v>2?m:0,m,m),l.setRenderTarget(i),d&&l.render(u,s),l.render(e,s)}l.toneMapping=h,l.autoClear=c,e.background=g}_textureToCubeUV(e,t){const n=this._renderer,i=e.mapping===301||e.mapping===302;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=Sl()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ml());const r=i?this._cubemapMaterial:this._equirectMaterial,s=this._lodMeshes[0];s.material=r;const a=r.uniforms;a.envMap.value=e;const o=this._cubeSize;Ii(t,0,0,3*o,2*o),n.setRenderTarget(t),n.render(s,dr)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const i=this._lodMeshes.length;for(let r=1;r<i;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){const i=this._renderer,r=this._pingPongRenderTarget,s=this._ggxMaterial,a=this._lodMeshes[n];a.material=s;const o=s.uniforms,l=n/(this._lodMeshes.length-1),c=t/(this._lodMeshes.length-1),h=Math.sqrt(l*l-c*c)*(0+l*1.25),{_lodMax:u}=this,f=this._sizeLods[n],d=3*f*(n>u-Gn?n-u+Gn:0),g=4*(this._cubeSize-f);o.envMap.value=e.texture,o.roughness.value=h,o.mipInt.value=u-t,Ii(r,d,g,3*f,2*f),i.setRenderTarget(r),i.render(a,dr),o.envMap.value=r.texture,o.roughness.value=0,o.mipInt.value=u-n,Ii(e,d,g,3*f,2*f),i.setRenderTarget(e),i.render(a,dr)}_blur(e,t,n,i,r){const s=this._pingPongRenderTarget;this._halfBlur(e,s,t,n,i,"latitudinal",r),this._halfBlur(s,e,n,n,i,"longitudinal",r)}_halfBlur(e,t,n,i,r,s,a){const o=this._renderer,l=this._blurMaterial;s!=="latitudinal"&&s!=="longitudinal"&&ke("blur direction must be either latitudinal or longitudinal!");const c=3,h=this._lodMeshes[i];h.material=l;const u=l.uniforms,f=this._sizeLods[n]-1,d=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*ii-1),g=r/d,v=isFinite(r)?1+Math.floor(c*g):ii;v>ii&&Le(`sigmaRadians, ${r}, is too large and will clip, as it requested ${v} samples when the maximum is set to ${ii}`);const p=[];let m=0;for(let M=0;M<ii;++M){const I=M/g,w=Math.exp(-I*I/2);p.push(w),M===0?m+=w:M<v&&(m+=2*w)}for(let M=0;M<p.length;M++)p[M]=p[M]/m;u.envMap.value=e.texture,u.samples.value=v,u.weights.value=p,u.latitudinal.value=s==="latitudinal",a&&(u.poleAxis.value=a);const{_lodMax:y}=this;u.dTheta.value=d,u.mipInt.value=y-n;const S=this._sizeLods[i];Ii(t,3*S*(i>y-Gn?i-y+Gn:0),4*(this._cubeSize-S),3*S,2*S),o.setRenderTarget(t),o.render(h,dr)}};function $d(e){const t=[],n=[],i=[];let r=e;const s=e-Gn+1+vl.length;for(let a=0;a<s;a++){const o=Math.pow(2,r);t.push(o);let l=1/o;a>e-Gn?l=vl[a-e+Gn-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),h=-c,u=1+c,f=[h,h,u,h,u,u,h,h,u,u,h,u],d=6,g=6,v=3,p=2,m=1,y=new Float32Array(v*g*d),S=new Float32Array(p*g*d),M=new Float32Array(m*g*d);for(let w=0;w<d;w++){const C=w%3*2/3-1,_=w>2?0:-1,b=[C,_,0,C+2/3,_,0,C+2/3,_+1,0,C,_,0,C+2/3,_+1,0,C,_+1,0];y.set(b,v*g*w),S.set(f,p*g*w);const N=[w,w,w,w,w,w];M.set(N,m*g*w)}const I=new dt;I.setAttribute("position",new wt(y,v)),I.setAttribute("uv",new wt(S,p)),I.setAttribute("faceIndex",new wt(M,m)),i.push(new Pt(I,null)),r>Gn&&r--}return{lodMeshes:i,sizeLods:t,sigmas:n}}function xl(e,t,n){const i=new vn(e,t,n);return i.texture.mapping=306,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Ii(e,t,n,i,r){e.viewport.set(t,n,i,r),e.scissor.set(t,n,i,r)}function Qd(e,t,n){return new _n({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Jd,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Gs(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function ep(e,t,n){const i=new Float32Array(ii),r=new P(0,1,0);return new _n({name:"SphericalGaussianBlur",defines:{n:ii,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Gs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Ml(){return new _n({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Gs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Sl(){return new _n({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Gs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Gs(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var sh=class extends vn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1};this.texture=new Cc([n,n,n,n,n,n]),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new oo(5,5,5),r=new _n({name:"CubemapFromEquirect",uniforms:ji(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});r.uniforms.tEquirect.value=t;const s=new Pt(i,r),a=t.minFilter;return t.minFilter===1008&&(t.minFilter=It),new Rd(1,10,this).update(e,s),t.minFilter=a,s.geometry.dispose(),s.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){const r=e.getRenderTarget();for(let s=0;s<6;s++)e.setRenderTarget(this,s),e.clear(t,n,i);e.setRenderTarget(r)}};function tp(e){let t=new WeakMap,n=new WeakMap,i=null;function r(f,d=!1){return f==null?null:d?a(f):s(f)}function s(f){if(f&&f.isTexture){const d=f.mapping;if(d===303||d===304)if(t.has(f)){const g=t.get(f).texture;return o(g,f.mapping)}else{const g=f.image;if(g&&g.height>0){const v=new sh(g.height);return v.fromEquirectangularTexture(e,f),t.set(f,v),f.addEventListener("dispose",c),o(v.texture,f.mapping)}else return null}}return f}function a(f){if(f&&f.isTexture){const d=f.mapping,g=d===303||d===304,v=d===301||d===302;if(g||v){let p=n.get(f);const m=p!==void 0?p.texture.pmremVersion:0;if(f.isRenderTargetTexture&&f.pmremVersion!==m)return i===null&&(i=new yl(e)),p=g?i.fromEquirectangular(f,p):i.fromCubemap(f,p),p.texture.pmremVersion=f.pmremVersion,n.set(f,p),p.texture;if(p!==void 0)return p.texture;{const y=f.image;return g&&y&&y.height>0||v&&y&&l(y)?(i===null&&(i=new yl(e)),p=g?i.fromEquirectangular(f):i.fromCubemap(f),p.texture.pmremVersion=f.pmremVersion,n.set(f,p),f.addEventListener("dispose",h),p.texture):null}}}return f}function o(f,d){return d===303?f.mapping=301:d===304&&(f.mapping=302),f}function l(f){let d=0;const g=6;for(let v=0;v<g;v++)f[v]!==void 0&&d++;return d===g}function c(f){const d=f.target;d.removeEventListener("dispose",c);const g=t.get(d);g!==void 0&&(t.delete(d),g.dispose())}function h(f){const d=f.target;d.removeEventListener("dispose",h);const g=n.get(d);g!==void 0&&(n.delete(d),g.dispose())}function u(){t=new WeakMap,n=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:u}}function np(e){const t={};function n(i){if(t[i]!==void 0)return t[i];const r=e.getExtension(i);return t[i]=r,r}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){const r=n(i);return r===null&&Ns("WebGLRenderer: "+i+" extension not supported."),r}}}function ip(e,t,n,i){const r={},s=new WeakMap;function a(u){const f=u.target;f.index!==null&&t.remove(f.index);for(const g in f.attributes)t.remove(f.attributes[g]);f.removeEventListener("dispose",a),delete r[f.id];const d=s.get(f);d&&(t.remove(d),s.delete(f)),i.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,n.memory.geometries--}function o(u,f){return r[f.id]===!0||(f.addEventListener("dispose",a),r[f.id]=!0,n.memory.geometries++),f}function l(u){const f=u.attributes;for(const d in f)t.update(f[d],e.ARRAY_BUFFER)}function c(u){const f=[],d=u.index,g=u.attributes.position;let v=0;if(g===void 0)return;if(d!==null){const y=d.array;v=d.version;for(let S=0,M=y.length;S<M;S+=3){const I=y[S+0],w=y[S+1],C=y[S+2];f.push(I,w,w,C,C,I)}}else{const y=g.array;v=g.version;for(let S=0,M=y.length/3-1;S<M;S+=3){const I=S+0,w=S+1,C=S+2;f.push(I,w,w,C,C,I)}}const p=new(g.count>=65535?Mc:so)(f,1);p.version=v;const m=s.get(u);m&&t.remove(m),s.set(u,p)}function h(u){const f=s.get(u);if(f){const d=u.index;d!==null&&f.version<d.version&&c(u)}else c(u);return s.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function rp(e,t,n){let i;function r(f){i=f}let s,a;function o(f){s=f.type,a=f.bytesPerElement}function l(f,d){e.drawElements(i,d,s,f*a),n.update(d,i,1)}function c(f,d,g){g!==0&&(e.drawElementsInstanced(i,d,s,f*a,g),n.update(d,i,g))}function h(f,d,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,d,0,s,f,0,g);let v=0;for(let p=0;p<g;p++)v+=d[p];n.update(v,i,1)}function u(f,d,g,v){if(g===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let m=0;m<f.length;m++)c(f[m]/a,d[m],v[m]);else{p.multiDrawElementsInstancedWEBGL(i,d,0,s,f,0,v,0,g);let m=0;for(let y=0;y<g;y++)m+=d[y]*v[y];n.update(m,i,1)}}this.setMode=r,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function sp(e){const t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,a,o){switch(n.calls++,a){case e.TRIANGLES:n.triangles+=o*(s/3);break;case e.LINES:n.lines+=o*(s/2);break;case e.LINE_STRIP:n.lines+=o*(s-1);break;case e.LINE_LOOP:n.lines+=o*s;break;case e.POINTS:n.points+=o*s;break;default:ke("WebGLInfo: Unknown draw mode:",a);break}}function r(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:r,update:i}}function ap(e,t,n){const i=new WeakMap,r=new ct;function s(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let f=i.get(o);if(f===void 0||f.count!==u){let b=function(){C.dispose(),i.delete(o),o.removeEventListener("dispose",b)};f!==void 0&&f.texture.dispose();const d=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,v=o.morphAttributes.color!==void 0,p=o.morphAttributes.position||[],m=o.morphAttributes.normal||[],y=o.morphAttributes.color||[];let S=0;d===!0&&(S=1),g===!0&&(S=2),v===!0&&(S=3);let M=o.attributes.position.count*S,I=1;M>t.maxTextureSize&&(I=Math.ceil(M/t.maxTextureSize),M=t.maxTextureSize);const w=new Float32Array(M*I*4*u),C=new gc(w,M,I,u);C.type=Ji,C.needsUpdate=!0;const _=S*4;for(let N=0;N<u;N++){const A=p[N],O=m[N],H=y[N],k=M*I*4*N;for(let L=0;L<A.count;L++){const B=L*_;d===!0&&(r.fromBufferAttribute(A,L),w[k+B+0]=r.x,w[k+B+1]=r.y,w[k+B+2]=r.z,w[k+B+3]=0),g===!0&&(r.fromBufferAttribute(O,L),w[k+B+4]=r.x,w[k+B+5]=r.y,w[k+B+6]=r.z,w[k+B+7]=0),v===!0&&(r.fromBufferAttribute(H,L),w[k+B+8]=r.x,w[k+B+9]=r.y,w[k+B+10]=r.z,w[k+B+11]=H.itemSize===4?r.w:1)}}f={count:u,texture:C,size:new oe(M,I)},i.set(o,f),o.addEventListener("dispose",b)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(e,"morphTexture",a.morphTexture,n);else{let d=0;for(let v=0;v<c.length;v++)d+=c[v];const g=o.morphTargetsRelative?1:1-d;l.getUniforms().setValue(e,"morphTargetBaseInfluence",g),l.getUniforms().setValue(e,"morphTargetInfluences",c)}l.getUniforms().setValue(e,"morphTargetsTexture",f.texture,n),l.getUniforms().setValue(e,"morphTargetsTextureSize",f.size)}return{update:s}}function op(e,t,n,i,r){let s=new WeakMap;function a(c){const h=r.render.frame,u=c.geometry,f=t.get(c,u);if(s.get(f)!==h&&(t.update(f),s.set(f,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==h&&(n.update(c.instanceMatrix,e.ARRAY_BUFFER),c.instanceColor!==null&&n.update(c.instanceColor,e.ARRAY_BUFFER),s.set(c,h))),c.isSkinnedMesh){const d=c.skeleton;s.get(d)!==h&&(d.update(),s.set(d,h))}return f}function o(){s=new WeakMap}function l(c){const h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),n.remove(h.instanceMatrix),h.instanceColor!==null&&n.remove(h.instanceColor)}return{update:a,dispose:o}}var lp={1:"LINEAR_TONE_MAPPING",2:"REINHARD_TONE_MAPPING",3:"CINEON_TONE_MAPPING",4:"ACES_FILMIC_TONE_MAPPING",6:"AGX_TONE_MAPPING",7:"NEUTRAL_TONE_MAPPING",5:"CUSTOM_TONE_MAPPING"};function cp(e,t,n,i,r){const s=new vn(t,n,{type:e,depthBuffer:i,stencilBuffer:r}),a=new vn(t,n,{type:si,depthBuffer:!1,stencilBuffer:!1}),o=new dt;o.setAttribute("position",new Ye([-1,3,0,-1,-1,0,3,-1,0],3)),o.setAttribute("uv",new Ye([0,2,0,0,2,0],2));const l=new od({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),c=new Pt(o,l),h=new Vs(-1,1,1,-1,0,1);let u=null,f=null,d=!1,g,v=null,p=[],m=!1;this.setSize=function(y,S){s.setSize(y,S),a.setSize(y,S);for(let M=0;M<p.length;M++){const I=p[M];I.setSize&&I.setSize(y,S)}},this.setEffects=function(y){p=y,m=p.length>0&&p[0].isRenderPass===!0;const S=s.width,M=s.height;for(let I=0;I<p.length;I++){const w=p[I];w.setSize&&w.setSize(S,M)}},this.begin=function(y,S){if(d||y.toneMapping===0&&p.length===0)return!1;if(v=S,S!==null){const M=S.width,I=S.height;(s.width!==M||s.height!==I)&&this.setSize(M,I)}return m===!1&&y.setRenderTarget(s),g=y.toneMapping,y.toneMapping=0,!0},this.hasRenderPass=function(){return m},this.end=function(y,S){y.toneMapping=g,d=!0;let M=s,I=a;for(let w=0;w<p.length;w++){const C=p[w];if(C.enabled!==!1&&(C.render(y,I,M,S),C.needsSwap!==!1)){const _=M;M=I,I=_}}if(u!==y.outputColorSpace||f!==y.toneMapping){u=y.outputColorSpace,f=y.toneMapping,l.defines={},qe.getTransfer(u)==="srgb"&&(l.defines.SRGB_TRANSFER="");const w=lp[f];w&&(l.defines[w]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=M.texture,y.setRenderTarget(v),y.render(c,h),v=null,d=!1},this.isCompositing=function(){return d},this.dispose=function(){s.dispose(),a.dispose(),o.dispose(),l.dispose()}}var ah=new Ft,Ja=new wr(1,1),oh=new gc,lh=new Zu,ch=new Cc,Tl=[],El=[],bl=new Float32Array(16),Al=new Float32Array(9),wl=new Float32Array(4);function tr(e,t,n){const i=e[0];if(i<=0||i>0)return e;const r=t*n;let s=Tl[r];if(s===void 0&&(s=new Float32Array(r),Tl[r]=s),t!==0){i.toArray(s,0);for(let a=1,o=0;a!==t;++a)o+=n,e[a].toArray(s,o)}return s}function Et(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function bt(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function Hs(e,t){let n=El[t];n===void 0&&(n=new Int32Array(t),El[t]=n);for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function hp(e,t){const n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function up(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Et(n,t))return;e.uniform2fv(this.addr,t),bt(n,t)}}function fp(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(Et(n,t))return;e.uniform3fv(this.addr,t),bt(n,t)}}function dp(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Et(n,t))return;e.uniform4fv(this.addr,t),bt(n,t)}}function pp(e,t){const n=this.cache,i=t.elements;if(i===void 0){if(Et(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),bt(n,t)}else{if(Et(n,i))return;wl.set(i),e.uniformMatrix2fv(this.addr,!1,wl),bt(n,i)}}function mp(e,t){const n=this.cache,i=t.elements;if(i===void 0){if(Et(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),bt(n,t)}else{if(Et(n,i))return;Al.set(i),e.uniformMatrix3fv(this.addr,!1,Al),bt(n,i)}}function gp(e,t){const n=this.cache,i=t.elements;if(i===void 0){if(Et(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),bt(n,t)}else{if(Et(n,i))return;bl.set(i),e.uniformMatrix4fv(this.addr,!1,bl),bt(n,i)}}function vp(e,t){const n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function _p(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Et(n,t))return;e.uniform2iv(this.addr,t),bt(n,t)}}function yp(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Et(n,t))return;e.uniform3iv(this.addr,t),bt(n,t)}}function xp(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Et(n,t))return;e.uniform4iv(this.addr,t),bt(n,t)}}function Mp(e,t){const n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function Sp(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Et(n,t))return;e.uniform2uiv(this.addr,t),bt(n,t)}}function Tp(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Et(n,t))return;e.uniform3uiv(this.addr,t),bt(n,t)}}function Ep(e,t){const n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Et(n,t))return;e.uniform4uiv(this.addr,t),bt(n,t)}}function bp(e,t,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r);let s;this.type===e.SAMPLER_2D_SHADOW?(Ja.compareFunction=n.isReversedDepthBuffer()?518:515,s=Ja):s=ah,n.setTexture2D(t||s,r)}function Ap(e,t,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),n.setTexture3D(t||lh,r)}function wp(e,t,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),n.setTextureCube(t||ch,r)}function Rp(e,t,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),n.setTexture2DArray(t||oh,r)}function Cp(e){switch(e){case 5126:return hp;case 35664:return up;case 35665:return fp;case 35666:return dp;case 35674:return pp;case 35675:return mp;case 35676:return gp;case 5124:case 35670:return vp;case 35667:case 35671:return _p;case 35668:case 35672:return yp;case 35669:case 35673:return xp;case 5125:return Mp;case 36294:return Sp;case 36295:return Tp;case 36296:return Ep;case 35678:case 36198:case 36298:case 36306:case 35682:return bp;case 35679:case 36299:case 36307:return Ap;case 35680:case 36300:case 36308:case 36293:return wp;case 36289:case 36303:case 36311:case 36292:return Rp}}function Ip(e,t){e.uniform1fv(this.addr,t)}function Pp(e,t){const n=tr(t,this.size,2);e.uniform2fv(this.addr,n)}function Lp(e,t){const n=tr(t,this.size,3);e.uniform3fv(this.addr,n)}function Dp(e,t){const n=tr(t,this.size,4);e.uniform4fv(this.addr,n)}function Np(e,t){const n=tr(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function Up(e,t){const n=tr(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function Op(e,t){const n=tr(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function Fp(e,t){e.uniform1iv(this.addr,t)}function Bp(e,t){e.uniform2iv(this.addr,t)}function kp(e,t){e.uniform3iv(this.addr,t)}function zp(e,t){e.uniform4iv(this.addr,t)}function Vp(e,t){e.uniform1uiv(this.addr,t)}function Gp(e,t){e.uniform2uiv(this.addr,t)}function Hp(e,t){e.uniform3uiv(this.addr,t)}function Wp(e,t){e.uniform4uiv(this.addr,t)}function Xp(e,t,n){const i=this.cache,r=t.length,s=Hs(n,r);Et(i,s)||(e.uniform1iv(this.addr,s),bt(i,s));let a;this.type===e.SAMPLER_2D_SHADOW?a=Ja:a=ah;for(let o=0;o!==r;++o)n.setTexture2D(t[o]||a,s[o])}function qp(e,t,n){const i=this.cache,r=t.length,s=Hs(n,r);Et(i,s)||(e.uniform1iv(this.addr,s),bt(i,s));for(let a=0;a!==r;++a)n.setTexture3D(t[a]||lh,s[a])}function Yp(e,t,n){const i=this.cache,r=t.length,s=Hs(n,r);Et(i,s)||(e.uniform1iv(this.addr,s),bt(i,s));for(let a=0;a!==r;++a)n.setTextureCube(t[a]||ch,s[a])}function jp(e,t,n){const i=this.cache,r=t.length,s=Hs(n,r);Et(i,s)||(e.uniform1iv(this.addr,s),bt(i,s));for(let a=0;a!==r;++a)n.setTexture2DArray(t[a]||oh,s[a])}function Kp(e){switch(e){case 5126:return Ip;case 35664:return Pp;case 35665:return Lp;case 35666:return Dp;case 35674:return Np;case 35675:return Up;case 35676:return Op;case 5124:case 35670:return Fp;case 35667:case 35671:return Bp;case 35668:case 35672:return kp;case 35669:case 35673:return zp;case 5125:return Vp;case 36294:return Gp;case 36295:return Hp;case 36296:return Wp;case 35678:case 36198:case 36298:case 36306:case 35682:return Xp;case 35679:case 36299:case 36307:return qp;case 35680:case 36300:case 36308:case 36293:return Yp;case 36289:case 36303:case 36311:case 36292:return jp}}var Jp=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Cp(t.type)}},Zp=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Kp(t.type)}},$p=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const i=this.seq;for(let r=0,s=i.length;r!==s;++r){const a=i[r];a.setValue(e,t[a.id],n)}}},Pa=/(\w+)(\])?(\[|\.)?/g;function Rl(e,t){e.seq.push(t),e.map[t.id]=t}function Qp(e,t,n){const i=e.name,r=i.length;for(Pa.lastIndex=0;;){const s=Pa.exec(i),a=Pa.lastIndex;let o=s[1];const l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===r){Rl(n,c===void 0?new Jp(o,e,t):new Zp(o,e,t));break}else{let h=n.map[o];h===void 0&&(h=new $p(o),Rl(n,h)),n=h}}}var ws=class{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const a=e.getActiveUniform(t,s);Qp(a,e.getUniformLocation(t,a.name),this)}const i=[],r=[];for(const s of this.seq)s.type===e.SAMPLER_2D_SHADOW||s.type===e.SAMPLER_CUBE_SHADOW||s.type===e.SAMPLER_2D_ARRAY_SHADOW?i.push(s):r.push(s);i.length>0&&(this.seq=i.concat(r))}setValue(e,t,n,i){const r=this.map[t];r!==void 0&&r.setValue(e,n,i)}setOptional(e,t,n){const i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,s=t.length;r!==s;++r){const a=t[r],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,i)}}static seqWithValue(e,t){const n=[];for(let i=0,r=e.length;i!==r;++i){const s=e[i];s.id in t&&n.push(s)}return n}};function Cl(e,t,n){const i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var em=37297,tm=0;function nm(e,t){const n=e.split(`
`),i=[],r=Math.max(t-6,0),s=Math.min(t+6,n.length);for(let a=r;a<s;a++){const o=a+1;i.push(`${o===t?">":" "} ${o}: ${n[a]}`)}return i.join(`
`)}var Il=new Ke;function im(e){qe._getMatrix(Il,qe.workingColorSpace,e);const t=`mat3( ${Il.elements.map(n=>n.toFixed(4))} )`;switch(qe.getTransfer(e)){case Ps:return[t,"LinearTransferOETF"];case Ls:return[t,"sRGBTransferOETF"];default:return Le("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function Pl(e,t,n){const i=e.getShaderParameter(t,e.COMPILE_STATUS),r=(e.getShaderInfoLog(t)||"").trim();if(i&&r==="")return"";const s=/ERROR: 0:(\d+)/.exec(r);if(s){const a=parseInt(s[1]);return n.toUpperCase()+`

`+r+`

`+nm(e.getShaderSource(t),a)}else return r}function rm(e,t){const n=im(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var sm={1:"Linear",2:"Reinhard",3:"Cineon",4:"ACESFilmic",6:"AgX",7:"Neutral",5:"Custom"};function am(e,t){const n=sm[t];return n===void 0?(Le("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var Ms=new P;function om(){return qe.getLuminanceCoefficients(Ms),["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${Ms.x.toFixed(4)}, ${Ms.y.toFixed(4)}, ${Ms.z.toFixed(4)} );`,"	return dot( weights, rgb );","}"].join(`
`)}function lm(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(_r).join(`
`)}function cm(e){const t=[];for(const n in e){const i=e[n];i!==!1&&t.push("#define "+n+" "+i)}return t.join(`
`)}function hm(e,t){const n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const s=e.getActiveAttrib(t,r),a=s.name;let o=1;s.type===e.FLOAT_MAT2&&(o=2),s.type===e.FLOAT_MAT3&&(o=3),s.type===e.FLOAT_MAT4&&(o=4),n[a]={type:s.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function _r(e){return e!==""}function Ll(e,t){const n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Dl(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var um=/^[ \t]*#include +<([\w\d./]+)>/gm;function Za(e){return e.replace(um,dm)}var fm=new Map;function dm(e,t){let n=je[t];if(n===void 0){const i=fm.get(t);if(i!==void 0)n=je[i],Le('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("Can not resolve #include <"+t+">")}return Za(n)}var pm=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Nl(e){return e.replace(pm,mm)}function mm(e,t,n,i){let r="";for(let s=parseInt(t);s<parseInt(n);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function Ul(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision==="highp"?t+=`
#define HIGH_PRECISION`:e.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:e.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var gm={1:"SHADOWMAP_TYPE_PCF",3:"SHADOWMAP_TYPE_VSM"};function vm(e){return gm[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var _m={301:"ENVMAP_TYPE_CUBE",302:"ENVMAP_TYPE_CUBE",306:"ENVMAP_TYPE_CUBE_UV"};function ym(e){return e.envMap===!1?"ENVMAP_TYPE_CUBE":_m[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var xm={302:"ENVMAP_MODE_REFRACTION"};function Mm(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":xm[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Sm={0:"ENVMAP_BLENDING_MULTIPLY",1:"ENVMAP_BLENDING_MIX",2:"ENVMAP_BLENDING_ADD"};function Tm(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":Sm[e.combine]||"ENVMAP_BLENDING_NONE"}function Em(e){const t=e.envMapCubeUVHeight;if(t===null)return null;const n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),112)),texelHeight:i,maxMip:n}}function bm(e,t,n,i){const r=e.getContext(),s=n.defines;let a=n.vertexShader,o=n.fragmentShader;const l=vm(n),c=ym(n),h=Mm(n),u=Tm(n),f=Em(n),d=lm(n),g=cm(s),v=r.createProgram();let p,m,y=n.glslVersion?"#version "+n.glslVersion+`
`:"";n.isRawShaderMaterial?(p=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(_r).join(`
`),p.length>0&&(p+=`
`),m=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(_r).join(`
`),m.length>0&&(m+=`
`)):(p=[Ul(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+h:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(_r).join(`
`),m=[Ul(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.envMap?"#define "+h:"",n.envMap?"#define "+u:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==0?"#define TONE_MAPPING":"",n.toneMapping!==0?je.tonemapping_pars_fragment:"",n.toneMapping!==0?am("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",je.colorspace_pars_fragment,rm("linearToOutputTexel",n.outputColorSpace),om(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(_r).join(`
`)),a=Za(a),a=Ll(a,n),a=Dl(a,n),o=Za(o),o=Ll(o,n),o=Dl(o,n),a=Nl(a),o=Nl(o),n.isRawShaderMaterial!==!0&&(y=`#version 300 es
`,p=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,m=["#define varying in",n.glslVersion==="300 es"?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion==="300 es"?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);const S=y+p+a,M=y+m+o,I=Cl(r,r.VERTEX_SHADER,S),w=Cl(r,r.FRAGMENT_SHADER,M);r.attachShader(v,I),r.attachShader(v,w),n.index0AttributeName!==void 0?r.bindAttribLocation(v,0,n.index0AttributeName):n.morphTargets===!0&&r.bindAttribLocation(v,0,"position"),r.linkProgram(v);function C(A){if(e.debug.checkShaderErrors){const O=r.getProgramInfoLog(v)||"",H=r.getShaderInfoLog(I)||"",k=r.getShaderInfoLog(w)||"",L=O.trim(),B=H.trim(),U=k.trim();let $=!0,j=!0;if(r.getProgramParameter(v,r.LINK_STATUS)===!1)if($=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(r,v,I,w);else{const J=Pl(r,I,"vertex"),re=Pl(r,w,"fragment");ke("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(v,r.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+L+`
`+J+`
`+re)}else L!==""?Le("WebGLProgram: Program Info Log:",L):(B===""||U==="")&&(j=!1);j&&(A.diagnostics={runnable:$,programLog:L,vertexShader:{log:B,prefix:p},fragmentShader:{log:U,prefix:m}})}r.deleteShader(I),r.deleteShader(w),_=new ws(r,v),b=hm(r,v)}let _;this.getUniforms=function(){return _===void 0&&C(this),_};let b;this.getAttributes=function(){return b===void 0&&C(this),b};let N=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return N===!1&&(N=r.getProgramParameter(v,em)),N},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(v),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=tm++,this.cacheKey=t,this.usedTimes=1,this.program=v,this.vertexShader=I,this.fragmentShader=w,this}var Am=0,wm=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,i=this._getShaderStage(t),r=this._getShaderStage(n),s=this._getShaderCacheForMaterial(e);return s.has(i)===!1&&(s.add(i),i.usedTimes++),s.has(r)===!1&&(s.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new Rm(e),t.set(e,n)),n}},Rm=class{constructor(e){this.id=Am++,this.code=e,this.usedTimes=0}};function Cm(e,t,n,i,r,s){const a=new ro,o=new wm,l=new Set,c=[],h=new Map,u=i.logarithmicDepthBuffer;let f=i.precision;const d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(_){return l.add(_),_===0?"uv":`uv${_}`}function v(_,b,N,A,O){const H=A.fog,k=O.geometry,L=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?A.environment:null,B=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,U=t.get(_.envMap||L,B),$=U&&U.mapping===306?U.image.height:null,j=d[_.type];_.precision!==null&&(f=i.getMaxPrecision(_.precision),f!==_.precision&&Le("WebGLProgram.getParameters:",_.precision,"not supported, using",f,"instead."));const J=k.morphAttributes.position||k.morphAttributes.normal||k.morphAttributes.color,re=J!==void 0?J.length:0;let Q=0;k.morphAttributes.position!==void 0&&(Q=1),k.morphAttributes.normal!==void 0&&(Q=2),k.morphAttributes.color!==void 0&&(Q=3);let pe,de,F,q;if(j){const ot=mn[j];pe=ot.vertexShader,de=ot.fragmentShader}else pe=_.vertexShader,de=_.fragmentShader,o.update(_),F=o.getVertexShaderID(_),q=o.getFragmentShaderID(_);const se=e.getRenderTarget(),ae=e.state.buffers.depth.getReversed(),Re=O.isInstancedMesh===!0,Oe=O.isBatchedMesh===!0,Ne=!!_.map,Je=!!_.matcap,Z=!!U,le=!!_.aoMap,ce=!!_.lightMap,Me=!!_.bumpMap,R=!!_.normalMap,ze=!!_.displacementMap,ve=!!_.emissiveMap,Ve=!!_.metalnessMap,me=!!_.roughnessMap,Xe=_.anisotropy>0,E=_.clearcoat>0,x=_.dispersion>0,V=_.iridescence>0,K=_.sheen>0,ne=_.transmission>0,Y=Xe&&!!_.anisotropyMap,Te=E&&!!_.clearcoatMap,_e=E&&!!_.clearcoatNormalMap,De=E&&!!_.clearcoatRoughnessMap,Fe=V&&!!_.iridescenceMap,ie=V&&!!_.iridescenceThicknessMap,he=K&&!!_.sheenColorMap,Ae=K&&!!_.sheenRoughnessMap,Ge=!!_.specularMap,Se=!!_.specularColorMap,Ze=!!_.specularIntensityMap,D=ne&&!!_.transmissionMap,ge=ne&&!!_.thicknessMap,ue=!!_.gradientMap,Pe=!!_.alphaMap,ee=_.alphaTest>0,te=!!_.alphaHash,Ce=!!_.extensions;let He=0;_.toneMapped&&(se===null||se.isXRRenderTarget===!0)&&(He=e.toneMapping);const Tt={shaderID:j,shaderType:_.type,shaderName:_.name,vertexShader:pe,fragmentShader:de,defines:_.defines,customVertexShaderID:F,customFragmentShaderID:q,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:f,batching:Oe,batchingColor:Oe&&O._colorsTexture!==null,instancing:Re,instancingColor:Re&&O.instanceColor!==null,instancingMorph:Re&&O.morphTexture!==null,outputColorSpace:se===null?e.outputColorSpace:se.isXRRenderTarget===!0?se.texture.colorSpace:qt,alphaToCoverage:!!_.alphaToCoverage,map:Ne,matcap:Je,envMap:Z,envMapMode:Z&&U.mapping,envMapCubeUVHeight:$,aoMap:le,lightMap:ce,bumpMap:Me,normalMap:R,displacementMap:ze,emissiveMap:ve,normalMapObjectSpace:R&&_.normalMapType===1,normalMapTangentSpace:R&&_.normalMapType===0,metalnessMap:Ve,roughnessMap:me,anisotropy:Xe,anisotropyMap:Y,clearcoat:E,clearcoatMap:Te,clearcoatNormalMap:_e,clearcoatRoughnessMap:De,dispersion:x,iridescence:V,iridescenceMap:Fe,iridescenceThicknessMap:ie,sheen:K,sheenColorMap:he,sheenRoughnessMap:Ae,specularMap:Ge,specularColorMap:Se,specularIntensityMap:Ze,transmission:ne,transmissionMap:D,thicknessMap:ge,gradientMap:ue,opaque:_.transparent===!1&&_.blending===1&&_.alphaToCoverage===!1,alphaMap:Pe,alphaTest:ee,alphaHash:te,combine:_.combine,mapUv:Ne&&g(_.map.channel),aoMapUv:le&&g(_.aoMap.channel),lightMapUv:ce&&g(_.lightMap.channel),bumpMapUv:Me&&g(_.bumpMap.channel),normalMapUv:R&&g(_.normalMap.channel),displacementMapUv:ze&&g(_.displacementMap.channel),emissiveMapUv:ve&&g(_.emissiveMap.channel),metalnessMapUv:Ve&&g(_.metalnessMap.channel),roughnessMapUv:me&&g(_.roughnessMap.channel),anisotropyMapUv:Y&&g(_.anisotropyMap.channel),clearcoatMapUv:Te&&g(_.clearcoatMap.channel),clearcoatNormalMapUv:_e&&g(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:De&&g(_.clearcoatRoughnessMap.channel),iridescenceMapUv:Fe&&g(_.iridescenceMap.channel),iridescenceThicknessMapUv:ie&&g(_.iridescenceThicknessMap.channel),sheenColorMapUv:he&&g(_.sheenColorMap.channel),sheenRoughnessMapUv:Ae&&g(_.sheenRoughnessMap.channel),specularMapUv:Ge&&g(_.specularMap.channel),specularColorMapUv:Se&&g(_.specularColorMap.channel),specularIntensityMapUv:Ze&&g(_.specularIntensityMap.channel),transmissionMapUv:D&&g(_.transmissionMap.channel),thicknessMapUv:ge&&g(_.thicknessMap.channel),alphaMapUv:Pe&&g(_.alphaMap.channel),vertexTangents:!!k.attributes.tangent&&(R||Xe),vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!k.attributes.color&&k.attributes.color.itemSize===4,pointsUvs:O.isPoints===!0&&!!k.attributes.uv&&(Ne||Pe),fog:!!H,useFog:_.fog===!0,fogExp2:!!H&&H.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||k.attributes.normal===void 0&&R===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:ae,skinning:O.isSkinnedMesh===!0,morphTargets:k.morphAttributes.position!==void 0,morphNormals:k.morphAttributes.normal!==void 0,morphColors:k.morphAttributes.color!==void 0,morphTargetsCount:re,morphTextureStride:Q,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:_.dithering,shadowMapEnabled:e.shadowMap.enabled&&N.length>0,shadowMapType:e.shadowMap.type,toneMapping:He,decodeVideoTexture:Ne&&_.map.isVideoTexture===!0&&qe.getTransfer(_.map.colorSpace)==="srgb",decodeVideoTextureEmissive:ve&&_.emissiveMap.isVideoTexture===!0&&qe.getTransfer(_.emissiveMap.colorSpace)==="srgb",premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===2,flipSided:_.side===1,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:Ce&&_.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ce&&_.extensions.multiDraw===!0||Oe)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return Tt.vertexUv1s=l.has(1),Tt.vertexUv2s=l.has(2),Tt.vertexUv3s=l.has(3),l.clear(),Tt}function p(_){const b=[];if(_.shaderID?b.push(_.shaderID):(b.push(_.customVertexShaderID),b.push(_.customFragmentShaderID)),_.defines!==void 0)for(const N in _.defines)b.push(N),b.push(_.defines[N]);return _.isRawShaderMaterial===!1&&(m(b,_),y(b,_),b.push(e.outputColorSpace)),b.push(_.customProgramCacheKey),b.join()}function m(_,b){_.push(b.precision),_.push(b.outputColorSpace),_.push(b.envMapMode),_.push(b.envMapCubeUVHeight),_.push(b.mapUv),_.push(b.alphaMapUv),_.push(b.lightMapUv),_.push(b.aoMapUv),_.push(b.bumpMapUv),_.push(b.normalMapUv),_.push(b.displacementMapUv),_.push(b.emissiveMapUv),_.push(b.metalnessMapUv),_.push(b.roughnessMapUv),_.push(b.anisotropyMapUv),_.push(b.clearcoatMapUv),_.push(b.clearcoatNormalMapUv),_.push(b.clearcoatRoughnessMapUv),_.push(b.iridescenceMapUv),_.push(b.iridescenceThicknessMapUv),_.push(b.sheenColorMapUv),_.push(b.sheenRoughnessMapUv),_.push(b.specularMapUv),_.push(b.specularColorMapUv),_.push(b.specularIntensityMapUv),_.push(b.transmissionMapUv),_.push(b.thicknessMapUv),_.push(b.combine),_.push(b.fogExp2),_.push(b.sizeAttenuation),_.push(b.morphTargetsCount),_.push(b.morphAttributeCount),_.push(b.numDirLights),_.push(b.numPointLights),_.push(b.numSpotLights),_.push(b.numSpotLightMaps),_.push(b.numHemiLights),_.push(b.numRectAreaLights),_.push(b.numDirLightShadows),_.push(b.numPointLightShadows),_.push(b.numSpotLightShadows),_.push(b.numSpotLightShadowsWithMaps),_.push(b.numLightProbes),_.push(b.shadowMapType),_.push(b.toneMapping),_.push(b.numClippingPlanes),_.push(b.numClipIntersection),_.push(b.depthPacking)}function y(_,b){a.disableAll(),b.instancing&&a.enable(0),b.instancingColor&&a.enable(1),b.instancingMorph&&a.enable(2),b.matcap&&a.enable(3),b.envMap&&a.enable(4),b.normalMapObjectSpace&&a.enable(5),b.normalMapTangentSpace&&a.enable(6),b.clearcoat&&a.enable(7),b.iridescence&&a.enable(8),b.alphaTest&&a.enable(9),b.vertexColors&&a.enable(10),b.vertexAlphas&&a.enable(11),b.vertexUv1s&&a.enable(12),b.vertexUv2s&&a.enable(13),b.vertexUv3s&&a.enable(14),b.vertexTangents&&a.enable(15),b.anisotropy&&a.enable(16),b.alphaHash&&a.enable(17),b.batching&&a.enable(18),b.dispersion&&a.enable(19),b.batchingColor&&a.enable(20),b.gradientMap&&a.enable(21),_.push(a.mask),a.disableAll(),b.fog&&a.enable(0),b.useFog&&a.enable(1),b.flatShading&&a.enable(2),b.logarithmicDepthBuffer&&a.enable(3),b.reversedDepthBuffer&&a.enable(4),b.skinning&&a.enable(5),b.morphTargets&&a.enable(6),b.morphNormals&&a.enable(7),b.morphColors&&a.enable(8),b.premultipliedAlpha&&a.enable(9),b.shadowMapEnabled&&a.enable(10),b.doubleSided&&a.enable(11),b.flipSided&&a.enable(12),b.useDepthPacking&&a.enable(13),b.dithering&&a.enable(14),b.transmission&&a.enable(15),b.sheen&&a.enable(16),b.opaque&&a.enable(17),b.pointsUvs&&a.enable(18),b.decodeVideoTexture&&a.enable(19),b.decodeVideoTextureEmissive&&a.enable(20),b.alphaToCoverage&&a.enable(21),_.push(a.mask)}function S(_){const b=d[_.type];let N;if(b){const A=mn[b];N=rd.clone(A.uniforms)}else N=_.uniforms;return N}function M(_,b){let N=h.get(b);return N!==void 0?++N.usedTimes:(N=new bm(e,b,_,r),c.push(N),h.set(b,N)),N}function I(_){if(--_.usedTimes===0){const b=c.indexOf(_);c[b]=c[c.length-1],c.pop(),h.delete(_.cacheKey),_.destroy()}}function w(_){o.remove(_)}function C(){o.dispose()}return{getParameters:v,getProgramCacheKey:p,getUniforms:S,acquireProgram:M,releaseProgram:I,releaseShaderCache:w,programs:c,dispose:C}}function Im(){let e=new WeakMap;function t(a){return e.has(a)}function n(a){let o=e.get(a);return o===void 0&&(o={},e.set(a,o)),o}function i(a){e.delete(a)}function r(a,o,l){e.get(a)[o]=l}function s(){e=new WeakMap}return{has:t,get:n,remove:i,update:r,dispose:s}}function Pm(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.material.id!==t.material.id?e.material.id-t.material.id:e.materialVariant!==t.materialVariant?e.materialVariant-t.materialVariant:e.z!==t.z?e.z-t.z:e.id-t.id}function Ol(e,t){return e.groupOrder!==t.groupOrder?e.groupOrder-t.groupOrder:e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.z!==t.z?t.z-e.z:e.id-t.id}function Fl(){const e=[];let t=0;const n=[],i=[],r=[];function s(){t=0,n.length=0,i.length=0,r.length=0}function a(f){let d=0;return f.isInstancedMesh&&(d+=2),f.isSkinnedMesh&&(d+=1),d}function o(f,d,g,v,p,m){let y=e[t];return y===void 0?(y={id:f.id,object:f,geometry:d,material:g,materialVariant:a(f),groupOrder:v,renderOrder:f.renderOrder,z:p,group:m},e[t]=y):(y.id=f.id,y.object=f,y.geometry=d,y.material=g,y.materialVariant=a(f),y.groupOrder=v,y.renderOrder=f.renderOrder,y.z=p,y.group=m),t++,y}function l(f,d,g,v,p,m){const y=o(f,d,g,v,p,m);g.transmission>0?i.push(y):g.transparent===!0?r.push(y):n.push(y)}function c(f,d,g,v,p,m){const y=o(f,d,g,v,p,m);g.transmission>0?i.unshift(y):g.transparent===!0?r.unshift(y):n.unshift(y)}function h(f,d){n.length>1&&n.sort(f||Pm),i.length>1&&i.sort(d||Ol),r.length>1&&r.sort(d||Ol)}function u(){for(let f=t,d=e.length;f<d;f++){const g=e[f];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:n,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:u,sort:h}}function Lm(){let e=new WeakMap;function t(i,r){const s=e.get(i);let a;return s===void 0?(a=new Fl,e.set(i,[a])):r>=s.length?(a=new Fl,s.push(a)):a=s[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}function Dm(){const e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={direction:new P,color:new Ee};break;case"SpotLight":n={position:new P,direction:new P,color:new Ee,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new P,color:new Ee,distance:0,decay:0};break;case"HemisphereLight":n={direction:new P,skyColor:new Ee,groundColor:new Ee};break;case"RectAreaLight":n={color:new Ee,position:new P,halfWidth:new P,halfHeight:new P};break}return e[t.id]=n,n}}}function Nm(){const e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new oe};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new oe};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new oe,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var Um=0;function Om(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function Fm(e){const t=new Dm,n=Nm(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new P);const r=new P,s=new Ie,a=new Ie;function o(c){let h=0,u=0,f=0;for(let b=0;b<9;b++)i.probe[b].set(0,0,0);let d=0,g=0,v=0,p=0,m=0,y=0,S=0,M=0,I=0,w=0,C=0;c.sort(Om);for(let b=0,N=c.length;b<N;b++){const A=c[b],O=A.color,H=A.intensity,k=A.distance;let L=null;if(A.shadow&&A.shadow.map&&(A.shadow.map.texture.format===1030?L=A.shadow.map.texture:L=A.shadow.map.depthTexture||A.shadow.map.texture),A.isAmbientLight)h+=O.r*H,u+=O.g*H,f+=O.b*H;else if(A.isLightProbe){for(let B=0;B<9;B++)i.probe[B].addScaledVector(A.sh.coefficients[B],H);C++}else if(A.isDirectionalLight){const B=t.get(A);if(B.color.copy(A.color).multiplyScalar(A.intensity),A.castShadow){const U=A.shadow,$=n.get(A);$.shadowIntensity=U.intensity,$.shadowBias=U.bias,$.shadowNormalBias=U.normalBias,$.shadowRadius=U.radius,$.shadowMapSize=U.mapSize,i.directionalShadow[d]=$,i.directionalShadowMap[d]=L,i.directionalShadowMatrix[d]=A.shadow.matrix,y++}i.directional[d]=B,d++}else if(A.isSpotLight){const B=t.get(A);B.position.setFromMatrixPosition(A.matrixWorld),B.color.copy(O).multiplyScalar(H),B.distance=k,B.coneCos=Math.cos(A.angle),B.penumbraCos=Math.cos(A.angle*(1-A.penumbra)),B.decay=A.decay,i.spot[v]=B;const U=A.shadow;if(A.map&&(i.spotLightMap[I]=A.map,I++,U.updateMatrices(A),A.castShadow&&w++),i.spotLightMatrix[v]=U.matrix,A.castShadow){const $=n.get(A);$.shadowIntensity=U.intensity,$.shadowBias=U.bias,$.shadowNormalBias=U.normalBias,$.shadowRadius=U.radius,$.shadowMapSize=U.mapSize,i.spotShadow[v]=$,i.spotShadowMap[v]=L,M++}v++}else if(A.isRectAreaLight){const B=t.get(A);B.color.copy(O).multiplyScalar(H),B.halfWidth.set(A.width*.5,0,0),B.halfHeight.set(0,A.height*.5,0),i.rectArea[p]=B,p++}else if(A.isPointLight){const B=t.get(A);if(B.color.copy(A.color).multiplyScalar(A.intensity),B.distance=A.distance,B.decay=A.decay,A.castShadow){const U=A.shadow,$=n.get(A);$.shadowIntensity=U.intensity,$.shadowBias=U.bias,$.shadowNormalBias=U.normalBias,$.shadowRadius=U.radius,$.shadowMapSize=U.mapSize,$.shadowCameraNear=U.camera.near,$.shadowCameraFar=U.camera.far,i.pointShadow[g]=$,i.pointShadowMap[g]=L,i.pointShadowMatrix[g]=A.shadow.matrix,S++}i.point[g]=B,g++}else if(A.isHemisphereLight){const B=t.get(A);B.skyColor.copy(A.color).multiplyScalar(H),B.groundColor.copy(A.groundColor).multiplyScalar(H),i.hemi[m]=B,m++}}p>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ye.LTC_FLOAT_1,i.rectAreaLTC2=ye.LTC_FLOAT_2):(i.rectAreaLTC1=ye.LTC_HALF_1,i.rectAreaLTC2=ye.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=u,i.ambient[2]=f;const _=i.hash;(_.directionalLength!==d||_.pointLength!==g||_.spotLength!==v||_.rectAreaLength!==p||_.hemiLength!==m||_.numDirectionalShadows!==y||_.numPointShadows!==S||_.numSpotShadows!==M||_.numSpotMaps!==I||_.numLightProbes!==C)&&(i.directional.length=d,i.spot.length=v,i.rectArea.length=p,i.point.length=g,i.hemi.length=m,i.directionalShadow.length=y,i.directionalShadowMap.length=y,i.pointShadow.length=S,i.pointShadowMap.length=S,i.spotShadow.length=M,i.spotShadowMap.length=M,i.directionalShadowMatrix.length=y,i.pointShadowMatrix.length=S,i.spotLightMatrix.length=M+I-w,i.spotLightMap.length=I,i.numSpotLightShadowsWithMaps=w,i.numLightProbes=C,_.directionalLength=d,_.pointLength=g,_.spotLength=v,_.rectAreaLength=p,_.hemiLength=m,_.numDirectionalShadows=y,_.numPointShadows=S,_.numSpotShadows=M,_.numSpotMaps=I,_.numLightProbes=C,i.version=Um++)}function l(c,h){let u=0,f=0,d=0,g=0,v=0;const p=h.matrixWorldInverse;for(let m=0,y=c.length;m<y;m++){const S=c[m];if(S.isDirectionalLight){const M=i.directional[u];M.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),M.direction.sub(r),M.direction.transformDirection(p),u++}else if(S.isSpotLight){const M=i.spot[d];M.position.setFromMatrixPosition(S.matrixWorld),M.position.applyMatrix4(p),M.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),M.direction.sub(r),M.direction.transformDirection(p),d++}else if(S.isRectAreaLight){const M=i.rectArea[g];M.position.setFromMatrixPosition(S.matrixWorld),M.position.applyMatrix4(p),a.identity(),s.copy(S.matrixWorld),s.premultiply(p),a.extractRotation(s),M.halfWidth.set(S.width*.5,0,0),M.halfHeight.set(0,S.height*.5,0),M.halfWidth.applyMatrix4(a),M.halfHeight.applyMatrix4(a),g++}else if(S.isPointLight){const M=i.point[f];M.position.setFromMatrixPosition(S.matrixWorld),M.position.applyMatrix4(p),f++}else if(S.isHemisphereLight){const M=i.hemi[v];M.direction.setFromMatrixPosition(S.matrixWorld),M.direction.transformDirection(p),v++}}}return{setup:o,setupView:l,state:i}}function Bl(e){const t=new Fm(e),n=[],i=[];function r(h){c.camera=h,n.length=0,i.length=0}function s(h){n.push(h)}function a(h){i.push(h)}function o(){t.setup(n)}function l(h){t.setupView(n,h)}const c={lightsArray:n,shadowsArray:i,camera:null,lights:t,transmissionRenderTarget:{}};return{init:r,state:c,setupLights:o,setupLightsView:l,pushLight:s,pushShadow:a}}function Bm(e){let t=new WeakMap;function n(r,s=0){const a=t.get(r);let o;return a===void 0?(o=new Bl(e),t.set(r,[o])):s>=a.length?(o=new Bl(e),a.push(o)):o=a[s],o}function i(){t=new WeakMap}return{get:n,dispose:i}}var km=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,zm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Vm=[new P(1,0,0),new P(-1,0,0),new P(0,1,0),new P(0,-1,0),new P(0,0,1),new P(0,0,-1)],Gm=[new P(0,-1,0),new P(0,-1,0),new P(0,0,1),new P(0,0,-1),new P(0,-1,0),new P(0,-1,0)],kl=new Ie,pr=new P,La=new P;function Hm(e,t,n){let i=new ao;const r=new oe,s=new oe,a=new ct,o=new cd,l=new hd,c={},h=n.maxTextureSize,u={0:1,1:0,2:2},f=new _n({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new oe},radius:{value:4}},vertexShader:km,fragmentShader:zm}),d=f.clone();d.defines.HORIZONTAL_PASS=1;const g=new dt;g.setAttribute("position",new wt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new Pt(g,f),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let m=this.type;this.render=function(w,C,_){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||w.length===0)return;this.type===2&&(Le("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=1);const b=e.getRenderTarget(),N=e.getActiveCubeFace(),A=e.getActiveMipmapLevel(),O=e.state;O.setBlending(0),O.buffers.depth.getReversed()===!0?O.buffers.color.setClear(0,0,0,0):O.buffers.color.setClear(1,1,1,1),O.buffers.depth.setTest(!0),O.setScissorTest(!1);const H=m!==this.type;H&&C.traverse(function(k){k.material&&(Array.isArray(k.material)?k.material.forEach(L=>L.needsUpdate=!0):k.material.needsUpdate=!0)});for(let k=0,L=w.length;k<L;k++){const B=w[k],U=B.shadow;if(U===void 0){Le("WebGLShadowMap:",B,"has no shadow.");continue}if(U.autoUpdate===!1&&U.needsUpdate===!1)continue;r.copy(U.mapSize);const $=U.getFrameExtents();r.multiply($),s.copy(U.mapSize),(r.x>h||r.y>h)&&(r.x>h&&(s.x=Math.floor(h/$.x),r.x=s.x*$.x,U.mapSize.x=s.x),r.y>h&&(s.y=Math.floor(h/$.y),r.y=s.y*$.y,U.mapSize.y=s.y));const j=e.state.buffers.depth.getReversed();if(U.camera._reversedDepth=j,U.map===null||H===!0){if(U.map!==null&&(U.map.depthTexture!==null&&(U.map.depthTexture.dispose(),U.map.depthTexture=null),U.map.dispose()),this.type===3){if(B.isPointLight){Le("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}U.map=new vn(r.x,r.y,{format:Cs,type:si,minFilter:It,magFilter:It,generateMipmaps:!1}),U.map.texture.name=B.name+".shadowMap",U.map.depthTexture=new wr(r.x,r.y,Ji),U.map.depthTexture.name=B.name+".shadowMapDepth",U.map.depthTexture.format=Tr,U.map.depthTexture.compareFunction=null,U.map.depthTexture.minFilter=Ot,U.map.depthTexture.magFilter=Ot}else B.isPointLight?(U.map=new sh(r.x),U.map.depthTexture=new xf(r.x,ri)):(U.map=new vn(r.x,r.y),U.map.depthTexture=new wr(r.x,r.y,ri)),U.map.depthTexture.name=B.name+".shadowMap",U.map.depthTexture.format=Tr,this.type===1?(U.map.depthTexture.compareFunction=j?518:515,U.map.depthTexture.minFilter=It,U.map.depthTexture.magFilter=It):(U.map.depthTexture.compareFunction=null,U.map.depthTexture.minFilter=Ot,U.map.depthTexture.magFilter=Ot);U.camera.updateProjectionMatrix()}const J=U.map.isWebGLCubeRenderTarget?6:1;for(let re=0;re<J;re++){if(U.map.isWebGLCubeRenderTarget)e.setRenderTarget(U.map,re),e.clear();else{re===0&&(e.setRenderTarget(U.map),e.clear());const Q=U.getViewport(re);a.set(s.x*Q.x,s.y*Q.y,s.x*Q.z,s.y*Q.w),O.viewport(a)}if(B.isPointLight){const Q=U.camera,pe=U.matrix,de=B.distance||Q.far;de!==Q.far&&(Q.far=de,Q.updateProjectionMatrix()),pr.setFromMatrixPosition(B.matrixWorld),Q.position.copy(pr),La.copy(Q.position),La.add(Vm[re]),Q.up.copy(Gm[re]),Q.lookAt(La),Q.updateMatrixWorld(),pe.makeTranslation(-pr.x,-pr.y,-pr.z),kl.multiplyMatrices(Q.projectionMatrix,Q.matrixWorldInverse),U._frustum.setFromProjectionMatrix(kl,Q.coordinateSystem,Q.reversedDepth)}else U.updateMatrices(B);i=U.getFrustum(),M(C,_,U.camera,B,this.type)}U.isPointLightShadow!==!0&&this.type===3&&y(U,_),U.needsUpdate=!1}m=this.type,p.needsUpdate=!1,e.setRenderTarget(b,N,A)};function y(w,C){const _=t.update(v);f.defines.VSM_SAMPLES!==w.blurSamples&&(f.defines.VSM_SAMPLES=w.blurSamples,d.defines.VSM_SAMPLES=w.blurSamples,f.needsUpdate=!0,d.needsUpdate=!0),w.mapPass===null&&(w.mapPass=new vn(r.x,r.y,{format:Cs,type:si})),f.uniforms.shadow_pass.value=w.map.depthTexture,f.uniforms.resolution.value=w.mapSize,f.uniforms.radius.value=w.radius,e.setRenderTarget(w.mapPass),e.clear(),e.renderBufferDirect(C,null,_,f,v,null),d.uniforms.shadow_pass.value=w.mapPass.texture,d.uniforms.resolution.value=w.mapSize,d.uniforms.radius.value=w.radius,e.setRenderTarget(w.map),e.clear(),e.renderBufferDirect(C,null,_,d,v,null)}function S(w,C,_,b){let N=null;const A=_.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(A!==void 0)N=A;else if(N=_.isPointLight===!0?l:o,e.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){const O=N.uuid,H=C.uuid;let k=c[O];k===void 0&&(k={},c[O]=k);let L=k[H];L===void 0&&(L=N.clone(),k[H]=L,C.addEventListener("dispose",I)),N=L}if(N.visible=C.visible,N.wireframe=C.wireframe,b===3?N.side=C.shadowSide!==null?C.shadowSide:C.side:N.side=C.shadowSide!==null?C.shadowSide:u[C.side],N.alphaMap=C.alphaMap,N.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,N.map=C.map,N.clipShadows=C.clipShadows,N.clippingPlanes=C.clippingPlanes,N.clipIntersection=C.clipIntersection,N.displacementMap=C.displacementMap,N.displacementScale=C.displacementScale,N.displacementBias=C.displacementBias,N.wireframeLinewidth=C.wireframeLinewidth,N.linewidth=C.linewidth,_.isPointLight===!0&&N.isMeshDistanceMaterial===!0){const O=e.properties.get(N);O.light=_}return N}function M(w,C,_,b,N){if(w.visible===!1)return;if(w.layers.test(C.layers)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&N===3)&&(!w.frustumCulled||i.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,w.matrixWorld);const O=t.update(w),H=w.material;if(Array.isArray(H)){const k=O.groups;for(let L=0,B=k.length;L<B;L++){const U=k[L],$=H[U.materialIndex];if($&&$.visible){const j=S(w,$,b,N);w.onBeforeShadow(e,w,C,_,O,j,U),e.renderBufferDirect(_,null,O,j,w,U),w.onAfterShadow(e,w,C,_,O,j,U)}}}else if(H.visible){const k=S(w,H,b,N);w.onBeforeShadow(e,w,C,_,O,k,null),e.renderBufferDirect(_,null,O,k,w,null),w.onAfterShadow(e,w,C,_,O,k,null)}}const A=w.children;for(let O=0,H=A.length;O<H;O++)M(A[O],C,_,b,N)}function I(w){w.target.removeEventListener("dispose",I);for(const C in c){const _=c[C],b=w.target.uuid;b in _&&(_[b].dispose(),delete _[b])}}}function Wm(e,t){function n(){let D=!1;const ge=new ct;let ue=null;const Pe=new ct(0,0,0,0);return{setMask:function(ee){ue!==ee&&!D&&(e.colorMask(ee,ee,ee,ee),ue=ee)},setLocked:function(ee){D=ee},setClear:function(ee,te,Ce,He,Tt){Tt===!0&&(ee*=He,te*=He,Ce*=He),ge.set(ee,te,Ce,He),Pe.equals(ge)===!1&&(e.clearColor(ee,te,Ce,He),Pe.copy(ge))},reset:function(){D=!1,ue=null,Pe.set(-1,0,0,0)}}}function i(){let D=!1,ge=!1,ue=null,Pe=null,ee=null;return{setReversed:function(te){if(ge!==te){const Ce=t.get("EXT_clip_control");te?Ce.clipControlEXT(Ce.LOWER_LEFT_EXT,Ce.ZERO_TO_ONE_EXT):Ce.clipControlEXT(Ce.LOWER_LEFT_EXT,Ce.NEGATIVE_ONE_TO_ONE_EXT),ge=te;const He=ee;ee=null,this.setClear(He)}},getReversed:function(){return ge},setTest:function(te){te?se(e.DEPTH_TEST):ae(e.DEPTH_TEST)},setMask:function(te){ue!==te&&!D&&(e.depthMask(te),ue=te)},setFunc:function(te){if(ge&&(te=Cu[te]),Pe!==te){switch(te){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}Pe=te}},setLocked:function(te){D=te},setClear:function(te){ee!==te&&(ee=te,ge&&(te=1-te),e.clearDepth(te))},reset:function(){D=!1,ue=null,Pe=null,ee=null,ge=!1}}}function r(){let D=!1,ge=null,ue=null,Pe=null,ee=null,te=null,Ce=null,He=null,Tt=null;return{setTest:function(ot){D||(ot?se(e.STENCIL_TEST):ae(e.STENCIL_TEST))},setMask:function(ot){ge!==ot&&!D&&(e.stencilMask(ot),ge=ot)},setFunc:function(ot,Mn,hn){(ue!==ot||Pe!==Mn||ee!==hn)&&(e.stencilFunc(ot,Mn,hn),ue=ot,Pe=Mn,ee=hn)},setOp:function(ot,Mn,hn){(te!==ot||Ce!==Mn||He!==hn)&&(e.stencilOp(ot,Mn,hn),te=ot,Ce=Mn,He=hn)},setLocked:function(ot){D=ot},setClear:function(ot){Tt!==ot&&(e.clearStencil(ot),Tt=ot)},reset:function(){D=!1,ge=null,ue=null,Pe=null,ee=null,te=null,Ce=null,He=null,Tt=null}}}const s=new n,a=new i,o=new r,l=new WeakMap,c=new WeakMap;let h={},u={},f=new WeakMap,d=[],g=null,v=!1,p=null,m=null,y=null,S=null,M=null,I=null,w=null,C=new Ee(0,0,0),_=0,b=!1,N=null,A=null,O=null,H=null,k=null;const L=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let B=!1,U=0;const $=e.getParameter(e.VERSION);$.indexOf("WebGL")!==-1?(U=parseFloat(/^WebGL (\d)/.exec($)[1]),B=U>=1):$.indexOf("OpenGL ES")!==-1&&(U=parseFloat(/^OpenGL ES (\d)/.exec($)[1]),B=U>=2);let j=null,J={};const re=e.getParameter(e.SCISSOR_BOX),Q=e.getParameter(e.VIEWPORT),pe=new ct().fromArray(re),de=new ct().fromArray(Q);function F(D,ge,ue,Pe){const ee=new Uint8Array(4),te=e.createTexture();e.bindTexture(D,te),e.texParameteri(D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(D,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let Ce=0;Ce<ue;Ce++)D===e.TEXTURE_3D||D===e.TEXTURE_2D_ARRAY?e.texImage3D(ge,0,e.RGBA,1,1,Pe,0,e.RGBA,e.UNSIGNED_BYTE,ee):e.texImage2D(ge+Ce,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,ee);return te}const q={};q[e.TEXTURE_2D]=F(e.TEXTURE_2D,e.TEXTURE_2D,1),q[e.TEXTURE_CUBE_MAP]=F(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),q[e.TEXTURE_2D_ARRAY]=F(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),q[e.TEXTURE_3D]=F(e.TEXTURE_3D,e.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),se(e.DEPTH_TEST),a.setFunc(3),Me(!1),R(1),se(e.CULL_FACE),le(0);function se(D){h[D]!==!0&&(e.enable(D),h[D]=!0)}function ae(D){h[D]!==!1&&(e.disable(D),h[D]=!1)}function Re(D,ge){return u[D]!==ge?(e.bindFramebuffer(D,ge),u[D]=ge,D===e.DRAW_FRAMEBUFFER&&(u[e.FRAMEBUFFER]=ge),D===e.FRAMEBUFFER&&(u[e.DRAW_FRAMEBUFFER]=ge),!0):!1}function Oe(D,ge){let ue=d,Pe=!1;if(D){ue=f.get(ge),ue===void 0&&(ue=[],f.set(ge,ue));const ee=D.textures;if(ue.length!==ee.length||ue[0]!==e.COLOR_ATTACHMENT0){for(let te=0,Ce=ee.length;te<Ce;te++)ue[te]=e.COLOR_ATTACHMENT0+te;ue.length=ee.length,Pe=!0}}else ue[0]!==e.BACK&&(ue[0]=e.BACK,Pe=!0);Pe&&e.drawBuffers(ue)}function Ne(D){return g!==D?(e.useProgram(D),g=D,!0):!1}const Je={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};Je[103]=e.MIN,Je[104]=e.MAX;const Z={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function le(D,ge,ue,Pe,ee,te,Ce,He,Tt,ot){if(D===0){v===!0&&(ae(e.BLEND),v=!1);return}if(v===!1&&(se(e.BLEND),v=!0),D!==5){if(D!==p||ot!==b){if((m!==100||M!==100)&&(e.blendEquation(e.FUNC_ADD),m=100,M=100),ot)switch(D){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:ke("WebGLState: Invalid blending: ",D);break}else switch(D){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:ke("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case 4:ke("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:ke("WebGLState: Invalid blending: ",D);break}y=null,S=null,I=null,w=null,C.set(0,0,0),_=0,p=D,b=ot}return}ee=ee||ge,te=te||ue,Ce=Ce||Pe,(ge!==m||ee!==M)&&(e.blendEquationSeparate(Je[ge],Je[ee]),m=ge,M=ee),(ue!==y||Pe!==S||te!==I||Ce!==w)&&(e.blendFuncSeparate(Z[ue],Z[Pe],Z[te],Z[Ce]),y=ue,S=Pe,I=te,w=Ce),(He.equals(C)===!1||Tt!==_)&&(e.blendColor(He.r,He.g,He.b,Tt),C.copy(He),_=Tt),p=D,b=!1}function ce(D,ge){D.side===2?ae(e.CULL_FACE):se(e.CULL_FACE);let ue=D.side===1;ge&&(ue=!ue),Me(ue),D.blending===1&&D.transparent===!1?le(0):le(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),a.setFunc(D.depthFunc),a.setTest(D.depthTest),a.setMask(D.depthWrite),s.setMask(D.colorWrite);const Pe=D.stencilWrite;o.setTest(Pe),Pe&&(o.setMask(D.stencilWriteMask),o.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),o.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),ve(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?se(e.SAMPLE_ALPHA_TO_COVERAGE):ae(e.SAMPLE_ALPHA_TO_COVERAGE)}function Me(D){N!==D&&(D?e.frontFace(e.CW):e.frontFace(e.CCW),N=D)}function R(D){D!==0?(se(e.CULL_FACE),D!==A&&(D===1?e.cullFace(e.BACK):D===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):ae(e.CULL_FACE),A=D}function ze(D){D!==O&&(B&&e.lineWidth(D),O=D)}function ve(D,ge,ue){D?(se(e.POLYGON_OFFSET_FILL),(H!==ge||k!==ue)&&(H=ge,k=ue,a.getReversed()&&(ge=-ge),e.polygonOffset(ge,ue))):ae(e.POLYGON_OFFSET_FILL)}function Ve(D){D?se(e.SCISSOR_TEST):ae(e.SCISSOR_TEST)}function me(D){D===void 0&&(D=e.TEXTURE0+L-1),j!==D&&(e.activeTexture(D),j=D)}function Xe(D,ge,ue){ue===void 0&&(j===null?ue=e.TEXTURE0+L-1:ue=j);let Pe=J[ue];Pe===void 0&&(Pe={type:void 0,texture:void 0},J[ue]=Pe),(Pe.type!==D||Pe.texture!==ge)&&(j!==ue&&(e.activeTexture(ue),j=ue),e.bindTexture(D,ge||q[D]),Pe.type=D,Pe.texture=ge)}function E(){const D=J[j];D!==void 0&&D.type!==void 0&&(e.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function x(){try{e.compressedTexImage2D(...arguments)}catch(D){ke("WebGLState:",D)}}function V(){try{e.compressedTexImage3D(...arguments)}catch(D){ke("WebGLState:",D)}}function K(){try{e.texSubImage2D(...arguments)}catch(D){ke("WebGLState:",D)}}function ne(){try{e.texSubImage3D(...arguments)}catch(D){ke("WebGLState:",D)}}function Y(){try{e.compressedTexSubImage2D(...arguments)}catch(D){ke("WebGLState:",D)}}function Te(){try{e.compressedTexSubImage3D(...arguments)}catch(D){ke("WebGLState:",D)}}function _e(){try{e.texStorage2D(...arguments)}catch(D){ke("WebGLState:",D)}}function De(){try{e.texStorage3D(...arguments)}catch(D){ke("WebGLState:",D)}}function Fe(){try{e.texImage2D(...arguments)}catch(D){ke("WebGLState:",D)}}function ie(){try{e.texImage3D(...arguments)}catch(D){ke("WebGLState:",D)}}function he(D){pe.equals(D)===!1&&(e.scissor(D.x,D.y,D.z,D.w),pe.copy(D))}function Ae(D){de.equals(D)===!1&&(e.viewport(D.x,D.y,D.z,D.w),de.copy(D))}function Ge(D,ge){let ue=c.get(ge);ue===void 0&&(ue=new WeakMap,c.set(ge,ue));let Pe=ue.get(D);Pe===void 0&&(Pe=e.getUniformBlockIndex(ge,D.name),ue.set(D,Pe))}function Se(D,ge){const ue=c.get(ge).get(D);l.get(ge)!==ue&&(e.uniformBlockBinding(ge,ue,D.__bindingPointIndex),l.set(ge,ue))}function Ze(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),a.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),h={},j=null,J={},u={},f=new WeakMap,d=[],g=null,v=!1,p=null,m=null,y=null,S=null,M=null,I=null,w=null,C=new Ee(0,0,0),_=0,b=!1,N=null,A=null,O=null,H=null,k=null,pe.set(0,0,e.canvas.width,e.canvas.height),de.set(0,0,e.canvas.width,e.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:se,disable:ae,bindFramebuffer:Re,drawBuffers:Oe,useProgram:Ne,setBlending:le,setMaterial:ce,setFlipSided:Me,setCullFace:R,setLineWidth:ze,setPolygonOffset:ve,setScissorTest:Ve,activeTexture:me,bindTexture:Xe,unbindTexture:E,compressedTexImage2D:x,compressedTexImage3D:V,texImage2D:Fe,texImage3D:ie,updateUBOMapping:Ge,uniformBlockBinding:Se,texStorage2D:_e,texStorage3D:De,texSubImage2D:K,texSubImage3D:ne,compressedTexSubImage2D:Y,compressedTexSubImage3D:Te,scissor:he,viewport:Ae,reset:Ze}}function Xm(e,t,n,i,r,s,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new oe,h=new WeakMap;let u;const f=new WeakMap;let d=!1;try{d=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(E,x){return d?new OffscreenCanvas(E,x):Ar("canvas")}function v(E,x,V){let K=1;const ne=Xe(E);if((ne.width>V||ne.height>V)&&(K=V/Math.max(ne.width,ne.height)),K<1)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap||typeof VideoFrame<"u"&&E instanceof VideoFrame){const Y=Math.floor(K*ne.width),Te=Math.floor(K*ne.height);u===void 0&&(u=g(Y,Te));const _e=x?g(Y,Te):u;return _e.width=Y,_e.height=Te,_e.getContext("2d").drawImage(E,0,0,Y,Te),Le("WebGLRenderer: Texture has been resized from ("+ne.width+"x"+ne.height+") to ("+Y+"x"+Te+")."),_e}else return"data"in E&&Le("WebGLRenderer: Image in DataTexture is too big ("+ne.width+"x"+ne.height+")."),E;return E}function p(E){return E.generateMipmaps}function m(E){e.generateMipmap(E)}function y(E){return E.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:E.isWebGL3DRenderTarget?e.TEXTURE_3D:E.isWebGLArrayRenderTarget||E.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function S(E,x,V,K,ne=!1){if(E!==null){if(e[E]!==void 0)return e[E];Le("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let Y=x;if(x===e.RED&&(V===e.FLOAT&&(Y=e.R32F),V===e.HALF_FLOAT&&(Y=e.R16F),V===e.UNSIGNED_BYTE&&(Y=e.R8)),x===e.RED_INTEGER&&(V===e.UNSIGNED_BYTE&&(Y=e.R8UI),V===e.UNSIGNED_SHORT&&(Y=e.R16UI),V===e.UNSIGNED_INT&&(Y=e.R32UI),V===e.BYTE&&(Y=e.R8I),V===e.SHORT&&(Y=e.R16I),V===e.INT&&(Y=e.R32I)),x===e.RG&&(V===e.FLOAT&&(Y=e.RG32F),V===e.HALF_FLOAT&&(Y=e.RG16F),V===e.UNSIGNED_BYTE&&(Y=e.RG8)),x===e.RG_INTEGER&&(V===e.UNSIGNED_BYTE&&(Y=e.RG8UI),V===e.UNSIGNED_SHORT&&(Y=e.RG16UI),V===e.UNSIGNED_INT&&(Y=e.RG32UI),V===e.BYTE&&(Y=e.RG8I),V===e.SHORT&&(Y=e.RG16I),V===e.INT&&(Y=e.RG32I)),x===e.RGB_INTEGER&&(V===e.UNSIGNED_BYTE&&(Y=e.RGB8UI),V===e.UNSIGNED_SHORT&&(Y=e.RGB16UI),V===e.UNSIGNED_INT&&(Y=e.RGB32UI),V===e.BYTE&&(Y=e.RGB8I),V===e.SHORT&&(Y=e.RGB16I),V===e.INT&&(Y=e.RGB32I)),x===e.RGBA_INTEGER&&(V===e.UNSIGNED_BYTE&&(Y=e.RGBA8UI),V===e.UNSIGNED_SHORT&&(Y=e.RGBA16UI),V===e.UNSIGNED_INT&&(Y=e.RGBA32UI),V===e.BYTE&&(Y=e.RGBA8I),V===e.SHORT&&(Y=e.RGBA16I),V===e.INT&&(Y=e.RGBA32I)),x===e.RGB&&(V===e.UNSIGNED_INT_5_9_9_9_REV&&(Y=e.RGB9_E5),V===e.UNSIGNED_INT_10F_11F_11F_REV&&(Y=e.R11F_G11F_B10F)),x===e.RGBA){const Te=ne?Ps:qe.getTransfer(K);V===e.FLOAT&&(Y=e.RGBA32F),V===e.HALF_FLOAT&&(Y=e.RGBA16F),V===e.UNSIGNED_BYTE&&(Y=Te==="srgb"?e.SRGB8_ALPHA8:e.RGBA8),V===e.UNSIGNED_SHORT_4_4_4_4&&(Y=e.RGBA4),V===e.UNSIGNED_SHORT_5_5_5_1&&(Y=e.RGB5_A1)}return(Y===e.R16F||Y===e.R32F||Y===e.RG16F||Y===e.RG32F||Y===e.RGBA16F||Y===e.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function M(E,x){let V;return E?x===null||x===1014||x===1020?V=e.DEPTH24_STENCIL8:x===1015?V=e.DEPTH32F_STENCIL8:x===1012&&(V=e.DEPTH24_STENCIL8,Le("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===1014||x===1020?V=e.DEPTH_COMPONENT24:x===1015?V=e.DEPTH_COMPONENT32F:x===1012&&(V=e.DEPTH_COMPONENT16),V}function I(E,x){return p(E)===!0||E.isFramebufferTexture&&E.minFilter!==1003&&E.minFilter!==1006?Math.log2(Math.max(x.width,x.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?x.mipmaps.length:1}function w(E){const x=E.target;x.removeEventListener("dispose",w),_(x),x.isVideoTexture&&h.delete(x)}function C(E){const x=E.target;x.removeEventListener("dispose",C),N(x)}function _(E){const x=i.get(E);if(x.__webglInit===void 0)return;const V=E.source,K=f.get(V);if(K){const ne=K[x.__cacheKey];ne.usedTimes--,ne.usedTimes===0&&b(E),Object.keys(K).length===0&&f.delete(V)}i.remove(E)}function b(E){const x=i.get(E);e.deleteTexture(x.__webglTexture);const V=E.source,K=f.get(V);delete K[x.__cacheKey],a.memory.textures--}function N(E){const x=i.get(E);if(E.depthTexture&&(E.depthTexture.dispose(),i.remove(E.depthTexture)),E.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(x.__webglFramebuffer[K]))for(let ne=0;ne<x.__webglFramebuffer[K].length;ne++)e.deleteFramebuffer(x.__webglFramebuffer[K][ne]);else e.deleteFramebuffer(x.__webglFramebuffer[K]);x.__webglDepthbuffer&&e.deleteRenderbuffer(x.__webglDepthbuffer[K])}else{if(Array.isArray(x.__webglFramebuffer))for(let K=0;K<x.__webglFramebuffer.length;K++)e.deleteFramebuffer(x.__webglFramebuffer[K]);else e.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&e.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&e.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let K=0;K<x.__webglColorRenderbuffer.length;K++)x.__webglColorRenderbuffer[K]&&e.deleteRenderbuffer(x.__webglColorRenderbuffer[K]);x.__webglDepthRenderbuffer&&e.deleteRenderbuffer(x.__webglDepthRenderbuffer)}const V=E.textures;for(let K=0,ne=V.length;K<ne;K++){const Y=i.get(V[K]);Y.__webglTexture&&(e.deleteTexture(Y.__webglTexture),a.memory.textures--),i.remove(V[K])}i.remove(E)}let A=0;function O(){A=0}function H(){const E=A;return E>=r.maxTextures&&Le("WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+r.maxTextures),A+=1,E}function k(E){const x=[];return x.push(E.wrapS),x.push(E.wrapT),x.push(E.wrapR||0),x.push(E.magFilter),x.push(E.minFilter),x.push(E.anisotropy),x.push(E.internalFormat),x.push(E.format),x.push(E.type),x.push(E.generateMipmaps),x.push(E.premultiplyAlpha),x.push(E.flipY),x.push(E.unpackAlignment),x.push(E.colorSpace),x.join()}function L(E,x){const V=i.get(E);if(E.isVideoTexture&&Ve(E),E.isRenderTargetTexture===!1&&E.isExternalTexture!==!0&&E.version>0&&V.__version!==E.version){const K=E.image;if(K===null)Le("WebGLRenderer: Texture marked for update but no image data found.");else if(K.complete===!1)Le("WebGLRenderer: Texture marked for update but image is incomplete");else{q(V,E,x);return}}else E.isExternalTexture&&(V.__webglTexture=E.sourceTexture?E.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,V.__webglTexture,e.TEXTURE0+x)}function B(E,x){const V=i.get(E);if(E.isRenderTargetTexture===!1&&E.version>0&&V.__version!==E.version){q(V,E,x);return}else E.isExternalTexture&&(V.__webglTexture=E.sourceTexture?E.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,V.__webglTexture,e.TEXTURE0+x)}function U(E,x){const V=i.get(E);if(E.isRenderTargetTexture===!1&&E.version>0&&V.__version!==E.version){q(V,E,x);return}n.bindTexture(e.TEXTURE_3D,V.__webglTexture,e.TEXTURE0+x)}function $(E,x){const V=i.get(E);if(E.isCubeDepthTexture!==!0&&E.version>0&&V.__version!==E.version){se(V,E,x);return}n.bindTexture(e.TEXTURE_CUBE_MAP,V.__webglTexture,e.TEXTURE0+x)}const j={[Gi]:e.REPEAT,[Ht]:e.CLAMP_TO_EDGE,[Rs]:e.MIRRORED_REPEAT},J={[Ot]:e.NEAREST,[$l]:e.NEAREST_MIPMAP_NEAREST,[Ql]:e.NEAREST_MIPMAP_LINEAR,[It]:e.LINEAR,[ec]:e.LINEAR_MIPMAP_NEAREST,[Ki]:e.LINEAR_MIPMAP_LINEAR},re={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function Q(E,x){if(x.type===1015&&t.has("OES_texture_float_linear")===!1&&(x.magFilter===1006||x.magFilter===1007||x.magFilter===1005||x.magFilter===1008||x.minFilter===1006||x.minFilter===1007||x.minFilter===1005||x.minFilter===1008)&&Le("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(E,e.TEXTURE_WRAP_S,j[x.wrapS]),e.texParameteri(E,e.TEXTURE_WRAP_T,j[x.wrapT]),(E===e.TEXTURE_3D||E===e.TEXTURE_2D_ARRAY)&&e.texParameteri(E,e.TEXTURE_WRAP_R,j[x.wrapR]),e.texParameteri(E,e.TEXTURE_MAG_FILTER,J[x.magFilter]),e.texParameteri(E,e.TEXTURE_MIN_FILTER,J[x.minFilter]),x.compareFunction&&(e.texParameteri(E,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(E,e.TEXTURE_COMPARE_FUNC,re[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===1003||x.minFilter!==1005&&x.minFilter!==1008||x.type===1015&&t.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||i.get(x).__currentAnisotropy){const V=t.get("EXT_texture_filter_anisotropic");e.texParameterf(E,V.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,r.getMaxAnisotropy())),i.get(x).__currentAnisotropy=x.anisotropy}}}function pe(E,x){let V=!1;E.__webglInit===void 0&&(E.__webglInit=!0,x.addEventListener("dispose",w));const K=x.source;let ne=f.get(K);ne===void 0&&(ne={},f.set(K,ne));const Y=k(x);if(Y!==E.__cacheKey){ne[Y]===void 0&&(ne[Y]={texture:e.createTexture(),usedTimes:0},a.memory.textures++,V=!0),ne[Y].usedTimes++;const Te=ne[E.__cacheKey];Te!==void 0&&(ne[E.__cacheKey].usedTimes--,Te.usedTimes===0&&b(x)),E.__cacheKey=Y,E.__webglTexture=ne[Y].texture}return V}function de(E,x,V){return Math.floor(Math.floor(E/V)/x)}function F(E,x,V,K){const Y=E.updateRanges;if(Y.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,x.width,x.height,V,K,x.data);else{Y.sort((ie,he)=>ie.start-he.start);let Te=0;for(let ie=1;ie<Y.length;ie++){const he=Y[Te],Ae=Y[ie],Ge=he.start+he.count,Se=de(Ae.start,x.width,4),Ze=de(he.start,x.width,4);Ae.start<=Ge+1&&Se===Ze&&de(Ae.start+Ae.count-1,x.width,4)===Se?he.count=Math.max(he.count,Ae.start+Ae.count-he.start):(++Te,Y[Te]=Ae)}Y.length=Te+1;const _e=e.getParameter(e.UNPACK_ROW_LENGTH),De=e.getParameter(e.UNPACK_SKIP_PIXELS),Fe=e.getParameter(e.UNPACK_SKIP_ROWS);e.pixelStorei(e.UNPACK_ROW_LENGTH,x.width);for(let ie=0,he=Y.length;ie<he;ie++){const Ae=Y[ie],Ge=Math.floor(Ae.start/4),Se=Math.ceil(Ae.count/4),Ze=Ge%x.width,D=Math.floor(Ge/x.width),ge=Se,ue=1;e.pixelStorei(e.UNPACK_SKIP_PIXELS,Ze),e.pixelStorei(e.UNPACK_SKIP_ROWS,D),n.texSubImage2D(e.TEXTURE_2D,0,Ze,D,ge,ue,V,K,x.data)}E.clearUpdateRanges(),e.pixelStorei(e.UNPACK_ROW_LENGTH,_e),e.pixelStorei(e.UNPACK_SKIP_PIXELS,De),e.pixelStorei(e.UNPACK_SKIP_ROWS,Fe)}}function q(E,x,V){let K=e.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(K=e.TEXTURE_2D_ARRAY),x.isData3DTexture&&(K=e.TEXTURE_3D);const ne=pe(E,x),Y=x.source;n.bindTexture(K,E.__webglTexture,e.TEXTURE0+V);const Te=i.get(Y);if(Y.version!==Te.__version||ne===!0){n.activeTexture(e.TEXTURE0+V);const _e=qe.getPrimaries(qe.workingColorSpace),De=x.colorSpace===""?null:qe.getPrimaries(x.colorSpace),Fe=x.colorSpace===""||_e===De?e.NONE:e.BROWSER_DEFAULT_WEBGL;e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(e.UNPACK_ALIGNMENT,x.unpackAlignment),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,Fe);let ie=v(x.image,!1,r.maxTextureSize);ie=me(x,ie);const he=s.convert(x.format,x.colorSpace),Ae=s.convert(x.type);let Ge=S(x.internalFormat,he,Ae,x.colorSpace,x.isVideoTexture);Q(K,x);let Se;const Ze=x.mipmaps,D=x.isVideoTexture!==!0,ge=Te.__version===void 0||ne===!0,ue=Y.dataReady,Pe=I(x,ie);if(x.isDepthTexture)Ge=M(x.format===sc,x.type),ge&&(D?n.texStorage2D(e.TEXTURE_2D,1,Ge,ie.width,ie.height):n.texImage2D(e.TEXTURE_2D,0,Ge,ie.width,ie.height,0,he,Ae,null));else if(x.isDataTexture)if(Ze.length>0){D&&ge&&n.texStorage2D(e.TEXTURE_2D,Pe,Ge,Ze[0].width,Ze[0].height);for(let ee=0,te=Ze.length;ee<te;ee++)Se=Ze[ee],D?ue&&n.texSubImage2D(e.TEXTURE_2D,ee,0,0,Se.width,Se.height,he,Ae,Se.data):n.texImage2D(e.TEXTURE_2D,ee,Ge,Se.width,Se.height,0,he,Ae,Se.data);x.generateMipmaps=!1}else D?(ge&&n.texStorage2D(e.TEXTURE_2D,Pe,Ge,ie.width,ie.height),ue&&F(x,ie,he,Ae)):n.texImage2D(e.TEXTURE_2D,0,Ge,ie.width,ie.height,0,he,Ae,ie.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){D&&ge&&n.texStorage3D(e.TEXTURE_2D_ARRAY,Pe,Ge,Ze[0].width,Ze[0].height,ie.depth);for(let ee=0,te=Ze.length;ee<te;ee++)if(Se=Ze[ee],x.format!==1023)if(he!==null)if(D){if(ue)if(x.layerUpdates.size>0){const Ce=gl(Se.width,Se.height,x.format,x.type);for(const He of x.layerUpdates){const Tt=Se.data.subarray(He*Ce/Se.data.BYTES_PER_ELEMENT,(He+1)*Ce/Se.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,ee,0,0,He,Se.width,Se.height,1,he,Tt)}x.clearLayerUpdates()}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,ee,0,0,0,Se.width,Se.height,ie.depth,he,Se.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,ee,Ge,Se.width,Se.height,ie.depth,0,Se.data,0,0);else Le("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else D?ue&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,ee,0,0,0,Se.width,Se.height,ie.depth,he,Ae,Se.data):n.texImage3D(e.TEXTURE_2D_ARRAY,ee,Ge,Se.width,Se.height,ie.depth,0,he,Ae,Se.data)}else{D&&ge&&n.texStorage2D(e.TEXTURE_2D,Pe,Ge,Ze[0].width,Ze[0].height);for(let ee=0,te=Ze.length;ee<te;ee++)Se=Ze[ee],x.format!==1023?he!==null?D?ue&&n.compressedTexSubImage2D(e.TEXTURE_2D,ee,0,0,Se.width,Se.height,he,Se.data):n.compressedTexImage2D(e.TEXTURE_2D,ee,Ge,Se.width,Se.height,0,Se.data):Le("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):D?ue&&n.texSubImage2D(e.TEXTURE_2D,ee,0,0,Se.width,Se.height,he,Ae,Se.data):n.texImage2D(e.TEXTURE_2D,ee,Ge,Se.width,Se.height,0,he,Ae,Se.data)}else if(x.isDataArrayTexture)if(D){if(ge&&n.texStorage3D(e.TEXTURE_2D_ARRAY,Pe,Ge,ie.width,ie.height,ie.depth),ue)if(x.layerUpdates.size>0){const ee=gl(ie.width,ie.height,x.format,x.type);for(const te of x.layerUpdates){const Ce=ie.data.subarray(te*ee/ie.data.BYTES_PER_ELEMENT,(te+1)*ee/ie.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,te,ie.width,ie.height,1,he,Ae,Ce)}x.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,ie.width,ie.height,ie.depth,he,Ae,ie.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,Ge,ie.width,ie.height,ie.depth,0,he,Ae,ie.data);else if(x.isData3DTexture)D?(ge&&n.texStorage3D(e.TEXTURE_3D,Pe,Ge,ie.width,ie.height,ie.depth),ue&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,ie.width,ie.height,ie.depth,he,Ae,ie.data)):n.texImage3D(e.TEXTURE_3D,0,Ge,ie.width,ie.height,ie.depth,0,he,Ae,ie.data);else if(x.isFramebufferTexture){if(ge)if(D)n.texStorage2D(e.TEXTURE_2D,Pe,Ge,ie.width,ie.height);else{let ee=ie.width,te=ie.height;for(let Ce=0;Ce<Pe;Ce++)n.texImage2D(e.TEXTURE_2D,Ce,Ge,ee,te,0,he,Ae,null),ee>>=1,te>>=1}}else if(Ze.length>0){if(D&&ge){const ee=Xe(Ze[0]);n.texStorage2D(e.TEXTURE_2D,Pe,Ge,ee.width,ee.height)}for(let ee=0,te=Ze.length;ee<te;ee++)Se=Ze[ee],D?ue&&n.texSubImage2D(e.TEXTURE_2D,ee,0,0,he,Ae,Se):n.texImage2D(e.TEXTURE_2D,ee,Ge,he,Ae,Se);x.generateMipmaps=!1}else if(D){if(ge){const ee=Xe(ie);n.texStorage2D(e.TEXTURE_2D,Pe,Ge,ee.width,ee.height)}ue&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,he,Ae,ie)}else n.texImage2D(e.TEXTURE_2D,0,Ge,he,Ae,ie);p(x)&&m(K),Te.__version=Y.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function se(E,x,V){if(x.image.length!==6)return;const K=pe(E,x),ne=x.source;n.bindTexture(e.TEXTURE_CUBE_MAP,E.__webglTexture,e.TEXTURE0+V);const Y=i.get(ne);if(ne.version!==Y.__version||K===!0){n.activeTexture(e.TEXTURE0+V);const Te=qe.getPrimaries(qe.workingColorSpace),_e=x.colorSpace===""?null:qe.getPrimaries(x.colorSpace),De=x.colorSpace===""||Te===_e?e.NONE:e.BROWSER_DEFAULT_WEBGL;e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(e.UNPACK_ALIGNMENT,x.unpackAlignment),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,De);const Fe=x.isCompressedTexture||x.image[0].isCompressedTexture,ie=x.image[0]&&x.image[0].isDataTexture,he=[];for(let te=0;te<6;te++)!Fe&&!ie?he[te]=v(x.image[te],!0,r.maxCubemapSize):he[te]=ie?x.image[te].image:x.image[te],he[te]=me(x,he[te]);const Ae=he[0],Ge=s.convert(x.format,x.colorSpace),Se=s.convert(x.type),Ze=S(x.internalFormat,Ge,Se,x.colorSpace),D=x.isVideoTexture!==!0,ge=Y.__version===void 0||K===!0,ue=ne.dataReady;let Pe=I(x,Ae);Q(e.TEXTURE_CUBE_MAP,x);let ee;if(Fe){D&&ge&&n.texStorage2D(e.TEXTURE_CUBE_MAP,Pe,Ze,Ae.width,Ae.height);for(let te=0;te<6;te++){ee=he[te].mipmaps;for(let Ce=0;Ce<ee.length;Ce++){const He=ee[Ce];x.format!==1023?Ge!==null?D?ue&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,0,0,He.width,He.height,Ge,He.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,Ze,He.width,He.height,0,He.data):Le("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):D?ue&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,0,0,He.width,He.height,Ge,Se,He.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,Ze,He.width,He.height,0,Ge,Se,He.data)}}}else{if(ee=x.mipmaps,D&&ge){ee.length>0&&Pe++;const te=Xe(he[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,Pe,Ze,te.width,te.height)}for(let te=0;te<6;te++)if(ie){D?ue&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,he[te].width,he[te].height,Ge,Se,he[te].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,Ze,he[te].width,he[te].height,0,Ge,Se,he[te].data);for(let Ce=0;Ce<ee.length;Ce++){const He=ee[Ce].image[te].image;D?ue&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,0,0,He.width,He.height,Ge,Se,He.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,Ze,He.width,He.height,0,Ge,Se,He.data)}}else{D?ue&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,Ge,Se,he[te]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,Ze,Ge,Se,he[te]);for(let Ce=0;Ce<ee.length;Ce++){const He=ee[Ce];D?ue&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,0,0,Ge,Se,He.image[te]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,Ze,Ge,Se,He.image[te])}}}p(x)&&m(e.TEXTURE_CUBE_MAP),Y.__version=ne.version,x.onUpdate&&x.onUpdate(x)}E.__version=x.version}function ae(E,x,V,K,ne,Y){const Te=s.convert(V.format,V.colorSpace),_e=s.convert(V.type),De=S(V.internalFormat,Te,_e,V.colorSpace),Fe=i.get(x),ie=i.get(V);if(ie.__renderTarget=x,!Fe.__hasExternalTextures){const he=Math.max(1,x.width>>Y),Ae=Math.max(1,x.height>>Y);ne===e.TEXTURE_3D||ne===e.TEXTURE_2D_ARRAY?n.texImage3D(ne,Y,De,he,Ae,x.depth,0,Te,_e,null):n.texImage2D(ne,Y,De,he,Ae,0,Te,_e,null)}n.bindFramebuffer(e.FRAMEBUFFER,E),ve(x)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,K,ne,ie.__webglTexture,0,ze(x)):(ne===e.TEXTURE_2D||ne>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&ne<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,K,ne,ie.__webglTexture,Y),n.bindFramebuffer(e.FRAMEBUFFER,null)}function Re(E,x,V){if(e.bindRenderbuffer(e.RENDERBUFFER,E),x.depthBuffer){const K=x.depthTexture,ne=K&&K.isDepthTexture?K.type:null,Y=M(x.stencilBuffer,ne),Te=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;ve(x)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,ze(x),Y,x.width,x.height):V?e.renderbufferStorageMultisample(e.RENDERBUFFER,ze(x),Y,x.width,x.height):e.renderbufferStorage(e.RENDERBUFFER,Y,x.width,x.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,Te,e.RENDERBUFFER,E)}else{const K=x.textures;for(let ne=0;ne<K.length;ne++){const Y=K[ne],Te=s.convert(Y.format,Y.colorSpace),_e=s.convert(Y.type),De=S(Y.internalFormat,Te,_e,Y.colorSpace);ve(x)?o.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,ze(x),De,x.width,x.height):V?e.renderbufferStorageMultisample(e.RENDERBUFFER,ze(x),De,x.width,x.height):e.renderbufferStorage(e.RENDERBUFFER,De,x.width,x.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Oe(E,x,V){const K=x.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,E),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const ne=i.get(x.depthTexture);if(ne.__renderTarget=x,(!ne.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),K){if(ne.__webglInit===void 0&&(ne.__webglInit=!0,x.depthTexture.addEventListener("dispose",w)),ne.__webglTexture===void 0){ne.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,ne.__webglTexture),Q(e.TEXTURE_CUBE_MAP,x.depthTexture);const Fe=s.convert(x.depthTexture.format),ie=s.convert(x.depthTexture.type);let he;x.depthTexture.format===1026?he=e.DEPTH_COMPONENT24:x.depthTexture.format===1027&&(he=e.DEPTH24_STENCIL8);for(let Ae=0;Ae<6;Ae++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Ae,0,he,x.width,x.height,0,Fe,ie,null)}}else L(x.depthTexture,0);const Y=ne.__webglTexture,Te=ze(x),_e=K?e.TEXTURE_CUBE_MAP_POSITIVE_X+V:e.TEXTURE_2D,De=x.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(x.depthTexture.format===1026)ve(x)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,De,_e,Y,0,Te):e.framebufferTexture2D(e.FRAMEBUFFER,De,_e,Y,0);else if(x.depthTexture.format===1027)ve(x)?o.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,De,_e,Y,0,Te):e.framebufferTexture2D(e.FRAMEBUFFER,De,_e,Y,0);else throw new Error("Unknown depthTexture format")}function Ne(E){const x=i.get(E),V=E.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==E.depthTexture){const K=E.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),K){const ne=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,K.removeEventListener("dispose",ne)};K.addEventListener("dispose",ne),x.__depthDisposeCallback=ne}x.__boundDepthTexture=K}if(E.depthTexture&&!x.__autoAllocateDepthBuffer)if(V)for(let K=0;K<6;K++)Oe(x.__webglFramebuffer[K],E,K);else{const K=E.texture.mipmaps;K&&K.length>0?Oe(x.__webglFramebuffer[0],E,0):Oe(x.__webglFramebuffer,E,0)}else if(V){x.__webglDepthbuffer=[];for(let K=0;K<6;K++)if(n.bindFramebuffer(e.FRAMEBUFFER,x.__webglFramebuffer[K]),x.__webglDepthbuffer[K]===void 0)x.__webglDepthbuffer[K]=e.createRenderbuffer(),Re(x.__webglDepthbuffer[K],E,!1);else{const ne=E.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,Y=x.__webglDepthbuffer[K];e.bindRenderbuffer(e.RENDERBUFFER,Y),e.framebufferRenderbuffer(e.FRAMEBUFFER,ne,e.RENDERBUFFER,Y)}}else{const K=E.texture.mipmaps;if(K&&K.length>0?n.bindFramebuffer(e.FRAMEBUFFER,x.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=e.createRenderbuffer(),Re(x.__webglDepthbuffer,E,!1);else{const ne=E.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,Y=x.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,Y),e.framebufferRenderbuffer(e.FRAMEBUFFER,ne,e.RENDERBUFFER,Y)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function Je(E,x,V){const K=i.get(E);x!==void 0&&ae(K.__webglFramebuffer,E,E.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),V!==void 0&&Ne(E)}function Z(E){const x=E.texture,V=i.get(E),K=i.get(x);E.addEventListener("dispose",C);const ne=E.textures,Y=E.isWebGLCubeRenderTarget===!0,Te=ne.length>1;if(Te||(K.__webglTexture===void 0&&(K.__webglTexture=e.createTexture()),K.__version=x.version,a.memory.textures++),Y){V.__webglFramebuffer=[];for(let _e=0;_e<6;_e++)if(x.mipmaps&&x.mipmaps.length>0){V.__webglFramebuffer[_e]=[];for(let De=0;De<x.mipmaps.length;De++)V.__webglFramebuffer[_e][De]=e.createFramebuffer()}else V.__webglFramebuffer[_e]=e.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){V.__webglFramebuffer=[];for(let _e=0;_e<x.mipmaps.length;_e++)V.__webglFramebuffer[_e]=e.createFramebuffer()}else V.__webglFramebuffer=e.createFramebuffer();if(Te)for(let _e=0,De=ne.length;_e<De;_e++){const Fe=i.get(ne[_e]);Fe.__webglTexture===void 0&&(Fe.__webglTexture=e.createTexture(),a.memory.textures++)}if(E.samples>0&&ve(E)===!1){V.__webglMultisampledFramebuffer=e.createFramebuffer(),V.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,V.__webglMultisampledFramebuffer);for(let _e=0;_e<ne.length;_e++){const De=ne[_e];V.__webglColorRenderbuffer[_e]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,V.__webglColorRenderbuffer[_e]);const Fe=s.convert(De.format,De.colorSpace),ie=s.convert(De.type),he=S(De.internalFormat,Fe,ie,De.colorSpace,E.isXRRenderTarget===!0),Ae=ze(E);e.renderbufferStorageMultisample(e.RENDERBUFFER,Ae,he,E.width,E.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+_e,e.RENDERBUFFER,V.__webglColorRenderbuffer[_e])}e.bindRenderbuffer(e.RENDERBUFFER,null),E.depthBuffer&&(V.__webglDepthRenderbuffer=e.createRenderbuffer(),Re(V.__webglDepthRenderbuffer,E,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(Y){n.bindTexture(e.TEXTURE_CUBE_MAP,K.__webglTexture),Q(e.TEXTURE_CUBE_MAP,x);for(let _e=0;_e<6;_e++)if(x.mipmaps&&x.mipmaps.length>0)for(let De=0;De<x.mipmaps.length;De++)ae(V.__webglFramebuffer[_e][De],E,x,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+_e,De);else ae(V.__webglFramebuffer[_e],E,x,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+_e,0);p(x)&&m(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(Te){for(let _e=0,De=ne.length;_e<De;_e++){const Fe=ne[_e],ie=i.get(Fe);let he=e.TEXTURE_2D;(E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(he=E.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(he,ie.__webglTexture),Q(he,Fe),ae(V.__webglFramebuffer,E,Fe,e.COLOR_ATTACHMENT0+_e,he,0),p(Fe)&&m(he)}n.unbindTexture()}else{let _e=e.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(_e=E.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(_e,K.__webglTexture),Q(_e,x),x.mipmaps&&x.mipmaps.length>0)for(let De=0;De<x.mipmaps.length;De++)ae(V.__webglFramebuffer[De],E,x,e.COLOR_ATTACHMENT0,_e,De);else ae(V.__webglFramebuffer,E,x,e.COLOR_ATTACHMENT0,_e,0);p(x)&&m(_e),n.unbindTexture()}E.depthBuffer&&Ne(E)}function le(E){const x=E.textures;for(let V=0,K=x.length;V<K;V++){const ne=x[V];if(p(ne)){const Y=y(E),Te=i.get(ne).__webglTexture;n.bindTexture(Y,Te),m(Y),n.unbindTexture()}}}const ce=[],Me=[];function R(E){if(E.samples>0){if(ve(E)===!1){const x=E.textures,V=E.width,K=E.height;let ne=e.COLOR_BUFFER_BIT;const Y=E.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,Te=i.get(E),_e=x.length>1;if(_e)for(let Fe=0;Fe<x.length;Fe++)n.bindFramebuffer(e.FRAMEBUFFER,Te.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Fe,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,Te.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+Fe,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,Te.__webglMultisampledFramebuffer);const De=E.texture.mipmaps;De&&De.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,Te.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,Te.__webglFramebuffer);for(let Fe=0;Fe<x.length;Fe++){if(E.resolveDepthBuffer&&(E.depthBuffer&&(ne|=e.DEPTH_BUFFER_BIT),E.stencilBuffer&&E.resolveStencilBuffer&&(ne|=e.STENCIL_BUFFER_BIT)),_e){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,Te.__webglColorRenderbuffer[Fe]);const ie=i.get(x[Fe]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,ie,0)}e.blitFramebuffer(0,0,V,K,0,0,V,K,ne,e.NEAREST),l===!0&&(ce.length=0,Me.length=0,ce.push(e.COLOR_ATTACHMENT0+Fe),E.depthBuffer&&E.resolveDepthBuffer===!1&&(ce.push(Y),Me.push(Y),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,Me)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,ce))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),_e)for(let Fe=0;Fe<x.length;Fe++){n.bindFramebuffer(e.FRAMEBUFFER,Te.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Fe,e.RENDERBUFFER,Te.__webglColorRenderbuffer[Fe]);const ie=i.get(x[Fe]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,Te.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+Fe,e.TEXTURE_2D,ie,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,Te.__webglMultisampledFramebuffer)}else if(E.depthBuffer&&E.resolveDepthBuffer===!1&&l){const x=E.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[x])}}}function ze(E){return Math.min(r.maxSamples,E.samples)}function ve(E){const x=i.get(E);return E.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function Ve(E){const x=a.render.frame;h.get(E)!==x&&(h.set(E,x),E.update())}function me(E,x){const V=E.colorSpace,K=E.format,ne=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||V!=="srgb-linear"&&V!==""&&(qe.getTransfer(V)==="srgb"?(K!==1023||ne!==1009)&&Le("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):ke("WebGLTextures: Unsupported texture color space:",V)),x}function Xe(E){return typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement?(c.width=E.naturalWidth||E.width,c.height=E.naturalHeight||E.height):typeof VideoFrame<"u"&&E instanceof VideoFrame?(c.width=E.displayWidth,c.height=E.displayHeight):(c.width=E.width,c.height=E.height),c}this.allocateTextureUnit=H,this.resetTextureUnits=O,this.setTexture2D=L,this.setTexture2DArray=B,this.setTexture3D=U,this.setTextureCube=$,this.rebindTextures=Je,this.setupRenderTarget=Z,this.updateRenderTargetMipmap=le,this.updateMultisampleRenderTarget=R,this.setupDepthRenderbuffer=Ne,this.setupFrameBufferTexture=ae,this.useMultisampledRTT=ve,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function qm(e,t){function n(i,r=""){let s;const a=qe.getTransfer(r);if(i===1009)return e.UNSIGNED_BYTE;if(i===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(i===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(i===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===1010)return e.BYTE;if(i===1011)return e.SHORT;if(i===1012)return e.UNSIGNED_SHORT;if(i===1013)return e.INT;if(i===1014)return e.UNSIGNED_INT;if(i===1015)return e.FLOAT;if(i===1016)return e.HALF_FLOAT;if(i===1021)return e.ALPHA;if(i===1022)return e.RGB;if(i===1023)return e.RGBA;if(i===1026)return e.DEPTH_COMPONENT;if(i===1027)return e.DEPTH_STENCIL;if(i===1028)return e.RED;if(i===1029)return e.RED_INTEGER;if(i===1030)return e.RG;if(i===1031)return e.RG_INTEGER;if(i===1033)return e.RGBA_INTEGER;if(i===33776||i===33777||i===33778||i===33779)if(a==="srgb")if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===33776)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===33777)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===33778)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===33779)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===33776)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===33777)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===33778)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===33779)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===35840||i===35841||i===35842||i===35843)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===35840)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===35841)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===35842)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===35843)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===36196||i===37492||i===37496||i===37488||i===37489||i===37490||i===37491)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(i===36196||i===37492)return a==="srgb"?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===37496)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===37488)return s.COMPRESSED_R11_EAC;if(i===37489)return s.COMPRESSED_SIGNED_R11_EAC;if(i===37490)return s.COMPRESSED_RG11_EAC;if(i===37491)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===37808||i===37809||i===37810||i===37811||i===37812||i===37813||i===37814||i===37815||i===37816||i===37817||i===37818||i===37819||i===37820||i===37821)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(i===37808)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===37809)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===37810)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===37811)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===37812)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===37813)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===37814)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===37815)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===37816)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===37817)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===37818)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===37819)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===37820)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===37821)return a==="srgb"?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===36492||i===36494||i===36495)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(i===36492)return a==="srgb"?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===36494)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===36495)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===36283||i===36284||i===36285||i===36286)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(i===36283)return s.COMPRESSED_RED_RGTC1_EXT;if(i===36284)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===36285)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===36286)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===1020?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:n}}var Ym=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,jm=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Km=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Ic(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new _n({vertexShader:Ym,fragmentShader:jm,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Pt(new qc(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Jm=class extends ci{constructor(e,t){super();const n=this;let i=null,r=1,s=null,a="local-floor",o=1,l=null,c=null,h=null,u=null,f=null,d=null;const g=typeof XRWebGLBinding<"u",v=new Km,p={},m=t.getContextAttributes();let y=null,S=null;const M=[],I=[],w=new oe;let C=null;const _=new Vt;_.viewport=new ct;const b=new Vt;b.viewport=new ct;const N=[_,b],A=new Cd;let O=null,H=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(F){let q=M[F];return q===void 0&&(q=new Qs,M[F]=q),q.getTargetRaySpace()},this.getControllerGrip=function(F){let q=M[F];return q===void 0&&(q=new Qs,M[F]=q),q.getGripSpace()},this.getHand=function(F){let q=M[F];return q===void 0&&(q=new Qs,M[F]=q),q.getHandSpace()};function k(F){const q=I.indexOf(F.inputSource);if(q===-1)return;const se=M[q];se!==void 0&&(se.update(F.inputSource,F.frame,l||s),se.dispatchEvent({type:F.type,data:F.inputSource}))}function L(){i.removeEventListener("select",k),i.removeEventListener("selectstart",k),i.removeEventListener("selectend",k),i.removeEventListener("squeeze",k),i.removeEventListener("squeezestart",k),i.removeEventListener("squeezeend",k),i.removeEventListener("end",L),i.removeEventListener("inputsourceschange",B);for(let F=0;F<M.length;F++){const q=I[F];q!==null&&(I[F]=null,M[F].disconnect(q))}O=null,H=null,v.reset();for(const F in p)delete p[F];e.setRenderTarget(y),f=null,u=null,h=null,i=null,S=null,de.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(w.width,w.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(F){r=F,n.isPresenting===!0&&Le("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(F){a=F,n.isPresenting===!0&&Le("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||s},this.setReferenceSpace=function(F){l=F},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return h===null&&g&&(h=new XRWebGLBinding(i,t)),h},this.getFrame=function(){return d},this.getSession=function(){return i},this.setSession=async function(F){if(i=F,i!==null){if(y=e.getRenderTarget(),i.addEventListener("select",k),i.addEventListener("selectstart",k),i.addEventListener("selectend",k),i.addEventListener("squeeze",k),i.addEventListener("squeezestart",k),i.addEventListener("squeezeend",k),i.addEventListener("end",L),i.addEventListener("inputsourceschange",B),m.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(w),g&&"createProjectionLayer"in XRWebGLBinding.prototype){let q=null,se=null,ae=null;m.depth&&(ae=m.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,q=m.stencil?sc:Tr,se=m.stencil?rc:ri);const Re={colorFormat:t.RGBA8,depthFormat:ae,scaleFactor:r};h=this.getBinding(),u=h.createProjectionLayer(Re),i.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),S=new vn(u.textureWidth,u.textureHeight,{format:Hi,type:Hn,depthTexture:new wr(u.textureWidth,u.textureHeight,se,void 0,void 0,void 0,void 0,void 0,void 0,q),stencilBuffer:m.stencil,colorSpace:e.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{const q={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(i,t,q),i.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),S=new vn(f.framebufferWidth,f.framebufferHeight,{format:Hi,type:Hn,colorSpace:e.outputColorSpace,stencilBuffer:m.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(o),l=null,s=await i.requestReferenceSpace(a),de.setContext(i),de.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function B(F){for(let q=0;q<F.removed.length;q++){const se=F.removed[q],ae=I.indexOf(se);ae>=0&&(I[ae]=null,M[ae].disconnect(se))}for(let q=0;q<F.added.length;q++){const se=F.added[q];let ae=I.indexOf(se);if(ae===-1){for(let Oe=0;Oe<M.length;Oe++)if(Oe>=I.length){I.push(se),ae=Oe;break}else if(I[Oe]===null){I[Oe]=se,ae=Oe;break}if(ae===-1)break}const Re=M[ae];Re&&Re.connect(se)}}const U=new P,$=new P;function j(F,q,se){U.setFromMatrixPosition(q.matrixWorld),$.setFromMatrixPosition(se.matrixWorld);const ae=U.distanceTo($),Re=q.projectionMatrix.elements,Oe=se.projectionMatrix.elements,Ne=Re[14]/(Re[10]-1),Je=Re[14]/(Re[10]+1),Z=(Re[9]+1)/Re[5],le=(Re[9]-1)/Re[5],ce=(Re[8]-1)/Re[0],Me=(Oe[8]+1)/Oe[0],R=Ne*ce,ze=Ne*Me,ve=ae/(-ce+Me),Ve=ve*-ce;if(q.matrixWorld.decompose(F.position,F.quaternion,F.scale),F.translateX(Ve),F.translateZ(ve),F.matrixWorld.compose(F.position,F.quaternion,F.scale),F.matrixWorldInverse.copy(F.matrixWorld).invert(),Re[10]===-1)F.projectionMatrix.copy(q.projectionMatrix),F.projectionMatrixInverse.copy(q.projectionMatrixInverse);else{const me=Ne+ve,Xe=Je+ve,E=R-Ve,x=ze+(ae-Ve),V=Z*Je/Xe*me,K=le*Je/Xe*me;F.projectionMatrix.makePerspective(E,x,V,K,me,Xe),F.projectionMatrixInverse.copy(F.projectionMatrix).invert()}}function J(F,q){q===null?F.matrixWorld.copy(F.matrix):F.matrixWorld.multiplyMatrices(q.matrixWorld,F.matrix),F.matrixWorldInverse.copy(F.matrixWorld).invert()}this.updateCamera=function(F){if(i===null)return;let q=F.near,se=F.far;v.texture!==null&&(v.depthNear>0&&(q=v.depthNear),v.depthFar>0&&(se=v.depthFar)),A.near=b.near=_.near=q,A.far=b.far=_.far=se,(O!==A.near||H!==A.far)&&(i.updateRenderState({depthNear:A.near,depthFar:A.far}),O=A.near,H=A.far),A.layers.mask=F.layers.mask|6,_.layers.mask=A.layers.mask&-5,b.layers.mask=A.layers.mask&-3;const ae=F.parent,Re=A.cameras;J(A,ae);for(let Oe=0;Oe<Re.length;Oe++)J(Re[Oe],ae);Re.length===2?j(A,_,b):A.projectionMatrix.copy(_.projectionMatrix),re(F,A,ae)};function re(F,q,se){se===null?F.matrix.copy(q.matrixWorld):(F.matrix.copy(se.matrixWorld),F.matrix.invert(),F.matrix.multiply(q.matrixWorld)),F.matrix.decompose(F.position,F.quaternion,F.scale),F.updateMatrixWorld(!0),F.projectionMatrix.copy(q.projectionMatrix),F.projectionMatrixInverse.copy(q.projectionMatrixInverse),F.isPerspectiveCamera&&(F.fov=qi*2*Math.atan(1/F.projectionMatrix.elements[5]),F.zoom=1)}this.getCamera=function(){return A},this.getFoveation=function(){if(!(u===null&&f===null))return o},this.setFoveation=function(F){o=F,u!==null&&(u.fixedFoveation=F),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=F)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(A)},this.getCameraTexture=function(F){return p[F]};let Q=null;function pe(F,q){if(c=q.getViewerPose(l||s),d=q,c!==null){const se=c.views;f!==null&&(e.setRenderTargetFramebuffer(S,f.framebuffer),e.setRenderTarget(S));let ae=!1;se.length!==A.cameras.length&&(A.cameras.length=0,ae=!0);for(let Oe=0;Oe<se.length;Oe++){const Ne=se[Oe];let Je=null;if(f!==null)Je=f.getViewport(Ne);else{const le=h.getViewSubImage(u,Ne);Je=le.viewport,Oe===0&&(e.setRenderTargetTextures(S,le.colorTexture,le.depthStencilTexture),e.setRenderTarget(S))}let Z=N[Oe];Z===void 0&&(Z=new Vt,Z.layers.enable(Oe),Z.viewport=new ct,N[Oe]=Z),Z.matrix.fromArray(Ne.transform.matrix),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.projectionMatrix.fromArray(Ne.projectionMatrix),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert(),Z.viewport.set(Je.x,Je.y,Je.width,Je.height),Oe===0&&(A.matrix.copy(Z.matrix),A.matrix.decompose(A.position,A.quaternion,A.scale)),ae===!0&&A.cameras.push(Z)}const Re=i.enabledFeatures;if(Re&&Re.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&g){h=n.getBinding();const Oe=h.getDepthInformation(se[0]);Oe&&Oe.isValid&&Oe.texture&&v.init(Oe,i.renderState)}if(Re&&Re.includes("camera-access")&&g){e.state.unbindTexture(),h=n.getBinding();for(let Oe=0;Oe<se.length;Oe++){const Ne=se[Oe].camera;if(Ne){let Je=p[Ne];Je||(Je=new Ic,p[Ne]=Je);const Z=h.getCameraImage(Ne);Je.sourceTexture=Z}}}}for(let se=0;se<M.length;se++){const ae=I[se],Re=M[se];ae!==null&&Re!==void 0&&Re.update(ae,q,l||s)}Q&&Q(F,q),q.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:q}),d=null}const de=new rh;de.setAnimationLoop(pe),this.setAnimationLoop=function(F){Q=F},this.dispose=function(){}}},Qn=new Ct,Zm=new Ie;function $m(e,t){function n(p,m){p.matrixAutoUpdate===!0&&p.updateMatrix(),m.value.copy(p.matrix)}function i(p,m){m.color.getRGB(p.fogColor.value,Jc(e)),m.isFog?(p.fogNear.value=m.near,p.fogFar.value=m.far):m.isFogExp2&&(p.fogDensity.value=m.density)}function r(p,m,y,S,M){m.isMeshBasicMaterial?s(p,m):m.isMeshLambertMaterial?(s(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshToonMaterial?(s(p,m),u(p,m)):m.isMeshPhongMaterial?(s(p,m),h(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshStandardMaterial?(s(p,m),f(p,m),m.isMeshPhysicalMaterial&&d(p,m,M)):m.isMeshMatcapMaterial?(s(p,m),g(p,m)):m.isMeshDepthMaterial?s(p,m):m.isMeshDistanceMaterial?(s(p,m),v(p,m)):m.isMeshNormalMaterial?s(p,m):m.isLineBasicMaterial?(a(p,m),m.isLineDashedMaterial&&o(p,m)):m.isPointsMaterial?l(p,m,y,S):m.isSpriteMaterial?c(p,m):m.isShadowMaterial?(p.color.value.copy(m.color),p.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function s(p,m){p.opacity.value=m.opacity,m.color&&p.diffuse.value.copy(m.color),m.emissive&&p.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(p.map.value=m.map,n(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,n(m.alphaMap,p.alphaMapTransform)),m.bumpMap&&(p.bumpMap.value=m.bumpMap,n(m.bumpMap,p.bumpMapTransform),p.bumpScale.value=m.bumpScale,m.side===1&&(p.bumpScale.value*=-1)),m.normalMap&&(p.normalMap.value=m.normalMap,n(m.normalMap,p.normalMapTransform),p.normalScale.value.copy(m.normalScale),m.side===1&&p.normalScale.value.negate()),m.displacementMap&&(p.displacementMap.value=m.displacementMap,n(m.displacementMap,p.displacementMapTransform),p.displacementScale.value=m.displacementScale,p.displacementBias.value=m.displacementBias),m.emissiveMap&&(p.emissiveMap.value=m.emissiveMap,n(m.emissiveMap,p.emissiveMapTransform)),m.specularMap&&(p.specularMap.value=m.specularMap,n(m.specularMap,p.specularMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest);const y=t.get(m),S=y.envMap,M=y.envMapRotation;S&&(p.envMap.value=S,Qn.copy(M),Qn.x*=-1,Qn.y*=-1,Qn.z*=-1,S.isCubeTexture&&S.isRenderTargetTexture===!1&&(Qn.y*=-1,Qn.z*=-1),p.envMapRotation.value.setFromMatrix4(Zm.makeRotationFromEuler(Qn)),p.flipEnvMap.value=S.isCubeTexture&&S.isRenderTargetTexture===!1?-1:1,p.reflectivity.value=m.reflectivity,p.ior.value=m.ior,p.refractionRatio.value=m.refractionRatio),m.lightMap&&(p.lightMap.value=m.lightMap,p.lightMapIntensity.value=m.lightMapIntensity,n(m.lightMap,p.lightMapTransform)),m.aoMap&&(p.aoMap.value=m.aoMap,p.aoMapIntensity.value=m.aoMapIntensity,n(m.aoMap,p.aoMapTransform))}function a(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,m.map&&(p.map.value=m.map,n(m.map,p.mapTransform))}function o(p,m){p.dashSize.value=m.dashSize,p.totalSize.value=m.dashSize+m.gapSize,p.scale.value=m.scale}function l(p,m,y,S){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.size.value=m.size*y,p.scale.value=S*.5,m.map&&(p.map.value=m.map,n(m.map,p.uvTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,n(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function c(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.rotation.value=m.rotation,m.map&&(p.map.value=m.map,n(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,n(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function h(p,m){p.specular.value.copy(m.specular),p.shininess.value=Math.max(m.shininess,1e-4)}function u(p,m){m.gradientMap&&(p.gradientMap.value=m.gradientMap)}function f(p,m){p.metalness.value=m.metalness,m.metalnessMap&&(p.metalnessMap.value=m.metalnessMap,n(m.metalnessMap,p.metalnessMapTransform)),p.roughness.value=m.roughness,m.roughnessMap&&(p.roughnessMap.value=m.roughnessMap,n(m.roughnessMap,p.roughnessMapTransform)),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)}function d(p,m,y){p.ior.value=m.ior,m.sheen>0&&(p.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),p.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(p.sheenColorMap.value=m.sheenColorMap,n(m.sheenColorMap,p.sheenColorMapTransform)),m.sheenRoughnessMap&&(p.sheenRoughnessMap.value=m.sheenRoughnessMap,n(m.sheenRoughnessMap,p.sheenRoughnessMapTransform))),m.clearcoat>0&&(p.clearcoat.value=m.clearcoat,p.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(p.clearcoatMap.value=m.clearcoatMap,n(m.clearcoatMap,p.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,n(m.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(p.clearcoatNormalMap.value=m.clearcoatNormalMap,n(m.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===1&&p.clearcoatNormalScale.value.negate())),m.dispersion>0&&(p.dispersion.value=m.dispersion),m.iridescence>0&&(p.iridescence.value=m.iridescence,p.iridescenceIOR.value=m.iridescenceIOR,p.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(p.iridescenceMap.value=m.iridescenceMap,n(m.iridescenceMap,p.iridescenceMapTransform)),m.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=m.iridescenceThicknessMap,n(m.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),m.transmission>0&&(p.transmission.value=m.transmission,p.transmissionSamplerMap.value=y.texture,p.transmissionSamplerSize.value.set(y.width,y.height),m.transmissionMap&&(p.transmissionMap.value=m.transmissionMap,n(m.transmissionMap,p.transmissionMapTransform)),p.thickness.value=m.thickness,m.thicknessMap&&(p.thicknessMap.value=m.thicknessMap,n(m.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=m.attenuationDistance,p.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(p.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(p.anisotropyMap.value=m.anisotropyMap,n(m.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=m.specularIntensity,p.specularColor.value.copy(m.specularColor),m.specularColorMap&&(p.specularColorMap.value=m.specularColorMap,n(m.specularColorMap,p.specularColorMapTransform)),m.specularIntensityMap&&(p.specularIntensityMap.value=m.specularIntensityMap,n(m.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,m){m.matcap&&(p.matcap.value=m.matcap)}function v(p,m){const y=t.get(m).light;p.referencePosition.value.setFromMatrixPosition(y.matrixWorld),p.nearDistance.value=y.shadow.camera.near,p.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Qm(e,t,n,i){let r={},s={},a=[];const o=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,S){const M=S.program;i.uniformBlockBinding(y,M)}function c(y,S){let M=r[y.id];M===void 0&&(g(y),M=h(y),r[y.id]=M,y.addEventListener("dispose",p));const I=S.program;i.updateUBOMapping(y,I);const w=t.render.frame;s[y.id]!==w&&(f(y),s[y.id]=w)}function h(y){const S=u();y.__bindingPointIndex=S;const M=e.createBuffer(),I=y.__size,w=y.usage;return e.bindBuffer(e.UNIFORM_BUFFER,M),e.bufferData(e.UNIFORM_BUFFER,I,w),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,S,M),M}function u(){for(let y=0;y<o;y++)if(a.indexOf(y)===-1)return a.push(y),y;return ke("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(y){const S=r[y.id],M=y.uniforms,I=y.__cache;e.bindBuffer(e.UNIFORM_BUFFER,S);for(let w=0,C=M.length;w<C;w++){const _=Array.isArray(M[w])?M[w]:[M[w]];for(let b=0,N=_.length;b<N;b++){const A=_[b];if(d(A,w,b,I)===!0){const O=A.__offset,H=Array.isArray(A.value)?A.value:[A.value];let k=0;for(let L=0;L<H.length;L++){const B=H[L],U=v(B);typeof B=="number"||typeof B=="boolean"?(A.__data[0]=B,e.bufferSubData(e.UNIFORM_BUFFER,O+k,A.__data)):B.isMatrix3?(A.__data[0]=B.elements[0],A.__data[1]=B.elements[1],A.__data[2]=B.elements[2],A.__data[3]=0,A.__data[4]=B.elements[3],A.__data[5]=B.elements[4],A.__data[6]=B.elements[5],A.__data[7]=0,A.__data[8]=B.elements[6],A.__data[9]=B.elements[7],A.__data[10]=B.elements[8],A.__data[11]=0):(B.toArray(A.__data,k),k+=U.storage/Float32Array.BYTES_PER_ELEMENT)}e.bufferSubData(e.UNIFORM_BUFFER,O,A.__data)}}}e.bindBuffer(e.UNIFORM_BUFFER,null)}function d(y,S,M,I){const w=y.value,C=S+"_"+M;if(I[C]===void 0)return typeof w=="number"||typeof w=="boolean"?I[C]=w:I[C]=w.clone(),!0;{const _=I[C];if(typeof w=="number"||typeof w=="boolean"){if(_!==w)return I[C]=w,!0}else if(_.equals(w)===!1)return _.copy(w),!0}return!1}function g(y){const S=y.uniforms;let M=0;const I=16;for(let C=0,_=S.length;C<_;C++){const b=Array.isArray(S[C])?S[C]:[S[C]];for(let N=0,A=b.length;N<A;N++){const O=b[N],H=Array.isArray(O.value)?O.value:[O.value];for(let k=0,L=H.length;k<L;k++){const B=H[k],U=v(B),$=M%I,j=$%U.boundary,J=$+j;M+=j,J!==0&&I-J<U.storage&&(M+=I-J),O.__data=new Float32Array(U.storage/Float32Array.BYTES_PER_ELEMENT),O.__offset=M,M+=U.storage}}}const w=M%I;return w>0&&(M+=I-w),y.__size=M,y.__cache={},this}function v(y){const S={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(S.boundary=4,S.storage=4):y.isVector2?(S.boundary=8,S.storage=8):y.isVector3||y.isColor?(S.boundary=16,S.storage=12):y.isVector4?(S.boundary=16,S.storage=16):y.isMatrix3?(S.boundary=48,S.storage=48):y.isMatrix4?(S.boundary=64,S.storage=64):y.isTexture?Le("WebGLRenderer: Texture samplers can not be part of an uniforms group."):Le("WebGLRenderer: Unsupported uniform value type.",y),S}function p(y){const S=y.target;S.removeEventListener("dispose",p);const M=a.indexOf(S.__bindingPointIndex);a.splice(M,1),e.deleteBuffer(r[S.id]),delete r[S.id],delete s[S.id]}function m(){for(const y in r)e.deleteBuffer(r[y]);a=[],r={},s={}}return{bind:l,update:c,dispose:m}}var eg=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),dn=null;function tg(){return dn===null&&(dn=new zs(eg,16,16,Cs,si),dn.name="DFG_LUT",dn.minFilter=It,dn.magFilter=It,dn.wrapS=Ht,dn.wrapT=Ht,dn.generateMipmaps=!1,dn.needsUpdate=!0),dn}var Bv=class{constructor(e={}){const{canvas:t=wu(),context:n=null,depth:i=!0,stencil:r=!1,alpha:s=!1,antialias:a=!1,premultipliedAlpha:o=!0,preserveDrawingBuffer:l=!1,powerPreference:c="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:u=!1,outputBufferType:f=Hn}=e;this.isWebGLRenderer=!0;let d;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");d=n.getContextAttributes().alpha}else d=s;const g=f,v=new Set([cc,lc,oc]),p=new Set([Hn,ri,tc,rc,nc,ic]),m=new Uint32Array(4),y=new Int32Array(4);let S=null,M=null;const I=[],w=[];let C=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const _=this;let b=!1;this._outputColorSpace=rt;let N=0,A=0,O=null,H=-1,k=null;const L=new ct,B=new ct;let U=null;const $=new Ee(0);let j=0,J=t.width,re=t.height,Q=1,pe=null,de=null;const F=new ct(0,0,J,re),q=new ct(0,0,J,re);let se=!1;const ae=new ao;let Re=!1,Oe=!1;const Ne=new Ie,Je=new P,Z=new ct,le={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let ce=!1;function Me(){return O===null?Q:1}let R=n;function ze(T,z){return t.getContext(T,z)}try{const T={alpha:!0,depth:i,stencil:r,antialias:a,premultipliedAlpha:o,preserveDrawingBuffer:l,powerPreference:c,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine","three.js r183"),t.addEventListener("webglcontextlost",te,!1),t.addEventListener("webglcontextrestored",Ce,!1),t.addEventListener("webglcontextcreationerror",He,!1),R===null){const z="webgl2";if(R=ze(z,T),R===null)throw ze(z)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(T){throw ke("WebGLRenderer: "+T.message),T}let ve,Ve,me,Xe,E,x,V,K,ne,Y,Te,_e,De,Fe,ie,he,Ae,Ge,Se,Ze,D,ge,ue;function Pe(){ve=new np(R),ve.init(),D=new qm(R,ve),Ve=new jd(R,ve,e,D),me=new Wm(R,ve),Ve.reversedDepthBuffer&&u&&me.buffers.depth.setReversed(!0),Xe=new sp(R),E=new Im,x=new Xm(R,ve,me,E,Ve,D,Xe),V=new tp(_),K=new Hd(R),ge=new qd(R,K),ne=new ip(R,K,Xe,ge),Y=new op(R,ne,K,ge,Xe),Ge=new ap(R,Ve,x),ie=new Kd(E),Te=new Cm(_,V,ve,Ve,ge,ie),_e=new $m(_,E),De=new Lm,Fe=new Bm(ve),Ae=new Xd(_,V,me,Y,d,o),he=new Hm(_,Y,Ve),ue=new Qm(R,Xe,Ve,me),Se=new Yd(R,ve,Xe),Ze=new rp(R,ve,Xe),Xe.programs=Te.programs,_.capabilities=Ve,_.extensions=ve,_.properties=E,_.renderLists=De,_.shadowMap=he,_.state=me,_.info=Xe}Pe(),g!==1009&&(C=new cp(g,t.width,t.height,i,r));const ee=new Jm(_,R);this.xr=ee,this.getContext=function(){return R},this.getContextAttributes=function(){return R.getContextAttributes()},this.forceContextLoss=function(){const T=ve.get("WEBGL_lose_context");T&&T.loseContext()},this.forceContextRestore=function(){const T=ve.get("WEBGL_lose_context");T&&T.restoreContext()},this.getPixelRatio=function(){return Q},this.setPixelRatio=function(T){T!==void 0&&(Q=T,this.setSize(J,re,!1))},this.getSize=function(T){return T.set(J,re)},this.setSize=function(T,z,X=!0){if(ee.isPresenting){Le("WebGLRenderer: Can't change size while VR device is presenting.");return}J=T,re=z,t.width=Math.floor(T*Q),t.height=Math.floor(z*Q),X===!0&&(t.style.width=T+"px",t.style.height=z+"px"),C!==null&&C.setSize(t.width,t.height),this.setViewport(0,0,T,z)},this.getDrawingBufferSize=function(T){return T.set(J*Q,re*Q).floor()},this.setDrawingBufferSize=function(T,z,X){J=T,re=z,Q=X,t.width=Math.floor(T*X),t.height=Math.floor(z*X),this.setViewport(0,0,T,z)},this.setEffects=function(T){if(g===1009){console.error("THREE.WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(T){for(let z=0;z<T.length;z++)if(T[z].isOutputPass===!0){console.warn("THREE.WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}C.setEffects(T||[])},this.getCurrentViewport=function(T){return T.copy(L)},this.getViewport=function(T){return T.copy(F)},this.setViewport=function(T,z,X,W){T.isVector4?F.set(T.x,T.y,T.z,T.w):F.set(T,z,X,W),me.viewport(L.copy(F).multiplyScalar(Q).round())},this.getScissor=function(T){return T.copy(q)},this.setScissor=function(T,z,X,W){T.isVector4?q.set(T.x,T.y,T.z,T.w):q.set(T,z,X,W),me.scissor(B.copy(q).multiplyScalar(Q).round())},this.getScissorTest=function(){return se},this.setScissorTest=function(T){me.setScissorTest(se=T)},this.setOpaqueSort=function(T){pe=T},this.setTransparentSort=function(T){de=T},this.getClearColor=function(T){return T.copy(Ae.getClearColor())},this.setClearColor=function(){Ae.setClearColor(...arguments)},this.getClearAlpha=function(){return Ae.getClearAlpha()},this.setClearAlpha=function(){Ae.setClearAlpha(...arguments)},this.clear=function(T=!0,z=!0,X=!0){let W=0;if(T){let G=!1;if(O!==null){const fe=O.texture.format;G=v.has(fe)}if(G){const fe=O.texture.type,xe=p.has(fe),we=Ae.getClearColor(),be=Ae.getClearAlpha(),We=we.r,$e=we.g,nt=we.b;xe?(m[0]=We,m[1]=$e,m[2]=nt,m[3]=be,R.clearBufferuiv(R.COLOR,0,m)):(y[0]=We,y[1]=$e,y[2]=nt,y[3]=be,R.clearBufferiv(R.COLOR,0,y))}else W|=R.COLOR_BUFFER_BIT}z&&(W|=R.DEPTH_BUFFER_BIT),X&&(W|=R.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),W!==0&&R.clear(W)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",te,!1),t.removeEventListener("webglcontextrestored",Ce,!1),t.removeEventListener("webglcontextcreationerror",He,!1),Ae.dispose(),De.dispose(),Fe.dispose(),E.dispose(),V.dispose(),Y.dispose(),ge.dispose(),ue.dispose(),Te.dispose(),ee.dispose(),ee.removeEventListener("sessionstart",mo),ee.removeEventListener("sessionend",go),qn.stop()};function te(T){T.preventDefault(),Ds("WebGLRenderer: Context Lost."),b=!0}function Ce(){Ds("WebGLRenderer: Context Restored."),b=!1;const T=Xe.autoReset,z=he.enabled,X=he.autoUpdate,W=he.needsUpdate,G=he.type;Pe(),Xe.autoReset=T,he.enabled=z,he.autoUpdate=X,he.needsUpdate=W,he.type=G}function He(T){ke("WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function Tt(T){const z=T.target;z.removeEventListener("dispose",Tt),ot(z)}function ot(T){Mn(T),E.remove(T)}function Mn(T){const z=E.get(T).programs;z!==void 0&&(z.forEach(function(X){Te.releaseProgram(X)}),T.isShaderMaterial&&Te.releaseShaderCache(T))}this.renderBufferDirect=function(T,z,X,W,G,fe){z===null&&(z=le);const xe=G.isMesh&&G.matrixWorld.determinant()<0,we=bh(T,z,X,W,G);me.setMaterial(W,xe);let be=X.index,We=1;if(W.wireframe===!0){if(be=ne.getWireframeAttribute(X),be===void 0)return;We=2}const $e=X.drawRange,nt=X.attributes.position;let Be=$e.start*We,ut=($e.start+$e.count)*We;fe!==null&&(Be=Math.max(Be,fe.start*We),ut=Math.min(ut,(fe.start+fe.count)*We)),be!==null?(Be=Math.max(Be,0),ut=Math.min(ut,be.count)):nt!=null&&(Be=Math.max(Be,0),ut=Math.min(ut,nt.count));const gt=ut-Be;if(gt<0||gt===1/0)return;ge.setup(G,W,we,X,be);let vt,it=Se;if(be!==null&&(vt=K.get(be),it=Ze,it.setIndex(vt)),G.isMesh)W.wireframe===!0?(me.setLineWidth(W.wireframeLinewidth*Me()),it.setMode(R.LINES)):it.setMode(R.TRIANGLES);else if(G.isLine){let Lt=W.linewidth;Lt===void 0&&(Lt=1),me.setLineWidth(Lt*Me()),G.isLineSegments?it.setMode(R.LINES):G.isLineLoop?it.setMode(R.LINE_LOOP):it.setMode(R.LINE_STRIP)}else G.isPoints?it.setMode(R.POINTS):G.isSprite&&it.setMode(R.TRIANGLES);if(G.isBatchedMesh)if(G._multiDrawInstances!==null)Ns("WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),it.renderMultiDrawInstances(G._multiDrawStarts,G._multiDrawCounts,G._multiDrawCount,G._multiDrawInstances);else if(ve.get("WEBGL_multi_draw"))it.renderMultiDraw(G._multiDrawStarts,G._multiDrawCounts,G._multiDrawCount);else{const Lt=G._multiDrawStarts,Ue=G._multiDrawCounts,Qt=G._multiDrawCount,st=be?K.get(be).bytesPerElement:1,en=E.get(W).currentProgram.getUniforms();for(let un=0;un<Qt;un++)en.setValue(R,"_gl_DrawID",un),it.render(Lt[un]/st,Ue[un])}else if(G.isInstancedMesh)it.renderInstances(Be,gt,G.count);else if(X.isInstancedBufferGeometry){const Lt=X._maxInstanceCount!==void 0?X._maxInstanceCount:1/0,Ue=Math.min(X.instanceCount,Lt);it.renderInstances(Be,gt,Ue)}else it.render(Be,gt)};function hn(T,z,X){T.transparent===!0&&T.side===2&&T.forceSinglePass===!1?(T.side=1,T.needsUpdate=!0,Fr(T,z,X),T.side=0,T.needsUpdate=!0,Fr(T,z,X),T.side=2):Fr(T,z,X)}this.compile=function(T,z,X=null){X===null&&(X=T),M=Fe.get(X),M.init(z),w.push(M),X.traverseVisible(function(G){G.isLight&&G.layers.test(z.layers)&&(M.pushLight(G),G.castShadow&&M.pushShadow(G))}),T!==X&&T.traverseVisible(function(G){G.isLight&&G.layers.test(z.layers)&&(M.pushLight(G),G.castShadow&&M.pushShadow(G))}),M.setupLights();const W=new Set;return T.traverse(function(G){if(!(G.isMesh||G.isPoints||G.isLine||G.isSprite))return;const fe=G.material;if(fe)if(Array.isArray(fe))for(let xe=0;xe<fe.length;xe++){const we=fe[xe];hn(we,X,G),W.add(we)}else hn(fe,X,G),W.add(fe)}),M=w.pop(),W},this.compileAsync=function(T,z,X=null){const W=this.compile(T,z,X);return new Promise(G=>{function fe(){if(W.forEach(function(xe){E.get(xe).currentProgram.isReady()&&W.delete(xe)}),W.size===0){G(T);return}setTimeout(fe,10)}ve.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let Ws=null;function Eh(T){Ws&&Ws(T)}function mo(){qn.stop()}function go(){qn.start()}const qn=new rh;qn.setAnimationLoop(Eh),typeof self<"u"&&qn.setContext(self),this.setAnimationLoop=function(T){Ws=T,ee.setAnimationLoop(T),T===null?qn.stop():qn.start()},ee.addEventListener("sessionstart",mo),ee.addEventListener("sessionend",go),this.render=function(T,z){if(z!==void 0&&z.isCamera!==!0){ke("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(b===!0)return;const X=ee.enabled===!0&&ee.isPresenting===!0,W=C!==null&&(O===null||X)&&C.begin(_,O);if(T.matrixWorldAutoUpdate===!0&&T.updateMatrixWorld(),z.parent===null&&z.matrixWorldAutoUpdate===!0&&z.updateMatrixWorld(),ee.enabled===!0&&ee.isPresenting===!0&&(C===null||C.isCompositing()===!1)&&(ee.cameraAutoUpdate===!0&&ee.updateCamera(z),z=ee.getCamera()),T.isScene===!0&&T.onBeforeRender(_,T,z,O),M=Fe.get(T,w.length),M.init(z),w.push(M),Ne.multiplyMatrices(z.projectionMatrix,z.matrixWorldInverse),ae.setFromProjectionMatrix(Ne,Wi,z.reversedDepth),Oe=this.localClippingEnabled,Re=ie.init(this.clippingPlanes,Oe),S=De.get(T,I.length),S.init(),I.push(S),ee.enabled===!0&&ee.isPresenting===!0){const fe=_.xr.getDepthSensingMesh();fe!==null&&Xs(fe,z,-1/0,_.sortObjects)}Xs(T,z,0,_.sortObjects),S.finish(),_.sortObjects===!0&&S.sort(pe,de),ce=ee.enabled===!1||ee.isPresenting===!1||ee.hasDepthSensing()===!1,ce&&Ae.addToRenderList(S,T),this.info.render.frame++,Re===!0&&ie.beginShadows();const G=M.state.shadowsArray;if(he.render(G,T,z),Re===!0&&ie.endShadows(),this.info.autoReset===!0&&this.info.reset(),(W&&C.hasRenderPass())===!1){const fe=S.opaque,xe=S.transmissive;if(M.setupLights(),z.isArrayCamera){const we=z.cameras;if(xe.length>0)for(let be=0,We=we.length;be<We;be++){const $e=we[be];_o(fe,xe,T,$e)}ce&&Ae.render(T);for(let be=0,We=we.length;be<We;be++){const $e=we[be];vo(S,T,$e,$e.viewport)}}else xe.length>0&&_o(fe,xe,T,z),ce&&Ae.render(T),vo(S,T,z)}O!==null&&A===0&&(x.updateMultisampleRenderTarget(O),x.updateRenderTargetMipmap(O)),W&&C.end(_),T.isScene===!0&&T.onAfterRender(_,T,z),ge.resetDefaultState(),H=-1,k=null,w.pop(),w.length>0?(M=w[w.length-1],Re===!0&&ie.setGlobalState(_.clippingPlanes,M.state.camera)):M=null,I.pop(),I.length>0?S=I[I.length-1]:S=null};function Xs(T,z,X,W){if(T.visible===!1)return;if(T.layers.test(z.layers)){if(T.isGroup)X=T.renderOrder;else if(T.isLOD)T.autoUpdate===!0&&T.update(z);else if(T.isLight)M.pushLight(T),T.castShadow&&M.pushShadow(T);else if(T.isSprite){if(!T.frustumCulled||ae.intersectsSprite(T)){W&&Z.setFromMatrixPosition(T.matrixWorld).applyMatrix4(Ne);const fe=Y.update(T),xe=T.material;xe.visible&&S.push(T,fe,xe,X,Z.z,null)}}else if((T.isMesh||T.isLine||T.isPoints)&&(!T.frustumCulled||ae.intersectsObject(T))){const fe=Y.update(T),xe=T.material;if(W&&(T.boundingSphere!==void 0?(T.boundingSphere===null&&T.computeBoundingSphere(),Z.copy(T.boundingSphere.center)):(fe.boundingSphere===null&&fe.computeBoundingSphere(),Z.copy(fe.boundingSphere.center)),Z.applyMatrix4(T.matrixWorld).applyMatrix4(Ne)),Array.isArray(xe)){const we=fe.groups;for(let be=0,We=we.length;be<We;be++){const $e=we[be],nt=xe[$e.materialIndex];nt&&nt.visible&&S.push(T,fe,nt,X,Z.z,$e)}}else xe.visible&&S.push(T,fe,xe,X,Z.z,null)}}const G=T.children;for(let fe=0,xe=G.length;fe<xe;fe++)Xs(G[fe],z,X,W)}function vo(T,z,X,W){const{opaque:G,transmissive:fe,transparent:xe}=T;M.setupLightsView(X),Re===!0&&ie.setGlobalState(_.clippingPlanes,X),W&&me.viewport(L.copy(W)),G.length>0&&Or(G,z,X),fe.length>0&&Or(fe,z,X),xe.length>0&&Or(xe,z,X),me.buffers.depth.setTest(!0),me.buffers.depth.setMask(!0),me.buffers.color.setMask(!0),me.setPolygonOffset(!1)}function _o(T,z,X,W){if((X.isScene===!0?X.overrideMaterial:null)!==null)return;if(M.state.transmissionRenderTarget[W.id]===void 0){const nt=ve.has("EXT_color_buffer_half_float")||ve.has("EXT_color_buffer_float");M.state.transmissionRenderTarget[W.id]=new vn(1,1,{generateMipmaps:!0,type:nt?si:Hn,minFilter:Ki,samples:Math.max(4,Ve.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:qe.workingColorSpace})}const G=M.state.transmissionRenderTarget[W.id],fe=W.viewport||L;G.setSize(fe.z*_.transmissionResolutionScale,fe.w*_.transmissionResolutionScale);const xe=_.getRenderTarget(),we=_.getActiveCubeFace(),be=_.getActiveMipmapLevel();_.setRenderTarget(G),_.getClearColor($),j=_.getClearAlpha(),j<1&&_.setClearColor(16777215,.5),_.clear(),ce&&Ae.render(X);const We=_.toneMapping;_.toneMapping=0;const $e=W.viewport;if(W.viewport!==void 0&&(W.viewport=void 0),M.setupLightsView(W),Re===!0&&ie.setGlobalState(_.clippingPlanes,W),Or(T,X,W),x.updateMultisampleRenderTarget(G),x.updateRenderTargetMipmap(G),ve.has("WEBGL_multisampled_render_to_texture")===!1){let nt=!1;for(let Be=0,ut=z.length;Be<ut;Be++){const{object:gt,geometry:vt,material:it,group:Lt}=z[Be];if(it.side===2&&gt.layers.test(W.layers)){const Ue=it.side;it.side=1,it.needsUpdate=!0,yo(gt,X,W,vt,it,Lt),it.side=Ue,it.needsUpdate=!0,nt=!0}}nt===!0&&(x.updateMultisampleRenderTarget(G),x.updateRenderTargetMipmap(G))}_.setRenderTarget(xe,we,be),_.setClearColor($,j),$e!==void 0&&(W.viewport=$e),_.toneMapping=We}function Or(T,z,X){const W=z.isScene===!0?z.overrideMaterial:null;for(let G=0,fe=T.length;G<fe;G++){const xe=T[G],{object:we,geometry:be,group:We}=xe;let $e=xe.material;$e.allowOverride===!0&&W!==null&&($e=W),we.layers.test(X.layers)&&yo(we,z,X,be,$e,We)}}function yo(T,z,X,W,G,fe){T.onBeforeRender(_,z,X,W,G,fe),T.modelViewMatrix.multiplyMatrices(X.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),G.onBeforeRender(_,z,X,W,T,fe),G.transparent===!0&&G.side===2&&G.forceSinglePass===!1?(G.side=1,G.needsUpdate=!0,_.renderBufferDirect(X,z,W,G,T,fe),G.side=0,G.needsUpdate=!0,_.renderBufferDirect(X,z,W,G,T,fe),G.side=2):_.renderBufferDirect(X,z,W,G,T,fe),T.onAfterRender(_,z,X,W,G,fe)}function Fr(T,z,X){z.isScene!==!0&&(z=le);const W=E.get(T),G=M.state.lights,fe=M.state.shadowsArray,xe=G.state.version,we=Te.getParameters(T,G.state,fe,z,X),be=Te.getProgramCacheKey(we);let We=W.programs;W.environment=T.isMeshStandardMaterial||T.isMeshLambertMaterial||T.isMeshPhongMaterial?z.environment:null,W.fog=z.fog;const $e=T.isMeshStandardMaterial||T.isMeshLambertMaterial&&!T.envMap||T.isMeshPhongMaterial&&!T.envMap;W.envMap=V.get(T.envMap||W.environment,$e),W.envMapRotation=W.environment!==null&&T.envMap===null?z.environmentRotation:T.envMapRotation,We===void 0&&(T.addEventListener("dispose",Tt),We=new Map,W.programs=We);let nt=We.get(be);if(nt!==void 0){if(W.currentProgram===nt&&W.lightsStateVersion===xe)return Mo(T,we),nt}else we.uniforms=Te.getUniforms(T),T.onBeforeCompile(we,_),nt=Te.acquireProgram(we,be),We.set(be,nt),W.uniforms=we.uniforms;const Be=W.uniforms;return(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)&&(Be.clippingPlanes=ie.uniform),Mo(T,we),W.needsLights=wh(T),W.lightsStateVersion=xe,W.needsLights&&(Be.ambientLightColor.value=G.state.ambient,Be.lightProbe.value=G.state.probe,Be.directionalLights.value=G.state.directional,Be.directionalLightShadows.value=G.state.directionalShadow,Be.spotLights.value=G.state.spot,Be.spotLightShadows.value=G.state.spotShadow,Be.rectAreaLights.value=G.state.rectArea,Be.ltc_1.value=G.state.rectAreaLTC1,Be.ltc_2.value=G.state.rectAreaLTC2,Be.pointLights.value=G.state.point,Be.pointLightShadows.value=G.state.pointShadow,Be.hemisphereLights.value=G.state.hemi,Be.directionalShadowMatrix.value=G.state.directionalShadowMatrix,Be.spotLightMatrix.value=G.state.spotLightMatrix,Be.spotLightMap.value=G.state.spotLightMap,Be.pointShadowMatrix.value=G.state.pointShadowMatrix),W.currentProgram=nt,W.uniformsList=null,nt}function xo(T){if(T.uniformsList===null){const z=T.currentProgram.getUniforms();T.uniformsList=ws.seqWithValue(z.seq,T.uniforms)}return T.uniformsList}function Mo(T,z){const X=E.get(T);X.outputColorSpace=z.outputColorSpace,X.batching=z.batching,X.batchingColor=z.batchingColor,X.instancing=z.instancing,X.instancingColor=z.instancingColor,X.instancingMorph=z.instancingMorph,X.skinning=z.skinning,X.morphTargets=z.morphTargets,X.morphNormals=z.morphNormals,X.morphColors=z.morphColors,X.morphTargetsCount=z.morphTargetsCount,X.numClippingPlanes=z.numClippingPlanes,X.numIntersection=z.numClipIntersection,X.vertexAlphas=z.vertexAlphas,X.vertexTangents=z.vertexTangents,X.toneMapping=z.toneMapping}function bh(T,z,X,W,G){z.isScene!==!0&&(z=le),x.resetTextureUnits();const fe=z.fog,xe=W.isMeshStandardMaterial||W.isMeshLambertMaterial||W.isMeshPhongMaterial?z.environment:null,we=O===null?_.outputColorSpace:O.isXRRenderTarget===!0?O.texture.colorSpace:qt,be=W.isMeshStandardMaterial||W.isMeshLambertMaterial&&!W.envMap||W.isMeshPhongMaterial&&!W.envMap,We=V.get(W.envMap||xe,be),$e=W.vertexColors===!0&&!!X.attributes.color&&X.attributes.color.itemSize===4,nt=!!X.attributes.tangent&&(!!W.normalMap||W.anisotropy>0),Be=!!X.morphAttributes.position,ut=!!X.morphAttributes.normal,gt=!!X.morphAttributes.color;let vt=0;W.toneMapped&&(O===null||O.isXRRenderTarget===!0)&&(vt=_.toneMapping);const it=X.morphAttributes.position||X.morphAttributes.normal||X.morphAttributes.color,Lt=it!==void 0?it.length:0,Ue=E.get(W),Qt=M.state.lights;if(Re===!0&&(Oe===!0||T!==k)){const xt=T===k&&W.id===H;ie.setState(W,T,xt)}let st=!1;W.version===Ue.__version?(Ue.needsLights&&Ue.lightsStateVersion!==Qt.state.version||Ue.outputColorSpace!==we||G.isBatchedMesh&&Ue.batching===!1||!G.isBatchedMesh&&Ue.batching===!0||G.isBatchedMesh&&Ue.batchingColor===!0&&G.colorTexture===null||G.isBatchedMesh&&Ue.batchingColor===!1&&G.colorTexture!==null||G.isInstancedMesh&&Ue.instancing===!1||!G.isInstancedMesh&&Ue.instancing===!0||G.isSkinnedMesh&&Ue.skinning===!1||!G.isSkinnedMesh&&Ue.skinning===!0||G.isInstancedMesh&&Ue.instancingColor===!0&&G.instanceColor===null||G.isInstancedMesh&&Ue.instancingColor===!1&&G.instanceColor!==null||G.isInstancedMesh&&Ue.instancingMorph===!0&&G.morphTexture===null||G.isInstancedMesh&&Ue.instancingMorph===!1&&G.morphTexture!==null||Ue.envMap!==We||W.fog===!0&&Ue.fog!==fe||Ue.numClippingPlanes!==void 0&&(Ue.numClippingPlanes!==ie.numPlanes||Ue.numIntersection!==ie.numIntersection)||Ue.vertexAlphas!==$e||Ue.vertexTangents!==nt||Ue.morphTargets!==Be||Ue.morphNormals!==ut||Ue.morphColors!==gt||Ue.toneMapping!==vt||Ue.morphTargetsCount!==Lt)&&(st=!0):(st=!0,Ue.__version=W.version);let en=Ue.currentProgram;st===!0&&(en=Fr(W,z,G));let un=!1,Yn=!1,hi=!1;const ht=en.getUniforms(),Rt=Ue.uniforms;if(me.useProgram(en.program)&&(un=!0,Yn=!0,hi=!0),W.id!==H&&(H=W.id,Yn=!0),un||k!==T){me.buffers.depth.getReversed()&&T.reversedDepth!==!0&&(T._reversedDepth=!0,T.updateProjectionMatrix()),ht.setValue(R,"projectionMatrix",T.projectionMatrix),ht.setValue(R,"viewMatrix",T.matrixWorldInverse);const xt=ht.map.cameraPosition;xt!==void 0&&xt.setValue(R,Je.setFromMatrixPosition(T.matrixWorld)),Ve.logarithmicDepthBuffer&&ht.setValue(R,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2)),(W.isMeshPhongMaterial||W.isMeshToonMaterial||W.isMeshLambertMaterial||W.isMeshBasicMaterial||W.isMeshStandardMaterial||W.isShaderMaterial)&&ht.setValue(R,"isOrthographic",T.isOrthographicCamera===!0),k!==T&&(k=T,Yn=!0,hi=!0)}if(Ue.needsLights&&(Qt.state.directionalShadowMap.length>0&&ht.setValue(R,"directionalShadowMap",Qt.state.directionalShadowMap,x),Qt.state.spotShadowMap.length>0&&ht.setValue(R,"spotShadowMap",Qt.state.spotShadowMap,x),Qt.state.pointShadowMap.length>0&&ht.setValue(R,"pointShadowMap",Qt.state.pointShadowMap,x)),G.isSkinnedMesh){ht.setOptional(R,G,"bindMatrix"),ht.setOptional(R,G,"bindMatrixInverse");const xt=G.skeleton;xt&&(xt.boneTexture===null&&xt.computeBoneTexture(),ht.setValue(R,"boneTexture",xt.boneTexture,x))}G.isBatchedMesh&&(ht.setOptional(R,G,"batchingTexture"),ht.setValue(R,"batchingTexture",G._matricesTexture,x),ht.setOptional(R,G,"batchingIdTexture"),ht.setValue(R,"batchingIdTexture",G._indirectTexture,x),ht.setOptional(R,G,"batchingColorTexture"),G._colorsTexture!==null&&ht.setValue(R,"batchingColorTexture",G._colorsTexture,x));const Pn=X.morphAttributes;if((Pn.position!==void 0||Pn.normal!==void 0||Pn.color!==void 0)&&Ge.update(G,X,en),(Yn||Ue.receiveShadow!==G.receiveShadow)&&(Ue.receiveShadow=G.receiveShadow,ht.setValue(R,"receiveShadow",G.receiveShadow)),(W.isMeshStandardMaterial||W.isMeshLambertMaterial||W.isMeshPhongMaterial)&&W.envMap===null&&z.environment!==null&&(Rt.envMapIntensity.value=z.environmentIntensity),Rt.dfgLUT!==void 0&&(Rt.dfgLUT.value=tg()),Yn&&(ht.setValue(R,"toneMappingExposure",_.toneMappingExposure),Ue.needsLights&&Ah(Rt,hi),fe&&W.fog===!0&&_e.refreshFogUniforms(Rt,fe),_e.refreshMaterialUniforms(Rt,W,Q,re,M.state.transmissionRenderTarget[T.id]),ws.upload(R,xo(Ue),Rt,x)),W.isShaderMaterial&&W.uniformsNeedUpdate===!0&&(ws.upload(R,xo(Ue),Rt,x),W.uniformsNeedUpdate=!1),W.isSpriteMaterial&&ht.setValue(R,"center",G.center),ht.setValue(R,"modelViewMatrix",G.modelViewMatrix),ht.setValue(R,"normalMatrix",G.normalMatrix),ht.setValue(R,"modelMatrix",G.matrixWorld),W.isShaderMaterial||W.isRawShaderMaterial){const xt=W.uniformsGroups;for(let nr=0,ui=xt.length;nr<ui;nr++){const So=xt[nr];ue.update(So,en),ue.bind(So,en)}}return en}function Ah(T,z){T.ambientLightColor.needsUpdate=z,T.lightProbe.needsUpdate=z,T.directionalLights.needsUpdate=z,T.directionalLightShadows.needsUpdate=z,T.pointLights.needsUpdate=z,T.pointLightShadows.needsUpdate=z,T.spotLights.needsUpdate=z,T.spotLightShadows.needsUpdate=z,T.rectAreaLights.needsUpdate=z,T.hemisphereLights.needsUpdate=z}function wh(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return N},this.getActiveMipmapLevel=function(){return A},this.getRenderTarget=function(){return O},this.setRenderTargetTextures=function(T,z,X){const W=E.get(T);W.__autoAllocateDepthBuffer=T.resolveDepthBuffer===!1,W.__autoAllocateDepthBuffer===!1&&(W.__useRenderToTexture=!1),E.get(T.texture).__webglTexture=z,E.get(T.depthTexture).__webglTexture=W.__autoAllocateDepthBuffer?void 0:X,W.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(T,z){const X=E.get(T);X.__webglFramebuffer=z,X.__useDefaultFramebuffer=z===void 0};const Rh=R.createFramebuffer();this.setRenderTarget=function(T,z=0,X=0){O=T,N=z,A=X;let W=null,G=!1,fe=!1;if(T){const xe=E.get(T);if(xe.__useDefaultFramebuffer!==void 0){me.bindFramebuffer(R.FRAMEBUFFER,xe.__webglFramebuffer),L.copy(T.viewport),B.copy(T.scissor),U=T.scissorTest,me.viewport(L),me.scissor(B),me.setScissorTest(U),H=-1;return}else if(xe.__webglFramebuffer===void 0)x.setupRenderTarget(T);else if(xe.__hasExternalTextures)x.rebindTextures(T,E.get(T.texture).__webglTexture,E.get(T.depthTexture).__webglTexture);else if(T.depthBuffer){const We=T.depthTexture;if(xe.__boundDepthTexture!==We){if(We!==null&&E.has(We)&&(T.width!==We.image.width||T.height!==We.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");x.setupDepthRenderbuffer(T)}}const we=T.texture;(we.isData3DTexture||we.isDataArrayTexture||we.isCompressedArrayTexture)&&(fe=!0);const be=E.get(T).__webglFramebuffer;T.isWebGLCubeRenderTarget?(Array.isArray(be[z])?W=be[z][X]:W=be[z],G=!0):T.samples>0&&x.useMultisampledRTT(T)===!1?W=E.get(T).__webglMultisampledFramebuffer:Array.isArray(be)?W=be[X]:W=be,L.copy(T.viewport),B.copy(T.scissor),U=T.scissorTest}else L.copy(F).multiplyScalar(Q).floor(),B.copy(q).multiplyScalar(Q).floor(),U=se;if(X!==0&&(W=Rh),me.bindFramebuffer(R.FRAMEBUFFER,W)&&me.drawBuffers(T,W),me.viewport(L),me.scissor(B),me.setScissorTest(U),G){const xe=E.get(T.texture);R.framebufferTexture2D(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_CUBE_MAP_POSITIVE_X+z,xe.__webglTexture,X)}else if(fe){const xe=z;for(let we=0;we<T.textures.length;we++){const be=E.get(T.textures[we]);R.framebufferTextureLayer(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0+we,be.__webglTexture,X,xe)}}else if(T!==null&&X!==0){const xe=E.get(T.texture);R.framebufferTexture2D(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_2D,xe.__webglTexture,X)}H=-1},this.readRenderTargetPixels=function(T,z,X,W,G,fe,xe,we=0){if(!(T&&T.isWebGLRenderTarget)){ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let be=E.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&xe!==void 0&&(be=be[xe]),be){me.bindFramebuffer(R.FRAMEBUFFER,be);try{const We=T.textures[we],$e=We.format,nt=We.type;if(T.textures.length>1&&R.readBuffer(R.COLOR_ATTACHMENT0+we),!Ve.textureFormatReadable($e)){ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Ve.textureTypeReadable(nt)){ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}z>=0&&z<=T.width-W&&X>=0&&X<=T.height-G&&R.readPixels(z,X,W,G,D.convert($e),D.convert(nt),fe)}finally{const We=O!==null?E.get(O).__webglFramebuffer:null;me.bindFramebuffer(R.FRAMEBUFFER,We)}}},this.readRenderTargetPixelsAsync=async function(T,z,X,W,G,fe,xe,we=0){if(!(T&&T.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let be=E.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&xe!==void 0&&(be=be[xe]),be)if(z>=0&&z<=T.width-W&&X>=0&&X<=T.height-G){me.bindFramebuffer(R.FRAMEBUFFER,be);const We=T.textures[we],$e=We.format,nt=We.type;if(T.textures.length>1&&R.readBuffer(R.COLOR_ATTACHMENT0+we),!Ve.textureFormatReadable($e))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Ve.textureTypeReadable(nt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Be=R.createBuffer();R.bindBuffer(R.PIXEL_PACK_BUFFER,Be),R.bufferData(R.PIXEL_PACK_BUFFER,fe.byteLength,R.STREAM_READ),R.readPixels(z,X,W,G,D.convert($e),D.convert(nt),0);const ut=O!==null?E.get(O).__webglFramebuffer:null;me.bindFramebuffer(R.FRAMEBUFFER,ut);const gt=R.fenceSync(R.SYNC_GPU_COMMANDS_COMPLETE,0);return R.flush(),await Ru(R,gt,4),R.bindBuffer(R.PIXEL_PACK_BUFFER,Be),R.getBufferSubData(R.PIXEL_PACK_BUFFER,0,fe),R.deleteBuffer(Be),R.deleteSync(gt),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(T,z=null,X=0){const W=Math.pow(2,-X),G=Math.floor(T.image.width*W),fe=Math.floor(T.image.height*W),xe=z!==null?z.x:0,we=z!==null?z.y:0;x.setTexture2D(T,0),R.copyTexSubImage2D(R.TEXTURE_2D,X,0,0,xe,we,G,fe),me.unbindTexture()};const Ch=R.createFramebuffer(),Ih=R.createFramebuffer();this.copyTextureToTexture=function(T,z,X=null,W=null,G=0,fe=0){let xe,we,be,We,$e,nt,Be,ut,gt;const vt=T.isCompressedTexture?T.mipmaps[fe]:T.image;if(X!==null)xe=X.max.x-X.min.x,we=X.max.y-X.min.y,be=X.isBox3?X.max.z-X.min.z:1,We=X.min.x,$e=X.min.y,nt=X.isBox3?X.min.z:0;else{const Rt=Math.pow(2,-G);xe=Math.floor(vt.width*Rt),we=Math.floor(vt.height*Rt),T.isDataArrayTexture?be=vt.depth:T.isData3DTexture?be=Math.floor(vt.depth*Rt):be=1,We=0,$e=0,nt=0}W!==null?(Be=W.x,ut=W.y,gt=W.z):(Be=0,ut=0,gt=0);const it=D.convert(z.format),Lt=D.convert(z.type);let Ue;z.isData3DTexture?(x.setTexture3D(z,0),Ue=R.TEXTURE_3D):z.isDataArrayTexture||z.isCompressedArrayTexture?(x.setTexture2DArray(z,0),Ue=R.TEXTURE_2D_ARRAY):(x.setTexture2D(z,0),Ue=R.TEXTURE_2D),R.pixelStorei(R.UNPACK_FLIP_Y_WEBGL,z.flipY),R.pixelStorei(R.UNPACK_PREMULTIPLY_ALPHA_WEBGL,z.premultiplyAlpha),R.pixelStorei(R.UNPACK_ALIGNMENT,z.unpackAlignment);const Qt=R.getParameter(R.UNPACK_ROW_LENGTH),st=R.getParameter(R.UNPACK_IMAGE_HEIGHT),en=R.getParameter(R.UNPACK_SKIP_PIXELS),un=R.getParameter(R.UNPACK_SKIP_ROWS),Yn=R.getParameter(R.UNPACK_SKIP_IMAGES);R.pixelStorei(R.UNPACK_ROW_LENGTH,vt.width),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,vt.height),R.pixelStorei(R.UNPACK_SKIP_PIXELS,We),R.pixelStorei(R.UNPACK_SKIP_ROWS,$e),R.pixelStorei(R.UNPACK_SKIP_IMAGES,nt);const hi=T.isDataArrayTexture||T.isData3DTexture,ht=z.isDataArrayTexture||z.isData3DTexture;if(T.isDepthTexture){const Rt=E.get(T),Pn=E.get(z),xt=E.get(Rt.__renderTarget),nr=E.get(Pn.__renderTarget);me.bindFramebuffer(R.READ_FRAMEBUFFER,xt.__webglFramebuffer),me.bindFramebuffer(R.DRAW_FRAMEBUFFER,nr.__webglFramebuffer);for(let ui=0;ui<be;ui++)hi&&(R.framebufferTextureLayer(R.READ_FRAMEBUFFER,R.COLOR_ATTACHMENT0,E.get(T).__webglTexture,G,nt+ui),R.framebufferTextureLayer(R.DRAW_FRAMEBUFFER,R.COLOR_ATTACHMENT0,E.get(z).__webglTexture,fe,gt+ui)),R.blitFramebuffer(We,$e,xe,we,Be,ut,xe,we,R.DEPTH_BUFFER_BIT,R.NEAREST);me.bindFramebuffer(R.READ_FRAMEBUFFER,null),me.bindFramebuffer(R.DRAW_FRAMEBUFFER,null)}else if(G!==0||T.isRenderTargetTexture||E.has(T)){const Rt=E.get(T),Pn=E.get(z);me.bindFramebuffer(R.READ_FRAMEBUFFER,Ch),me.bindFramebuffer(R.DRAW_FRAMEBUFFER,Ih);for(let xt=0;xt<be;xt++)hi?R.framebufferTextureLayer(R.READ_FRAMEBUFFER,R.COLOR_ATTACHMENT0,Rt.__webglTexture,G,nt+xt):R.framebufferTexture2D(R.READ_FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_2D,Rt.__webglTexture,G),ht?R.framebufferTextureLayer(R.DRAW_FRAMEBUFFER,R.COLOR_ATTACHMENT0,Pn.__webglTexture,fe,gt+xt):R.framebufferTexture2D(R.DRAW_FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_2D,Pn.__webglTexture,fe),G!==0?R.blitFramebuffer(We,$e,xe,we,Be,ut,xe,we,R.COLOR_BUFFER_BIT,R.NEAREST):ht?R.copyTexSubImage3D(Ue,fe,Be,ut,gt+xt,We,$e,xe,we):R.copyTexSubImage2D(Ue,fe,Be,ut,We,$e,xe,we);me.bindFramebuffer(R.READ_FRAMEBUFFER,null),me.bindFramebuffer(R.DRAW_FRAMEBUFFER,null)}else ht?T.isDataTexture||T.isData3DTexture?R.texSubImage3D(Ue,fe,Be,ut,gt,xe,we,be,it,Lt,vt.data):z.isCompressedArrayTexture?R.compressedTexSubImage3D(Ue,fe,Be,ut,gt,xe,we,be,it,vt.data):R.texSubImage3D(Ue,fe,Be,ut,gt,xe,we,be,it,Lt,vt):T.isDataTexture?R.texSubImage2D(R.TEXTURE_2D,fe,Be,ut,xe,we,it,Lt,vt.data):T.isCompressedTexture?R.compressedTexSubImage2D(R.TEXTURE_2D,fe,Be,ut,vt.width,vt.height,it,vt.data):R.texSubImage2D(R.TEXTURE_2D,fe,Be,ut,xe,we,it,Lt,vt);R.pixelStorei(R.UNPACK_ROW_LENGTH,Qt),R.pixelStorei(R.UNPACK_IMAGE_HEIGHT,st),R.pixelStorei(R.UNPACK_SKIP_PIXELS,en),R.pixelStorei(R.UNPACK_SKIP_ROWS,un),R.pixelStorei(R.UNPACK_SKIP_IMAGES,Yn),fe===0&&z.generateMipmaps&&R.generateMipmap(Ue),me.unbindTexture()},this.initRenderTarget=function(T){E.get(T).__webglFramebuffer===void 0&&x.setupRenderTarget(T)},this.initTexture=function(T){T.isCubeTexture?x.setTextureCube(T,0):T.isData3DTexture?x.setTexture3D(T,0):T.isDataArrayTexture||T.isCompressedArrayTexture?x.setTexture2DArray(T,0):x.setTexture2D(T,0),me.unbindTexture()},this.resetState=function(){N=0,A=0,O=null,me.reset(),ge.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Wi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=qe._getDrawingBufferColorSpace(e),t.unpackColorSpace=qe._getUnpackColorSpace()}};function zl(e,t){if(t===0)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),e;if(t===2||t===1){let n=e.getIndex();if(n===null){const a=[],o=e.getAttribute("position");if(o!==void 0){for(let l=0;l<o.count;l++)a.push(l);e.setIndex(a),n=e.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),e}const i=n.count-2,r=[];if(t===2)for(let a=1;a<=i;a++)r.push(n.getX(0)),r.push(n.getX(a)),r.push(n.getX(a+1));else for(let a=0;a<i;a++)a%2===0?(r.push(n.getX(a)),r.push(n.getX(a+1)),r.push(n.getX(a+2))):(r.push(n.getX(a+2)),r.push(n.getX(a+1)),r.push(n.getX(a)));r.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const s=e.clone();return s.setIndex(r),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",t),e}function ng(e){const t=new Map,n=new Map,i=e.clone();return hh(e,i,function(r,s){t.set(s,r),n.set(r,s)}),i.traverse(function(r){if(!r.isSkinnedMesh)return;const s=r,a=t.get(r),o=a.skeleton.bones;s.skeleton=a.skeleton.clone(),s.bindMatrix.copy(a.bindMatrix),s.skeleton.bones=o.map(function(l){return n.get(l)}),s.bind(s.skeleton,s.bindMatrix)}),i}function hh(e,t,n){n(e,t);for(let i=0;i<e.children.length;i++)hh(e.children[i],t.children[i],n)}var kv=class extends $t{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new og(t)}),this.register(function(t){return new lg(t)}),this.register(function(t){return new vg(t)}),this.register(function(t){return new _g(t)}),this.register(function(t){return new yg(t)}),this.register(function(t){return new hg(t)}),this.register(function(t){return new ug(t)}),this.register(function(t){return new fg(t)}),this.register(function(t){return new dg(t)}),this.register(function(t){return new ag(t)}),this.register(function(t){return new pg(t)}),this.register(function(t){return new cg(t)}),this.register(function(t){return new gg(t)}),this.register(function(t){return new mg(t)}),this.register(function(t){return new rg(t)}),this.register(function(t){return new Vl(t,tt.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new Vl(t,tt.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new xg(t)})}load(e,t,n,i){const r=this;let s;if(this.resourcePath!=="")s=this.resourcePath;else if(this.path!==""){const l=zi.extractUrlBase(e);s=zi.resolveURL(l,this.path)}else s=zi.extractUrlBase(e);this.manager.itemStart(e);const a=function(l){i?i(l):console.error(l),r.manager.itemError(e),r.manager.itemEnd(e)},o=new er(this.manager);o.setPath(this.path),o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(l){try{r.parse(l,s,function(c){t(c),r.manager.itemEnd(e)},a)}catch(c){a(c)}},n,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let r;const s={},a={},o=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(o.decode(new Uint8Array(e,0,4))===uh){try{s[tt.KHR_BINARY_GLTF]=new Mg(e)}catch(c){i&&i(c);return}r=JSON.parse(s[tt.KHR_BINARY_GLTF].content)}else r=JSON.parse(o.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const l=new Ng(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});l.fileLoader.setRequestHeader(this.requestHeader);for(let c=0;c<this.pluginCallbacks.length;c++){const h=this.pluginCallbacks[c](l);h.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[h.name]=h,s[h.name]=!0}if(r.extensionsUsed)for(let c=0;c<r.extensionsUsed.length;++c){const h=r.extensionsUsed[c],u=r.extensionsRequired||[];switch(h){case tt.KHR_MATERIALS_UNLIT:s[h]=new sg;break;case tt.KHR_DRACO_MESH_COMPRESSION:s[h]=new Sg(r,this.dracoLoader);break;case tt.KHR_TEXTURE_TRANSFORM:s[h]=new Tg;break;case tt.KHR_MESH_QUANTIZATION:s[h]=new Eg;break;default:u.indexOf(h)>=0&&a[h]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+h+'".')}}l.setExtensions(s),l.setPlugins(a),l.parse(n,i)}parseAsync(e,t){const n=this;return new Promise(function(i,r){n.parse(e,t,i,r)})}};function ig(){let e={};return{get:function(t){return e[t]},add:function(t,n){e[t]=n},remove:function(t){delete e[t]},removeAll:function(){e={}}}}function yt(e,t,n){const i=e.json.materials[t];return i.extensions&&i.extensions[n]?i.extensions[n]:null}var tt={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},rg=class{constructor(e){this.parser=e,this.name=tt.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){const r=t[n];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){const t=this.parser,n="light:"+e;let i=t.cache.get(n);if(i)return i;const r=t.json,s=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e];let a;const o=new Ee(16777215);s.color!==void 0&&o.setRGB(s.color[0],s.color[1],s.color[2],qt);const l=s.range!==void 0?s.range:0;switch(s.type){case"directional":a=new ih(o),a.target.position.set(0,0,-1),a.add(a.target);break;case"point":a=new ja(o),a.distance=l;break;case"spot":a=new nh(o),a.distance=l,s.spot=s.spot||{},s.spot.innerConeAngle=s.spot.innerConeAngle!==void 0?s.spot.innerConeAngle:0,s.spot.outerConeAngle=s.spot.outerConeAngle!==void 0?s.spot.outerConeAngle:Math.PI/4,a.angle=s.spot.outerConeAngle,a.penumbra=1-s.spot.innerConeAngle/s.spot.outerConeAngle,a.target.position.set(0,0,-1),a.add(a.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+s.type)}return a.position.set(0,0,0),pn(a,s),s.intensity!==void 0&&(a.intensity=s.intensity),a.name=t.createUniqueName(s.name||"light_"+e),i=Promise.resolve(a),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){const t=this,n=this.parser,i=n.json.nodes[e],r=(i.extensions&&i.extensions[this.name]||{}).light;return r===void 0?null:this._loadLight(r).then(function(s){return n._getNodeRef(t.cache,r,s)})}},sg=class{constructor(){this.name=tt.KHR_MATERIALS_UNLIT}getMaterialType(){return zn}extendParams(e,t,n){const i=[];e.color=new Ee(1,1,1),e.opacity=1;const r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){const s=r.baseColorFactor;e.color.setRGB(s[0],s[1],s[2],qt),e.opacity=s[3]}r.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",r.baseColorTexture,rt))}return Promise.all(i)}},ag=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}},og=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatMap",n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(i.push(this.parser.assignTexture(t,"clearcoatNormalMap",n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){const r=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new oe(r,r)}return Promise.all(i)}},lg=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_DISPERSION}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion!==void 0?n.dispersion:0),Promise.resolve()}},cg=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceMap",n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceThicknessMap",n.iridescenceThicknessTexture)),Promise.all(i)}},hg=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_SHEEN}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];if(t.sheenColor=new Ee(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){const r=n.sheenColorFactor;t.sheenColor.setRGB(r[0],r[1],r[2],qt)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenColorMap",n.sheenColorTexture,rt)),n.sheenRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenRoughnessMap",n.sheenRoughnessTexture)),Promise.all(i)}},ug=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&i.push(this.parser.assignTexture(t,"transmissionMap",n.transmissionTexture)),Promise.all(i)}},fg=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_VOLUME}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];t.thickness=n.thicknessFactor!==void 0?n.thicknessFactor:0,n.thicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"thicknessMap",n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;const r=n.attenuationColor||[1,1,1];return t.attenuationColor=new Ee().setRGB(r[0],r[1],r[2],qt),Promise.all(i)}},dg=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_IOR}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);return n===null||(t.ior=n.ior!==void 0?n.ior:1.5),Promise.resolve()}},pg=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_SPECULAR}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];t.specularIntensity=n.specularFactor!==void 0?n.specularFactor:1,n.specularTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularIntensityMap",n.specularTexture));const r=n.specularColorFactor||[1,1,1];return t.specularColor=new Ee().setRGB(r[0],r[1],r[2],qt),n.specularColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularColorMap",n.specularColorTexture,rt)),Promise.all(i)}},mg=class{constructor(e){this.parser=e,this.name=tt.EXT_MATERIALS_BUMP}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return t.bumpScale=n.bumpFactor!==void 0?n.bumpFactor:1,n.bumpTexture!==void 0&&i.push(this.parser.assignTexture(t,"bumpMap",n.bumpTexture)),Promise.all(i)}},gg=class{constructor(e){this.parser=e,this.name=tt.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return yt(this.parser,e,this.name)!==null?xn:null}extendMaterialParams(e,t){const n=yt(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&i.push(this.parser.assignTexture(t,"anisotropyMap",n.anisotropyTexture)),Promise.all(i)}},vg=class{constructor(e){this.parser=e,this.name=tt.KHR_TEXTURE_BASISU}loadTexture(e){const t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;const r=i.extensions[this.name],s=t.options.ktx2Loader;if(!s){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,s)}},_g=class{constructor(e){this.parser=e,this.name=tt.EXT_TEXTURE_WEBP}loadTexture(e){const t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;const s=r.extensions[t],a=i.images[s.source];let o=n.textureLoader;if(a.uri){const l=n.options.manager.getHandler(a.uri);l!==null&&(o=l)}return n.loadTextureImage(e,s.source,o)}},yg=class{constructor(e){this.parser=e,this.name=tt.EXT_TEXTURE_AVIF}loadTexture(e){const t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;const s=r.extensions[t],a=i.images[s.source];let o=n.textureLoader;if(a.uri){const l=n.options.manager.getHandler(a.uri);l!==null&&(o=l)}return n.loadTextureImage(e,s.source,o)}},Vl=class{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){const t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){const i=n.extensions[this.name],r=this.parser.getDependency("buffer",i.buffer),s=this.parser.options.meshoptDecoder;if(!s||!s.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(a){const o=i.byteOffset||0,l=i.byteLength||0,c=i.count,h=i.byteStride,u=new Uint8Array(a,o,l);return s.decodeGltfBufferAsync?s.decodeGltfBufferAsync(c,h,u,i.mode,i.filter).then(function(f){return f.buffer}):s.ready.then(function(){const f=new ArrayBuffer(c*h);return s.decodeGltfBuffer(new Uint8Array(f),c,h,u,i.mode,i.filter),f})})}else return null}},xg=class{constructor(e){this.name=tt.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){const t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;const i=t.meshes[n.mesh];for(const o of i.primitives)if(o.mode!==Kt.TRIANGLES&&o.mode!==Kt.TRIANGLE_STRIP&&o.mode!==Kt.TRIANGLE_FAN&&o.mode!==void 0)return null;const r=n.extensions[this.name].attributes,s=[],a={};for(const o in r)s.push(this.parser.getDependency("accessor",r[o]).then(l=>(a[o]=l,a[o])));return s.length<1?null:(s.push(this.parser.createNodeMesh(e)),Promise.all(s).then(o=>{const l=o.pop(),c=l.isGroup?l.children:[l],h=o[0].count,u=[];for(const f of c){const d=new Ie,g=new P,v=new St,p=new P(1,1,1),m=new mf(f.geometry,f.material,h);for(let y=0;y<h;y++)a.TRANSLATION&&g.fromBufferAttribute(a.TRANSLATION,y),a.ROTATION&&v.fromBufferAttribute(a.ROTATION,y),a.SCALE&&p.fromBufferAttribute(a.SCALE,y),m.setMatrixAt(y,d.compose(g,v,p));for(const y in a)if(y==="_COLOR_0"){const S=a[y];m.instanceColor=new Ha(S.array,S.itemSize,S.normalized)}else y!=="TRANSLATION"&&y!=="ROTATION"&&y!=="SCALE"&&f.geometry.setAttribute(y,a[y]);ft.prototype.copy.call(m,f),this.parser.assignFinalMaterial(m),u.push(m)}return l.isGroup?(l.clear(),l.add(...u),l):u[0]}))}},uh="glTF",mr=12,Gl={JSON:1313821514,BIN:5130562},Mg=class{constructor(e){this.name=tt.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,mr),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==uh)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const i=this.header.length-mr,r=new DataView(e,mr);let s=0;for(;s<i;){const a=r.getUint32(s,!0);s+=4;const o=r.getUint32(s,!0);if(s+=4,o===Gl.JSON){const l=new Uint8Array(e,mr+s,a);this.content=n.decode(l)}else if(o===Gl.BIN){const l=mr+s;this.body=e.slice(l,l+a)}s+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},Sg=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=tt.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){const n=this.json,i=this.dracoLoader,r=e.extensions[this.name].bufferView,s=e.extensions[this.name].attributes,a={},o={},l={};for(const c in s){const h=$a[c]||c.toLowerCase();a[h]=s[c]}for(const c in e.attributes){const h=$a[c]||c.toLowerCase();if(s[c]!==void 0){const u=n.accessors[e.attributes[c]];l[h]=Vi[u.componentType].name,o[h]=u.normalized===!0}}return t.getDependency("bufferView",r).then(function(c){return new Promise(function(h,u){i.decodeDracoFile(c,function(f){for(const d in f.attributes){const g=f.attributes[d],v=o[d];v!==void 0&&(g.normalized=v)}h(f)},a,l,qt,u)})})}},Tg=class{constructor(){this.name=tt.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}},Eg=class{constructor(){this.name=tt.KHR_MESH_QUANTIZATION}},fh=class extends Zi{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i*3+i;for(let s=0;s!==i;s++)t[s]=n[r+s];return t}interpolate_(e,t,n,i){const r=this.resultBuffer,s=this.sampleValues,a=this.valueSize,o=a*2,l=a*3,c=i-t,h=(n-t)/c,u=h*h,f=u*h,d=e*l,g=d-l,v=-2*f+3*u,p=f-u,m=1-v,y=p-u+h;for(let S=0;S!==a;S++){const M=s[g+S+a],I=s[g+S+o]*c,w=s[d+S+a],C=s[d+S]*c;r[S]=m*M+y*I+v*w+p*C}return r}},bg=new St,Ag=class extends fh{interpolate_(e,t,n,i){const r=super.interpolate_(e,t,n,i);return bg.fromArray(r).normalize().toArray(r),r}},Kt={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Vi={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Hl={9728:Ot,9729:It,9984:$l,9985:ec,9986:Ql,9987:Ki},Wl={33071:Ht,33648:Rs,10497:Gi},Da={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},$a={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Bn={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},wg={CUBICSPLINE:void 0,LINEAR:br,STEP:Er},Na={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function Rg(e){return e.DefaultMaterial===void 0&&(e.DefaultMaterial=new ho({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:0})),e.DefaultMaterial}function ei(e,t,n){for(const i in n.extensions)e[i]===void 0&&(t.userData.gltfExtensions=t.userData.gltfExtensions||{},t.userData.gltfExtensions[i]=n.extensions[i])}function pn(e,t){t.extras!==void 0&&(typeof t.extras=="object"?Object.assign(e.userData,t.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+t.extras))}function Cg(e,t,n){let i=!1,r=!1,s=!1;for(let c=0,h=t.length;c<h;c++){const u=t[c];if(u.POSITION!==void 0&&(i=!0),u.NORMAL!==void 0&&(r=!0),u.COLOR_0!==void 0&&(s=!0),i&&r&&s)break}if(!i&&!r&&!s)return Promise.resolve(e);const a=[],o=[],l=[];for(let c=0,h=t.length;c<h;c++){const u=t[c];if(i){const f=u.POSITION!==void 0?n.getDependency("accessor",u.POSITION):e.attributes.position;a.push(f)}if(r){const f=u.NORMAL!==void 0?n.getDependency("accessor",u.NORMAL):e.attributes.normal;o.push(f)}if(s){const f=u.COLOR_0!==void 0?n.getDependency("accessor",u.COLOR_0):e.attributes.color;l.push(f)}}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l)]).then(function(c){const h=c[0],u=c[1],f=c[2];return i&&(e.morphAttributes.position=h),r&&(e.morphAttributes.normal=u),s&&(e.morphAttributes.color=f),e.morphTargetsRelative=!0,e})}function Ig(e,t){if(e.updateMorphTargets(),t.weights!==void 0)for(let n=0,i=t.weights.length;n<i;n++)e.morphTargetInfluences[n]=t.weights[n];if(t.extras&&Array.isArray(t.extras.targetNames)){const n=t.extras.targetNames;if(e.morphTargetInfluences.length===n.length){e.morphTargetDictionary={};for(let i=0,r=n.length;i<r;i++)e.morphTargetDictionary[n[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function Pg(e){let t;const n=e.extensions&&e.extensions[tt.KHR_DRACO_MESH_COMPRESSION];if(n?t="draco:"+n.bufferView+":"+n.indices+":"+Ua(n.attributes):t=e.indices+":"+Ua(e.attributes)+":"+e.mode,e.targets!==void 0)for(let i=0,r=e.targets.length;i<r;i++)t+=":"+Ua(e.targets[i]);return t}function Ua(e){let t="";const n=Object.keys(e).sort();for(let i=0,r=n.length;i<r;i++)t+=n[i]+":"+e[n[i]]+";";return t}function Qa(e){switch(e){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function Lg(e){return e.search(/\.jpe?g($|\?)/i)>0||e.search(/^data\:image\/jpeg/)===0?"image/jpeg":e.search(/\.webp($|\?)/i)>0||e.search(/^data\:image\/webp/)===0?"image/webp":e.search(/\.ktx2($|\?)/i)>0||e.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var Dg=new Ie,Ng=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new ig,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,r=!1,s=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){const a=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(a)===!0;const o=a.match(/Version\/(\d+)/);i=n&&o?parseInt(o[1],10):-1,r=a.indexOf("Firefox")>-1,s=r?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||r&&s<98?this.textureLoader=new eh(this.options.manager):this.textureLoader=new wd(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new er(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){const n=this,i=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(s){return s._markDefs&&s._markDefs()}),Promise.all(this._invokeAll(function(s){return s.beforeRoot&&s.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(s){const a={scene:s[0][i.scene||0],scenes:s[0],animations:s[1],cameras:s[2],asset:i.asset,parser:n,userData:{}};return ei(r,a,i),pn(a,i),Promise.all(n._invokeAll(function(o){return o.afterRoot&&o.afterRoot(a)})).then(function(){for(const o of a.scenes)o.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,r=t.length;i<r;i++){const s=t[i].joints;for(let a=0,o=s.length;a<o;a++)e[s[a]].isBone=!0}for(let i=0,r=e.length;i<r;i++){const s=e[i];s.mesh!==void 0&&(this._addNodeRef(this.meshCache,s.mesh),s.skin!==void 0&&(n[s.mesh].isSkinnedMesh=!0)),s.camera!==void 0&&this._addNodeRef(this.cameraCache,s.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;const i=n.clone(),r=(s,a)=>{const o=this.associations.get(s);o!=null&&this.associations.set(a,o);for(const[l,c]of s.children.entries())r(c,a.children[l])};return r(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){const i=e(t[n]);if(i)return i}return null}_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const n=[];for(let i=0;i<t.length;i++){const r=e(t[i]);r&&n.push(r)}return n}getDependency(e,t){const n=e+":"+t;let i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":i=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){const n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(r,s){return n.getDependency(e,s)})),this.cache.add(e,t)}return t}loadBuffer(e){const t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[tt.KHR_BINARY_GLTF].body);const i=this.options;return new Promise(function(r,s){n.load(zi.resolveURL(t.uri,i.path),r,void 0,function(){s(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){const i=t.byteLength||0,r=t.byteOffset||0;return n.slice(r,r+i)})}loadAccessor(e){const t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){const s=Da[i.type],a=Vi[i.componentType],o=i.normalized===!0,l=new a(i.count*s);return Promise.resolve(new wt(l,s,o))}const r=[];return i.bufferView!==void 0?r.push(this.getDependency("bufferView",i.bufferView)):r.push(null),i.sparse!==void 0&&(r.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(r).then(function(s){const a=s[0],o=Da[i.type],l=Vi[i.componentType],c=l.BYTES_PER_ELEMENT,h=c*o,u=i.byteOffset||0,f=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,d=i.normalized===!0;let g,v;if(f&&f!==h){const p=Math.floor(u/f),m="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+p+":"+i.count;let y=t.cache.get(m);y||(g=new l(a,p*f,i.count*f/c),y=new Tc(g,f/c),t.cache.add(m,y)),v=new Ga(y,o,u%f/c,d)}else a===null?g=new l(i.count*o):g=new l(a,u,i.count*o),v=new wt(g,o,d);if(i.sparse!==void 0){const p=Da.SCALAR,m=Vi[i.sparse.indices.componentType],y=i.sparse.indices.byteOffset||0,S=i.sparse.values.byteOffset||0,M=new m(s[1],y,i.sparse.count*p),I=new l(s[2],S,i.sparse.count*o);a!==null&&(v=new wt(v.array.slice(),v.itemSize,v.normalized)),v.normalized=!1;for(let w=0,C=M.length;w<C;w++){const _=M[w];if(v.setX(_,I[w*o]),o>=2&&v.setY(_,I[w*o+1]),o>=3&&v.setZ(_,I[w*o+2]),o>=4&&v.setW(_,I[w*o+3]),o>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}v.normalized=d}return v})}loadTexture(e){const t=this.json,n=this.options,i=t.textures[e].source,r=t.images[i];let s=this.textureLoader;if(r.uri){const a=n.manager.getHandler(r.uri);a!==null&&(s=a)}return this.loadTextureImage(e,i,s)}loadTextureImage(e,t,n){const i=this,r=this.json,s=r.textures[e],a=r.images[t],o=(a.uri||a.bufferView)+":"+s.sampler;if(this.textureCache[o])return this.textureCache[o];const l=this.loadImageSource(t,n).then(function(c){c.flipY=!1,c.name=s.name||a.name||"",c.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(c.name=a.uri);const h=(r.samplers||{})[s.sampler]||{};return c.magFilter=Hl[h.magFilter]||1006,c.minFilter=Hl[h.minFilter]||1008,c.wrapS=Wl[h.wrapS]||1e3,c.wrapT=Wl[h.wrapT]||1e3,c.generateMipmaps=!c.isCompressedTexture&&c.minFilter!==1003&&c.minFilter!==1006,i.associations.set(c,{textures:e}),c}).catch(function(){return null});return this.textureCache[o]=l,l}loadImageSource(e,t){const n=this,i=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(h=>h.clone());const s=i.images[e],a=self.URL||self.webkitURL;let o=s.uri||"",l=!1;if(s.bufferView!==void 0)o=n.getDependency("bufferView",s.bufferView).then(function(h){l=!0;const u=new Blob([h],{type:s.mimeType});return o=a.createObjectURL(u),o});else if(s.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const c=Promise.resolve(o).then(function(h){return new Promise(function(u,f){let d=u;t.isImageBitmapLoader===!0&&(d=function(g){const v=new Ft(g);v.needsUpdate=!0,u(v)}),t.load(zi.resolveURL(h,r.path),d,void 0,f)})}).then(function(h){return l===!0&&a.revokeObjectURL(o),pn(h,s),h.userData.mimeType=s.mimeType||Lg(s.uri),h}).catch(function(h){throw console.error("THREE.GLTFLoader: Couldn't load texture",o),h});return this.sourceCache[e]=c,c}assignTexture(e,t,n,i){const r=this;return this.getDependency("texture",n.index).then(function(s){if(!s)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(s=s.clone(),s.channel=n.texCoord),r.extensions[tt.KHR_TEXTURE_TRANSFORM]){const a=n.extensions!==void 0?n.extensions[tt.KHR_TEXTURE_TRANSFORM]:void 0;if(a){const o=r.associations.get(s);s=r.extensions[tt.KHR_TEXTURE_TRANSFORM].extendTexture(s,a),r.associations.set(s,o)}}return i!==void 0&&(s.colorSpace=i),e[t]=s,s})}assignFinalMaterial(e){const t=e.geometry;let n=e.material;const i=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,s=t.attributes.normal===void 0;if(e.isPoints){const a="PointsMaterial:"+n.uuid;let o=this.cache.get(a);o||(o=new Oi,Gt.prototype.copy.call(o,n),o.color.copy(n.color),o.map=n.map,o.sizeAttenuation=!1,this.cache.add(a,o)),n=o}else if(e.isLine){const a="LineBasicMaterial:"+n.uuid;let o=this.cache.get(a);o||(o=new Wn,Gt.prototype.copy.call(o,n),o.color.copy(n.color),o.map=n.map,this.cache.add(a,o)),n=o}if(i||r||s){let a="ClonedMaterial:"+n.uuid+":";i&&(a+="derivative-tangents:"),r&&(a+="vertex-colors:"),s&&(a+="flat-shading:");let o=this.cache.get(a);o||(o=n.clone(),r&&(o.vertexColors=!0),s&&(o.flatShading=!0),i&&(o.normalScale&&(o.normalScale.y*=-1),o.clearcoatNormalScale&&(o.clearcoatNormalScale.y*=-1)),this.cache.add(a,o),this.associations.set(o,this.associations.get(n))),n=o}e.material=n}getMaterialType(){return ho}loadMaterial(e){const t=this,n=this.json,i=this.extensions,r=n.materials[e];let s;const a={},o=r.extensions||{},l=[];if(o[tt.KHR_MATERIALS_UNLIT]){const h=i[tt.KHR_MATERIALS_UNLIT];s=h.getMaterialType(),l.push(h.extendParams(a,r,t))}else{const h=r.pbrMetallicRoughness||{};if(a.color=new Ee(1,1,1),a.opacity=1,Array.isArray(h.baseColorFactor)){const u=h.baseColorFactor;a.color.setRGB(u[0],u[1],u[2],qt),a.opacity=u[3]}h.baseColorTexture!==void 0&&l.push(t.assignTexture(a,"map",h.baseColorTexture,rt)),a.metalness=h.metallicFactor!==void 0?h.metallicFactor:1,a.roughness=h.roughnessFactor!==void 0?h.roughnessFactor:1,h.metallicRoughnessTexture!==void 0&&(l.push(t.assignTexture(a,"metalnessMap",h.metallicRoughnessTexture)),l.push(t.assignTexture(a,"roughnessMap",h.metallicRoughnessTexture))),s=this._invokeOne(function(u){return u.getMaterialType&&u.getMaterialType(e)}),l.push(Promise.all(this._invokeAll(function(u){return u.extendMaterialParams&&u.extendMaterialParams(e,a)})))}r.doubleSided===!0&&(a.side=2);const c=r.alphaMode||Na.OPAQUE;if(c===Na.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,c===Na.MASK&&(a.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&s!==zn&&(l.push(t.assignTexture(a,"normalMap",r.normalTexture)),a.normalScale=new oe(1,1),r.normalTexture.scale!==void 0)){const h=r.normalTexture.scale;a.normalScale.set(h,h)}if(r.occlusionTexture!==void 0&&s!==zn&&(l.push(t.assignTexture(a,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&s!==zn){const h=r.emissiveFactor;a.emissive=new Ee().setRGB(h[0],h[1],h[2],qt)}return r.emissiveTexture!==void 0&&s!==zn&&l.push(t.assignTexture(a,"emissiveMap",r.emissiveTexture,rt)),Promise.all(l).then(function(){const h=new s(a);return r.name&&(h.name=r.name),pn(h,r),t.associations.set(h,{materials:e}),r.extensions&&ei(i,h,r),h})}createUniqueName(e){const t=lt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){const t=this,n=this.extensions,i=this.primitiveCache;function r(a){return n[tt.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(o){return Xl(o,a,t)})}const s=[];for(let a=0,o=e.length;a<o;a++){const l=e[a],c=Pg(l),h=i[c];if(h)s.push(h.promise);else{let u;l.extensions&&l.extensions[tt.KHR_DRACO_MESH_COMPRESSION]?u=r(l):u=Xl(new dt,l,t),i[c]={primitive:l,promise:u},s.push(u)}}return Promise.all(s)}loadMesh(e){const t=this,n=this.json,i=this.extensions,r=n.meshes[e],s=r.primitives,a=[];for(let o=0,l=s.length;o<l;o++){const c=s[o].material===void 0?Rg(this.cache):this.getDependency("material",s[o].material);a.push(c)}return a.push(t.loadGeometries(s)),Promise.all(a).then(function(o){const l=o.slice(0,o.length-1),c=o[o.length-1],h=[];for(let f=0,d=c.length;f<d;f++){const g=c[f],v=s[f];let p;const m=l[f];if(v.mode===Kt.TRIANGLES||v.mode===Kt.TRIANGLE_STRIP||v.mode===Kt.TRIANGLE_FAN||v.mode===void 0)p=r.isSkinnedMesh===!0?new Ac(g,m):new Pt(g,m),p.isSkinnedMesh===!0&&p.normalizeSkinWeights(),v.mode===Kt.TRIANGLE_STRIP?p.geometry=zl(p.geometry,1):v.mode===Kt.TRIANGLE_FAN&&(p.geometry=zl(p.geometry,2));else if(v.mode===Kt.LINES)p=new Bs(g,m);else if(v.mode===Kt.LINE_STRIP)p=new Dr(g,m);else if(v.mode===Kt.LINE_LOOP)p=new yf(g,m);else if(v.mode===Kt.POINTS)p=new As(g,m);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+v.mode);Object.keys(p.geometry.morphAttributes).length>0&&Ig(p,r),p.name=t.createUniqueName(r.name||"mesh_"+e),pn(p,r),v.extensions&&ei(i,p,v),t.assignFinalMaterial(p),h.push(p)}for(let f=0,d=h.length;f<d;f++)t.associations.set(h[f],{meshes:e,primitives:f});if(h.length===1)return r.extensions&&ei(i,h[0],r),h[0];const u=new gn;r.extensions&&ei(i,u,r),t.associations.set(u,{meshes:e});for(let f=0,d=h.length;f<d;f++)u.add(h[f]);return u})}loadCamera(e){let t;const n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new Vt(Ut.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new Vs(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),pn(t,n),Promise.resolve(t)}loadSkin(e){const t=this.json.skins[e],n=[];for(let i=0,r=t.joints.length;i<r;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){const r=i.pop(),s=i,a=[],o=[];for(let l=0,c=s.length;l<c;l++){const h=s[l];if(h){a.push(h);const u=new Ie;r!==null&&u.fromArray(r.array,l*16),o.push(u)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[l])}return new wc(a,o)})}loadAnimation(e){const t=this.json,n=this,i=t.animations[e],r=i.name?i.name:"animation_"+e,s=[],a=[],o=[],l=[],c=[];for(let h=0,u=i.channels.length;h<u;h++){const f=i.channels[h],d=i.samplers[f.sampler],g=f.target,v=g.node,p=i.parameters!==void 0?i.parameters[d.input]:d.input,m=i.parameters!==void 0?i.parameters[d.output]:d.output;g.node!==void 0&&(s.push(this.getDependency("node",v)),a.push(this.getDependency("accessor",p)),o.push(this.getDependency("accessor",m)),l.push(d),c.push(g))}return Promise.all([Promise.all(s),Promise.all(a),Promise.all(o),Promise.all(l),Promise.all(c)]).then(function(h){const u=h[0],f=h[1],d=h[2],g=h[3],v=h[4],p=[];for(let y=0,S=u.length;y<S;y++){const M=u[y],I=f[y],w=d[y],C=g[y],_=v[y];if(M===void 0)continue;M.updateMatrix&&M.updateMatrix();const b=n._createAnimationTracks(M,I,w,C,_);if(b)for(let N=0;N<b.length;N++)p.push(b[N])}const m=new ks(r,void 0,p);return pn(m,i),m})}createNodeMesh(e){const t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(r){const s=n._getNodeRef(n.meshCache,i.mesh,r);return i.weights!==void 0&&s.traverse(function(a){if(a.isMesh)for(let o=0,l=i.weights.length;o<l;o++)a.morphTargetInfluences[o]=i.weights[o]}),s})}loadNode(e){const t=this.json,n=this,i=t.nodes[e],r=n._loadNodeShallow(e),s=[],a=i.children||[];for(let l=0,c=a.length;l<c;l++)s.push(n.getDependency("node",a[l]));const o=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([r,Promise.all(s),o]).then(function(l){const c=l[0],h=l[1],u=l[2];u!==null&&c.traverse(function(f){f.isSkinnedMesh&&f.bind(u,Dg)});for(let f=0,d=h.length;f<d;f++)c.add(h[f]);if(c.userData.pivot!==void 0&&h.length>0){const f=c.userData.pivot,d=h[0];c.pivot=new P().fromArray(f),c.position.x-=f[0],c.position.y-=f[1],c.position.z-=f[2],d.position.set(0,0,0),delete c.userData.pivot}return c})}_loadNodeShallow(e){const t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const r=t.nodes[e],s=r.name?i.createUniqueName(r.name):"",a=[],o=i._invokeOne(function(l){return l.createNodeMesh&&l.createNodeMesh(e)});return o&&a.push(o),r.camera!==void 0&&a.push(i.getDependency("camera",r.camera).then(function(l){return i._getNodeRef(i.cameraCache,r.camera,l)})),i._invokeAll(function(l){return l.createNodeAttachment&&l.createNodeAttachment(e)}).forEach(function(l){a.push(l)}),this.nodeCache[e]=Promise.all(a).then(function(l){let c;if(r.isBone===!0?c=new Us:l.length>1?c=new gn:l.length===1?c=l[0]:c=new ft,c!==l[0])for(let h=0,u=l.length;h<u;h++)c.add(l[h]);if(r.name&&(c.userData.name=r.name,c.name=s),pn(c,r),r.extensions&&ei(n,c,r),r.matrix!==void 0){const h=new Ie;h.fromArray(r.matrix),c.applyMatrix4(h)}else r.translation!==void 0&&c.position.fromArray(r.translation),r.rotation!==void 0&&c.quaternion.fromArray(r.rotation),r.scale!==void 0&&c.scale.fromArray(r.scale);if(!i.associations.has(c))i.associations.set(c,{});else if(r.mesh!==void 0&&i.meshCache.refs[r.mesh]>1){const h=i.associations.get(c);i.associations.set(c,{...h})}return i.associations.get(c).nodes=e,c}),this.nodeCache[e]}loadScene(e){const t=this.extensions,n=this.json.scenes[e],i=this,r=new gn;n.name&&(r.name=i.createUniqueName(n.name)),pn(r,n),n.extensions&&ei(t,r,n);const s=n.nodes||[],a=[];for(let o=0,l=s.length;o<l;o++)a.push(i.getDependency("node",s[o]));return Promise.all(a).then(function(o){for(let c=0,h=o.length;c<h;c++){const u=o[c];u.parent!==null?r.add(ng(u)):r.add(u)}const l=c=>{const h=new Map;for(const[u,f]of i.associations)(u instanceof Gt||u instanceof Ft)&&h.set(u,f);return c.traverse(u=>{const f=i.associations.get(u);f!=null&&h.set(u,f)}),h};return i.associations=l(r),r})}_createAnimationTracks(e,t,n,i,r){const s=[],a=e.name?e.name:e.uuid,o=[];Bn[r.path]===Bn.weights?e.traverse(function(u){u.morphTargetInfluences&&o.push(u.name?u.name:u.uuid)}):o.push(a);let l;switch(Bn[r.path]){case Bn.weights:l=oi;break;case Bn.rotation:l=Xn;break;case Bn.translation:case Bn.scale:l=li;break;default:n.itemSize===1?l=oi:l=li;break}const c=i.interpolation!==void 0?wg[i.interpolation]:br,h=this._getArrayFromAccessor(n);for(let u=0,f=o.length;u<f;u++){const d=new l(o[u]+"."+Bn[r.path],t.array,h,c);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(d),s.push(d)}return s}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const n=Qa(t.constructor),i=new Float32Array(t.length);for(let r=0,s=t.length;r<s;r++)i[r]=t[r]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){return new(this instanceof Xn?Ag:fh)(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function Ug(e,t,n){const i=t.attributes,r=new In;if(i.POSITION!==void 0){const o=n.json.accessors[i.POSITION],l=o.min,c=o.max;if(l!==void 0&&c!==void 0){if(r.set(new P(l[0],l[1],l[2]),new P(c[0],c[1],c[2])),o.normalized){const h=Qa(Vi[o.componentType]);r.min.multiplyScalar(h),r.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const s=t.targets;if(s!==void 0){const o=new P,l=new P;for(let c=0,h=s.length;c<h;c++){const u=s[c];if(u.POSITION!==void 0){const f=n.json.accessors[u.POSITION],d=f.min,g=f.max;if(d!==void 0&&g!==void 0){if(l.setX(Math.max(Math.abs(d[0]),Math.abs(g[0]))),l.setY(Math.max(Math.abs(d[1]),Math.abs(g[1]))),l.setZ(Math.max(Math.abs(d[2]),Math.abs(g[2]))),f.normalized){const v=Qa(Vi[f.componentType]);l.multiplyScalar(v)}o.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(o)}e.boundingBox=r;const a=new yn;r.getCenter(a.center),a.radius=r.min.distanceTo(r.max)/2,e.boundingSphere=a}function Xl(e,t,n){const i=t.attributes,r=[];function s(a,o){return n.getDependency("accessor",a).then(function(l){e.setAttribute(o,l)})}for(const a in i){const o=$a[a]||a.toLowerCase();o in e.attributes||r.push(s(i[a],o))}if(t.indices!==void 0&&!e.index){const a=n.getDependency("accessor",t.indices).then(function(o){e.setIndex(o)});r.push(a)}return qe.workingColorSpace!=="srgb-linear"&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${qe.workingColorSpace}" not supported.`),pn(e,t),Ug(e,t,n),Promise.all(r).then(function(){return t.targets!==void 0?Cg(e,t.targets,n):e})}var Jt=Uint8Array,Fi=Uint16Array,Og=Int32Array,dh=new Jt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),ph=new Jt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Fg=new Jt([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),mh=function(e,t){for(var n=new Fi(31),i=0;i<31;++i)n[i]=t+=1<<e[i-1];for(var r=new Og(n[30]),i=1;i<30;++i)for(var s=n[i];s<n[i+1];++s)r[s]=s-n[i]<<5|i;return{b:n,r}},gh=mh(dh,2),vh=gh.b,Bg=gh.r;vh[28]=258,Bg[258]=28;var _h=mh(ph,0),kg=_h.b,zv=_h.r,eo=new Fi(32768);for(var pt=0;pt<32768;++pt){var kn=(pt&43690)>>1|(pt&21845)<<1;kn=(kn&52428)>>2|(kn&13107)<<2,kn=(kn&61680)>>4|(kn&3855)<<4,eo[pt]=((kn&65280)>>8|(kn&255)<<8)>>1}var Sr=(function(e,t,n){for(var i=e.length,r=0,s=new Fi(t);r<i;++r)e[r]&&++s[e[r]-1];var a=new Fi(t);for(r=1;r<t;++r)a[r]=a[r-1]+s[r-1]<<1;var o;if(n){o=new Fi(1<<t);var l=15-t;for(r=0;r<i;++r)if(e[r])for(var c=r<<4|e[r],h=t-e[r],u=a[e[r]-1]++<<h,f=u|(1<<h)-1;u<=f;++u)o[eo[u]>>l]=c}else for(o=new Fi(i),r=0;r<i;++r)e[r]&&(o[r]=eo[a[e[r]-1]++]>>15-e[r]);return o}),Ur=new Jt(288);for(var pt=0;pt<144;++pt)Ur[pt]=8;for(var pt=144;pt<256;++pt)Ur[pt]=9;for(var pt=256;pt<280;++pt)Ur[pt]=7;for(var pt=280;pt<288;++pt)Ur[pt]=8;var yh=new Jt(32);for(var pt=0;pt<32;++pt)yh[pt]=5;var zg=Sr(Ur,9,1);var Vg=Sr(yh,5,1),Oa=function(e){for(var t=e[0],n=1;n<e.length;++n)e[n]>t&&(t=e[n]);return t},sn=function(e,t,n){var i=t/8|0;return(e[i]|e[i+1]<<8)>>(t&7)&n},Fa=function(e,t){var n=t/8|0;return(e[n]|e[n+1]<<8|e[n+2]<<16)>>(t&7)},Gg=function(e){return(e+7)/8|0},Hg=function(e,t,n){return(t==null||t<0)&&(t=0),(n==null||n>e.length)&&(n=e.length),new Jt(e.subarray(t,n))},Wg=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],an=function(e,t,n){var i=new Error(t||Wg[e]);if(i.code=e,Error.captureStackTrace&&Error.captureStackTrace(i,an),!n)throw i;return i},Xg=function(e,t,n,i){var r=e.length,s=i?i.length:0;if(!r||t.f&&!t.l)return n||new Jt(0);var a=!n,o=a||t.i!=2,l=t.i;a&&(n=new Jt(r*3));var c=function(Ne){var Je=n.length;if(Ne>Je){var Z=new Jt(Math.max(Je*2,Ne));Z.set(n),n=Z}},h=t.f||0,u=t.p||0,f=t.b||0,d=t.l,g=t.d,v=t.m,p=t.n,m=r*8;do{if(!d){h=sn(e,u,1);var y=sn(e,u+1,3);if(u+=3,y)if(y==1)d=zg,g=Vg,v=9,p=5;else if(y==2){var w=sn(e,u,31)+257,C=sn(e,u+10,15)+4,_=w+sn(e,u+5,31)+1;u+=14;for(var b=new Jt(_),N=new Jt(19),A=0;A<C;++A)N[Fg[A]]=sn(e,u+A*3,7);u+=C*3;for(var O=Oa(N),H=(1<<O)-1,k=Sr(N,O,1),A=0;A<_;){var L=k[sn(e,u,H)];u+=L&15;var S=L>>4;if(S<16)b[A++]=S;else{var B=0,U=0;for(S==16?(U=3+sn(e,u,3),u+=2,B=b[A-1]):S==17?(U=3+sn(e,u,7),u+=3):S==18&&(U=11+sn(e,u,127),u+=7);U--;)b[A++]=B}}var $=b.subarray(0,w),j=b.subarray(w);v=Oa($),p=Oa(j),d=Sr($,v,1),g=Sr(j,p,1)}else an(1);else{var S=Gg(u)+4,M=e[S-4]|e[S-3]<<8,I=S+M;if(I>r){l&&an(0);break}o&&c(f+M),n.set(e.subarray(S,I),f),t.b=f+=M,t.p=u=I*8,t.f=h;continue}if(u>m){l&&an(0);break}}o&&c(f+131072);for(var J=(1<<v)-1,re=(1<<p)-1,Q=u;;Q=u){var B=d[Fa(e,u)&J],pe=B>>4;if(u+=B&15,u>m){l&&an(0);break}if(B||an(2),pe<256)n[f++]=pe;else if(pe==256){Q=u,d=null;break}else{var de=pe-254;if(pe>264){var A=pe-257,F=dh[A];de=sn(e,u,(1<<F)-1)+vh[A],u+=F}var q=g[Fa(e,u)&re],se=q>>4;q||an(3),u+=q&15;var j=kg[se];if(se>3){var F=ph[se];j+=Fa(e,u)&(1<<F)-1,u+=F}if(u>m){l&&an(0);break}o&&c(f+131072);var ae=f+de;if(f<j){var Re=s-j,Oe=Math.min(j,ae);for(Re+f<0&&an(3);f<Oe;++f)n[f]=i[Re+f]}for(;f<ae;++f)n[f]=n[f-j]}}t.l=d,t.p=Q,t.b=f,t.f=h,d&&(h=1,t.m=v,t.d=g,t.n=p)}while(!h);return f!=n.length&&a?Hg(n,0,f):n.subarray(0,f)},qg=new Jt(0),Yg=function(e,t){return((e[0]&15)!=8||e[0]>>4>7||(e[0]<<8|e[1])%31)&&an(6,"invalid zlib data"),(e[1]>>5&1)==+!t&&an(6,"invalid zlib data: "+(e[1]&32?"need":"unexpected")+" dictionary"),(e[1]>>3&4)+2};function jg(e,t){return Xg(e.subarray(Yg(e,t&&t.dictionary),-4),{i:2},t&&t.out,t&&t.dictionary)}var Kg=typeof TextDecoder<"u"&&new TextDecoder,Jg=0;try{Kg.decode(qg,{stream:!0}),Jg=1}catch{}function xh(e,t,n){const i=n.length-e-1;if(t>=n[i])return i-1;if(t<=n[e])return e;let r=e,s=i,a=Math.floor((r+s)/2);for(;t<n[a]||t>=n[a+1];)t<n[a]?s=a:r=a,a=Math.floor((r+s)/2);return a}function Zg(e,t,n,i){const r=[],s=[],a=[];r[0]=1;for(let o=1;o<=n;++o){s[o]=t-i[e+1-o],a[o]=i[e+o]-t;let l=0;for(let c=0;c<o;++c){const h=a[c+1],u=s[o-c],f=r[c]/(h+u);r[c]=l+h*f,l=u*f}r[o]=l}return r}function $g(e,t,n,i){const r=xh(e,i,t),s=Zg(r,i,e,t),a=new ct(0,0,0,0);for(let o=0;o<=e;++o){const l=n[r-e+o],c=s[o],h=l.w*c;a.x+=l.x*h,a.y+=l.y*h,a.z+=l.z*h,a.w+=l.w*c}return a}function Qg(e,t,n,i,r){const s=[];for(let u=0;u<=n;++u)s[u]=0;const a=[];for(let u=0;u<=i;++u)a[u]=s.slice(0);const o=[];for(let u=0;u<=n;++u)o[u]=s.slice(0);o[0][0]=1;const l=s.slice(0),c=s.slice(0);for(let u=1;u<=n;++u){l[u]=t-r[e+1-u],c[u]=r[e+u]-t;let f=0;for(let d=0;d<u;++d){const g=c[d+1],v=l[u-d];o[u][d]=g+v;const p=o[d][u-1]/o[u][d];o[d][u]=f+g*p,f=v*p}o[u][u]=f}for(let u=0;u<=n;++u)a[0][u]=o[u][n];for(let u=0;u<=n;++u){let f=0,d=1;const g=[];for(let v=0;v<=n;++v)g[v]=s.slice(0);g[0][0]=1;for(let v=1;v<=i;++v){let p=0;const m=u-v,y=n-v;u>=v&&(g[d][0]=g[f][0]/o[y+1][m],p=g[d][0]*o[m][y]);const S=m>=-1?1:-m,M=u-1<=y?v-1:n-u;for(let w=S;w<=M;++w)g[d][w]=(g[f][w]-g[f][w-1])/o[y+1][m+w],p+=g[d][w]*o[m+w][y];u<=y&&(g[d][v]=-g[f][v-1]/o[y+1][u],p+=g[d][v]*o[u][y]),a[v][u]=p;const I=f;f=d,d=I}}let h=n;for(let u=1;u<=i;++u){for(let f=0;f<=n;++f)a[u][f]*=h;h*=n-u}return a}function ev(e,t,n,i,r){const s=r<e?r:e,a=[],o=xh(e,i,t),l=Qg(o,i,e,s,t),c=[];for(let h=0;h<n.length;++h){const u=n[h].clone(),f=u.w;u.x*=f,u.y*=f,u.z*=f,c[h]=u}for(let h=0;h<=s;++h){const u=c[o-e].clone().multiplyScalar(l[h][0]);for(let f=1;f<=e;++f)u.add(c[o-e+f].clone().multiplyScalar(l[h][f]));a[h]=u}for(let h=s+1;h<=r+1;++h)a[h]=new ct(0,0,0);return a}function tv(e,t){let n=1;for(let r=2;r<=e;++r)n*=r;let i=1;for(let r=2;r<=t;++r)i*=r;for(let r=2;r<=e-t;++r)i*=r;return n/i}function nv(e){const t=e.length,n=[],i=[];for(let s=0;s<t;++s){const a=e[s];n[s]=new P(a.x,a.y,a.z),i[s]=a.w}const r=[];for(let s=0;s<t;++s){const a=n[s].clone();for(let o=1;o<=s;++o)a.sub(r[s-o].clone().multiplyScalar(tv(s,o)*i[o]));r[s]=a.divideScalar(i[0])}return r}function iv(e,t,n,i,r){return nv(ev(e,t,n,i,r))}var rv=class extends ln{constructor(e,t,n,i,r){super();const s=t?t.length-1:0,a=n?n.length:0;this.degree=e,this.knots=t,this.controlPoints=[],this.startKnot=i||0,this.endKnot=r||s;for(let o=0;o<a;++o){const l=n[o];this.controlPoints[o]=new ct(l.x,l.y,l.z,l.w)}}getPoint(e,t=new P){const n=t,i=this.knots[this.startKnot]+e*(this.knots[this.endKnot]-this.knots[this.startKnot]),r=$g(this.degree,this.knots,this.controlPoints,i);return r.w!==1&&r.divideScalar(r.w),n.set(r.x,r.y,r.z)}getTangent(e,t=new P){const n=t,i=this.knots[0]+e*(this.knots[this.knots.length-1]-this.knots[0]),r=iv(this.degree,this.knots,this.controlPoints,i,1);return n.copy(r[1]).normalize(),n}toJSON(){const e=super.toJSON();return e.degree=this.degree,e.knots=[...this.knots],e.controlPoints=this.controlPoints.map(t=>t.toArray()),e.startKnot=this.startKnot,e.endKnot=this.endKnot,e}fromJSON(e){return super.fromJSON(e),this.degree=e.degree,this.knots=[...e.knots],this.controlPoints=e.controlPoints.map(t=>new ct(t[0],t[1],t[2],t[3])),this.startKnot=e.startKnot,this.endKnot=e.endKnot,this}},Qe,_t,zt,Vv=class extends $t{constructor(e){super(e)}load(e,t,n,i){const r=this,s=r.path===""?zi.extractUrlBase(e):r.path,a=new er(this.manager);a.setPath(r.path),a.setResponseType("arraybuffer"),a.setRequestHeader(r.requestHeader),a.setWithCredentials(r.withCredentials),a.load(e,function(o){try{t(r.parse(o,s))}catch(l){i?i(l):console.error(l),r.manager.itemError(e)}},n,i)}parse(e,t){if(hv(e))Qe=new cv().parse(e);else{const n=Th(e);if(!uv(n))throw new Error("THREE.FBXLoader: Unknown format.");if(Yl(n)<7e3)throw new Error("THREE.FBXLoader: FBX version not supported, FileVersion: "+Yl(n));Qe=new lv().parse(n)}return new sv(new eh(this.manager).setPath(this.resourcePath||t).setCrossOrigin(this.crossOrigin),this.manager).parse(Qe)}},sv=class{constructor(e,t){this.textureLoader=e,this.manager=t}parse(){_t=this.parseConnections();const e=this.parseImages(),t=this.parseTextures(e),n=this.parseMaterials(t),i=this.parseDeformers(),r=new av().parse(i);return this.parseScene(i,r,n),zt}parseConnections(){const e=new Map;return"Connections"in Qe&&Qe.Connections.connections.forEach(function(t){const n=t[0],i=t[1],r=t[2];e.has(n)||e.set(n,{parents:[],children:[]});const s={ID:i,relationship:r};e.get(n).parents.push(s),e.has(i)||e.set(i,{parents:[],children:[]});const a={ID:n,relationship:r};e.get(i).children.push(a)}),e}parseImages(){const e={},t={};if("Video"in Qe.Objects){const n=Qe.Objects.Video;for(const i in n){const r=n[i],s=parseInt(i);if(e[s]=r.RelativeFilename||r.Filename,"Content"in r){const a=r.Content instanceof ArrayBuffer&&r.Content.byteLength>0,o=typeof r.Content=="string"&&r.Content!=="";if(a||o){const l=this.parseImage(n[i]);t[r.RelativeFilename||r.Filename]=l}}}}for(const n in e){const i=e[n];t[i]!==void 0?e[n]=t[i]:e[n]=e[n].split("\\").pop()}return e}parseImage(e){const t=e.Content,n=e.RelativeFilename||e.Filename,i=n.slice(n.lastIndexOf(".")+1).toLowerCase();let r;switch(i){case"bmp":r="image/bmp";break;case"jpg":case"jpeg":r="image/jpeg";break;case"png":r="image/png";break;case"tif":r="image/tiff";break;case"tga":this.manager.getHandler(".tga")===null&&console.warn("FBXLoader: TGA loader not found, skipping ",n),r="image/tga";break;case"webp":r="image/webp";break;default:console.warn('FBXLoader: Image type "'+i+'" is not supported.');return}if(typeof t=="string")return"data:"+r+";base64,"+t;{const s=new Uint8Array(t);return window.URL.createObjectURL(new Blob([s],{type:r}))}}parseTextures(e){const t=new Map;if("Texture"in Qe.Objects){const n=Qe.Objects.Texture;for(const i in n){const r=this.parseTexture(n[i],e);t.set(parseInt(i),r)}}return t}parseTexture(e,t){const n=this.loadTexture(e,t);n.ID=e.id,n.name=e.attrName;const i=e.WrapModeU,r=e.WrapModeV,s=i!==void 0?i.value:0,a=r!==void 0?r.value:0;if(n.wrapS=s===0?Gi:Ht,n.wrapT=a===0?Gi:Ht,"Scaling"in e){const o=e.Scaling.value;n.repeat.x=o[0],n.repeat.y=o[1]}if("Translation"in e){const o=e.Translation.value;n.offset.x=o[0],n.offset.y=o[1]}return n}loadTexture(e,t){const n=e.FileName.split(".").pop().toLowerCase();let i=this.manager.getHandler(`.${n}`);i===null&&(i=this.textureLoader);const r=i.path;r||i.setPath(this.textureLoader.path);const s=_t.get(e.id).children;let a;if(s!==void 0&&s.length>0&&t[s[0].ID]!==void 0&&(a=t[s[0].ID],(a.indexOf("blob:")===0||a.indexOf("data:")===0)&&i.setPath(void 0)),a===void 0)return console.warn("FBXLoader: Undefined filename, creating placeholder texture."),new Ft;const o=i.load(a);return i.setPath(r),o}parseMaterials(e){const t=new Map;if("Material"in Qe.Objects){const n=Qe.Objects.Material;for(const i in n){const r=this.parseMaterial(n[i],e);r!==null&&t.set(parseInt(i),r)}}return t}parseMaterial(e,t){const n=e.id,i=e.attrName;let r=e.ShadingModel;if(typeof r=="object"&&(r=r.value),!_t.has(n))return null;const s=this.parseParameters(e,t,n);let a;switch(r.toLowerCase()){case"phong":a=new vr;break;case"lambert":a=new ld;break;default:console.warn('THREE.FBXLoader: unknown material type "%s". Defaulting to MeshPhongMaterial.',r),a=new vr;break}return a.setValues(s),a.name=i,a}parseParameters(e,t,n){const i={};e.BumpFactor&&(i.bumpScale=e.BumpFactor.value),e.Diffuse?i.color=qe.colorSpaceToWorking(new Ee().fromArray(e.Diffuse.value),rt):e.DiffuseColor&&(e.DiffuseColor.type==="Color"||e.DiffuseColor.type==="ColorRGB")&&(i.color=qe.colorSpaceToWorking(new Ee().fromArray(e.DiffuseColor.value),rt)),e.DisplacementFactor&&(i.displacementScale=e.DisplacementFactor.value),e.Emissive?i.emissive=qe.colorSpaceToWorking(new Ee().fromArray(e.Emissive.value),rt):e.EmissiveColor&&(e.EmissiveColor.type==="Color"||e.EmissiveColor.type==="ColorRGB")&&(i.emissive=qe.colorSpaceToWorking(new Ee().fromArray(e.EmissiveColor.value),rt)),e.EmissiveFactor&&(i.emissiveIntensity=parseFloat(e.EmissiveFactor.value)),i.opacity=1-(e.TransparencyFactor?parseFloat(e.TransparencyFactor.value):0),(i.opacity===1||i.opacity===0)&&(i.opacity=e.Opacity?parseFloat(e.Opacity.value):null,i.opacity===null&&(i.opacity=1-(e.TransparentColor?parseFloat(e.TransparentColor.value[0]):0))),i.opacity<1&&(i.transparent=!0),e.ReflectionFactor&&(i.reflectivity=e.ReflectionFactor.value),e.Shininess&&(i.shininess=e.Shininess.value),e.Specular?i.specular=qe.colorSpaceToWorking(new Ee().fromArray(e.Specular.value),rt):e.SpecularColor&&e.SpecularColor.type==="Color"&&(i.specular=qe.colorSpaceToWorking(new Ee().fromArray(e.SpecularColor.value),rt));const r=this;return _t.get(n).children.forEach(function(s){const a=s.relationship;switch(a){case"Bump":i.bumpMap=r.getTexture(t,s.ID);break;case"Maya|TEX_ao_map":i.aoMap=r.getTexture(t,s.ID);break;case"DiffuseColor":case"Maya|TEX_color_map":i.map=r.getTexture(t,s.ID),i.map!==void 0&&(i.map.colorSpace=rt);break;case"DisplacementColor":i.displacementMap=r.getTexture(t,s.ID);break;case"EmissiveColor":i.emissiveMap=r.getTexture(t,s.ID),i.emissiveMap!==void 0&&(i.emissiveMap.colorSpace=rt);break;case"NormalMap":case"Maya|TEX_normal_map":i.normalMap=r.getTexture(t,s.ID);break;case"ReflectionColor":i.envMap=r.getTexture(t,s.ID),i.envMap!==void 0&&(i.envMap.mapping=303,i.envMap.colorSpace=rt);break;case"SpecularColor":i.specularMap=r.getTexture(t,s.ID),i.specularMap!==void 0&&(i.specularMap.colorSpace=rt);break;case"TransparentColor":case"TransparencyFactor":i.alphaMap=r.getTexture(t,s.ID),i.transparent=!0;break;default:console.warn("THREE.FBXLoader: %s map is not supported in three.js, skipping texture.",a);break}}),i}getTexture(e,t){return"LayeredTexture"in Qe.Objects&&t in Qe.Objects.LayeredTexture&&(console.warn("THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer."),t=_t.get(t).children[0].ID),e.get(t)}parseDeformers(){const e={},t={};if("Deformer"in Qe.Objects){const n=Qe.Objects.Deformer;for(const i in n){const r=n[i],s=_t.get(parseInt(i));if(r.attrType==="Skin"){const a=this.parseSkeleton(s,n);a.ID=i,s.parents.length>1&&console.warn("THREE.FBXLoader: skeleton attached to more than one geometry is not supported."),a.geometryID=s.parents[0].ID,e[i]=a}else if(r.attrType==="BlendShape"){const a={id:i};a.rawTargets=this.parseMorphTargets(s,n),a.id=i,s.parents.length>1&&console.warn("THREE.FBXLoader: morph target attached to more than one geometry is not supported."),t[i]=a}}}return{skeletons:e,morphTargets:t}}parseSkeleton(e,t){const n=[];return e.children.forEach(function(i){const r=t[i.ID];if(r.attrType!=="Cluster")return;const s={ID:i.ID,indices:[],weights:[],transformLink:new Ie().fromArray(r.TransformLink.a)};"Indexes"in r&&(s.indices=r.Indexes.a,s.weights=r.Weights.a),n.push(s)}),{rawBones:n,bones:[]}}parseMorphTargets(e,t){const n=[];for(let i=0;i<e.children.length;i++){const r=e.children[i],s=t[r.ID],a={name:s.attrName,initialWeight:s.DeformPercent,id:s.id,fullWeights:s.FullWeights.a};if(s.attrType!=="BlendShapeChannel")return;a.geoID=_t.get(parseInt(r.ID)).children.filter(function(o){return o.relationship===void 0})[0].ID,n.push(a)}return n}parseScene(e,t,n){zt=new gn;const i=this.parseModels(e.skeletons,t,n),r=Qe.Objects.Model,s=this;i.forEach(function(o){const l=r[o.ID];s.setLookAtProperties(o,l),_t.get(o.ID).parents.forEach(function(c){const h=i.get(c.ID);h!==void 0&&h.add(o)}),o.parent===null&&zt.add(o)}),this.bindSkeleton(e.skeletons,t,i),this.addGlobalSceneSettings(),zt.traverse(function(o){if(o.userData.transformData){o.parent&&(o.userData.transformData.parentMatrix=o.parent.matrix,o.userData.transformData.parentMatrixWorld=o.parent.matrixWorld);const l=Sh(o.userData.transformData);o.applyMatrix4(l),o.updateWorldMatrix()}});const a=new ov().parse();zt.children.length===1&&zt.children[0].isGroup&&(zt.children[0].animations=a,zt=zt.children[0]),zt.animations=a}parseModels(e,t,n){const i=new Map,r=Qe.Objects.Model;for(const s in r){const a=parseInt(s),o=r[s],l=_t.get(a);let c=this.buildSkeleton(l,e,a,o.attrName);if(!c){switch(o.attrType){case"Camera":c=this.createCamera(l);break;case"Light":c=this.createLight(l);break;case"Mesh":c=this.createMesh(l,t,n);break;case"NurbsCurve":c=this.createCurve(l,t);break;case"LimbNode":case"Root":c=new Us;break;default:c=new gn;break}c.name=o.attrName?lt.sanitizeNodeName(o.attrName):"",c.userData.originalName=o.attrName,c.ID=a}this.getTransformData(c,o),i.set(a,c)}return i}buildSkeleton(e,t,n,i){let r=null;return e.parents.forEach(function(s){for(const a in t){const o=t[a];o.rawBones.forEach(function(l,c){if(l.ID===s.ID){const h=r;r=new Us,r.matrixWorld.copy(l.transformLink),r.name=i?lt.sanitizeNodeName(i):"",r.userData.originalName=i,r.ID=n,o.bones[c]=r,h!==null&&r.add(h)}})}}),r}createCamera(e){let t,n;if(e.children.forEach(function(i){const r=Qe.Objects.NodeAttribute[i.ID];r!==void 0&&(n=r)}),n===void 0)t=new ft;else{let i=0;n.CameraProjectionType!==void 0&&n.CameraProjectionType.value===1&&(i=1);let r=1;n.NearPlane!==void 0&&(r=n.NearPlane.value/1e3);let s=1e3;n.FarPlane!==void 0&&(s=n.FarPlane.value/1e3);let a=window.innerWidth,o=window.innerHeight;n.AspectWidth!==void 0&&n.AspectHeight!==void 0&&(a=n.AspectWidth.value,o=n.AspectHeight.value);const l=a/o;let c=45;n.FieldOfView!==void 0&&(c=n.FieldOfView.value);const h=n.FocalLength?n.FocalLength.value:null;switch(i){case 0:t=new Vt(c,l,r,s),h!==null&&t.setFocalLength(h);break;case 1:console.warn("THREE.FBXLoader: Orthographic cameras not supported yet."),t=new ft;break;default:console.warn("THREE.FBXLoader: Unknown camera type "+i+"."),t=new ft;break}}return t}createLight(e){let t,n;if(e.children.forEach(function(i){const r=Qe.Objects.NodeAttribute[i.ID];r!==void 0&&(n=r)}),n===void 0)t=new ft;else{let i;n.LightType===void 0?i=0:i=n.LightType.value;let r=16777215;n.Color!==void 0&&(r=qe.colorSpaceToWorking(new Ee().fromArray(n.Color.value),rt));let s=n.Intensity===void 0?1:n.Intensity.value/100;n.CastLightOnObject!==void 0&&n.CastLightOnObject.value===0&&(s=0);let a=0;n.FarAttenuationEnd!==void 0&&(n.EnableFarAttenuation!==void 0&&n.EnableFarAttenuation.value===0?a=0:a=n.FarAttenuationEnd.value);const o=1;switch(i){case 0:t=new ja(r,s,a,o);break;case 1:t=new ih(r,s);break;case 2:let l=Math.PI/3;n.InnerAngle!==void 0&&(l=Ut.degToRad(n.InnerAngle.value));let c=0;n.OuterAngle!==void 0&&(c=Ut.degToRad(n.OuterAngle.value),c=Math.max(c,1)),t=new nh(r,s,a,l,c,o);break;default:console.warn("THREE.FBXLoader: Unknown light type "+n.LightType.value+", defaulting to a PointLight."),t=new ja(r,s);break}n.CastShadows!==void 0&&n.CastShadows.value===1&&(t.castShadow=!0)}return t}createMesh(e,t,n){let i,r=null,s=null;const a=[];if(e.children.forEach(function(o){t.has(o.ID)&&(r=t.get(o.ID)),n.has(o.ID)&&a.push(n.get(o.ID))}),a.length>1?s=a:a.length>0?s=a[0]:(s=new vr({name:$t.DEFAULT_MATERIAL_NAME,color:13421772}),a.push(s)),"color"in r.attributes&&a.forEach(function(o){o.vertexColors=!0}),r.groups.length>0){let o=!1;for(let l=0,c=r.groups.length;l<c;l++){const h=r.groups[l];(h.materialIndex<0||h.materialIndex>=a.length)&&(h.materialIndex=a.length,o=!0)}if(o){const l=new vr;a.push(l)}}return r.FBX_Deformer?(i=new Ac(r,s),i.normalizeSkinWeights()):i=new Pt(r,s),i}createCurve(e,t){return new Dr(e.children.reduce(function(n,i){return t.has(i.ID)&&(n=t.get(i.ID)),n},null),new Wn({name:$t.DEFAULT_MATERIAL_NAME,color:3342591,linewidth:1}))}getTransformData(e,t){const n={};"InheritType"in t&&(n.inheritType=parseInt(t.InheritType.value)),"RotationOrder"in t?n.eulerOrder=Pr(t.RotationOrder.value):n.eulerOrder=Pr(0),"Lcl_Translation"in t&&(n.translation=t.Lcl_Translation.value),"PreRotation"in t&&(n.preRotation=t.PreRotation.value),"Lcl_Rotation"in t&&(n.rotation=t.Lcl_Rotation.value),"PostRotation"in t&&(n.postRotation=t.PostRotation.value),"Lcl_Scaling"in t&&(n.scale=t.Lcl_Scaling.value),"ScalingOffset"in t&&(n.scalingOffset=t.ScalingOffset.value),"ScalingPivot"in t&&(n.scalingPivot=t.ScalingPivot.value),"RotationOffset"in t&&(n.rotationOffset=t.RotationOffset.value),"RotationPivot"in t&&(n.rotationPivot=t.RotationPivot.value),e.userData.transformData=n}setLookAtProperties(e,t){"LookAtProperty"in t&&_t.get(e.ID).children.forEach(function(n){if(n.relationship==="LookAtProperty"){const i=Qe.Objects.Model[n.ID];if("Lcl_Translation"in i){const r=i.Lcl_Translation.value;e.target!==void 0?(e.target.position.fromArray(r),zt.add(e.target)):e.lookAt(new P().fromArray(r))}}})}bindSkeleton(e,t,n){const i=this.parsePoseNodes();for(const r in e){const s=e[r];_t.get(parseInt(s.ID)).parents.forEach(function(a){if(t.has(a.ID)){const o=a.ID;_t.get(o).parents.forEach(function(l){n.has(l.ID)&&n.get(l.ID).bind(new wc(s.bones),i[l.ID])})}})}}parsePoseNodes(){const e={};if("Pose"in Qe.Objects){const t=Qe.Objects.Pose;for(const n in t)if(t[n].attrType==="BindPose"&&t[n].NbPoseNodes>0){const i=t[n].PoseNode;Array.isArray(i)?i.forEach(function(r){e[r.Node]=new Ie().fromArray(r.Matrix.a)}):e[i.Node]=new Ie().fromArray(i.Matrix.a)}}return e}addGlobalSceneSettings(){if("GlobalSettings"in Qe){if("AmbientColor"in Qe.GlobalSettings){const e=Qe.GlobalSettings.AmbientColor.value,t=e[0],n=e[1],i=e[2];if(t!==0||n!==0||i!==0){const r=new Ee().setRGB(t,n,i,rt);zt.add(new Ad(r,1))}}"UnitScaleFactor"in Qe.GlobalSettings&&(zt.userData.unitScaleFactor=Qe.GlobalSettings.UnitScaleFactor.value)}}},av=class{constructor(){this.negativeMaterialIndices=!1}parse(e){const t=new Map;if("Geometry"in Qe.Objects){const n=Qe.Objects.Geometry;for(const i in n){const r=_t.get(parseInt(i)),s=this.parseGeometry(r,n[i],e);t.set(parseInt(i),s)}}return this.negativeMaterialIndices===!0&&console.warn("THREE.FBXLoader: The FBX file contains invalid (negative) material indices. The asset might not render as expected."),t}parseGeometry(e,t,n){switch(t.attrType){case"Mesh":return this.parseMeshGeometry(e,t,n);case"NurbsCurve":return this.parseNurbsGeometry(t)}}parseMeshGeometry(e,t,n){const i=n.skeletons,r=[],s=e.parents.map(function(h){return Qe.Objects.Model[h.ID]});if(s.length===0)return;const a=e.children.reduce(function(h,u){return i[u.ID]!==void 0&&(h=i[u.ID]),h},null);e.children.forEach(function(h){n.morphTargets[h.ID]!==void 0&&r.push(n.morphTargets[h.ID])});const o=s[0],l={};"RotationOrder"in o&&(l.eulerOrder=Pr(o.RotationOrder.value)),"InheritType"in o&&(l.inheritType=parseInt(o.InheritType.value)),"GeometricTranslation"in o&&(l.translation=o.GeometricTranslation.value),"GeometricRotation"in o&&(l.rotation=o.GeometricRotation.value),"GeometricScaling"in o&&(l.scale=o.GeometricScaling.value);const c=Sh(l);return this.genGeometry(t,a,r,c)}genGeometry(e,t,n,i){const r=new dt;e.attrName&&(r.name=e.attrName);const s=this.parseGeoNode(e,t),a=this.genBuffers(s),o=new Ye(a.vertex,3);if(o.applyMatrix4(i),r.setAttribute("position",o),a.colors.length>0&&r.setAttribute("color",new Ye(a.colors,3)),t&&(r.setAttribute("skinIndex",new so(a.weightsIndices,4)),r.setAttribute("skinWeight",new Ye(a.vertexWeights,4)),r.FBX_Deformer=t),a.normal.length>0){const l=new Ke().getNormalMatrix(i),c=new Ye(a.normal,3);c.applyNormalMatrix(l),r.setAttribute("normal",c)}if(a.uvs.forEach(function(l,c){const h=c===0?"uv":`uv${c}`;r.setAttribute(h,new Ye(a.uvs[c],2))}),s.material&&s.material.mappingType!=="AllSame"){let l=a.materialIndex[0],c=0;if(a.materialIndex.forEach(function(h,u){h!==l&&(r.addGroup(c,u-c,l),l=h,c=u)}),r.groups.length>0){const h=r.groups[r.groups.length-1],u=h.start+h.count;u!==a.materialIndex.length&&r.addGroup(u,a.materialIndex.length-u,l)}r.groups.length===0&&r.addGroup(0,a.materialIndex.length,a.materialIndex[0])}return this.addMorphTargets(r,e,n,i),r}parseGeoNode(e,t){const n={};if(n.vertexPositions=e.Vertices!==void 0?e.Vertices.a:[],n.vertexIndices=e.PolygonVertexIndex!==void 0?e.PolygonVertexIndex.a:[],e.LayerElementColor&&e.LayerElementColor[0].Colors&&(n.color=this.parseVertexColors(e.LayerElementColor[0])),e.LayerElementMaterial&&(n.material=this.parseMaterialIndices(e.LayerElementMaterial[0])),e.LayerElementNormal&&(n.normal=this.parseNormals(e.LayerElementNormal[0])),e.LayerElementUV){n.uv=[];let i=0;for(;e.LayerElementUV[i];)e.LayerElementUV[i].UV&&n.uv.push(this.parseUVs(e.LayerElementUV[i])),i++}return n.weightTable={},t!==null&&(n.skeleton=t,t.rawBones.forEach(function(i,r){i.indices.forEach(function(s,a){n.weightTable[s]===void 0&&(n.weightTable[s]=[]),n.weightTable[s].push({id:r,weight:i.weights[a]})})})),n}genBuffers(e){const t={vertex:[],normal:[],colors:[],uvs:[],materialIndex:[],vertexWeights:[],weightsIndices:[]};let n=0,i=0,r=!1,s=[],a=[],o=[],l=[],c=[],h=[];const u=this;return e.vertexIndices.forEach(function(f,d){let g,v=!1;f<0&&(f=f^-1,v=!0);let p=[],m=[];if(s.push(f*3,f*3+1,f*3+2),e.color){const y=Ss(d,n,f,e.color);o.push(y[0],y[1],y[2])}if(e.skeleton){if(e.weightTable[f]!==void 0&&e.weightTable[f].forEach(function(y){m.push(y.weight),p.push(y.id)}),m.length>4){r||(console.warn("THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights."),r=!0);const y=[0,0,0,0],S=[0,0,0,0];m.forEach(function(M,I){let w=M,C=p[I];S.forEach(function(_,b,N){if(w>_){N[b]=w,w=_;const A=y[b];y[b]=C,C=A}})}),p=y,m=S}for(;m.length<4;)m.push(0),p.push(0);for(let y=0;y<4;++y)c.push(m[y]),h.push(p[y])}if(e.normal){const y=Ss(d,n,f,e.normal);a.push(y[0],y[1],y[2])}e.material&&e.material.mappingType!=="AllSame"&&(g=Ss(d,n,f,e.material)[0],g<0&&(u.negativeMaterialIndices=!0,g=0)),e.uv&&e.uv.forEach(function(y,S){const M=Ss(d,n,f,y);l[S]===void 0&&(l[S]=[]),l[S].push(M[0]),l[S].push(M[1])}),i++,v&&(u.genFace(t,e,s,g,a,o,l,c,h,i),n++,i=0,s=[],a=[],o=[],l=[],c=[],h=[])}),t}getNormalNewell(e){const t=new P(0,0,0);for(let n=0;n<e.length;n++){const i=e[n],r=e[(n+1)%e.length];t.x+=(i.y-r.y)*(i.z+r.z),t.y+=(i.z-r.z)*(i.x+r.x),t.z+=(i.x-r.x)*(i.y+r.y)}return t.normalize(),t}getNormalTangentAndBitangent(e){const t=this.getNormalNewell(e),n=(Math.abs(t.z)>.5?new P(0,1,0):new P(0,0,1)).cross(t).normalize();return{normal:t,tangent:n,bitangent:t.clone().cross(n).normalize()}}flattenVertex(e,t,n){return new oe(e.dot(t),e.dot(n))}genFace(e,t,n,i,r,s,a,o,l,c){let h;if(c>3){const u=[],f=t.baseVertexPositions||t.vertexPositions;for(let p=0;p<n.length;p+=3)u.push(new P(f[n[p]],f[n[p+1]],f[n[p+2]]));const{tangent:d,bitangent:g}=this.getNormalTangentAndBitangent(u),v=[];for(const p of u)v.push(this.flattenVertex(p,d,g));h=Vn.triangulateShape(v,[])}else h=[[0,1,2]];for(const[u,f,d]of h)e.vertex.push(t.vertexPositions[n[u*3]]),e.vertex.push(t.vertexPositions[n[u*3+1]]),e.vertex.push(t.vertexPositions[n[u*3+2]]),e.vertex.push(t.vertexPositions[n[f*3]]),e.vertex.push(t.vertexPositions[n[f*3+1]]),e.vertex.push(t.vertexPositions[n[f*3+2]]),e.vertex.push(t.vertexPositions[n[d*3]]),e.vertex.push(t.vertexPositions[n[d*3+1]]),e.vertex.push(t.vertexPositions[n[d*3+2]]),t.skeleton&&(e.vertexWeights.push(o[u*4]),e.vertexWeights.push(o[u*4+1]),e.vertexWeights.push(o[u*4+2]),e.vertexWeights.push(o[u*4+3]),e.vertexWeights.push(o[f*4]),e.vertexWeights.push(o[f*4+1]),e.vertexWeights.push(o[f*4+2]),e.vertexWeights.push(o[f*4+3]),e.vertexWeights.push(o[d*4]),e.vertexWeights.push(o[d*4+1]),e.vertexWeights.push(o[d*4+2]),e.vertexWeights.push(o[d*4+3]),e.weightsIndices.push(l[u*4]),e.weightsIndices.push(l[u*4+1]),e.weightsIndices.push(l[u*4+2]),e.weightsIndices.push(l[u*4+3]),e.weightsIndices.push(l[f*4]),e.weightsIndices.push(l[f*4+1]),e.weightsIndices.push(l[f*4+2]),e.weightsIndices.push(l[f*4+3]),e.weightsIndices.push(l[d*4]),e.weightsIndices.push(l[d*4+1]),e.weightsIndices.push(l[d*4+2]),e.weightsIndices.push(l[d*4+3])),t.color&&(e.colors.push(s[u*3]),e.colors.push(s[u*3+1]),e.colors.push(s[u*3+2]),e.colors.push(s[f*3]),e.colors.push(s[f*3+1]),e.colors.push(s[f*3+2]),e.colors.push(s[d*3]),e.colors.push(s[d*3+1]),e.colors.push(s[d*3+2])),t.material&&t.material.mappingType!=="AllSame"&&(e.materialIndex.push(i),e.materialIndex.push(i),e.materialIndex.push(i)),t.normal&&(e.normal.push(r[u*3]),e.normal.push(r[u*3+1]),e.normal.push(r[u*3+2]),e.normal.push(r[f*3]),e.normal.push(r[f*3+1]),e.normal.push(r[f*3+2]),e.normal.push(r[d*3]),e.normal.push(r[d*3+1]),e.normal.push(r[d*3+2])),t.uv&&t.uv.forEach(function(g,v){e.uvs[v]===void 0&&(e.uvs[v]=[]),e.uvs[v].push(a[v][u*2]),e.uvs[v].push(a[v][u*2+1]),e.uvs[v].push(a[v][f*2]),e.uvs[v].push(a[v][f*2+1]),e.uvs[v].push(a[v][d*2]),e.uvs[v].push(a[v][d*2+1])})}addMorphTargets(e,t,n,i){if(n.length===0)return;e.morphTargetsRelative=!0,e.morphAttributes.position=[];const r=this;n.forEach(function(s){s.rawTargets.forEach(function(a){const o=Qe.Objects.Geometry[a.geoID];o!==void 0&&r.genMorphGeometry(e,t,o,i,a.name)})})}genMorphGeometry(e,t,n,i,r){const s=t.Vertices!==void 0?t.Vertices.a:[],a=t.PolygonVertexIndex!==void 0?t.PolygonVertexIndex.a:[],o=n.Vertices!==void 0?n.Vertices.a:[],l=n.Indexes!==void 0?n.Indexes.a:[],c=e.attributes.position.count*3,h=new Float32Array(c);for(let d=0;d<l.length;d++){const g=l[d]*3;h[g]=o[d*3],h[g+1]=o[d*3+1],h[g+2]=o[d*3+2]}const u={vertexIndices:a,vertexPositions:h,baseVertexPositions:s},f=new Ye(this.genBuffers(u).vertex,3);f.name=r||n.attrName,f.applyMatrix4(i),e.morphAttributes.position.push(f)}parseNormals(e){const t=e.MappingInformationType,n=e.ReferenceInformationType,i=e.Normals.a;let r=[];return n==="IndexToDirect"&&("NormalIndex"in e?r=e.NormalIndex.a:"NormalsIndex"in e&&(r=e.NormalsIndex.a)),{dataSize:3,buffer:i,indices:r,mappingType:t,referenceType:n}}parseUVs(e){const t=e.MappingInformationType,n=e.ReferenceInformationType,i=e.UV.a;let r=[];return n==="IndexToDirect"&&(r=e.UVIndex.a),{dataSize:2,buffer:i,indices:r,mappingType:t,referenceType:n}}parseVertexColors(e){const t=e.MappingInformationType,n=e.ReferenceInformationType,i=e.Colors.a;let r=[];n==="IndexToDirect"&&(r=e.ColorIndex.a);for(let s=0,a=new Ee;s<i.length;s+=4)a.fromArray(i,s),qe.colorSpaceToWorking(a,rt),a.toArray(i,s);return{dataSize:4,buffer:i,indices:r,mappingType:t,referenceType:n}}parseMaterialIndices(e){const t=e.MappingInformationType,n=e.ReferenceInformationType;if(t==="NoMappingInformation")return{dataSize:1,buffer:[0],indices:[0],mappingType:"AllSame",referenceType:n};const i=e.Materials.a,r=[];for(let s=0;s<i.length;++s)r.push(s);return{dataSize:1,buffer:i,indices:r,mappingType:t,referenceType:n}}parseNurbsGeometry(e){const t=parseInt(e.Order);if(isNaN(t))return console.error("THREE.FBXLoader: Invalid Order %s given for geometry ID: %s",e.Order,e.id),new dt;const n=t-1,i=e.KnotVector.a,r=[],s=e.Points.a;for(let c=0,h=s.length;c<h;c+=4)r.push(new ct().fromArray(s,c));let a,o;if(e.Form==="Closed")r.push(r[0]);else if(e.Form==="Periodic"){a=n,o=i.length-1-a;for(let c=0;c<n;++c)r.push(r[c])}const l=new rv(n,i,r,a,o).getPoints(r.length*12);return new dt().setFromPoints(l)}},ov=class{parse(){const e=[],t=this.parseClips();if(t!==void 0)for(const n in t){const i=t[n],r=this.addClip(i);e.push(r)}return e}parseClips(){if(Qe.Objects.AnimationCurve===void 0)return;const e=this.parseAnimationCurveNodes();this.parseAnimationCurves(e);const t=this.parseAnimationLayers(e);return this.parseAnimStacks(t)}parseAnimationCurveNodes(){const e=Qe.Objects.AnimationCurveNode,t=new Map;for(const n in e){const i=e[n];if(i.attrName.match(/S|R|T|DeformPercent/)!==null){const r={id:i.id,attr:i.attrName,curves:{}};t.set(r.id,r)}}return t}parseAnimationCurves(e){const t=Qe.Objects.AnimationCurve;for(const n in t){const i={id:t[n].id,times:t[n].KeyTime.a.map(fv),values:t[n].KeyValueFloat.a},r=_t.get(i.id);if(r!==void 0){const s=r.parents[0].ID,a=r.parents[0].relationship;a.match(/X/)?e.get(s).curves.x=i:a.match(/Y/)?e.get(s).curves.y=i:a.match(/Z/)?e.get(s).curves.z=i:a.match(/DeformPercent/)&&e.has(s)&&(e.get(s).curves.morph=i)}}}parseAnimationLayers(e){const t=Qe.Objects.AnimationLayer,n=new Map;for(const i in t){const r=[],s=_t.get(parseInt(i));s!==void 0&&(s.children.forEach(function(a,o){if(e.has(a.ID)){const l=e.get(a.ID);if(l.curves.x!==void 0||l.curves.y!==void 0||l.curves.z!==void 0){if(r[o]===void 0){const c=_t.get(a.ID).parents.filter(function(h){return h.relationship!==void 0})[0].ID;if(c!==void 0){const h=Qe.Objects.Model[c.toString()];if(h===void 0){console.warn("THREE.FBXLoader: Encountered a unused curve.",a);return}const u={modelName:h.attrName?lt.sanitizeNodeName(h.attrName):"",ID:h.id,initialPosition:[0,0,0],initialRotation:[0,0,0],initialScale:[1,1,1]};zt.traverse(function(f){f.ID===h.id&&(u.transform=f.matrix,f.userData.transformData&&(u.eulerOrder=f.userData.transformData.eulerOrder))}),u.transform||(u.transform=new Ie),"PreRotation"in h&&(u.preRotation=h.PreRotation.value),"PostRotation"in h&&(u.postRotation=h.PostRotation.value),r[o]=u}}r[o]&&(r[o][l.attr]=l)}else if(l.curves.morph!==void 0){if(r[o]===void 0){const c=_t.get(a.ID).parents.filter(function(g){return g.relationship!==void 0})[0].ID,h=_t.get(c).parents[0].ID,u=_t.get(h).parents[0].ID,f=_t.get(u).parents[0].ID,d=Qe.Objects.Model[f];r[o]={modelName:d.attrName?lt.sanitizeNodeName(d.attrName):"",morphName:Qe.Objects.Deformer[c].attrName}}r[o][l.attr]=l}}}),n.set(parseInt(i),r))}return n}parseAnimStacks(e){const t=Qe.Objects.AnimationStack,n={};for(const i in t){const r=_t.get(parseInt(i)).children;r.length>1&&console.warn("THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.");const s=e.get(r[0].ID);n[i]={name:t[i].attrName,layer:s}}return n}addClip(e){let t=[];const n=this;return e.layer.forEach(function(i){t=t.concat(n.generateTracks(i))}),new ks(e.name,-1,t)}generateTracks(e){const t=[];let n=new P,i=new P;if(e.transform&&e.transform.decompose(n,new St,i),n=n.toArray(),i=i.toArray(),e.T!==void 0&&Object.keys(e.T.curves).length>0){const r=this.generateVectorTrack(e.modelName,e.T.curves,n,"position");r!==void 0&&t.push(r)}if(e.R!==void 0&&Object.keys(e.R.curves).length>0){const r=this.generateRotationTrack(e.modelName,e.R.curves,e.preRotation,e.postRotation,e.eulerOrder);r!==void 0&&t.push(r)}if(e.S!==void 0&&Object.keys(e.S.curves).length>0){const r=this.generateVectorTrack(e.modelName,e.S.curves,i,"scale");r!==void 0&&t.push(r)}if(e.DeformPercent!==void 0){const r=this.generateMorphTrack(e);r!==void 0&&t.push(r)}return t}generateVectorTrack(e,t,n,i){const r=this.getTimesForAllAxes(t),s=this.getKeyframeTrackValues(r,t,n);return new li(e+"."+i,r,s)}generateRotationTrack(e,t,n,i,r){let s,a;if(t.x!==void 0&&t.y!==void 0&&t.z!==void 0){const u=this.interpolateRotations(t.x,t.y,t.z,r);s=u[0],a=u[1]}const o=Pr(0);n!==void 0&&(n=n.map(Ut.degToRad),n.push(o),n=new Ct().fromArray(n),n=new St().setFromEuler(n)),i!==void 0&&(i=i.map(Ut.degToRad),i.push(o),i=new Ct().fromArray(i),i=new St().setFromEuler(i).invert());const l=new St,c=new Ct,h=[];if(!a||!s)return new Xn(e+".quaternion",[0],[0]);for(let u=0;u<a.length;u+=3)c.set(a[u],a[u+1],a[u+2],r),l.setFromEuler(c),n!==void 0&&l.premultiply(n),i!==void 0&&l.multiply(i),u>2&&new St().fromArray(h,(u-3)/3*4).dot(l)<0&&l.set(-l.x,-l.y,-l.z,-l.w),l.toArray(h,u/3*4);return new Xn(e+".quaternion",s,h)}generateMorphTrack(e){const t=e.DeformPercent.curves.morph,n=t.values.map(function(r){return r/100}),i=zt.getObjectByName(e.modelName).morphTargetDictionary[e.morphName];return new oi(e.modelName+".morphTargetInfluences["+i+"]",t.times,n)}getTimesForAllAxes(e){let t=[];if(e.x!==void 0&&(t=t.concat(e.x.times)),e.y!==void 0&&(t=t.concat(e.y.times)),e.z!==void 0&&(t=t.concat(e.z.times)),t=t.sort(function(n,i){return n-i}),t.length>1){let n=1,i=t[0];for(let r=1;r<t.length;r++){const s=t[r];s!==i&&(t[n]=s,i=s,n++)}t=t.slice(0,n)}return t}getKeyframeTrackValues(e,t,n){const i=n,r=[];let s=-1,a=-1,o=-1;return e.forEach(function(l){if(t.x&&(s=t.x.times.indexOf(l)),t.y&&(a=t.y.times.indexOf(l)),t.z&&(o=t.z.times.indexOf(l)),s!==-1){const c=t.x.values[s];r.push(c),i[0]=c}else r.push(i[0]);if(a!==-1){const c=t.y.values[a];r.push(c),i[1]=c}else r.push(i[1]);if(o!==-1){const c=t.z.values[o];r.push(c),i[2]=c}else r.push(i[2])}),r}interpolateRotations(e,t,n,i){const r=[],s=[];r.push(e.times[0]),s.push(Ut.degToRad(e.values[0])),s.push(Ut.degToRad(t.values[0])),s.push(Ut.degToRad(n.values[0]));for(let a=1;a<e.values.length;a++){const o=[e.values[a-1],t.values[a-1],n.values[a-1]];if(isNaN(o[0])||isNaN(o[1])||isNaN(o[2]))continue;const l=o.map(Ut.degToRad),c=[e.values[a],t.values[a],n.values[a]];if(isNaN(c[0])||isNaN(c[1])||isNaN(c[2]))continue;const h=c.map(Ut.degToRad),u=[c[0]-o[0],c[1]-o[1],c[2]-o[2]],f=[Math.abs(u[0]),Math.abs(u[1]),Math.abs(u[2])];if(f[0]>=180||f[1]>=180||f[2]>=180){const d=Math.max(...f)/180,g=new Ct(...l,i),v=new Ct(...h,i),p=new St().setFromEuler(g),m=new St().setFromEuler(v);p.dot(m)&&m.set(-m.x,-m.y,-m.z,-m.w);const y=e.times[a-1],S=e.times[a]-y,M=new St,I=new Ct;for(let w=0;w<1;w+=1/d)M.copy(p.clone().slerp(m.clone(),w)),r.push(y+w*S),I.setFromQuaternion(M,i),s.push(I.x),s.push(I.y),s.push(I.z)}else r.push(e.times[a]),s.push(Ut.degToRad(e.values[a])),s.push(Ut.degToRad(t.values[a])),s.push(Ut.degToRad(n.values[a]))}return[r,s]}},lv=class{getPrevNode(){return this.nodeStack[this.currentIndent-2]}getCurrentNode(){return this.nodeStack[this.currentIndent-1]}getCurrentProp(){return this.currentProp}pushStack(e){this.nodeStack.push(e),this.currentIndent+=1}popStack(){this.nodeStack.pop(),this.currentIndent-=1}setCurrentProp(e,t){this.currentProp=e,this.currentPropName=t}parse(e){this.currentIndent=0,this.allNodes=new Mh,this.nodeStack=[],this.currentProp=[],this.currentPropName="";const t=this,n=e.split(/[\r\n]+/);return n.forEach(function(i,r){const s=i.match(/^[\s\t]*;/),a=i.match(/^[\s\t]*$/);if(s||a)return;const o=i.match("^\\t{"+t.currentIndent+"}(\\w+):(.*){",""),l=i.match("^\\t{"+t.currentIndent+"}(\\w+):[\\s\\t\\r\\n](.*)"),c=i.match("^\\t{"+(t.currentIndent-1)+"}}");o?t.parseNodeBegin(i,o):l?t.parseNodeProperty(i,l,n[++r]):c?t.popStack():i.match(/^[^\s\t}]/)&&t.parseNodePropertyContinued(i)}),this.allNodes}parseNodeBegin(e,t){const n=t[1].trim().replace(/^"/,"").replace(/"$/,""),i=t[2].split(",").map(function(o){return o.trim().replace(/^"/,"").replace(/"$/,"")}),r={name:n},s=this.parseNodeAttr(i),a=this.getCurrentNode();this.currentIndent===0?this.allNodes.add(n,r):n in a?(n==="PoseNode"?a.PoseNode.push(r):a[n].id!==void 0&&(a[n]={},a[n][a[n].id]=a[n]),s.id!==""&&(a[n][s.id]=r)):typeof s.id=="number"?(a[n]={},a[n][s.id]=r):n!=="Properties70"&&(n==="PoseNode"?a[n]=[r]:a[n]=r),typeof s.id=="number"&&(r.id=s.id),s.name!==""&&(r.attrName=s.name),s.type!==""&&(r.attrType=s.type),this.pushStack(r)}parseNodeAttr(e){let t=e[0];e[0]!==""&&(t=parseInt(e[0]),isNaN(t)&&(t=e[0]));let n="",i="";return e.length>1&&(n=e[1].replace(/^(\w+)::/,""),i=e[2]),{id:t,name:n,type:i}}parseNodeProperty(e,t,n){let i=t[1].replace(/^"/,"").replace(/"$/,"").trim(),r=t[2].replace(/^"/,"").replace(/"$/,"").trim();i==="Content"&&r===","&&(r=n.replace(/"/g,"").replace(/,$/,"").trim());const s=this.getCurrentNode();if(s.name==="Properties70"){this.parseNodeSpecialProperty(e,i,r);return}if(i==="C"){const a=r.split(",").slice(1),o=parseInt(a[0]),l=parseInt(a[1]);let c=r.split(",").slice(3);c=c.map(function(h){return h.trim().replace(/^"/,"")}),i="connections",r=[o,l],pv(r,c),s[i]===void 0&&(s[i]=[])}i==="Node"&&(s.id=r),i in s&&Array.isArray(s[i])?s[i].push(r):i!=="a"?s[i]=r:s.a=r,this.setCurrentProp(s,i),i==="a"&&r.slice(-1)!==","&&(s.a=ka(r))}parseNodePropertyContinued(e){const t=this.getCurrentNode();t.a+=e,e.slice(-1)!==","&&(t.a=ka(t.a))}parseNodeSpecialProperty(e,t,n){const i=n.split('",').map(function(c){return c.trim().replace(/^\"/,"").replace(/\s/,"_")}),r=i[0],s=i[1],a=i[2],o=i[3];let l=i[4];switch(s){case"int":case"enum":case"bool":case"ULongLong":case"double":case"Number":case"FieldOfView":l=parseFloat(l);break;case"Color":case"ColorRGB":case"Vector3D":case"Lcl_Translation":case"Lcl_Rotation":case"Lcl_Scaling":l=ka(l);break}this.getPrevNode()[r]={type:s,type2:a,flag:o,value:l},this.setCurrentProp(this.getPrevNode(),r)}},cv=class{parse(e){const t=new ql(e);t.skip(23);const n=t.getUint32();if(n<6400)throw new Error("THREE.FBXLoader: FBX version not supported, FileVersion: "+n);const i=new Mh;for(;!this.endOfContent(t);){const r=this.parseNode(t,n);r!==null&&i.add(r.name,r)}return i}endOfContent(e){return e.size()%16===0?(e.getOffset()+160+16&-16)>=e.size():e.getOffset()+160+16>=e.size()}parseNode(e,t){const n={},i=t>=7500?e.getUint64():e.getUint32(),r=t>=7500?e.getUint64():e.getUint32();t>=7500?e.getUint64():e.getUint32();const s=e.getUint8(),a=e.getString(s);if(i===0)return null;const o=[];for(let u=0;u<r;u++)o.push(this.parseProperty(e));const l=o.length>0?o[0]:"",c=o.length>1?o[1]:"",h=o.length>2?o[2]:"";for(n.singleProperty=r===1&&e.getOffset()===i;i>e.getOffset();){const u=this.parseNode(e,t);u!==null&&this.parseSubNode(a,n,u)}return n.propertyList=o,typeof l=="number"&&(n.id=l),c!==""&&(n.attrName=c),h!==""&&(n.attrType=h),a!==""&&(n.name=a),n}parseSubNode(e,t,n){if(n.singleProperty===!0){const i=n.propertyList[0];Array.isArray(i)?(t[n.name]=n,n.a=i):t[n.name]=i}else if(e==="Connections"&&n.name==="C"){const i=[];n.propertyList.forEach(function(r,s){s!==0&&i.push(r)}),t.connections===void 0&&(t.connections=[]),t.connections.push(i)}else if(n.name==="Properties70")Object.keys(n).forEach(function(i){t[i]=n[i]});else if(e==="Properties70"&&n.name==="P"){let i=n.propertyList[0],r=n.propertyList[1];const s=n.propertyList[2],a=n.propertyList[3];let o;i.indexOf("Lcl ")===0&&(i=i.replace("Lcl ","Lcl_")),r.indexOf("Lcl ")===0&&(r=r.replace("Lcl ","Lcl_")),r==="Color"||r==="ColorRGB"||r==="Vector"||r==="Vector3D"||r.indexOf("Lcl_")===0?o=[n.propertyList[4],n.propertyList[5],n.propertyList[6]]:o=n.propertyList[4],t[i]={type:r,type2:s,flag:a,value:o}}else t[n.name]===void 0?typeof n.id=="number"?(t[n.name]={},t[n.name][n.id]=n):t[n.name]=n:n.name==="PoseNode"?(Array.isArray(t[n.name])||(t[n.name]=[t[n.name]]),t[n.name].push(n)):t[n.name][n.id]===void 0&&(t[n.name][n.id]=n)}parseProperty(e){const t=e.getString(1);let n;switch(t){case"C":return e.getBoolean();case"D":return e.getFloat64();case"F":return e.getFloat32();case"I":return e.getInt32();case"L":return e.getInt64();case"R":return n=e.getUint32(),e.getArrayBuffer(n);case"S":return n=e.getUint32(),e.getString(n);case"Y":return e.getInt16();case"b":case"c":case"d":case"f":case"i":case"l":const i=e.getUint32(),r=e.getUint32(),s=e.getUint32();if(r===0)switch(t){case"b":case"c":return e.getBooleanArray(i);case"d":return e.getFloat64Array(i);case"f":return e.getFloat32Array(i);case"i":return e.getInt32Array(i);case"l":return e.getInt64Array(i)}const a=new ql(jg(new Uint8Array(e.getArrayBuffer(s))).buffer);switch(t){case"b":case"c":return a.getBooleanArray(i);case"d":return a.getFloat64Array(i);case"f":return a.getFloat32Array(i);case"i":return a.getInt32Array(i);case"l":return a.getInt64Array(i)}break;default:throw new Error("THREE.FBXLoader: Unknown property type "+t)}}},ql=class{constructor(e,t){this.dv=new DataView(e),this.offset=0,this.littleEndian=t!==void 0?t:!0,this._textDecoder=new TextDecoder}getOffset(){return this.offset}size(){return this.dv.buffer.byteLength}skip(e){this.offset+=e}getBoolean(){return(this.getUint8()&1)===1}getBooleanArray(e){const t=[];for(let n=0;n<e;n++)t.push(this.getBoolean());return t}getUint8(){const e=this.dv.getUint8(this.offset);return this.offset+=1,e}getInt16(){const e=this.dv.getInt16(this.offset,this.littleEndian);return this.offset+=2,e}getInt32(){const e=this.dv.getInt32(this.offset,this.littleEndian);return this.offset+=4,e}getInt32Array(e){const t=[];for(let n=0;n<e;n++)t.push(this.getInt32());return t}getUint32(){const e=this.dv.getUint32(this.offset,this.littleEndian);return this.offset+=4,e}getInt64(){let e,t;return this.littleEndian?(e=this.getUint32(),t=this.getUint32()):(t=this.getUint32(),e=this.getUint32()),t&2147483648?(t=~t&4294967295,e=~e&4294967295,e===4294967295&&(t=t+1&4294967295),e=e+1&4294967295,-(t*4294967296+e)):t*4294967296+e}getInt64Array(e){const t=[];for(let n=0;n<e;n++)t.push(this.getInt64());return t}getUint64(){let e,t;return this.littleEndian?(e=this.getUint32(),t=this.getUint32()):(t=this.getUint32(),e=this.getUint32()),t*4294967296+e}getFloat32(){const e=this.dv.getFloat32(this.offset,this.littleEndian);return this.offset+=4,e}getFloat32Array(e){const t=[];for(let n=0;n<e;n++)t.push(this.getFloat32());return t}getFloat64(){const e=this.dv.getFloat64(this.offset,this.littleEndian);return this.offset+=8,e}getFloat64Array(e){const t=[];for(let n=0;n<e;n++)t.push(this.getFloat64());return t}getArrayBuffer(e){const t=this.dv.buffer.slice(this.offset,this.offset+e);return this.offset+=e,t}getString(e){const t=this.offset;let n=new Uint8Array(this.dv.buffer,t,e);this.skip(e);const i=n.indexOf(0);return i>=0&&(n=new Uint8Array(this.dv.buffer,t,i)),this._textDecoder.decode(n)}},Mh=class{add(e,t){this[e]=t}};function hv(e){return e.byteLength>=21&&Th(e,0,21)==="Kaydara FBX Binary  \0"}function uv(e){const t=["K","a","y","d","a","r","a","\\","F","B","X","\\","B","i","n","a","r","y","\\","\\"];let n=0;function i(r){const s=e[r-1];return e=e.slice(n+r),n++,s}for(let r=0;r<t.length;++r)if(i(1)===t[r])return!1;return!0}function Yl(e){const t=e.match(/FBXVersion: (\d+)/);if(t)return parseInt(t[1]);throw new Error("THREE.FBXLoader: Cannot find the version number for the file given.")}function fv(e){return e/46186158e3}var dv=[];function Ss(e,t,n,i){let r;switch(i.mappingType){case"ByPolygonVertex":r=e;break;case"ByPolygon":r=t;break;case"ByVertice":r=n;break;case"AllSame":r=i.indices[0];break;default:console.warn("THREE.FBXLoader: unknown attribute mapping type "+i.mappingType)}i.referenceType==="IndexToDirect"&&(r=i.indices[r]);const s=r*i.dataSize,a=s+i.dataSize;return mv(dv,i.buffer,s,a)}var Ba=new Ct,Pi=new P;function Sh(e){const t=new Ie,n=new Ie,i=new Ie,r=new Ie,s=new Ie,a=new Ie,o=new Ie,l=new Ie,c=new Ie,h=new Ie,u=new Ie,f=new Ie,d=e.inheritType?e.inheritType:0;e.translation&&t.setPosition(Pi.fromArray(e.translation));const g=Pr(0);if(e.preRotation){const A=e.preRotation.map(Ut.degToRad);A.push(g),n.makeRotationFromEuler(Ba.fromArray(A))}if(e.rotation){const A=e.rotation.map(Ut.degToRad);A.push(e.eulerOrder||g),i.makeRotationFromEuler(Ba.fromArray(A))}if(e.postRotation){const A=e.postRotation.map(Ut.degToRad);A.push(g),r.makeRotationFromEuler(Ba.fromArray(A)),r.invert()}e.scale&&s.scale(Pi.fromArray(e.scale)),e.scalingOffset&&o.setPosition(Pi.fromArray(e.scalingOffset)),e.scalingPivot&&a.setPosition(Pi.fromArray(e.scalingPivot)),e.rotationOffset&&l.setPosition(Pi.fromArray(e.rotationOffset)),e.rotationPivot&&c.setPosition(Pi.fromArray(e.rotationPivot)),e.parentMatrixWorld&&(u.copy(e.parentMatrix),h.copy(e.parentMatrixWorld));const v=n.clone().multiply(i).multiply(r),p=new Ie;p.extractRotation(h);const m=new Ie;m.copyPosition(h);const y=m.clone().invert().multiply(h),S=p.clone().invert().multiply(y),M=s,I=new Ie;if(d===0)I.copy(p).multiply(v).multiply(S).multiply(M);else if(d===1)I.copy(p).multiply(S).multiply(v).multiply(M);else{const A=new Ie().scale(new P().setFromMatrixScale(u)).clone().invert(),O=S.clone().multiply(A);I.copy(p).multiply(v).multiply(O).multiply(M)}const w=c.clone().invert(),C=a.clone().invert();let _=t.clone().multiply(l).multiply(c).multiply(n).multiply(i).multiply(r).multiply(w).multiply(o).multiply(a).multiply(s).multiply(C);const b=new Ie().copyPosition(_),N=h.clone().multiply(b);return f.copyPosition(N),_=f.clone().multiply(I),_.premultiply(h.invert()),_}function Pr(e){e=e||0;const t=["ZYX","YZX","XZY","ZXY","YXZ","XYZ"];return e===6?(console.warn("THREE.FBXLoader: unsupported Euler Order: Spherical XYZ. Animations and rotations may be incorrect."),t[0]):t[e]}function ka(e){return e.split(",").map(function(t){return parseFloat(t)})}function Th(e,t,n){return t===void 0&&(t=0),n===void 0&&(n=e.byteLength),new TextDecoder().decode(new Uint8Array(e,t,n))}function pv(e,t){for(let n=0,i=e.length,r=t.length;n<r;n++,i++)e[i]=t[n]}function mv(e,t,n,i){for(let r=n,s=0;r<i;r++,s++)e[s]=t[r];return e}var gv=/^[og]\s*(.+)?/,vv=/^mtllib /,_v=/^usemtl /,yv=/^usemap /,jl=/\s+/,Kl=new P,za=new P,Jl=new P,Zl=new P,jt=new P,Ts=new Ee;function xv(){const e={objects:[],object:{},vertices:[],normals:[],colors:[],uvs:[],materials:{},materialLibraries:[],startObject:function(t,n){if(this.object&&this.object.fromDeclaration===!1){this.object.name=t,this.object.fromDeclaration=n!==!1;return}const i=this.object&&typeof this.object.currentMaterial=="function"?this.object.currentMaterial():void 0;if(this.object&&typeof this.object._finalize=="function"&&this.object._finalize(!0),this.object={name:t||"",fromDeclaration:n!==!1,geometry:{vertices:[],normals:[],colors:[],uvs:[],hasUVIndices:!1},materials:[],smooth:!0,startMaterial:function(r,s){const a=this._finalize(!1);a&&(a.inherited||a.groupCount<=0)&&this.materials.splice(a.index,1);const o={index:this.materials.length,name:r||"",mtllib:Array.isArray(s)&&s.length>0?s[s.length-1]:"",smooth:a!==void 0?a.smooth:this.smooth,groupStart:a!==void 0?a.groupEnd:0,groupEnd:-1,groupCount:-1,inherited:!1,clone:function(l){const c={index:typeof l=="number"?l:this.index,name:this.name,mtllib:this.mtllib,smooth:this.smooth,groupStart:0,groupEnd:-1,groupCount:-1,inherited:!1};return c.clone=this.clone.bind(c),c}};return this.materials.push(o),o},currentMaterial:function(){if(this.materials.length>0)return this.materials[this.materials.length-1]},_finalize:function(r){const s=this.currentMaterial();if(s&&s.groupEnd===-1&&(s.groupEnd=this.geometry.vertices.length/3,s.groupCount=s.groupEnd-s.groupStart,s.inherited=!1),r&&this.materials.length>1)for(let a=this.materials.length-1;a>=0;a--)this.materials[a].groupCount<=0&&this.materials.splice(a,1);return r&&this.materials.length===0&&this.materials.push({name:"",smooth:this.smooth}),s}},i&&i.name&&typeof i.clone=="function"){const r=i.clone(0);r.inherited=!0,this.object.materials.push(r)}this.objects.push(this.object)},finalize:function(){this.object&&typeof this.object._finalize=="function"&&this.object._finalize(!0)},parseVertexIndex:function(t,n){const i=parseInt(t,10);return(i>=0?i-1:i+n/3)*3},parseNormalIndex:function(t,n){const i=parseInt(t,10);return(i>=0?i-1:i+n/3)*3},parseUVIndex:function(t,n){const i=parseInt(t,10);return(i>=0?i-1:i+n/2)*2},addVertex:function(t,n,i){const r=this.vertices,s=this.object.geometry.vertices;s.push(r[t+0],r[t+1],r[t+2]),s.push(r[n+0],r[n+1],r[n+2]),s.push(r[i+0],r[i+1],r[i+2])},addVertexPoint:function(t){const n=this.vertices;this.object.geometry.vertices.push(n[t+0],n[t+1],n[t+2])},addVertexLine:function(t){const n=this.vertices;this.object.geometry.vertices.push(n[t+0],n[t+1],n[t+2])},addNormal:function(t,n,i){const r=this.normals,s=this.object.geometry.normals;s.push(r[t+0],r[t+1],r[t+2]),s.push(r[n+0],r[n+1],r[n+2]),s.push(r[i+0],r[i+1],r[i+2])},addFaceNormal:function(t,n,i){const r=this.vertices,s=this.object.geometry.normals;Kl.fromArray(r,t),za.fromArray(r,n),Jl.fromArray(r,i),jt.subVectors(Jl,za),Zl.subVectors(Kl,za),jt.cross(Zl),jt.normalize(),s.push(jt.x,jt.y,jt.z),s.push(jt.x,jt.y,jt.z),s.push(jt.x,jt.y,jt.z)},addColor:function(t,n,i){const r=this.colors,s=this.object.geometry.colors;r[t]!==void 0&&s.push(r[t+0],r[t+1],r[t+2]),r[n]!==void 0&&s.push(r[n+0],r[n+1],r[n+2]),r[i]!==void 0&&s.push(r[i+0],r[i+1],r[i+2])},addUV:function(t,n,i){const r=this.uvs,s=this.object.geometry.uvs;s.push(r[t+0],r[t+1]),s.push(r[n+0],r[n+1]),s.push(r[i+0],r[i+1])},addDefaultUV:function(){const t=this.object.geometry.uvs;t.push(0,0),t.push(0,0),t.push(0,0)},addUVLine:function(t){const n=this.uvs;this.object.geometry.uvs.push(n[t+0],n[t+1])},addFace:function(t,n,i,r,s,a,o,l,c){const h=this.vertices.length;let u=this.parseVertexIndex(t,h),f=this.parseVertexIndex(n,h),d=this.parseVertexIndex(i,h);if(this.addVertex(u,f,d),this.addColor(u,f,d),o!==void 0&&o!==""){const g=this.normals.length;u=this.parseNormalIndex(o,g),f=this.parseNormalIndex(l,g),d=this.parseNormalIndex(c,g),this.addNormal(u,f,d)}else this.addFaceNormal(u,f,d);if(r!==void 0&&r!==""){const g=this.uvs.length;u=this.parseUVIndex(r,g),f=this.parseUVIndex(s,g),d=this.parseUVIndex(a,g),this.addUV(u,f,d),this.object.geometry.hasUVIndices=!0}else this.addDefaultUV()},addPointGeometry:function(t){this.object.geometry.type="Points";const n=this.vertices.length;for(let i=0,r=t.length;i<r;i++){const s=this.parseVertexIndex(t[i],n);this.addVertexPoint(s),this.addColor(s)}},addLineGeometry:function(t,n){this.object.geometry.type="Line";const i=this.vertices.length,r=this.uvs.length;for(let s=0,a=t.length;s<a;s++)this.addVertexLine(this.parseVertexIndex(t[s],i));for(let s=0,a=n.length;s<a;s++)this.addUVLine(this.parseUVIndex(n[s],r))}};return e.startObject("",!1),e}var Gv=class extends $t{constructor(e){super(e),this.materials=null}load(e,t,n,i){const r=this,s=new er(this.manager);s.setPath(this.path),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials),s.load(e,function(a){try{t(r.parse(a))}catch(o){i?i(o):console.error(o),r.manager.itemError(e)}},n,i)}setMaterials(e){return this.materials=e,this}parse(e){const t=new xv;e.indexOf(`\r
`)!==-1&&(e=e.replace(/\r\n/g,`
`)),e.indexOf(`\\
`)!==-1&&(e=e.replace(/\\\n/g,""));const n=e.split(`
`);let i=[];for(let s=0,a=n.length;s<a;s++){const o=n[s].trimStart();if(o.length===0)continue;const l=o.charAt(0);if(l!=="#")if(l==="v"){const c=o.split(jl);switch(c[0]){case"v":t.vertices.push(parseFloat(c[1]),parseFloat(c[2]),parseFloat(c[3])),c.length>=7?(Ts.setRGB(parseFloat(c[4]),parseFloat(c[5]),parseFloat(c[6]),rt),t.colors.push(Ts.r,Ts.g,Ts.b)):t.colors.push(void 0,void 0,void 0);break;case"vn":t.normals.push(parseFloat(c[1]),parseFloat(c[2]),parseFloat(c[3]));break;case"vt":t.uvs.push(parseFloat(c[1]),parseFloat(c[2]));break}}else if(l==="f"){const c=o.slice(1).trim().split(jl),h=[];for(let f=0,d=c.length;f<d;f++){const g=c[f];if(g.length>0){const v=g.split("/");h.push(v)}}const u=h[0];for(let f=1,d=h.length-1;f<d;f++){const g=h[f],v=h[f+1];t.addFace(u[0],g[0],v[0],u[1],g[1],v[1],u[2],g[2],v[2])}}else if(l==="l"){const c=o.substring(1).trim().split(" ");let h=[];const u=[];if(o.indexOf("/")===-1)h=c;else for(let f=0,d=c.length;f<d;f++){const g=c[f].split("/");g[0]!==""&&h.push(g[0]),g[1]!==""&&u.push(g[1])}t.addLineGeometry(h,u)}else if(l==="p"){const c=o.slice(1).trim().split(" ");t.addPointGeometry(c)}else if((i=gv.exec(o))!==null){const c=(" "+i[0].slice(1).trim()).slice(1);t.startObject(c)}else if(_v.test(o))t.object.startMaterial(o.substring(7).trim(),t.materialLibraries);else if(vv.test(o))t.materialLibraries.push(o.substring(7).trim());else if(yv.test(o))console.warn('THREE.OBJLoader: Rendering identifier "usemap" not supported. Textures must be defined in MTL files.');else if(l==="s"){if(i=o.split(" "),i.length>1){const h=i[1].trim().toLowerCase();t.object.smooth=h!=="0"&&h!=="off"}else t.object.smooth=!0;const c=t.object.currentMaterial();c&&(c.smooth=t.object.smooth)}else{if(o==="\0")continue;console.warn('THREE.OBJLoader: Unexpected line: "'+o+'"')}}t.finalize();const r=new gn;if(r.materialLibraries=[].concat(t.materialLibraries),t.objects.length===1&&t.objects[0].geometry.vertices.length===0){if(t.vertices.length>0){const s=new Oi({size:1,sizeAttenuation:!1}),a=new dt;a.setAttribute("position",new Ye(t.vertices,3)),t.colors.length>0&&t.colors[0]!==void 0&&(a.setAttribute("color",new Ye(t.colors,3)),s.vertexColors=!0);const o=new As(a,s);r.add(o)}}else for(let s=0,a=t.objects.length;s<a;s++){const o=t.objects[s],l=o.geometry,c=o.materials,h=l.type==="Line",u=l.type==="Points";let f=!1;if(l.vertices.length===0)continue;const d=new dt;d.setAttribute("position",new Ye(l.vertices,3)),l.normals.length>0&&d.setAttribute("normal",new Ye(l.normals,3)),l.colors.length>0&&(f=!0,d.setAttribute("color",new Ye(l.colors,3))),l.hasUVIndices===!0&&d.setAttribute("uv",new Ye(l.uvs,2));const g=[];for(let p=0,m=c.length;p<m;p++){const y=c[p],S=y.name+"_"+y.smooth+"_"+f;let M=t.materials[S];if(this.materials!==null){if(M=this.materials.create(y.name),h&&M&&!(M instanceof Wn)){const I=new Wn;Gt.prototype.copy.call(I,M),I.color.copy(M.color),M=I}else if(u&&M&&!(M instanceof Oi)){const I=new Oi({size:10,sizeAttenuation:!1});Gt.prototype.copy.call(I,M),I.color.copy(M.color),I.map=M.map,M=I}}M===void 0&&(h?M=new Wn:u?M=new Oi({size:1,sizeAttenuation:!1}):M=new vr,M.name=y.name,M.flatShading=!y.smooth,M.vertexColors=f,t.materials[S]=M),g.push(M)}let v;if(g.length>1){for(let p=0,m=c.length;p<m;p++){const y=c[p];d.addGroup(y.groupStart,y.groupCount,p)}h?v=new Bs(d,g):u?v=new As(d,g):v=new Pt(d,g)}else h?v=new Bs(d,g[0]):u?v=new As(d,g[0]):v=new Pt(d,g[0]);v.name=o.name,r.add(v)}return r}},Hv=class extends $t{constructor(e){super(e)}load(e,t,n,i){const r=this,s=new er(this.manager);s.setPath(this.path),s.setResponseType("arraybuffer"),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials),s.load(e,function(a){try{t(r.parse(a))}catch(o){i?i(o):console.error(o),r.manager.itemError(e)}},n,i)}parse(e){function t(l){const c=new DataView(l);if(84+c.getUint32(80,!0)*50===c.byteLength)return!0;const h=[115,111,108,105,100];for(let u=0;u<5;u++)if(n(h,c,u))return!1;return!0}function n(l,c,h){for(let u=0,f=l.length;u<f;u++)if(l[u]!==c.getUint8(h+u))return!1;return!0}function i(l){const c=new DataView(l),h=c.getUint32(80,!0);let u,f,d,g=!1,v,p,m,y,S;for(let N=0;N<70;N++)c.getUint32(N,!1)==1129270351&&c.getUint8(N+4)==82&&c.getUint8(N+5)==61&&(g=!0,v=new Float32Array(h*3*3),p=c.getUint8(N+6)/255,m=c.getUint8(N+7)/255,y=c.getUint8(N+8)/255,S=c.getUint8(N+9)/255);const M=84,I=50,w=new dt,C=new Float32Array(h*3*3),_=new Float32Array(h*3*3),b=new Ee;for(let N=0;N<h;N++){const A=M+N*I,O=c.getFloat32(A,!0),H=c.getFloat32(A+4,!0),k=c.getFloat32(A+8,!0);if(g){const L=c.getUint16(A+48,!0);(L&32768)===0?(u=(L&31)/31,f=(L>>5&31)/31,d=(L>>10&31)/31):(u=p,f=m,d=y)}for(let L=1;L<=3;L++){const B=A+L*12,U=N*3*3+(L-1)*3;C[U]=c.getFloat32(B,!0),C[U+1]=c.getFloat32(B+4,!0),C[U+2]=c.getFloat32(B+8,!0),_[U]=O,_[U+1]=H,_[U+2]=k,g&&(b.setRGB(u,f,d,rt),v[U]=b.r,v[U+1]=b.g,v[U+2]=b.b)}}return w.setAttribute("position",new wt(C,3)),w.setAttribute("normal",new wt(_,3)),g&&(w.setAttribute("color",new wt(v,3)),w.hasColors=!0,w.alpha=S),w}function r(l){const c=new dt,h=/solid([\s\S]*?)endsolid/g,u=/facet([\s\S]*?)endfacet/g,f=/solid\s(.+)/;let d=0;const g=/[\s]+([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)/.source,v=new RegExp("vertex"+g+g+g,"g"),p=new RegExp("normal"+g+g+g,"g"),m=[],y=[],S=[],M=new P;let I,w=0,C=0,_=0;for(;(I=h.exec(l))!==null;){C=_;const b=I[0],N=(I=f.exec(b))!==null?I[1]:"";for(S.push(N);(I=u.exec(b))!==null;){let H=0,k=0;const L=I[0];for(;(I=p.exec(L))!==null;)M.x=parseFloat(I[1]),M.y=parseFloat(I[2]),M.z=parseFloat(I[3]),k++;for(;(I=v.exec(L))!==null;)m.push(parseFloat(I[1]),parseFloat(I[2]),parseFloat(I[3])),y.push(M.x,M.y,M.z),H++,_++;k!==1&&console.error("THREE.STLLoader: Something isn't right with the normal of face number "+d),H!==3&&console.error("THREE.STLLoader: Something isn't right with the vertices of face number "+d),d++}const A=C,O=_-C;c.userData.groupNames=S,c.addGroup(A,O,w),w++}return c.setAttribute("position",new Ye(m,3)),c.setAttribute("normal",new Ye(y,3)),c}function s(l){return typeof l!="string"?new TextDecoder().decode(l):l}function a(l){if(typeof l=="string"){const c=new Uint8Array(l.length);for(let h=0;h<l.length;h++)c[h]=l.charCodeAt(h)&255;return c.buffer||c}else return l}const o=a(e);return t(o)?i(o):r(s(e))}},Wv=class extends Sd{constructor(e){super(e)}parse(e){function t(L){switch(L.image_type){case u:case g:if(L.colormap_length>256||L.colormap_size!==24||L.colormap_type!==1)throw new Error("THREE.TGALoader: Invalid type colormap data for indexed type.");break;case f:case d:case v:case p:if(L.colormap_type)throw new Error("THREE.TGALoader: Invalid type colormap data for colormap type.");break;case h:throw new Error("THREE.TGALoader: No data.");default:throw new Error("THREE.TGALoader: Invalid type "+L.image_type)}if(L.width<=0||L.height<=0)throw new Error("THREE.TGALoader: Invalid image size.");if(L.pixel_size!==8&&L.pixel_size!==16&&L.pixel_size!==24&&L.pixel_size!==32)throw new Error("THREE.TGALoader: Invalid pixel size "+L.pixel_size)}function n(L,B,U,$,j){let J,re;const Q=U.pixel_size>>3,pe=U.width*U.height*Q;if(B&&(re=j.subarray($,$+=U.colormap_length*(U.colormap_size>>3))),L){J=new Uint8Array(pe);let de,F,q,se=0;const ae=new Uint8Array(Q);for(;se<pe;)if(de=j[$++],F=(de&127)+1,de&128){for(q=0;q<Q;++q)ae[q]=j[$++];for(q=0;q<F;++q)J.set(ae,se+q*Q);se+=Q*F}else{for(F*=Q,q=0;q<F;++q)J[se+q]=j[$++];se+=F}}else J=j.subarray($,$+=B?U.width*U.height:pe);return{pixel_data:J,palettes:re}}function i(L,B,U,$,j,J,re,Q,pe){const de=pe;let F,q=0,se,ae;const Re=b.width;for(ae=B;ae!==$;ae+=U)for(se=j;se!==re;se+=J,q++)F=Q[q],L[(se+Re*ae)*4+3]=255,L[(se+Re*ae)*4+2]=de[F*3+0],L[(se+Re*ae)*4+1]=de[F*3+1],L[(se+Re*ae)*4+0]=de[F*3+2];return L}function r(L,B,U,$,j,J,re,Q){let pe,de=0,F,q;const se=b.width;for(q=B;q!==$;q+=U)for(F=j;F!==re;F+=J,de+=2)pe=Q[de+0]+(Q[de+1]<<8),L[(F+se*q)*4+0]=(pe&31744)>>7,L[(F+se*q)*4+1]=(pe&992)>>2,L[(F+se*q)*4+2]=(pe&31)<<3,L[(F+se*q)*4+3]=pe&32768?0:255;return L}function s(L,B,U,$,j,J,re,Q){let pe=0,de,F;const q=b.width;for(F=B;F!==$;F+=U)for(de=j;de!==re;de+=J,pe+=3)L[(de+q*F)*4+3]=255,L[(de+q*F)*4+2]=Q[pe+0],L[(de+q*F)*4+1]=Q[pe+1],L[(de+q*F)*4+0]=Q[pe+2];return L}function a(L,B,U,$,j,J,re,Q){let pe=0,de,F;const q=b.width;for(F=B;F!==$;F+=U)for(de=j;de!==re;de+=J,pe+=4)L[(de+q*F)*4+2]=Q[pe+0],L[(de+q*F)*4+1]=Q[pe+1],L[(de+q*F)*4+0]=Q[pe+2],L[(de+q*F)*4+3]=Q[pe+3];return L}function o(L,B,U,$,j,J,re,Q){let pe,de=0,F,q;const se=b.width;for(q=B;q!==$;q+=U)for(F=j;F!==re;F+=J,de++)pe=Q[de],L[(F+se*q)*4+0]=pe,L[(F+se*q)*4+1]=pe,L[(F+se*q)*4+2]=pe,L[(F+se*q)*4+3]=255;return L}function l(L,B,U,$,j,J,re,Q){let pe=0,de,F;const q=b.width;for(F=B;F!==$;F+=U)for(de=j;de!==re;de+=J,pe+=2)L[(de+q*F)*4+0]=Q[pe+0],L[(de+q*F)*4+1]=Q[pe+0],L[(de+q*F)*4+2]=Q[pe+0],L[(de+q*F)*4+3]=Q[pe+1];return L}function c(L,B,U,$,j){let J,re,Q,pe,de,F;switch((b.flags&m)>>y){default:case I:J=0,Q=1,de=B,re=0,pe=1,F=U;break;case S:J=0,Q=1,de=B,re=U-1,pe=-1,F=-1;break;case w:J=B-1,Q=-1,de=-1,re=0,pe=1,F=U;break;case M:J=B-1,Q=-1,de=-1,re=U-1,pe=-1,F=-1;break}if(O)switch(b.pixel_size){case 8:o(L,re,pe,F,J,Q,de,$);break;case 16:l(L,re,pe,F,J,Q,de,$);break;default:throw new Error("THREE.TGALoader: Format not supported.")}else switch(b.pixel_size){case 8:i(L,re,pe,F,J,Q,de,$,j);break;case 16:r(L,re,pe,F,J,Q,de,$);break;case 24:s(L,re,pe,F,J,Q,de,$);break;case 32:a(L,re,pe,F,J,Q,de,$);break;default:throw new Error("THREE.TGALoader: Format not supported.")}return L}const h=0,u=1,f=2,d=3,g=9,v=10,p=11,m=48,y=4,S=0,M=1,I=2,w=3;if(e.length<19)throw new Error("THREE.TGALoader: Not enough data to contain header.");let C=0;const _=new Uint8Array(e),b={id_length:_[C++],colormap_type:_[C++],image_type:_[C++],colormap_index:_[C++]|_[C++]<<8,colormap_length:_[C++]|_[C++]<<8,colormap_size:_[C++],origin:[_[C++]|_[C++]<<8,_[C++]|_[C++]<<8],width:_[C++]|_[C++]<<8,height:_[C++]|_[C++]<<8,pixel_size:_[C++],flags:_[C++]};if(t(b),b.id_length+C>e.length)throw new Error("THREE.TGALoader: No data.");C+=b.id_length;let N=!1,A=!1,O=!1;switch(b.image_type){case g:N=!0,A=!0;break;case u:A=!0;break;case v:N=!0;break;case f:break;case p:N=!0,O=!0;break;case d:O=!0;break}const H=new Uint8Array(b.width*b.height*4),k=n(N,A,b,C,_);return c(H,b.width,b.height,k.pixel_data,k.palettes),{data:H,width:b.width,height:b.height,flipY:!0,generateMipmaps:!0,minFilter:Ki}}};export{kc as $,gn as A,Pt as B,Rv as C,Tv as D,Ye as E,It as F,Vt as G,xn as H,Ki as I,Lr as J,ti as K,_d as L,Dr as M,Wn as N,Sv as O,Bs as P,Ev as Q,Mu as R,Mv as S,Cv as T,ho as U,zn as V,il as W,Gi as X,Nv as Y,rt as Z,Uv as _,kv as a,Ft as at,Mf as b,Ad as c,P as ct,In as d,Iv as et,oo as f,wv as g,Av as h,Vv as i,hf as it,Lv as j,Ov as k,Dv as l,dt as m,Hv as n,Pv as nt,ng as o,eh as ot,wt as p,qc as q,Gv as r,bv as rt,Bv as s,oe as st,Wv as t,Vn as tt,Fv as u,Ee as v,Ct as w,ih as x,Sf as y,Ut as z};
