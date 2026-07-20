import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  AuthSessionDto,
  AuthenticatedUserDto,
  ProfileDto,
  StoredFileDto,
  UpdateProfileRequest,
  UserNoteDto,
  UserRole
} from "@door010/contracts";

const scrypt = promisify(scryptCallback);

export interface UserAccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccountRepository {
  create(record: UserAccountRecord): Promise<void>;
  findByEmail(email: string): Promise<UserAccountRecord | null>;
  findById(id: string): Promise<UserAccountRecord | null>;
  updateCredentials(
    userId: string,
    input: {
      passwordHash: string;
      active: boolean;
      updatedAt: string;
    }
  ): Promise<void>;
}

export interface UserRoleRepository {
  listByUserId(userId: string): Promise<readonly UserRole[]>;
  assign(userId: string, role: UserRole): Promise<void>;
}

export interface ProfileRepository {
  create(profile: ProfileDto): Promise<void>;
  findByUserId(userId: string): Promise<ProfileDto | null>;
  update(
    userId: string,
    input: UpdateProfileRequest
  ): Promise<ProfileDto>;
  updateFile(
    userId: string,
    field: "avatarObjectKey" | "cvObjectKey",
    objectKey: string | null
  ): Promise<ProfileDto>;
  delete(userId: string): Promise<void>;
}

export interface UserNoteRepository {
  create(note: UserNoteDto): Promise<void>;
  listByUserId(userId: string): Promise<readonly UserNoteDto[]>;
  update(
    userId: string,
    noteId: string,
    input: { title: string; content: string }
  ): Promise<UserNoteDto>;
  delete(userId: string, noteId: string): Promise<void>;
}

export interface ObjectStorage {
  put(input: {
    objectKey: string;
    content: Uint8Array;
    mimeType: string;
    originalFilename: string;
  }): Promise<StoredFileDto>;
  delete(objectKey: string): Promise<void>;
  createReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}

export interface TokenClaims {
  sub: string;
  email: string;
  roles: readonly UserRole[];
  exp: number;
}

export interface TokenService {
  issue(user: AuthenticatedUserDto): AuthSessionDto;
  verify(token: string): TokenClaims;
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export class HmacTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds = 3600
  ) {
    if (secret.length < 32) {
      throw new Error("AUTH_TOKEN_SECRET must contain at least 32 characters.");
    }
  }

  issue(user: AuthenticatedUserDto): AuthSessionDto {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const claims: TokenClaims = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      exp: Math.floor(expiresAt.getTime() / 1000)
    };
    const payload = encode(JSON.stringify(claims));
    const signature = createHmac("sha256", this.secret)
      .update(payload)
      .digest("base64url");

    return {
      accessToken: `${payload}.${signature}`,
      expiresAt: expiresAt.toISOString(),
      user
    };
  }

  verify(token: string): TokenClaims {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) {
      throw new Error("invalid_access_token");
    }

    const expected = createHmac("sha256", this.secret)
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new Error("invalid_access_token");
    }

    const claims = JSON.parse(decode(payload)) as TokenClaims;
    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error("access_token_expired");
    }
    return claims;
  }
}

export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, 64) as Buffer;
    return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [algorithm, saltText, hashText] = stored.split(":");
    if (algorithm !== "scrypt" || !saltText || !hashText) {
      return false;
    }
    const expected = Buffer.from(hashText, "base64url");
    const actual = await scrypt(
      password,
      Buffer.from(saltText, "base64url"),
      expected.length
    ) as Buffer;
    return timingSafeEqual(actual, expected);
  }
}

export class AuthService {
  constructor(
    private readonly users: UserAccountRepository,
    private readonly roles: UserRoleRepository,
    private readonly profiles: ProfileRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService
  ) {}

