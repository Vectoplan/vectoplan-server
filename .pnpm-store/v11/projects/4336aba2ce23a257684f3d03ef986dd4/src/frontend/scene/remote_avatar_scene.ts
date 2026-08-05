import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { RealtimeMember, RealtimePresenceState } from "./realtime_client";
import {
  createHeldItemVisual,
  type HeldItemVisualHandle,
} from "./held_item_visual";

type AvatarAnimationState = "idle" | "walk" | "run" | "jump";

interface HumanAvatarTemplate {
  readonly scene: THREE.Group;
  readonly animations: readonly THREE.AnimationClip[];
}

interface AvatarRig {
  readonly member: RealtimeMember;
  readonly root: THREE.Group;
  readonly body: THREE.Group;
  readonly leftShoulder: THREE.Group;
  readonly rightShoulder: THREE.Group;
  readonly leftHip: THREE.Group;
  readonly rightHip: THREE.Group;
  readonly leftKnee: THREE.Group;
  readonly rightKnee: THREE.Group;
  readonly targetPosition: THREE.Vector3;
  readonly targetVelocity: THREE.Vector3;
  readonly materials: THREE.Material[];
  readonly textures: THREE.Texture[];
  readonly fallbackRightHand: THREE.Object3D;
  readonly heldItemMount: THREE.Group;
  readonly heldItemVisual: HeldItemVisualHandle;
  modelRoot: THREE.Group | null;
  modelRightHand: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<AvatarAnimationState, THREE.AnimationAction>>;
  activeAction: THREE.AnimationAction | null;
  animationState: AvatarAnimationState;
  hasJumpClip: boolean;
  targetYaw: number;
  movementMode: RealtimePresenceState["movementMode"];
  phase: number;
  idlePhase: number;
  lastUpdateAtMs: number;
}

export interface AvatarScenePlayerSnapshot {
  readonly sessionId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly avatarColor: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly movementMode: RealtimePresenceState["movementMode"];
  readonly heldItem: RealtimePresenceState["heldItem"];
}
export interface RemoteAvatarScene {
  upsertMember(member: RealtimeMember): void;
  applyPresence(state: RealtimePresenceState): void;
  remove(sessionId: string): void;
  update(deltaSeconds: number, nowMs: number): void;
  setVisible(visible: boolean): void;
  clear(): void;
  getCount(): number;
  getPlayers(): readonly AvatarScenePlayerSnapshot[];
  destroy(): void;
}

const AVATAR_HEIGHT = 2.03;
const AVATAR_MODEL_URL = new URL("../assets/models/vectoplan-human.glb", import.meta.url).href;
const STALE_AVATAR_MS = 30_000;
const WALK_TO_RUN_SPEED = 4.8;
const HUMAN_AVATAR_LOADER = new GLTFLoader();
const HELD_ITEM_WORLD_POSITION = new THREE.Vector3();
let humanAvatarTemplatePromise: Promise<HumanAvatarTemplate> | null = null;

function loadHumanAvatarTemplate(): Promise<HumanAvatarTemplate> {
  if (!humanAvatarTemplatePromise) {
    humanAvatarTemplatePromise = HUMAN_AVATAR_LOADER.loadAsync(AVATAR_MODEL_URL).then((gltf) => ({
      scene: gltf.scene,
      animations: gltf.animations,
    }));
  }
  return humanAvatarTemplatePromise;
}

