import { storageService } from '../services/storageService';
import { StorageKeys } from '../constants/storageKeys';
import { User } from '../types/user';

/**
 * Acesso cru à lista de usuários. Não valida regras de negócio (duplicidade
 * de e-mail, força de senha etc.) — isso é responsabilidade do
 * `authService`/`userService`. Este arquivo só sabe ler e escrever.
 *
 * Futuramente, ao migrar para Django, cada método aqui vira uma chamada
 * HTTP (ex.: `findByEmail` -> `GET /users?email=...`), sem que
 * `authService`, `AuthContext` ou as telas precisem mudar.
 */
export const userRepository = {
  async getAll(): Promise<User[]> {
    return (await storageService.getItem<User[]>(StorageKeys.USERS)) ?? [];
  },

  async saveAll(users: User[]): Promise<void> {
    await storageService.setItem(StorageKeys.USERS, users);
  },

  async findById(id: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find((u) => u.id === id) ?? null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const users = await this.getAll();
    return users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  },

  async create(user: User): Promise<User> {
    const users = await this.getAll();
    users.push(user);
    await this.saveAll(users);
    return user;
  },

  async update(id: string, updates: Partial<Omit<User, 'id'>>): Promise<User | null> {
    const users = await this.getAll();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    const updated: User = { ...users[index], ...updates };
    users[index] = updated;
    await this.saveAll(users);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const users = await this.getAll();
    await this.saveAll(users.filter((u) => u.id !== id));
  },
};