  async register(input: {
    email: string;
    password: string;
  }): Promise<AuthSessionDto> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new Error("email_already_registered");
    }

    const now = new Date().toISOString();
    const userId = globalThis.crypto.randomUUID();
    await this.users.create({
      id: userId,
      email,
      passwordHash: await this.hasher.hash(input.password),
      active: true,
      createdAt: now,
      updatedAt: now
    });
    await this.roles.assign(userId, "candidate");

    await this.profiles.create({
      id: globalThis.crypto.randomUUID(),
      userId,
      knownSlots: {},
      testCompleted: false,
      createdAt: now,
      updatedAt: now
    });

    return this.tokens.issue({
      id: userId,
      email,
      roles: ["candidate"]
    });
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<AuthSessionDto> {
    const user = await this.users.findByEmail(
      input.email.trim().toLowerCase()
    );
    if (
      !user ||
      !user.active ||
      !(await this.hasher.verify(input.password, user.passwordHash))
    ) {
      throw new Error("invalid_credentials");
    }

    return this.tokens.issue({
      id: user.id,
      email: user.email,
      roles: await this.roles.listByUserId(user.id)
    });
  }

  async provisionPublicDemoAccount(input: {
    email: string;
    password: string;
    roles: readonly UserRole[];
  }): Promise<AuthSessionDto> {
    const email = input.email.trim().toLowerCase();
    const now = new Date().toISOString();
    let user = await this.users.findByEmail(email);

    if (user) {
      await this.users.updateCredentials(user.id, {
        passwordHash: await this.hasher.hash(input.password),
        active: true,
        updatedAt: now
      });
    } else {
      user = {
        id: globalThis.crypto.randomUUID(),
        email,
        passwordHash: await this.hasher.hash(input.password),
        active: true,
        createdAt: now,
        updatedAt: now
      };
      await this.users.create(user);
    }

    if (!(await this.profiles.findByUserId(user.id))) {
      await this.profiles.create({
        id: globalThis.crypto.randomUUID(),
        userId: user.id,
        knownSlots: {},
        testCompleted: false,
        createdAt: now,
        updatedAt: now
      });
    }

    for (const role of input.roles) {
      await this.roles.assign(user.id, role);
    }

    return this.login({ email, password: input.password });
  }

  async me(token: string): Promise<AuthenticatedUserDto> {
    const claims = this.tokens.verify(token);
    return {
      id: claims.sub,
      email: claims.email,
      roles: claims.roles
    };
  }
}

export class AuthorizationService {
  requireAuthenticated(claims: TokenClaims | undefined): TokenClaims {
    if (!claims) {
      throw new Error("authentication_required");
    }
    return claims;
  }

  requireAnyRole(
    claims: TokenClaims | undefined,
    allowed: readonly UserRole[]
  ): TokenClaims {
    const authenticated = this.requireAuthenticated(claims);
    if (!authenticated.roles.some((role) => allowed.includes(role))) {
      throw new Error("forbidden");
    }
    return authenticated;
  }

  requireSelfOrRole(
    claims: TokenClaims | undefined,
    targetUserId: string,
    allowed: readonly UserRole[]
  ): TokenClaims {
    const authenticated = this.requireAuthenticated(claims);
    if (
      authenticated.sub !== targetUserId &&
      !authenticated.roles.some((role) => allowed.includes(role))
    ) {
      throw new Error("forbidden");
    }
    return authenticated;
  }
}