function hashNumber(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function createMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number],
  scale?: readonly [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCapsule(
  name: string,
  radius: number,
  length: number,
  material: THREE.Material,
  position: readonly [number, number, number],
): THREE.Mesh {
  return createMesh(
    name,
    new THREE.CapsuleGeometry(radius, length, 6, 12),
    material,
    position,
  );
}

function createNameplate(displayName: string): {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
} {
  const name = displayName.trim().slice(0, 48) || "Gast";
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "700 40px Inter, Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(3, 10, 18, 0.88)";
    context.lineWidth = 6;
    context.strokeText(name, 256, 56, 468);
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(0, 0, 0, 0.72)";
    context.shadowBlur = 5;
    context.shadowOffsetY = 2;
    context.fillText(name, 256, 56, 468);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = "vectoplan-remote-avatar-name";
  sprite.position.set(0, AVATAR_HEIGHT + 0.25, 0);
  sprite.scale.set(1.72, 0.38, 1);
  sprite.renderOrder = 10_000;
  return { sprite, material, texture };
}

function safeColor(value: string): THREE.Color {
  const color = new THREE.Color(0x2563eb);
  try {
    color.setStyle(value);
  } catch {
    // Keep the deterministic VECTOPLAN blue fallback.
  }
  return color;
}

function skinColor(userId: string): THREE.Color {
  const tones = [0xf1c6a8, 0xe5ad88, 0xce8c65, 0xa96645, 0x71432f] as const;
  return new THREE.Color(tones[hashNumber(userId) % tones.length]);
}

function damp(current: number, target: number, speed: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-Math.max(0, dt) * speed));
}

function dampAngle(current: number, target: number, speed: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-Math.max(0, dt) * speed));
}

function createArm(
  side: "left" | "right",
  x: number,
  jacket: THREE.Material,
  skin: THREE.Material,
): THREE.Group {
  const shoulder = new THREE.Group();
  shoulder.name = `${side}-shoulder-joint`;
  shoulder.position.set(x, 1.5, 0);
  const upper = createCapsule(`${side}-upper-arm`, 0.09, 0.2, jacket, [0, -0.2, 0]);
  const elbow = new THREE.Group();
  elbow.position.set(0, -0.39, 0);
  const forearm = createCapsule(`${side}-forearm`, 0.075, 0.2, skin, [0, -0.19, 0]);
  const hand = createMesh(
    `${side}-hand`,
    new THREE.SphereGeometry(0.09, 14, 10),
    skin,
    [0, -0.39, 0],
    [0.88, 1.08, 0.84],
  );
  elbow.add(forearm, hand);
  shoulder.add(upper, elbow);
  return shoulder;
}

function createLeg(
  side: "left" | "right",
  x: number,
  trousers: THREE.Material,
  shoes: THREE.Material,
): { hip: THREE.Group; knee: THREE.Group } {
  const hip = new THREE.Group();
  hip.name = `${side}-hip-joint`;
  hip.position.set(x, 0.91, 0);
  const upper = createCapsule(`${side}-upper-leg`, 0.11, 0.24, trousers, [0, -0.22, 0]);
  const knee = new THREE.Group();
  knee.position.set(0, -0.44, 0);
  const lower = createCapsule(`${side}-lower-leg`, 0.09, 0.24, trousers, [0, -0.21, 0]);
  const foot = createMesh(
    `${side}-foot`,
    new THREE.CapsuleGeometry(0.105, 0.18, 5, 10),
    shoes,
    [0, -0.42, -0.065],
  );
  foot.rotation.x = Math.PI / 2;
  foot.scale.set(0.98, 1.04, 0.92);
  knee.add(lower, foot);
  hip.add(upper, knee);
  return { hip, knee };
}