export class ProfileService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly notes: UserNoteRepository,
    private readonly storage: ObjectStorage
  ) {}

  async get(userId: string): Promise<ProfileDto> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) {
      throw new Error("profile_not_found");
    }
    return profile;
  }

  update(
    userId: string,
    input: UpdateProfileRequest
  ): Promise<ProfileDto> {
    return this.profiles.update(userId, input);
  }

  async uploadFile(input: {
    userId: string;
    kind: "avatar" | "cv";
    originalFilename: string;
    mimeType: string;
    content: Uint8Array;
  }): Promise<{ profile: ProfileDto; file: StoredFileDto }> {
    const allowed = input.kind === "avatar"
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["application/pdf"];

    if (!allowed.includes(input.mimeType)) {
      throw new Error("unsupported_file_type");
    }

    const maxBytes = input.kind === "avatar" ? 5_000_000 : 15_000_000;
    if (input.content.byteLength > maxBytes) {
      throw new Error("file_too_large");
    }

    const objectKey = [
      "profiles",
      input.userId,
      input.kind,
      globalThis.crypto.randomUUID()
    ].join("/");

    const file = await this.storage.put({
      objectKey,
      content: input.content,
      mimeType: input.mimeType,
      originalFilename: input.originalFilename
    });
    const profile = await this.profiles.updateFile(
      input.userId,
      input.kind === "avatar" ? "avatarObjectKey" : "cvObjectKey",
      objectKey
    );
    return { profile, file };
  }

  async createFileUrl(
    userId: string,
    kind: "avatar" | "cv"
  ): Promise<string> {
    const profile = await this.get(userId);
    const key = kind === "avatar"
      ? profile.avatarObjectKey
      : profile.cvObjectKey;
    if (!key) {
      throw new Error("file_not_found");
    }
    return this.storage.createReadUrl(key, 900);
  }

  async createNote(
    userId: string,
    input: { title: string; content: string }
  ): Promise<UserNoteDto> {
    const now = new Date().toISOString();
    const note: UserNoteDto = {
      id: globalThis.crypto.randomUUID(),
      userId,
      title: input.title.trim(),
      content: input.content.trim(),
      createdAt: now,
      updatedAt: now
    };
    await this.notes.create(note);
    return note;
  }

  listNotes(userId: string): Promise<readonly UserNoteDto[]> {
    return this.notes.listByUserId(userId);
  }

  updateNote(
    userId: string,
    noteId: string,
    input: { title: string; content: string }
  ): Promise<UserNoteDto> {
    return this.notes.update(userId, noteId, input);
  }

  deleteNote(userId: string, noteId: string): Promise<void> {
    return this.notes.delete(userId, noteId);
  }

  deleteProfile(userId: string): Promise<void> {
    return this.profiles.delete(userId);
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredFileDto>();

  async put(input: {
    objectKey: string;
    content: Uint8Array;
    mimeType: string;
    originalFilename: string;
  }): Promise<StoredFileDto> {
    const file: StoredFileDto = {
      objectKey: input.objectKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.content.byteLength
    };
    this.objects.set(input.objectKey, file);
    return file;
  }

  async delete(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }

  async createReadUrl(objectKey: string): Promise<string> {
    if (!this.objects.has(objectKey)) {
      throw new Error("file_not_found");
    }
    return `memory://${objectKey}`;
  }
}


export class InMemoryUserAccountRepository
  implements UserAccountRepository
{
  private readonly records = new Map<string, UserAccountRecord>();

  async create(record: UserAccountRecord): Promise<void> {
    if ([...this.records.values()].some(
      (item) => item.email === record.email
    )) {
      throw new Error("email_already_registered");
    }
    this.records.set(record.id, record);
  }

  async findByEmail(email: string): Promise<UserAccountRecord | null> {
    return [...this.records.values()].find(
      (record) => record.email === email
    ) ?? null;
  }

  async findById(id: string): Promise<UserAccountRecord | null> {
    return this.records.get(id) ?? null;
  }

  async updateCredentials(
    userId: string,
    input: {
      passwordHash: string;
      active: boolean;
      updatedAt: string;
    }
  ): Promise<void> {
    const current = this.records.get(userId);
    if (!current) throw new Error("user_not_found");
    this.records.set(userId, { ...current, ...input });
  }
}

export class InMemoryUserRoleRepository
  implements UserRoleRepository
{
  private readonly roles = new Map<string, Set<UserRole>>();

  async listByUserId(userId: string): Promise<readonly UserRole[]> {
    return [...(this.roles.get(userId) ?? new Set<UserRole>())];
  }

  async assign(userId: string, role: UserRole): Promise<void> {
    const values = this.roles.get(userId) ?? new Set<UserRole>();
    values.add(role);
    this.roles.set(userId, values);
  }
}