function createRig(member: RealtimeMember): AvatarRig {
  const root = new THREE.Group();
  root.name = `vectoplan-remote-avatar:${member.sessionId}`;
  root.userData.vectoplanRemoteAvatar = true;
  root.userData.sessionId = member.sessionId;

  const primary = safeColor(member.avatarColor);
  const jacket = new THREE.MeshPhysicalMaterial({
    color: primary,
    roughness: 0.58,
    metalness: 0.01,
    clearcoat: 0.12,
    clearcoatRoughness: 0.72,
  });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xeaf1f8, roughness: 0.76 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor(member.userId), roughness: 0.86 });
  const trousers = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x27364a).lerp(primary, 0.12),
    roughness: 0.9,
  });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.82 });
  const hair = new THREE.MeshStandardMaterial({
    color: [0x261a16, 0x4a3026, 0x6b4b35, 0x17191c][hashNumber(member.userId + ":hair") % 4],
    roughness: 0.94,
  });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.4 });

  const body = new THREE.Group();
  body.name = "humanoid-body";
  const leftShoulder = createArm("left", -0.4, jacket, skin);
  const rightShoulder = createArm("right", 0.4, jacket, skin);
  const leftLeg = createLeg("left", -0.155, trousers, shoes);
  const rightLeg = createLeg("right", 0.155, trousers, shoes);
  const nose = createMesh(
    "nose",
    new THREE.ConeGeometry(0.028, 0.075, 12),
    skin,
    [0, 1.77, -0.244],
  );
  nose.rotation.x = Math.PI / 2;
  body.add(
    createMesh("pelvis", new THREE.SphereGeometry(1, 20, 14), trousers, [0, 0.95, 0], [0.29, 0.2, 0.19]),
    createMesh("tailored-jacket", new THREE.SphereGeometry(1, 24, 16), jacket, [0, 1.3, 0], [0.36, 0.42, 0.21]),
    createMesh("shirt-front", new THREE.BoxGeometry(0.16, 0.29, 0.02), shirt, [0, 1.39, -0.205]),
    createCapsule("neck", 0.105, 0.06, skin, [0, 1.63, 0]),
    createMesh("head", new THREE.SphereGeometry(1, 28, 20), skin, [0, 1.8, 0], [0.235, 0.275, 0.225]),
    createMesh(
      "hair",
      new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hair,
      [0, 1.845, 0.006],
      [0.241, 0.255, 0.231],
    ),
    createMesh("left-eye", new THREE.SphereGeometry(0.025, 12, 8), eyes, [-0.078, 1.825, -0.213]),
    createMesh("right-eye", new THREE.SphereGeometry(0.025, 12, 8), eyes, [0.078, 1.825, -0.213]),
    nose,
    leftShoulder,
    rightShoulder,
    leftLeg.hip,
    rightLeg.hip,
  );

  const nameplate = createNameplate(member.displayName);
  const fallbackRightHand = rightShoulder.getObjectByName("right-hand") ?? rightShoulder;
  const heldItemMount = new THREE.Group();
  heldItemMount.name = "vectoplan-avatar-held-item-mount";
  root.add(body, nameplate.sprite, heldItemMount);
  const heldItemVisual = createHeldItemVisual(heldItemMount, "avatar");
  const seed = hashNumber(member.sessionId) / 0xffff_ffff;
  const rig: AvatarRig = {
    member,
    root,
    body,
    leftShoulder,
    rightShoulder,
    leftHip: leftLeg.hip,
    rightHip: rightLeg.hip,
    leftKnee: leftLeg.knee,
    rightKnee: rightLeg.knee,
    targetPosition: new THREE.Vector3(),
    targetVelocity: new THREE.Vector3(),
    targetYaw: 0,
    movementMode: "airborne",
    phase: seed * Math.PI * 2,
    idlePhase: seed * Math.PI * 2,
    lastUpdateAtMs: performance.now(),
    materials: [jacket, shirt, skin, trousers, shoes, hair, eyes, nameplate.material],
    textures: [nameplate.texture],
    fallbackRightHand,
    heldItemMount,
    heldItemVisual,
    modelRoot: null,
    modelRightHand: null,
    mixer: null,
    actions: {},
    activeAction: null,
    animationState: "idle",
    hasJumpClip: false,
  };
  if (member.state) {
    rig.targetPosition.set(member.state.position.x, member.state.position.y, member.state.position.z);
    rig.targetVelocity.set(member.state.velocity.x, member.state.velocity.y, member.state.velocity.z);
    rig.root.position.copy(rig.targetPosition);
    rig.targetYaw = member.state.yaw;
    rig.root.rotation.y = member.state.yaw;
    rig.movementMode = member.state.movementMode;
    rig.heldItemVisual.setItem(member.state.heldItem);
  }
  return rig;
}

function findAnimationClip(
  animations: readonly THREE.AnimationClip[],
  candidates: readonly string[],
): THREE.AnimationClip | null {
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase();
    const exact = animations.find((clip) => clip.name.trim().toLowerCase() === normalizedCandidate);
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase();
    const partial = animations.find((clip) => clip.name.trim().toLowerCase().includes(normalizedCandidate));
    if (partial) return partial;
  }
  return null;
}

function findRightHandTarget(model: THREE.Object3D): THREE.Object3D | null {
  const preferred = [
    "mixamorigrighthand",
    "righthand",
    "handr",
    "rhand",
    "defhandr",
  ];
  let partial: THREE.Object3D | null = null;
  model.traverse((object) => {
    const normalized = object.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!normalized) return;
    if (preferred.includes(normalized)) {
      partial = object;
      return;
    }
    if (!partial && (normalized.includes("righthand") || normalized.endsWith("handr"))) {
      partial = object;
    }
  });
  return partial;
}

function attachHumanAvatarModel(rig: AvatarRig, template: HumanAvatarTemplate): void {
  if (rig.modelRoot) return;

  const model = cloneSkeleton(template.scene) as THREE.Group;
  model.name = "vectoplan-human-avatar-model";
  // The imported Mixamo rig already matches the editor forward axis; the avatar root owns realtime yaw.
  const architecturalWhite = new THREE.MeshPhysicalMaterial({
    name: "vectoplan-avatar-architectural-white",
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.8,
  });
  rig.materials.push(architecturalWhite);
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.material = Array.isArray(object.material)
        ? object.material.map(() => architecturalWhite)
        : architecturalWhite;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    }
  });

  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const initialHeight = initialBounds.getSize(new THREE.Vector3()).y;
  if (Number.isFinite(initialHeight) && initialHeight > 0.01) {
    model.scale.setScalar(AVATAR_HEIGHT / initialHeight);
  }
  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  model.position.y -= scaledBounds.min.y;

  const modelRoot = new THREE.Group();
  modelRoot.name = "vectoplan-human-avatar";
  modelRoot.add(model);
  rig.root.add(modelRoot);
  rig.modelRoot = modelRoot;
  rig.modelRightHand = findRightHandTarget(model);
  rig.body.visible = false;

  const mixer = new THREE.AnimationMixer(model);
  const idleClip = findAnimationClip(template.animations, ["idle"]);
  const walkClip = findAnimationClip(template.animations, ["walk"]);
  const runClip = findAnimationClip(template.animations, ["run", "sprint"]);
  const jumpClip = findAnimationClip(template.animations, ["jump", "fall", "airborne"]);
  const fallbackClip = idleClip ?? walkClip ?? runClip ?? template.animations[0] ?? null;

  const actionFor = (clip: THREE.AnimationClip | null): THREE.AnimationAction | undefined => {
    if (!clip) return undefined;
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.setLoop(THREE.LoopRepeat, Infinity);
    return action;
  };

  rig.mixer = mixer;
  rig.actions = {
    idle: actionFor(idleClip ?? fallbackClip),
    walk: actionFor(walkClip ?? idleClip ?? fallbackClip),
    run: actionFor(runClip ?? walkClip ?? idleClip ?? fallbackClip),
    jump: actionFor(jumpClip ?? idleClip ?? fallbackClip),
  };
  rig.hasJumpClip = Boolean(jumpClip);
  rig.activeAction = rig.actions.idle ?? null;
  rig.animationState = "idle";
  rig.activeAction?.reset().fadeIn(0.01).play();
}

function selectAnimationState(rig: AvatarRig, speed: number): AvatarAnimationState {
  if (rig.movementMode !== "grounded") return "jump";
  if (speed >= WALK_TO_RUN_SPEED) return "run";
  if (speed > 0.08) return "walk";
  return "idle";
}