export class InMemoryProfileRepository
  implements ProfileRepository
{
  private readonly profiles = new Map<string, ProfileDto>();

  async create(profile: ProfileDto): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }

  async findByUserId(userId: string): Promise<ProfileDto | null> {
    return this.profiles.get(userId) ?? null;
  }

  async update(
    userId: string,
    input: UpdateProfileRequest
  ): Promise<ProfileDto> {
    const current = this.profiles.get(userId);
    if (!current) throw new Error("profile_not_found");

    const updated: ProfileDto = {
      ...current,
      firstName: input.firstName === null
        ? undefined
        : input.firstName ?? current.firstName,
      lastName: input.lastName === null
        ? undefined
        : input.lastName ?? current.lastName,
      phone: input.phone === null
        ? undefined
        : input.phone ?? current.phone,
      bio: input.bio === null
        ? undefined
        : input.bio ?? current.bio,
      preferredSector: input.preferredSector === null
        ? undefined
        : input.preferredSector ?? current.preferredSector,
      updatedAt: new Date().toISOString()
    };
    this.profiles.set(userId, updated);
    return updated;
  }

  async updateFile(
    userId: string,
    field: "avatarObjectKey" | "cvObjectKey",
    objectKey: string | null
  ): Promise<ProfileDto> {
    const current = this.profiles.get(userId);
    if (!current) throw new Error("profile_not_found");
    const updated = {
      ...current,
      [field]: objectKey ?? undefined,
      updatedAt: new Date().toISOString()
    };
    this.profiles.set(userId, updated);
    return updated;
  }

  async delete(userId: string): Promise<void> {
    this.profiles.delete(userId);
  }
}

export class InMemoryUserNoteRepository
  implements UserNoteRepository
{
  private readonly notes = new Map<string, UserNoteDto>();

  async create(note: UserNoteDto): Promise<void> {
    this.notes.set(note.id, note);
  }

  async listByUserId(userId: string): Promise<readonly UserNoteDto[]> {
    return [...this.notes.values()]
      .filter((note) => note.userId === userId)
      .sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      );
  }

  async update(
    userId: string,
    noteId: string,
    input: { title: string; content: string }
  ): Promise<UserNoteDto> {
    const current = this.notes.get(noteId);
    if (!current || current.userId !== userId) {
      throw new Error("note_not_found");
    }
    const updated: UserNoteDto = {
      ...current,
      title: input.title.trim(),
      content: input.content.trim(),
      updatedAt: new Date().toISOString()
    };
    this.notes.set(noteId, updated);
    return updated;
  }

  async delete(userId: string, noteId: string): Promise<void> {
    const current = this.notes.get(noteId);
    if (!current || current.userId !== userId) {
      throw new Error("note_not_found");
    }
    this.notes.delete(noteId);
  }
}


export class FileSystemObjectStorage implements ObjectStorage {
  constructor(private readonly rootDirectory: string) {}

  async put(input: {
    objectKey: string;
    content: Uint8Array;
    mimeType: string;
    originalFilename: string;
  }): Promise<StoredFileDto> {
    const target = resolve(this.rootDirectory, input.objectKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.content);
    await writeFile(
      `${target}.metadata.json`,
      JSON.stringify({
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.content.byteLength
      })
    );
    return {
      objectKey: input.objectKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.content.byteLength
    };
  }

  async delete(objectKey: string): Promise<void> {
    const target = resolve(this.rootDirectory, objectKey);
    await Promise.all([
      rm(target, { force: true }),
      rm(`${target}.metadata.json`, { force: true })
    ]);
  }

  async createReadUrl(objectKey: string): Promise<string> {
    const target = resolve(this.rootDirectory, objectKey);
    await readFile(target);
    return `file://${target}`;
  }
}