function updateHumanAvatarAnimation(rig: AvatarRig, speed: number, dt: number): void {
  if (!rig.mixer || !rig.modelRoot) return;

  const desiredState = selectAnimationState(rig, speed);
  const desiredAction = rig.actions[desiredState] ?? rig.actions.idle ?? null;
  if (desiredAction && desiredAction !== rig.activeAction) {
    rig.activeAction?.fadeOut(0.18);
    desiredAction.reset().fadeIn(0.18).play();
    rig.activeAction = desiredAction;
  }
  rig.animationState = desiredState;

  if (rig.activeAction) {
    const playbackRate =
      desiredState === "run"
        ? THREE.MathUtils.clamp(speed / 6.2, 0.72, 1.5)
        : desiredState === "walk"
          ? THREE.MathUtils.clamp(speed / 2.6, 0.65, 1.45)
          : 1;
    rig.activeAction.setEffectiveTimeScale(playbackRate);
  }

  const flying = rig.movementMode === "flying";
  const airborneWithoutClip = desiredState === "jump" && !rig.hasJumpClip;
  rig.modelRoot.rotation.x = damp(
    rig.modelRoot.rotation.x,
    flying ? -0.42 : airborneWithoutClip ? -0.1 : 0,
    9,
    dt,
  );
  rig.modelRoot.rotation.z = damp(rig.modelRoot.rotation.z, 0, 10, dt);
  rig.modelRoot.position.y = damp(
    rig.modelRoot.position.y,
    airborneWithoutClip ? Math.min(0.055, Math.abs(rig.targetVelocity.y) * 0.012) : 0,
    12,
    dt,
  );
  rig.mixer.update(Math.max(0, dt));
}

function animateRig(rig: AvatarRig, dt: number, nowMs: number): void {
  const speed = Math.hypot(rig.targetVelocity.x, rig.targetVelocity.z);
  const amount = THREE.MathUtils.smoothstep(speed, 0.04, 3.6);
  const flying = rig.movementMode === "flying";
  const grounded = rig.movementMode === "grounded";
  const moving = speed > 0.04;
  updateHumanAvatarAnimation(rig, speed, dt);
  rig.phase += dt * (moving ? 4.8 + Math.min(speed, 5) * 1.35 : 1.15);
  const cycle = Math.sin(rig.phase);
  const stride = grounded ? cycle * amount * 0.72 : 0;

  rig.leftShoulder.rotation.x = damp(rig.leftShoulder.rotation.x, flying ? -0.72 : -stride * 0.74, 12, dt);
  rig.rightShoulder.rotation.x = damp(rig.rightShoulder.rotation.x, flying ? -0.72 : stride * 0.74, 12, dt);
  rig.leftHip.rotation.x = damp(rig.leftHip.rotation.x, flying ? 0.16 : stride, 14, dt);
  rig.rightHip.rotation.x = damp(rig.rightHip.rotation.x, flying ? -0.05 : -stride, 14, dt);
  rig.leftKnee.rotation.x = damp(
    rig.leftKnee.rotation.x,
    grounded ? Math.max(0, Math.sin(rig.phase)) * amount * 0.72 : flying ? 0.32 : 0.18,
    16,
    dt,
  );
  rig.rightKnee.rotation.x = damp(
    rig.rightKnee.rotation.x,
    grounded ? Math.max(0, -Math.sin(rig.phase)) * amount * 0.72 : flying ? 0.24 : 0.18,
    16,
    dt,
  );

  const bob = grounded && moving ? Math.abs(cycle) * amount * 0.045 : 0;
  const breath = Math.sin(nowMs * 0.0017 + rig.idlePhase);
  rig.body.position.y = damp(rig.body.position.y, bob, 14, dt);
  rig.body.rotation.x = damp(rig.body.rotation.x, flying ? -0.34 : Math.min(0.1, speed * 0.025), 8, dt);
  rig.body.rotation.z = damp(rig.body.rotation.z, grounded ? Math.cos(rig.phase) * amount * 0.018 : 0, 9, dt);
  rig.body.scale.y = 1 + breath * (moving ? 0.002 : 0.006);
  rig.body.scale.x = 1 - breath * (moving ? 0.0008 : 0.002);
}

function updateHeldItemMount(rig: AvatarRig, deltaSeconds: number, nowMs: number): void {
  const hand = rig.modelRightHand ?? rig.fallbackRightHand;
  hand.updateWorldMatrix(true, false);
  rig.root.updateWorldMatrix(true, false);
  hand.getWorldPosition(HELD_ITEM_WORLD_POSITION);
  rig.root.worldToLocal(HELD_ITEM_WORLD_POSITION);
  const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * 24);
  rig.heldItemMount.position.lerp(HELD_ITEM_WORLD_POSITION, blend);
  rig.heldItemMount.rotation.x = damp(rig.heldItemMount.rotation.x, -0.08, 18, deltaSeconds);
  rig.heldItemMount.rotation.y = damp(rig.heldItemMount.rotation.y, -0.18, 18, deltaSeconds);
  rig.heldItemMount.rotation.z = damp(rig.heldItemMount.rotation.z, 0.1, 18, deltaSeconds);
  rig.heldItemVisual.update(deltaSeconds, nowMs, rig.targetVelocity.length());
}

export function createRemoteAvatarScene(parent: THREE.Object3D): RemoteAvatarScene {
  const root = new THREE.Group();
  root.name = "vectoplan-remote-avatars";
  parent.add(root);
  const avatars = new Map<string, AvatarRig>();
  let destroyed = false;
  const templatePromise = loadHumanAvatarTemplate().catch(() => null);

  function remove(sessionId: string): void {
    const rig = avatars.get(sessionId);
    if (!rig) return;
    avatars.delete(sessionId);
    root.remove(rig.root);
    rig.mixer?.stopAllAction();
    rig.mixer = null;
    rig.activeAction = null;
    rig.heldItemVisual.destroy();
    const geometries = new Set<THREE.BufferGeometry>();
    rig.body.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    rig.materials.forEach((material) => material.dispose());
    rig.textures.forEach((texture) => texture.dispose());
  }

  function upsertMember(member: RealtimeMember): void {
    if (avatars.has(member.sessionId)) {
      if (member.state) applyPresence(member.state);
      return;
    }
    const rig = createRig(member);
    avatars.set(member.sessionId, rig);
    root.add(rig.root);
    void templatePromise.then((template) => {
      if (!template || destroyed || avatars.get(member.sessionId) !== rig) return;
      attachHumanAvatarModel(rig, template);
    });
  }

  function applyPresence(state: RealtimePresenceState): void {
    let rig = avatars.get(state.sessionId);
    if (!rig) {
      upsertMember({
        sessionId: state.sessionId,
        userId: state.userId,
        displayName: state.displayName,
        avatarColor: state.avatarColor,
        projectId: "",
        worldId: "",
        connectedAtMs: Date.now(),
        state,
      });
      rig = avatars.get(state.sessionId);
    }
    if (!rig) return;
    rig.targetPosition.set(state.position.x, state.position.y, state.position.z);
    rig.targetVelocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
    rig.targetYaw = state.yaw;
    rig.movementMode = state.movementMode;
    rig.heldItemVisual.setItem(state.heldItem);
    rig.lastUpdateAtMs = performance.now();
  }

  return {
    upsertMember,
    applyPresence,
    remove,
    update(deltaSeconds, nowMs): void {
      const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * 12);
      for (const [sessionId, rig] of avatars) {
        if (nowMs - rig.lastUpdateAtMs > STALE_AVATAR_MS) {
          remove(sessionId);
          continue;
        }
        rig.root.position.lerp(rig.targetPosition, blend);
        rig.root.rotation.y = dampAngle(rig.root.rotation.y, rig.targetYaw, 12, deltaSeconds);
        animateRig(rig, deltaSeconds, nowMs);
        updateHeldItemMount(rig, deltaSeconds, nowMs);
      }
    },
    setVisible(visible: boolean): void {
      root.visible = visible;
    },
    clear(): void {
      [...avatars.keys()].forEach(remove);
    },
    getCount: () => avatars.size,
    getPlayers(): readonly AvatarScenePlayerSnapshot[] {
      return [...avatars.values()].map((rig) => ({
        sessionId: rig.member.sessionId,
        userId: rig.member.userId,
        displayName: rig.member.displayName.trim() || "Gast",
        avatarColor: rig.member.avatarColor,
        position: { x: rig.targetPosition.x, y: rig.targetPosition.y, z: rig.targetPosition.z },
        velocity: { x: rig.targetVelocity.x, y: rig.targetVelocity.y, z: rig.targetVelocity.z },
        yaw: rig.targetYaw,
        movementMode: rig.movementMode,
        heldItem: rig.heldItemVisual.getItem(),
      }));
    },
    destroy(): void {
      destroyed = true;
      [...avatars.keys()].forEach(remove);
      parent.remove(root);
    },
  };
}
